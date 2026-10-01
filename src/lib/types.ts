/**
 * 正規化領域模型。
 *
 * 這裡的型別是 UI 與各營運商 adapter 之間唯一的契約：adapter 負責把
 * 各家不同的 API 回應轉成這裡的形狀，元件只認這裡的型別。
 */

export type Company = 'KMB' | 'CTB' | 'NLB' | 'GMB';

export type Direction = 'inbound' | 'outbound';

export interface Fare {
  /** 全程成人車資（港幣） */
  adult: number;
}

/**
 * 營運商專屬的「如何指定這個方向」的句柄。
 *
 * 用判別聯集取代過去 Route 上的 bound?/serviceType?/routeId? 三個
 * 選填欄位，令 adapter 內部可以正確收窄而不需要到處斷言。
 */
export type VariantRef =
  | { company: 'KMB'; route: string; bound: 'I' | 'O'; serviceType: string }
  | { company: 'CTB'; route: string; bound: 'I' | 'O' }
  | { company: 'NLB'; routeId: string }
  | { company: 'GMB'; routeId: number; routeSeq: number };

/** 班距（每 N 分鐘一班），資料來自 GMB 實時到站系統 */
export interface Headway {
  startTime: string;
  endTime: string | null;
  frequency: number | null;
  publicHoliday: boolean;
}

/**
 * 一條路線的一個方向。所有元件都以「已選方向」為單位操作，
 * 因此不需要到處傳遞 `dir` 參數。
 */
export interface RouteVariant {
  /** 穩定識別碼，用於 bookmark 與 React key */
  id: string;
  company: Company;
  /** 顯示用路線號碼 */
  route: string;
  dir: Direction;
  orig: string;
  dest: string;
  ref: VariantRef;
  fare?: Fare | null;
  /** 單程車程（分鐘） */
  journeyTime?: number;
  headways?: Headway[];
}

export interface Stop {
  company: Company;
  stopId: string;
  name: string;
  /** 於該方向中的站序（由 1 開始） */
  seq: number;
  lat?: number;
  long?: number;
}

export interface Eta {
  company: Company;
  route: string;
  /** 單向行駛的營運商沒有方向資料 */
  dir: Direction | null;
  dest: string;
  /** ISO 8601 絕對時間；無預計到站時間時為 null */
  eta: string | null;
  rmk: string;
  /** 上游資料的最後更新時間 */
  timestamp: string;
  /** 若此筆 ETA 可直接對應到某個方向變體（站牌看板用） */
  variantId?: string;
}
