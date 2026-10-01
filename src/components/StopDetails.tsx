import { useMemo } from 'react';
import { ArrowLeft, Loader2, Clock, AlertCircle, RefreshCw, Bookmark } from 'lucide-react';
import { getStopEtas, type Eta, type Stop } from '../lib/api';
import { etaLabel, formatClock, sortEtasByTime } from '../lib/format';
import { stopOnlyBookmark } from '../lib/bookmarks';
import { useBookmarkStore } from '../lib/store';
import { usePolling } from '../hooks/usePolling';

interface StopDetailsProps {
  stop: Stop;
  onBack: () => void;
}

const EMPTY_ETAS: Eta[] = [];

export function StopDetails({ stop, onBack }: StopDetailsProps) {
  const {
    data: etas,
    loading,
    error,
    lastUpdated,
    refresh,
  } = usePolling<Eta[]>(
    async (signal) => sortEtasByTime(await getStopEtas(stop.company, stop.stopId, signal)),
    [stop.company, stop.stopId],
    EMPTY_ETAS,
  );

  const { addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();
  const bookmark = stopOnlyBookmark(stop);
  const bookmarked = isBookmarked(bookmark.id);

  const toggleBookmark = () => {
    if (bookmarked) removeBookmark(bookmark.id);
    else addBookmark(bookmark);
  };

  const groups = useMemo(() => {
    const grouped = new Map<string, Eta[]>();
    for (const eta of etas) {
      const key = `${eta.company}-${eta.route}-${eta.dest}`;
      const bucket = grouped.get(key);
      if (bucket) bucket.push(eta);
      else grouped.set(key, [eta]);
    }
    return [...grouped.values()].sort((a, b) =>
      (a[0]?.route ?? '').localeCompare(b[0]?.route ?? '', 'en'),
    );
  }, [etas]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-gray-900 truncate">{stop.name}</h2>
          <p className="text-sm text-gray-500">所有到站路線</p>
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

      <div className="flex justify-between items-center text-sm text-gray-500 px-1">
        <span className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {lastUpdated ? `最後更新 ${formatClock(lastUpdated, true)}` : '尚未更新'}
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {loading && etas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入到站時間中...</p>
        </div>
      ) : groups.length > 0 ? (
        <div className="space-y-4">
          {groups.map((group) => {
            const first = group[0];
            if (!first) return null;
            return (
              <div
                key={`${first.company}-${first.route}-${first.dest}`}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-bold text-xl text-gray-900">{first.route}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    往 {first.dest}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.slice(0, 3).map((eta, index) => (
                    <div key={index} className="flex items-center justify-between text-sm gap-3">
                      <span className="text-gray-500">
                        {index === 0 ? '下一班' : index === 1 ? '第二班' : '第三班'}
                      </span>
                      <div className="flex items-center gap-2">
                        {eta.rmk && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                            {eta.rmk}
                          </span>
                        )}
                        <span
                          className={`font-bold ${index === 0 ? 'text-lg text-red-600' : 'text-gray-700'}`}
                        >
                          {etaLabel(eta.eta)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center space-y-2">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500">{error ? '載入失敗，請稍後再試' : '暫時沒有到站資料'}</p>
        </div>
      )}
    </div>
  );
}
