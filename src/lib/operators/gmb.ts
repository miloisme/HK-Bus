import { fetchJson, fetchText } from '../http';
import { persisted } from '../cache';
import { mapWithConcurrency } from '../concurrency';
import type { Headway, RouteVariant, Stop, VariantRef } from '../types';
import { toNumber, variantId, type OperatorAdapter } from './adapter';

/**
 * 綠色專線小巴（Green Minibus）— 運輸署實時到站資訊系統。
 *
 * 注意：此 API 會拒絕沒有 User-Agent 的請求（回 403）。瀏覽器一律會
 * 帶 UA，所以前端直連沒問題；但若日後要加到 server.ts 的 proxy，
 * 必須像 KMB proxy 一樣自行設定 User-Agent。
 */
const BASE = 'https://data.etagmb.gov.hk';

/**
 * 運輸署「公共交通路線及收費資料」的綠色小巴路線檔。
 *
 * 實時 API 只有 /route（路線代號清單）與逐條查詢的端點，要湊出
 * 「全港 782 條路線 + 起終點 + 車資」得發 700+ 次請求。這個靜態檔
 * 一次請求就給齊，因此拿來當搜尋索引。
 */
const INDEX_URL = 'https://static.data.gov.hk/td/routes-fares-xml/ROUTE_GMB.xml';

const INDEX_TTL = 7 * 24 * 60 * 60 * 1000;
const STATIC_TTL = 7 * 24 * 60 * 60 * 1000;

// ---- 上游回應結構 ----

interface GmbDirection {
  route_seq: number;
  orig_tc: string;
  dest_tc: string;
  remarks_tc?: string | null;
  headways?: GmbHeadway[];
}

interface GmbHeadway {
  weekdays: boolean[];
  public_holiday: boolean;
  headway_seq: number;
  start_time: string;
  end_time: string | null;
  frequency: number | null;
}

interface GmbRouteDetail {
  route_id: number;
  route_code: string;
  directions?: GmbDirection[];
}

interface GmbRouteStopEntry {
  stop_seq: number;
  stop_id: number;
  name_tc: string;
}

interface GmbEtaEntry {
  eta_seq: number;
  diff: number;
  timestamp: string;
  remarks_tc: string | null;
}

interface GmbEtaPayload {
  enabled?: boolean;
  stop_id?: number;
  eta?: GmbEtaEntry[];
}

interface GmbStopEtaEntry {
  route_id: number;
  route_seq: number;
  stop_seq: number;
  enabled: boolean;
  eta?: GmbEtaEntry[];
}

/** 靜態索引的一筆路線 */
interface IndexEntry {
  routeId: number;
  route: string;
  district: string;
  orig: string;
  dest: string;
  fare: number | null;
  journeyTime: number | null;
}

const url = (path: string) => `${BASE}/${path}`;

const readText = (root: Document | Element, tag: string): string => {
  const value = root.getElementsByTagName(tag)[0]?.textContent?.trim();
  return value ?? '';
};

/** 解析運輸署的扁平化 routes/fares XML，壓成我們需要的最小欄位 */
function parseIndex(xml: string): IndexEntry[] {
  // 檔案開頭有 UTF-8 BOM，不移除可能讓 DOMParser 判定失敗
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml.replace(/^\uFEFF/, ''), 'application/xml');
  if (doc.querySelector('parsererror')) return [];

  const entries: IndexEntry[] = [];
  for (const node of Array.from(doc.getElementsByTagName('ROUTE'))) {
    const routeId = toNumber(readText(node, 'ROUTE_ID'));
    if (routeId === undefined) continue;

    entries.push({
      routeId,
      route: readText(node, 'ROUTE_NAMEC'),
      district: readText(node, 'DISTRICT'),
      orig: readText(node, 'LOC_START_NAMEC'),
      dest: readText(node, 'LOC_END_NAMEC'),
      fare: toNumber(readText(node, 'FULL_FARE')) ?? null,
      journeyTime: toNumber(readText(node, 'JOURNEY_TIME')) ?? null,
    });
  }
  return entries;
}

