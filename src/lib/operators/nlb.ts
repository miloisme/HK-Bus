import { fetchJson } from '../http';
import { persisted } from '../cache';
import type { VariantRef } from '../types';
import { toNumber, variantId, type OperatorAdapter } from './adapter';

const BASE = 'https://rt.data.gov.hk/v2/transport/nlb';
const DAY = 24 * 60 * 60 * 1000;

// ---- 上游回應結構 ----

interface NlbRoute {
  routeNo: string;
  routeId: string;
  /** 以 "起點>終點" 合併表示的單向路線名稱 */
  routeName_c: string;
}

interface NlbStop {
  stopId: string;
  stopName_c: string;
  stopSequence: number | string;
}

interface NlbEtaEntry {
  estimatedArrivalTime: string;
  routeVariantName_c?: string | null;
}

export const nlbAdapter: OperatorAdapter = {
  meta: {
    id: 'NLB',
    nameTc: '大嶼山巴士',
    badgeClass: 'bg-teal-100 text-teal-700',
  },

  async listRoutes(signal) {
    return persisted('nlb-routes', 'all', DAY, async () => {
      const data = await fetchJson<{ routes?: NlbRoute[] }>(
        `${BASE}/route.php?action=list`,
        { signal },
      );

      return (data?.routes ?? []).map((r) => {
        const [orig = '', dest = ''] = r.routeName_c.split('>').map((part) => part.trim());
        const ref: VariantRef = { company: 'NLB', routeId: r.routeId };
        return {
          id: variantId(ref),
          company: 'NLB' as const,
          route: r.routeNo,
          // NLB 每條路線只有單一方向
          dir: 'outbound' as const,
          orig,
          dest,
          ref,
        };
      });
    });
  },

  // NLB 沒有方向區分，切換器不需要出現
  async listVariants(variants) {
    return [...variants];
  },

  async listStops(variant, signal) {
    const ref = variant.ref;
    if (ref.company !== 'NLB') return [];

    return persisted('nlb-route-stop', variant.id, DAY, async () => {
      const data = await fetchJson<{ stops?: NlbStop[] }>(
        `${BASE}/stop.php?action=list&routeId=${encodeURIComponent(ref.routeId)}`,
        { signal },
      );

      return (data?.stops ?? []).map((s, index) => ({
        company: 'NLB' as const,
        stopId: s.stopId,
        name: s.stopName_c,
        seq: toNumber(s.stopSequence) ?? index + 1,
      }));
    });
  },

  async getVariantEtas(variant, stop, signal) {
    const ref = variant.ref;
    if (ref.company !== 'NLB') return [];

    const params = new URLSearchParams({
      action: 'eta',
      routeId: ref.routeId,
      stopId: stop.stopId,
    });
    const data = await fetchJson<{ estimatedArrivals?: NlbEtaEntry[] }>(
      `${BASE}/stop.php?${params}`,
      { signal, timeoutMs: 8_000, retries: 1 },
    );

    const timestamp = new Date().toISOString();
    return (data?.estimatedArrivals ?? []).map((e) => ({
      company: 'NLB' as const,
      route: variant.route,
      dir: null,
      dest: variant.dest,
      eta: e.estimatedArrivalTime,
      rmk: e.routeVariantName_c ?? '',
      timestamp,
    }));
  },

  // NLB 的 ETA 查詢必須帶 routeId，無法一次取得整個車站的所有路線
};
