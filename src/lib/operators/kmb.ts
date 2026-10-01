import { fetchJson } from '../http';
import { persisted } from '../cache';
import { mapWithConcurrency } from '../concurrency';
import type { Stop, VariantRef } from '../types';
import { directionOf, toNumber, variantId, type OperatorAdapter } from './adapter';

const OFFICIAL = 'https://data.etabus.gov.hk/v1/transport/kmb';

/**
 * 開發時經 Express proxy 取得（可繞開 CORS 與大型 payload 問題）；
 * GitHub Pages 是純靜態站，沒有 proxy，只能直接呼叫。
 */
const isStaticHost = window.location.hostname.includes('github.io');

const url = (path: string) => (isStaticHost ? `${OFFICIAL}/${path}` : `/api/kmb/${path}`);

const DAY = 24 * 60 * 60 * 1000;

// ---- 上游回應結構（對應 KMB API v1 規格）----

interface KmbRoute {
  route: string;
  bound: 'I' | 'O';
  service_type: number;
  orig_tc: string;
  dest_tc: string;
}

interface KmbRouteStopEntry {
  stop: string;
  seq: number;
}

interface KmbStop {
  name_tc: string;
  lat: string;
  long: string;
}

interface KmbEtaEntry {
  route: string;
  dir: 'I' | 'O';
  dest_tc: string;
  eta: string | null;
  rmk_tc: string | null;
  data_timestamp: string;
}

const asRef = (r: KmbRoute): VariantRef => ({
  company: 'KMB',
  route: r.route,
  bound: r.bound,
  serviceType: String(r.service_type),
});

const asStop = (company: 'KMB', stopId: string, name: string, seq: number, raw?: KmbStop): Stop => ({
  company,
  stopId,
  name,
  seq,
  lat: toNumber(raw?.lat),
  long: toNumber(raw?.long),
});

/** 站名幾乎不變，但變動頻率極低，值得長期快取 */
function fetchStopName(stopId: string, signal?: AbortSignal): Promise<string> {
  return persisted('kmb-stop-name', stopId, 30 * DAY, async () => {
    const data = await fetchJson<{ data?: KmbStop }>(url(`stop/${stopId}`), { signal });
    return data?.data?.name_tc ?? stopId;
  });
}

export const kmbAdapter: OperatorAdapter = {
  meta: {
    id: 'KMB',
    nameTc: '九巴',
    badgeClass: 'bg-red-100 text-red-700',
  },

  async listRoutes(signal) {
    return persisted('kmb-routes', 'all', DAY, async () => {
      const data = await fetchJson<{ data?: KmbRoute[] }>(url('route'), { signal });
      return (data?.data ?? []).map((r) => ({
        id: variantId(asRef(r)),
        company: 'KMB' as const,
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
    if (!first || first.company !== 'KMB') return [...variants];

    // 方向切換只在同一路線號碼、同一服務類型內進行
    const all = await this.listRoutes(signal);
    return all.filter((variant) => {
      const ref = variant.ref;
      return (
        ref.company === 'KMB' && ref.route === first.route && ref.serviceType === first.serviceType
      );
    });
  },

  async listStops(variant, signal) {
    const ref = variant.ref;
    if (ref.company !== 'KMB') return [];

    return persisted('kmb-route-stop', variant.id, DAY, async () => {
      const bound = ref.bound === 'I' ? 'inbound' : 'outbound';
      const data = await fetchJson<{ data?: KmbRouteStopEntry[] }>(
        url(`route-stop/${ref.route}/${bound}/${ref.serviceType}`),
        { signal },
      );
      const entries = data?.data ?? [];
      if (entries.length === 0) return [];

      const names = await mapWithConcurrency(entries, 8, (entry) =>
        fetchStopName(entry.stop, signal).catch(() => entry.stop),
      );

      return entries.map((entry, index) =>
        asStop('KMB', entry.stop, names[index] ?? entry.stop, toNumber(entry.seq) ?? index + 1),
      );
    });
  },

  async getVariantEtas(variant, stop, signal) {
    const ref = variant.ref;
    if (ref.company !== 'KMB') return [];

    const data = await fetchJson<{ data?: KmbEtaEntry[] }>(
      url(`eta/${stop.stopId}/${ref.route}/${ref.serviceType}`),
      { signal, timeoutMs: 8_000, retries: 1 },
    );

    return (data?.data ?? [])
      .filter((e) => e.dir === ref.bound)
      .map((e) => ({
        company: 'KMB' as const,
        route: e.route,
        dir: directionOf(e.dir),
        dest: e.dest_tc,
        eta: e.eta,
        rmk: e.rmk_tc ?? '',
        timestamp: e.data_timestamp,
      }));
  },

  async getStopEtas(stopId, signal) {
    const data = await fetchJson<{ data?: KmbEtaEntry[] }>(url(`stop-eta/${stopId}`), {
      signal,
      timeoutMs: 8_000,
      retries: 1,
    });

    return (data?.data ?? []).map((e) => ({
      company: 'KMB' as const,
      route: e.route,
      dir: directionOf(e.dir),
      dest: e.dest_tc,
      eta: e.eta,
      rmk: e.rmk_tc ?? '',
      timestamp: e.data_timestamp,
    }));
  },

  async listAllStops(signal) {
    // /stop 回應數 MB，每次刷新重下太浪費；快取一天
    return persisted('kmb-stops', 'all', DAY, async () => {
      const data = await fetchJson<{ data?: Array<KmbStop & { stop: string }> }>(url('stop'), {
        signal,
        timeoutMs: 30_000,
        retries: 2,
      });

      return (data?.data ?? []).map((s) => asStop('KMB', s.stop, s.name_tc, 0, s));
    });
  },
};