/** 靜態索引（7 天）。失敗時回傳空陣列，由呼叫端退回 /route 的降級路徑。 */
function loadIndex(signal?: AbortSignal): Promise<IndexEntry[]> {
  return persisted('gmb-index', 'routes', INDEX_TTL, async () => {
    const xml = await fetchText(INDEX_URL, { signal, timeoutMs: 30_000, retries: 1 });
    return parseIndex(xml);
  }).catch((error) => {
    console.error('GMB 路線索引載入失敗，改用降級模式', error);
    return [] as IndexEntry[];
  });
}

const toHeadways = (raw: GmbHeadway[] | undefined): Headway[] | undefined => {
  if (!raw?.length) return undefined;
  return raw.map((h) => ({
    startTime: h.start_time,
    endTime: h.end_time,
    frequency: h.frequency,
    publicHoliday: h.public_holiday,
  }));
};

const asVariant = (
  entry: IndexEntry,
  routeSeq: number,
  orig: string,
  dest: string,
  headways?: Headway[],
): RouteVariant => {
  const ref: VariantRef = { company: 'GMB', routeId: entry.routeId, routeSeq };
  return {
    id: variantId(ref),
    company: 'GMB',
    route: entry.route,
    dir: routeSeq === 1 ? 'outbound' : 'inbound',
    orig,
    dest,
    ref,
    fare: entry.fare === null ? null : { adult: entry.fare },
    journeyTime: entry.journeyTime ?? undefined,
    headways,
  };
};

/** /route/{route_id}：取得該路線的所有方向與班距 */
async function loadDirections(routeId: number, signal?: AbortSignal): Promise<GmbRouteDetail[]> {
  return persisted('gmb-route', String(routeId), STATIC_TTL, async () => {
    const data = await fetchJson<{ data?: GmbRouteDetail[] }>(url(`/route/${routeId}`), { signal });
    return data?.data ?? [];
  }).catch(() => [] as GmbRouteDetail[]);
}

