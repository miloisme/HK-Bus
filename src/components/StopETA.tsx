import { ArrowLeft, Loader2, Clock, RefreshCw, Bookmark, AlertCircle } from 'lucide-react';
import { getVariantEtas, sortEtasByTime, type Eta, type RouteVariant, type Stop } from '../lib/api';
import { formatClock, minutesUntil, parseEta } from '../lib/format';
import { stopBookmark } from '../lib/bookmarks';
import { useBookmarkStore } from '../lib/store';
import { usePolling } from '../hooks/usePolling';
import { OperatorBadge } from './OperatorBadge';

interface StopEtaProps {
  variant: RouteVariant;
  stop: Stop;
  onBack: () => void;
}

const EMPTY_ETAS: Eta[] = [];

export function StopETA({ variant, stop, onBack }: StopEtaProps) {
  const {
    data: etas,
    loading,
    error,
    lastUpdated,
    refresh,
  } = usePolling<Eta[]>(
    async (signal) => sortEtasByTime(await getVariantEtas(variant, stop, signal)),
    [variant.id, stop.stopId],
    EMPTY_ETAS,
  );

  const { addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();
  const bookmark = stopBookmark(variant, stop);
  const bookmarked = isBookmarked(bookmark.id);

  const toggleBookmark = () => {
    if (bookmarked) removeBookmark(bookmark.id);
    else addBookmark(bookmark);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold truncate">{stop.name}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <span className="font-bold text-gray-700">{variant.route}</span>
            <OperatorBadge company={variant.company} />
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

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>即將到站</span>
        <button
          onClick={refresh}
          className="flex items-center gap-1 hover:text-red-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {lastUpdated ? `最後更新 ${formatClock(lastUpdated, true)}` : '更新'}
        </button>
      </div>

      {error && etas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center space-y-3">
          <AlertCircle className="w-10 h-10 mx-auto text-gray-300" />
          <p className="text-sm text-gray-500">{error}</p>
          <button onClick={refresh} className="text-sm text-red-600 hover:text-red-800">
            重新載入
          </button>
        </div>
      ) : loading && etas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入到站時間中...</p>
        </div>
      ) : etas.length > 0 ? (
        <div className="space-y-3">
          {etas.map((eta, index) => {
            const minutes = minutesUntil(eta.eta);
            const etaDate = parseEta(eta.eta);
            return (
              <div
                key={index}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">往 {eta.dest}</div>
                  {eta.rmk && (
                    <div className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded mt-1 inline-block">
                      {eta.rmk}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-red-600">
                    {minutes === 0 ? '即將抵達' : minutes}
                    {minutes !== null && minutes > 0 && (
                      <span className="text-sm font-normal text-gray-500 ml-1">分鐘</span>
                    )}
                  </div>
                  {etaDate && (
                    <div className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-1">
                      <Clock className="w-3 h-3" />
                      {formatClock(etaDate)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
          暫時沒有到站資料
        </div>
      )}
    </div>
  );
}
