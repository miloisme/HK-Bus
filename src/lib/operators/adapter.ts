import type { Company, Direction, Eta, RouteVariant, Stop, VariantRef } from '../types';

export interface OperatorMeta {
  id: Company;
  nameTc: string;
  /** Tailwind 樣式；營運商徽章顏色的唯一來源 */
  badgeClass: string;
}

/**
 * 營運商 adapter。
 *
 * adapter 的責任是把某家 API 的回應轉成 `types.ts` 的領域模型，
 * 並回報自己支援哪些能力（車站看板、全港車站搜尋）。
 * 元件與 `api.ts` facade 不需要知道任何一家 API 的端點細節。
 */
export interface OperatorAdapter {
  readonly meta: OperatorMeta;

  /** 一次網絡請求取得全部可搜尋路線，每個方向變體一項 */
  listRoutes(signal?: AbortSignal): Promise<RouteVariant[]>;

  /** 展開成使用者可切換的同組方向變體；單向的營運商原樣回傳 */
  listVariants(variants: readonly RouteVariant[], signal?: AbortSignal): Promise<RouteVariant[]>;

  /** 該方向的路線站序 */
  listStops(variant: RouteVariant, signal?: AbortSignal): Promise<Stop[]>;

  /** 某一站在該方向的到站時間 */
  getVariantEtas(variant: RouteVariant, stop: Stop, signal?: AbortSignal): Promise<Eta[]>;

  /** 車站看板：該站所有路線的到站時間。不支援的營運商省略。 */
  getStopEtas?(stopId: string, signal?: AbortSignal): Promise<Eta[]>;

  /** 全港車站清單，供車站搜尋使用。不支援的營運商省略。 */
  listAllStops?(signal?: AbortSignal): Promise<Stop[]>;
}

/** 由 ref 產生跨營運商皆不重複的穩定識別碼 */
export function variantId(ref: VariantRef): string {
  switch (ref.company) {
    case 'KMB':
      return `kmb:${ref.route}:${ref.bound}:${ref.serviceType}`;
    case 'CTB':
      return `ctb:${ref.route}:${ref.bound}`;
    case 'NLB':
      return `nlb:${ref.routeId}`;
    case 'GMB':
      return `gmb:${ref.routeId}:${ref.routeSeq}`;
  }
}

export function directionOf(bound: 'I' | 'O'): Direction {
  return bound === 'I' ? 'inbound' : 'outbound';
}

/** 上游欄位有時是字串有時是數字，且可能為空字串 */
export function toNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