export const gmbAdapter: OperatorAdapter = {
  meta: {
    id: 'GMB',
    nameTc: '綠色小巴',
    badgeClass: 'bg-green-100 text-green-700',
  },

  async listRoutes(signal) {
    const index = await loadIndex(signal);
    if (index.length > 0) {
      // 索引只描述 route_seq 1；使用者開啟路線時才用 /route/{id} 展開其他方向
      return index.map((entry) => asVariant(entry, 1, entry.orig, entry.dest));
    }

    // 降級：靜態檔不可用時只剩路線代號，仍可用代號搜尋
    const codes = await fetchJson<{ data?: { routes?: Record<string, string[]> } }>(url('/route'), {
      signal,
      timeoutMs: 15_000,
    }).catch(() => null);

    const variants: RouteVariant[] = [];
    for (const [district, list] of Object.entries(codes?.data?.routes ?? {})) {
      for (const code of list) {
        variants.push(
          asVariant(
            { routeId: 0, route: code, district, orig: '', dest: '', fare: null, journeyTime: null },
            1,
            '',
            '',
          ),
        );
      }
    }
    return variants;
  },

  async listVariants(variants, signal) {
    const gmbVariants = variants.filter((v) => v.ref.company === 'GMB');
    if (gmbVariants.length === 0) return [...variants];

    const index = await loadIndex(signal);
    const indexByRouteId = new Map(index.map((entry) => [entry.routeId, entry]));

    const routeIds = [...new Set(gmbVariants.map((v) => (v.ref.company === 'GMB' ? v.ref.routeId : 0)))];
    const details = await mapWithConcurrency(routeIds, 6, (routeId) =>
      loadDirections(routeId, signal),
    );
    const detailsByRouteId = new Map(routeIds.map((routeId, i) => [routeId, details[i] ?? []]));

    const expanded: RouteVariant[] = [];
    for (const routeId of routeIds) {
      const entry = indexByRouteId.get(routeId);
      for (const detail of detailsByRouteId.get(routeId) ?? []) {
        for (const direction of detail.directions ?? []) {
          const routeSeq = direction.route_seq;
          if (!entry) {
            // 索引外的路線（例如剛新增）以 /route 回應為準
            const fallbackEntry: IndexEntry = {
              routeId,
              route: detail.route_code,
              district: '',
              orig: '',
              dest: '',
              fare: null,
              journeyTime: null,
            };
            expanded.push(
              asVariant(
                fallbackEntry,
                routeSeq,
                direction.orig_tc,
                direction.dest_tc,
                toHeadways(direction.headways),
              ),
            );
            continue;
          }
          expanded.push(
            asVariant(entry, routeSeq, direction.orig_tc, direction.dest_tc, toHeadways(direction.headways)),
          );
        }
      }
    }

    return expanded.length > 0 ? expanded : [...variants];
  },

  async listStops(variant, signal) {
    const ref = variant.ref;
    if (ref.company !== 'GMB') return [];

    return persisted('gmb-route-stop', variant.id, STATIC_TTL, async () => {
      const data = await fetchJson<{ data?: { route_stops?: GmbRouteStopEntry[] } }>(
        url(`/route-stop/${ref.routeId}/${ref.routeSeq}`),
        { signal },
      );

      return (data?.data?.route_stops ?? []).map((s) => ({
        company: 'GMB' as const,
        stopId: String(s.stop_id),
        name: s.name_tc,
        seq: toNumber(s.stop_seq) ?? 0,
      }));
    }).catch(() => [] as Stop[]);
  },

  async getVariantEtas(variant, stop, signal) {
    const ref = variant.ref;
    if (ref.company !== 'GMB') return [];
    if (stop.seq <= 0) return [];

    const data = await fetchJson<{ data?: GmbEtaPayload }>(
      url(`/eta/route-stop/${ref.routeId}/${ref.routeSeq}/${stop.seq}`),
      { signal, timeoutMs: 8_000, retries: 1 },
    ).catch(() => null);

    // enabled 為 false 代表該站未提供實時到站服務
    if (data?.data?.enabled === false) return [];

    return (data?.data?.eta ?? []).map((e) => ({
      company: 'GMB' as const,
      route: variant.route,
      dir: variant.dir,
      dest: variant.dest,
      eta: e.timestamp ?? null,
      rmk: e.remarks_tc ?? '',
      timestamp: e.timestamp,
    }));
  },

  async getStopEtas(stopId, signal) {
    const data = await fetchJson<{ data?: GmbStopEtaEntry[] }>(url(`/eta/stop/${stopId}`), {
      signal,
      timeoutMs: 10_000,
      retries: 1,
    }).catch(() => null);

    const active = (data?.data ?? []).filter((entry) => entry.enabled !== false);
    if (active.length === 0) return [];

    // /eta/stop 只給 route_id + route_seq，沒有路線代號與終點，
    // 因此逐一補查 /route/{route_id}（有快取，重複造訪不會再發）
    const routeIds = [...new Set(active.map((e) => e.route_id))];
    const details = await mapWithConcurrency(routeIds, 6, (routeId) =>
      loadDirections(routeId, signal),
    );
    const variantsByKey = new Map<string, RouteVariant>();
    const index = await loadIndex(signal);
    const indexByRouteId = new Map(index.map((entry) => [entry.routeId, entry]));

    routeIds.forEach((routeId, i) => {
      for (const detail of details[i] ?? []) {
        for (const direction of detail.directions ?? []) {
          const entry = indexByRouteId.get(routeId);
          const variant = asVariant(
            entry ?? {
              routeId,
              route: detail.route_code,
              district: '',
              orig: '',
              dest: '',
              fare: null,
              journeyTime: null,
            },
            direction.route_seq,
            direction.orig_tc,
            direction.dest_tc,
          );
          variantsByKey.set(`${routeId}:${direction.route_seq}`, variant);
        }
      }
    });

    return active.flatMap((entry) => {
      const variant = variantsByKey.get(`${entry.route_id}:${entry.route_seq}`);
      if (!variant) return [];

      return (entry.eta ?? []).map((e) => ({
        company: 'GMB' as const,
        route: variant.route,
        dir: variant.dir,
        dest: variant.dest,
        eta: e.timestamp ?? null,
        rmk: e.remarks_tc ?? '',
        timestamp: e.timestamp,
        variantId: variant.id,
      }));
    });
  },

  // 沒有「列出所有小巴站」的端點：/stop-route 只能由 stop_id 反查，
  // 要建立全港小巴站索引得逐條路線抓 780+ 次，因此不提供全港車站搜尋。
};
