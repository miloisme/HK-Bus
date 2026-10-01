import { fetchJson } from '../http';
import { persisted } from '../cache';
import { mapWithConcurrency } from '../concurrency';
import type { Stop, VariantRef } from '../types';
import { directionOf, toNumber, variantId, type OperatorAdapter } from './adapter';

const BASE = 'https://rt.data.gov.hk/v2/transport/citybus';
const DAY = 24 * 60 * 60 * 1000;

// ---- 上游回應結構（對應城巴 API v2 規格）----

interface CtbRoute {
  route: string;
  bound: 'I' | 'O';
  orig_tc: string;
  dest_tc: string;
}

interface CtbRouteStopEntry {
  stop: string;
  seq: number;
}

interface CtbStop {
  name_tc: string;
  lat: string;
  long: string;
}

interface CtbEtaEntry {
  route: string;
  dir: 'I' | 'O';
  dest_tc: string;
  eta: string | null;
  rmk_tc: string | null;
  data_timestamp: string;
}

const url = (path: string) => `${BASE}/${path}`;

const asRef = (r: CtbRoute): VariantRef => ({
  company: 'CTB',
  route: r.route,
  bound: r.bound,
});

const asStop = (stopId: string, name: string, seq: number, raw?: CtbStop): Stop => ({
  company: 'CTB',
  stopId,
  name,
  seq,
  lat: toNumber(raw?.lat),
  long: toNumber(raw?.long),
});

function fetchStopName(stopId: string, signal?: AbortSignal): Promise<string> {
  return persisted('ctb-stop-name', stopId, 30 * DAY, async () => {
    const data = await fetchJson<{ data?: CtbStop }>(url(`stop/${stopId}`), { signal });
    return data?.data?.name_tc ?? stopId;
  });
}

export const ctbAdapter: OperatorAdapter = {
  meta: {
    id: 'CTB',
    nameTc: '城巴',
    badgeClass: 'bg-yellow-100 text-yellow-800',
  },

  async listRoutes(signal) {
    return persisted('ctb-routes', 'all', DAY, async () => {
      const data = await fetchJson<{ data?: CtbRoute[] }>(url('route/ctb'), { signal });
      return (data?.data ?? []).map((r) => ({
        id: variantId(asRef(r)),
        company: 'CTB' as const,
        route: r.route,
        dir: directionOf(r.bound),
        orig: r.orig_tc,
        dest: r.dest_tc,
        ref: asRef(r),
      }));
    });
  },

  async listVariants(variants, signal) {
    if (variants.length === 0) return [];
    const first = variants[0]?.ref;
    if (!first || first.company !== 'CTB') return [...variants];

    const all = await this.listRoutes(signal);
    return all.filter((variant) => {
      const ref = variant.ref;
      return ref.company === 'CTB' && ref.route === first.route;
    });
  },

  async listStops(variant, signal) {
    const ref = variant.ref;
    if (ref.company !== 'CTB') return [];

    return persisted('ctb-route-stop', variant.id, DAY, async () => {
      const bound = ref.bound === 'I' ? 'inbound' : 'outbound';
      const data = await fetchJson<{ data?: CtbRouteStopEntry[] }>(
        url(`route-stop/ctb/${ref.route}/${bound}`),
        { signal },
      );
      const entries = data?.data ?? [];
      if (entries.length === 0) return [];

      const names = await mapWithConcurrency(entries, 8, (entry) =>
        fetchStopName(entry.stop, signal).catch(() => entry.stop),
      );

      return entries.map((entry, index) =>
        asStop(entry.stop, names[index] ?? entry.stop, toNumber(entry.seq) ?? index + 1),
      );
    });
  },

  async getVariantEtas(variant, stop, signal) {
    const ref = variant.ref;
    if (ref.company !== 'CTB') return [];

    const data = await fetchJson<{ data?: CtbEtaEntry[] }>(
      url(`eta/ctb/${stop.stopId}/${ref.route}`),
      { signal, timeoutMs: 8_000, retries: 1 },
    );

    return (data?.data ?? [])
      .filter((e) => e.dir === ref.bound)
      .map((e) => ({
        company: 'CTB' as const,
        route: e.route,
        dir: directionOf(e.dir),
        dest: e.dest_tc,
        eta: e.eta,
        rmk: e.rmk_tc ?? '',
        timestamp: e.data_timestamp,
      }));
  },

  async getStopEtas(stopId, signal) {
    const data = await fetchJson<{ data?: CtbEtaEntry[] }>(url(`eta/ctb/${stopId}`), {
      signal,
      timeoutMs: 8_000,
      retries: 1,
    });

    return (data?.data ?? []).map((e) => ({
      company: 'CTB' as const,
      route: e.route,
      dir: directionOf(e.dir),
      dest: e.dest_tc,
      eta: e.eta,
      rmk: e.rmk_tc ?? '',
      timestamp: e.data_timestamp,
    }));
  },
};
