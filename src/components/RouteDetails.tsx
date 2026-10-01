import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Loader2, MapPin, Bookmark, RefreshCw } from 'lucide-react';
import { getRouteStops, getRouteVariants, type RouteVariant, type Stop } from '../lib/api';
import { compactEtaLabel, formatFare } from '../lib/format';
import { routeBookmark } from '../lib/bookmarks';
import { useBookmarkStore } from '../lib/store';
import { usePolling } from '../hooks/usePolling';
import { useStopEtas } from '../hooks/useStopEtas';
import { OperatorBadge } from './OperatorBadge';

interface RouteDetailsProps {
  variant: RouteVariant;
  onBack: () => void;
  onSelectVariant: (variant: RouteVariant) => void;
  onSelectStop: (variant: RouteVariant, stop: Stop) => void;
}

const EMPTY_STOPS: Stop[] = [];

export function RouteDetails({
  variant,
  onBack,
  onSelectVariant,
  onSelectStop,
}: RouteDetailsProps) {
  const [siblingVariants, setSiblingVariants] = useState<RouteVariant[]>([variant]);

  // 切換方向時先歸位，避免短暫顯示上一個方向的選項
  useEffect(() => {
    setSiblingVariants([variant]);
  }, [variant]);

  const { data: resolved, loading: variantsLoading } = usePolling<RouteVariant[]>(
    (signal) => getRouteVariants(variant, signal),
    [variant.id],
    [variant],
    { poll: false },
  );

  useEffect(() => {
    // 只有當結果確實包含目前的變體才採用，否則就是上一輪的殘留資料
    if (resolved.some((item) => item.id === variant.id)) setSiblingVariants(resolved);
  }, [resolved, variant.id]);

  const active = variant;
  const alternate = useMemo(
    () =>
      siblingVariants.find((item) => item.route === variant.route && item.id !== variant.id),
    [siblingVariants, variant],
  );

  const {
    data: stops,
    loading: stopsLoading,
    error: stopsError,
    refresh: refreshStops,
  } = usePolling<Stop[]>((signal) => getRouteStops(active, signal), [active.id], EMPTY_STOPS, {
    poll: false,
  });

  const { etasByStop, loading: etasLoading, error: etasError, refresh: refreshEtas } =
    useStopEtas(active, stops);

  const { addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();
  const bookmarkId = active.id;
  const bookmarked = isBookmarked(bookmarkId);

  const toggleBookmark = () => {
    if (bookmarked) removeBookmark(bookmarkId);
    else addBookmark(routeBookmark(active));
  };

  const fare = formatFare(active.fare?.adult);
  const headway = active.headways?.find((h) => h.frequency !== null)?.frequency;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {active.route}
            <OperatorBadge company={active.company} />
          </h2>
          <p className="text-sm text-gray-500 truncate">
            {active.orig}
            {active.dest && (
              <>
                <span className="mx-1">→</span>
                {active.dest}
              </>
            )}
          </p>
        </div>
        <button
          onClick={toggleBookmark}
          className={`p-2 rounded-full transition-colors ${
            bookmarked ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-gray-200 text-gray-400'
          }`}
          aria-label="收藏"
        >
          <Bookmark className={`w-6 h-6 ${bookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {(fare || headway || active.journeyTime) && (
        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          {fare && <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">全程 {fare}</span>}
          {active.journeyTime !== undefined && (
            <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">
              車程約 {active.journeyTime} 分鐘
            </span>
          )}
          {headway !== null && headway !== undefined && (
            <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">
              班距約 {headway} 分鐘
            </span>
          )}
        </div>
      )}

      {variantsLoading && !alternate && (
        <p className="text-xs text-gray-400">載入行走路線中...</p>
      )}

      {alternate && (
        <button
          onClick={() => {
            window.scrollTo({ top: 0 });
            onSelectVariant(alternate);
          }}
          className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowRightLeft className="w-4 h-4" />
          切換方向 (往 {alternate.dest})
        </button>
      )}

      {stopsError && stops.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-10 text-center space-y-3">
          <p className="text-sm text-gray-500">車站資料載入失敗</p>
          <button
            onClick={refreshStops}
            className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
          >
            <RefreshCw className="w-4 h-4" />
            重新載入
          </button>
        </div>
      ) : stopsLoading && stops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入車站資料中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {stops.length > 0 ? (
            <>
              {etasError && (
                <p className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-gray-100 flex items-center justify-between">
                  <span>到站時間更新失敗：{etasError}</span>
                  <button onClick={refreshEtas} className="underline">
                    重試
                  </button>
                </p>
              )}
              <ul className="divide-y divide-gray-100">
                {stops.map((stop) => {
                  const stopEtas = etasByStop[stop.stopId];
                  return (
                    <li key={`${stop.stopId}-${stop.seq}`}>
                      <button
                        onClick={() => onSelectStop(active, stop)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-4 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-sm shrink-0 mt-0.5">
                          {stop.seq}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{stop.name}</div>
                          {etasLoading && !stopEtas ? (
                            <div className="mt-1 h-4 flex items-center">
                              <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                            </div>
                          ) : stopEtas && stopEtas.length > 0 ? (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                              {stopEtas.map((eta, index) => {
                                const label = compactEtaLabel(eta.eta);
                                if (!label) return null;
                                return (
                                  <span key={index} className="flex items-center gap-1 text-gray-600">
                                    {index > 0 && <span className="text-gray-300">|</span>}
                                    <span className="text-gray-400">往</span>
                                    <span className="text-gray-600 truncate max-w-[80px]">{eta.dest}</span>
                                    <span className="font-bold text-red-500">{label}</span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                        <MapPin className="w-5 h-5 text-gray-300 shrink-0 mt-1" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">此方向沒有車站資料</div>
          )}
        </div>
      )}
    </div>
  );
}
