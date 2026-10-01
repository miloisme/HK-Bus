import { useState } from 'react';
import { getVariantEtas, sortEtasByTime } from '../lib/api';
import type { Eta, RouteVariant, Stop } from '../lib/types';
import { mapWithConcurrency } from '../lib/concurrency';
import { usePolling, type PollingState } from './usePolling';

export type StopEtaMap = Record<string, Eta[]>;

export type StopEtasState = PollingState<StopEtaMap> & { etasByStop: StopEtaMap };

const EMPTY: StopEtaMap = {};

/**
 * 路線詳情頁用：一次取得沿線每個站的到站時間，並逐站更新畫面，
 * 不必等最遠的站回來才看到結果。
 *
 * 輪詢本身委由 usePolling 處理（30 秒、頁面隱藏暫停、卸載中止）。
 */
export function useStopEtas(
  variant: RouteVariant | null,
  stops: readonly Stop[],
  perStopLimit = 3,
): StopEtasState {
  const [etasByStop, setEtasByStop] = useState<StopEtaMap>(EMPTY);
  const stopsKey = stops.map((stop) => `${stop.stopId}:${stop.seq}`).join(',');

  const load = async (signal: AbortSignal): Promise<StopEtaMap> => {
    if (!variant || stops.length === 0) return EMPTY;

    const collected: StopEtaMap = {};
    // 清空舊值，讓每格回到 loading 狀態
    setEtasByStop({});

    await mapWithConcurrency(stops, 6, async (stop) => {
      if (signal.aborted) return;
      const etas = sortEtasByTime(await getVariantEtas(variant, stop, signal)).slice(
        0,
        perStopLimit,
      );
      if (signal.aborted) return;
      collected[stop.stopId] = etas;
      setEtasByStop({ ...collected });
    });

    return collected;
  };

  const { loading, error, lastUpdated, refresh } = usePolling<StopEtaMap>(
    load,
    [variant?.id ?? '', stopsKey, perStopLimit],
    EMPTY,
    { enabled: variant !== null && stops.length > 0 },
  );

  return { data: etasByStop, etasByStop, loading, error, lastUpdated, refresh };
}
