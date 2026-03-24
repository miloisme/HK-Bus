import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Company = 'KMB' | 'CTB' | 'NLB';

export interface Route {
  company: Company;
  route: string;
  routeId?: string; // NLB specific
  orig: string;
  dest: string;
  bound?: string; // KMB specific ('I' or 'O')
  serviceType?: string; // KMB specific
}

export interface Stop {
  company: Company;
  stopId: string;
  name: string;
  seq: number;
  lat?: string;
  long?: string;
}

export interface ETA {
  company: Company;
  route: string;
  dir: string;
  dest: string;
  eta: string | null;
  rmk: string;
  timestamp: string;
}

const API_BASE = {
  KMB: 'https://rt.data.gov.hk/v1/transport/kmb',
  CTB: 'https://rt.data.gov.hk/v2/transport/citybus',
  NLB: 'https://rt.data.gov.hk/v2/transport/nlb',
};

// Helper for resilient fetching
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (i === retries) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (i === retries) throw err;
      // Wait a bit before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Fetch failed after retries');
}

// Caching routes in memory to avoid fetching multiple times
let cachedRoutes: Route[] | null = null;
let allKmbStopsCache: Stop[] | null = null;

export async function getAllRoutes(): Promise<Route[]> {
  if (cachedRoutes) return cachedRoutes;

  const routes: Route[] = [];

  try {
    // Fetch KMB via local proxy
    const kmbRes = await fetchWithRetry("/api/kmb/route");
    const kmbData = await kmbRes.json();
    if (kmbData && kmbData.data) {
      kmbData.data.forEach((r: any) => {
        routes.push({
          company: 'KMB',
          route: r.route,
          orig: r.orig_tc,
          dest: r.dest_tc,
          bound: r.bound,
          serviceType: r.service_type,
        });
      });
    }

    // Fetch CTB
    const ctbRes = await fetchWithRetry(`${API_BASE.CTB}/route/ctb`);
    const ctbData = await ctbRes.json();
    if (ctbData && ctbData.data) {
      ctbData.data.forEach((r: any) => {
        routes.push({
          company: 'CTB',
          route: r.route,
          orig: r.orig_tc,
          dest: r.dest_tc,
        });
      });
    }

    // Fetch NLB
    const nlbRes = await fetchWithRetry(`${API_BASE.NLB}/route.php?action=list`);
    const nlbData = await nlbRes.json();
    if (nlbData && nlbData.routes) {
      nlbData.routes.forEach((r: any) => {
        const parts = r.routeName_c.split('>');
        const orig = parts[0]?.trim() || '';
        const dest = parts[1]?.trim() || '';
        routes.push({
          company: 'NLB',
          route: r.routeNo,
          routeId: r.routeId,
          orig,
          dest,
        });
      });
    }

    cachedRoutes = routes;
  } catch (err) {
    console.error('Failed to fetch routes', err);
  }

  return routes;
}

export async function getRouteStops(route: Route, dir: 'inbound' | 'outbound'): Promise<Stop[]> {
  const stops: Stop[] = [];

  try {
    if (route.company === 'KMB') {
      const bound = dir === 'inbound' ? 'inbound' : 'outbound';
      const res = await fetchWithRetry(`/api/kmb/route-stop/${route.route}/${bound}/${route.serviceType || '1'}`);
      const data = await res.json();
      
      if (data && data.data) {
        // Fetch stop names in parallel, chunks of 10 to avoid overwhelming the browser
        const stopIds = data.data.map((s: any) => s.stop);
        const stopNames: Record<string, string> = {};
        
        for (let i = 0; i < stopIds.length; i += 10) {
          const chunk = stopIds.slice(i, i + 10);
          await Promise.all(
            chunk.map(async (id: string) => {
              try {
                const sRes = await fetchWithRetry(`/api/kmb/stop/${id}`);
                const sData = await sRes.json();
                if (sData && sData.data) {
                  stopNames[id] = sData.data.name_tc;
                }
              } catch (e) {
                console.error('Failed to fetch KMB stop', id);
              }
            })
          );
        }
        
        data.data.forEach((s: any) => {
          stops.push({
            company: 'KMB',
            stopId: s.stop,
            name: stopNames[s.stop] || s.stop,
            seq: parseInt(s.seq, 10),
          });
        });
      }
    } else if (route.company === 'CTB') {
      const bound = dir === 'inbound' ? 'inbound' : 'outbound';
      const res = await fetchWithRetry(`${API_BASE.CTB}/route-stop/ctb/${route.route}/${bound}`);
      const data = await res.json();
      
      if (data && data.data) {
        // Fetch stop names in parallel, chunks of 10 to avoid overwhelming the browser
        const stopIds = data.data.map((s: any) => s.stop);
        const stopNames: Record<string, string> = {};
        
        for (let i = 0; i < stopIds.length; i += 10) {
          const chunk = stopIds.slice(i, i + 10);
          await Promise.all(
            chunk.map(async (id: string) => {
              try {
                const sRes = await fetchWithRetry(`${API_BASE.CTB}/stop/${id}`);
                const sData = await sRes.json();
                if (sData && sData.data) {
                  stopNames[id] = sData.data.name_tc;
                }
              } catch (e) {
                console.error('Failed to fetch CTB stop', id);
              }
            })
          );
        }

        data.data.forEach((s: any) => {
          stops.push({
            company: 'CTB',
            stopId: s.stop,
            name: stopNames[s.stop] || s.stop,
            seq: parseInt(s.seq, 10),
          });
        });
      }
    } else if (route.company === 'NLB') {
      // NLB doesn't use inbound/outbound in the same way, the routeId determines the direction
      const res = await fetchWithRetry(`${API_BASE.NLB}/stop.php?action=list&routeId=${route.routeId}`);
      const data = await res.json();
      
      if (data && data.stops) {
        data.stops.forEach((s: any) => {
          stops.push({
            company: 'NLB',
            stopId: s.stopId,
            name: s.stopName_c,
            seq: parseInt(s.stopSequence, 10) || stops.length + 1,
          });
        });
      }
    }
  } catch (err) {
    console.error('Failed to fetch route stops', err);
  }

  return stops.sort((a, b) => a.seq - b.seq);
}

