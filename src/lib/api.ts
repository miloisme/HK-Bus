/**
 * 對外的資料存取 facade。
 *
 * 元件只呼叫這裡的函式；每家營運商的端點細節都藏在 operators/ 底下。
 * 這一層存在的唯一理由，是把「同時向多個營運商要資料並容忍其中一家失敗」
 * 這種橫切邏輯集中在一處。
 */
import type { Company, Eta, RouteVariant, Stop } from './types';
import { COMPANY_ORDER, getOperator } from './operators';

export type { Company, Direction, Eta, Headway, RouteVariant, Stop, VariantRef } from './types';
export { formatClock, formatFare, etaLabel, compactEtaLabel, minutesUntil, sortEtasByTime } from './format';
export { COMPANY_ORDER, operatorMeta, supportsStopSearch } from './operators';

/** 全部營運商的路線清單。單一營運商失敗不會拖垮整份搜尋結果。 */
export async function getAllVariants(signal?: AbortSignal): Promise<RouteVariant[]> {
  const results = await Promise.allSettled(
    COMPANY_ORDER.map((company) => getOperator(company).listRoutes(signal)),
  );

  const variants: RouteVariant[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      variants.push(...result.value);
    } else {
      console.error(`${COMPANY_ORDER[index]} 路線清單載入失敗`, result.reason);
    }
  });
  return variants;
}

/** 同一路線可切換的所有方向變體 */
export async function getRouteVariants(
  variant: RouteVariant,
  signal?: AbortSignal,
): Promise<RouteVariant[]> {
  try {
    const variants = await getOperator(variant.company).listVariants([variant], signal);
    // 保證回傳的集合一定包含目前的變體，避免呼叫端切到空白
    return variants.some((v) => v.id === variant.id) ? variants : [variant, ...variants];
  } catch (error) {
    console.error('載入方向變體失敗', error);
    return [variant];
  }
}

export async function getRouteStops(variant: RouteVariant, signal?: AbortSignal): Promise<Stop[]> {
  try {
    return await getOperator(variant.company).listStops(variant, signal);
  } catch (error) {
    console.error('載入路線站序失敗', error);
    return [];
  }
}

/** 某一站在該方向的到站時間 */
export async function getVariantEtas(
  variant: RouteVariant,
  stop: Stop,
  signal?: AbortSignal,
): Promise<Eta[]> {
  try {
    return await getOperator(variant.company).getVariantEtas(variant, stop, signal);
  } catch (error) {
    console.error('載入到站時間失敗', error);
    return [];
  }
}

/**
 * 車站看板：該站所有路線的到站時間。
 * 不支援此能力的營運商回傳空陣列。
 */
export async function getStopEtas(
  company: Company,
  stopId: string,
  signal?: AbortSignal,
): Promise<Eta[]> {
  const adapter = getOperator(company);
  if (!adapter.getStopEtas) return [];

  try {
    return await adapter.getStopEtas(stopId, signal);
  } catch (error) {
    console.error('載入車站到站時間失敗', error);
    return [];
  }
}

/** 支援全港車站搜尋的營運商的車站清單 */
export async function getAllStops(signal?: AbortSignal): Promise<Stop[]> {
  const adapters = COMPANY_ORDER.map(getOperator).filter((a) => typeof a.listAllStops === 'function');

  const results = await Promise.allSettled(
    adapters.map((adapter) => adapter.listAllStops!(signal)),
  );

  const stops: Stop[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      stops.push(...result.value);
    } else {
      console.error(`${adapters[index]?.meta.nameTc} 車站清單載入失敗`, result.reason);
    }
  });

  // 同一營運商內可能有重複站名（例如來回程共用站），以 stopId 去重
  return Array.from(new Map(stops.map((stop) => [stop.stopId, stop])).values());
}
