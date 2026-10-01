import type { Eta } from './types';

/** 上游 ISO 8601（含時區偏移）→ Date；格式不符時回傳 null 而不產生 Invalid Date */
export function parseEta(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 距離到站還有多少分鐘（向下取整）。已過期回傳負數；無資料回傳 null。 */
export function minutesUntil(value: string | null | undefined, now = Date.now()): number | null {
  const date = parseEta(value);
  if (!date) return null;
  return Math.floor((date.getTime() - now) / 60_000);
}

/** 站牌看板用的完整標籤 */
export function etaLabel(value: string | null | undefined, now = Date.now()): string {
  if (!value) return '未有資料';
  const minutes = minutesUntil(value, now);
  if (minutes === null) return '未有資料';
  if (minutes < 0) return '已離開';
  if (minutes === 0) return '即將抵達';
  return `${minutes} 分鐘`;
}

/** 緊湊標籤：`3分` / `即將`；已過期回傳 null 讓呼叫端略過該筆 */
export function compactEtaLabel(value: string | null | undefined, now = Date.now()): string | null {
  const minutes = minutesUntil(value, now);
  if (minutes === null || minutes < 0) return null;
  return minutes === 0 ? '即將' : `${minutes}分`;
}

/**
 * 過濾掉沒有到站時間與已經開走的班次，其餘由早至晚排序。
 * 回傳新陣列，不更動原資料。
 */
export function sortEtasByTime<T extends Eta>(etas: readonly T[], now = Date.now()): T[] {
  return etas
    .filter((eta) => {
      const minutes = minutesUntil(eta.eta, now);
      return minutes !== null && minutes >= 0;
    })
    .slice()
    .sort(
      (a, b) => (parseEta(a.eta)?.getTime() ?? 0) - (parseEta(b.eta)?.getTime() ?? 0),
    );
}

const timeFormat = new Intl.DateTimeFormat('zh-HK', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const timeWithSecondsFormat = new Intl.DateTimeFormat('zh-HK', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatClock(date: Date, withSeconds = false): string {
  return (withSeconds ? timeWithSecondsFormat : timeFormat).format(date);
}

export function formatFare(fare: number | null | undefined): string | null {
  if (fare === null || fare === undefined || Number.isNaN(fare)) return null;
  return `$${fare.toFixed(fare % 1 === 0 ? 0 : 1)}`;
}