export async function getStopName(company: Company, stopId: string): Promise<string> {
  if (company === 'KMB') {
    try {
      const res = await fetchWithRetry(`/api/kmb/stop/${stopId}`);
      const data = await res.json();
      return data?.data?.name_tc || stopId;
    } catch {
      return stopId;
    }
  } else if (company === 'CTB') {
    try {
      const res = await fetchWithRetry(`${API_BASE.CTB}/stop/${stopId}`);
      const data = await res.json();
      return data?.data?.name_tc || stopId;
    } catch {
      return stopId;
    }
  }
  return stopId;
}

export async function getAllKmbStops(): Promise<Stop[]> {
  if (allKmbStopsCache) return allKmbStopsCache;
  try {
    // Use local proxy to avoid CORS and handle large payload
    const res = await fetchWithRetry("/api/kmb/stop");
    const data = await res.json();
    if (data && data.data) {
      const stops = data.data.map((s: any) => ({
        company: 'KMB' as Company,
        stopId: s.stop,
        name: s.name_tc,
        seq: 0, // not applicable for general stop list
        lat: s.lat,
        long: s.long,
      }));
      allKmbStopsCache = stops;
      return stops;
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch all KMB stops:', err);
    return [];
  }
}

export async function getStopETAs(company: Company, stopId: string): Promise<ETA[]> {
  const etas: ETA[] = [];
  try {
    if (company === 'KMB') {
      const res = await fetchWithRetry(`/api/kmb/stop-eta/${stopId}`);
      const data = await res.json();
      if (data && data.data) {
        data.data.forEach((e: any) => {
          etas.push({
            company: 'KMB',
            route: e.route,
            dir: e.dir === 'I' ? 'inbound' : 'outbound',
            dest: e.dest_tc,
            eta: e.eta,
            rmk: e.rmk_tc,
            timestamp: e.data_timestamp,
          });
        });
      }
    } else if (company === 'CTB') {
      const res = await fetchWithRetry(`${API_BASE.CTB}/eta/ctb/${stopId}`);
      const data = await res.json();
      if (data && data.data) {
        data.data.forEach((e: any) => {
          etas.push({
            company: 'CTB',
            route: e.route,
            dir: e.dir === 'I' ? 'inbound' : 'outbound',
            dest: e.dest_tc,
            eta: e.eta,
            rmk: e.rmk_tc,
            timestamp: e.data_timestamp,
          });
        });
      }
    } else if (company === 'NLB') {
      // NLB doesn't have a stop-eta API without routeId, but let's check if it does.
      // Actually, NLB stop-eta requires routeId. We can't easily get all ETAs for a stop.
    }
  } catch (err) {
    console.error('Failed to fetch stop ETAs', err);
  }
  return etas;
}

export async function getETA(route: Route, stopId: string, dir: 'inbound' | 'outbound'): Promise<ETA[]> {
  const etas: ETA[] = [];
  
  try {
    if (route.company === 'KMB') {
      const res = await fetchWithRetry(`/api/kmb/eta/${stopId}/${route.route}/${route.serviceType || '1'}`);
      const data = await res.json();
      if (data && data.data) {
        const targetDir = dir === 'inbound' ? 'I' : 'O';
        data.data.forEach((e: any) => {
          if (e.dir === targetDir) {
            etas.push({
              company: 'KMB',
              route: e.route,
              dir: e.dir,
              dest: e.dest_tc,
              eta: e.eta,
              rmk: e.rmk_tc,
              timestamp: e.data_timestamp,
            });
          }
        });
      }
    } else if (route.company === 'CTB') {
      const res = await fetchWithRetry(`${API_BASE.CTB}/eta/ctb/${stopId}/${route.route}`);
      const data = await res.json();
      if (data && data.data) {
        const targetDir = dir === 'inbound' ? 'I' : 'O';
        data.data.forEach((e: any) => {
          if (e.dir === targetDir) {
            etas.push({
              company: 'CTB',
              route: e.route,
              dir: e.dir,
              dest: e.dest_tc,
              eta: e.eta,
              rmk: e.rmk_tc,
              timestamp: e.data_timestamp,
            });
          }
        });
      }
    } else if (route.company === 'NLB') {
      const res = await fetchWithRetry(`${API_BASE.NLB}/stop.php?action=eta&routeId=${route.routeId}&stopId=${stopId}`);
      const data = await res.json();
      if (data && data.estimatedArrivals) {
        data.estimatedArrivals.forEach((e: any) => {
          etas.push({
            company: 'NLB',
            route: route.route,
            dir: '',
            dest: route.dest,
            eta: e.estimatedArrivalTime,
            rmk: e.routeVariantName_c || '',
            timestamp: new Date().toISOString(),
          });
        });
      }
    }
  } catch (err) {
    console.error('Failed to fetch ETA', err);
  }

  return etas;
}
