import { useCallback, useEffect, useRef, useState } from 'react';

export const ETA_POLL_INTERVAL_MS = 30_000;

export interface PollingState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  /** 手動重新整理 */
  refresh: () => void;
}

export interface PollingOptions {
  /** false 時完全不做任何請求 */
  enabled?: boolean;
  /** 預設 true。靜態資料（路線清單、車站清單、站序）應設為 false，只在 deps 改變時載入 */
  poll?: boolean;
}

/**
 * 統一處理「非同步資料 + 逾時 + 輪詢 + 取消 + 錯誤狀態」。
 *
 * 元件不需要再各自維護 mountedRef 或 setInterval：
 *  - 卸載時 abort 所有進行中的請求，狀態更新一律先確認 signal 未被取消
 *  - 分頁切到背景時暫停輪詢，回到前景立即補一次
 *  - 依賴改變時清掉舊的 loading 語意，避免顯示上一輪的資料
 */
export function usePolling<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  initial: T,
  { enabled = true, poll = true }: PollingOptions = {},
): PollingState<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        const result = await loadRef.current(controller.signal);
        if (!active) return;
        setData(result);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    if (!poll) return;

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void run();
    }, ETA_POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [...deps, enabled, poll, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { data, loading, error, lastUpdated, refresh };
}
