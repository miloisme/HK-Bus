import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRightLeft, Loader2, MapPin, Bookmark } from 'lucide-react';
import { Route, Stop, getRouteStops } from '../lib/api';
import { useBookmarkStore } from '../lib/store';

interface RouteDetailsProps {
  route: Route;
  initialDir?: 'inbound' | 'outbound';
  onBack: () => void;
  onSelectStop: (route: Route, stop: Stop, dir: 'inbound' | 'outbound') => void;
}

export function RouteDetails({ route, initialDir, onBack, onSelectStop }: RouteDetailsProps) {
  const [dir, setDir] = useState<'inbound' | 'outbound'>(
    initialDir || (route.company === 'KMB' && route.bound === 'I' ? 'inbound' : 'outbound')
  );

  useEffect(() => {
    setDir(initialDir || (route.company === 'KMB' && route.bound === 'I' ? 'inbound' : 'outbound'));
  }, [route, initialDir]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();

  useEffect(() => {
    setLoading(true);
    getRouteStops(route, dir).then((data) => {
      setStops(data);
      setLoading(false);
    });
  }, [route, dir]);

  const toggleDirection = () => {
    setDir((prev) => (prev === 'outbound' ? 'inbound' : 'outbound'));
  };

  const isOriginalDir = route.company === 'KMB' 
    ? (route.bound === 'I' && dir === 'inbound') || (route.bound === 'O' && dir === 'outbound')
    : dir === 'outbound';

  const currentDest = isOriginalDir ? route.dest : route.orig;
  const currentOrig = isOriginalDir ? route.orig : route.dest;

  const bookmarkId = `route-${route.company}-${route.route}-${dir}-${route.routeId || ''}`;
  const bookmarked = isBookmarked(bookmarkId);

  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(bookmarkId);
    } else {
      addBookmark({
        id: bookmarkId,
        type: 'route',
        company: route.company,
        route: route.route,
        routeId: route.routeId,
        bound: route.bound,
        serviceType: route.serviceType,
        dir,
        name: `${route.route} (${route.company === 'KMB' ? '九巴' : route.company === 'CTB' ? '城巴' : '大嶼山巴士'})`,
        subtitle: `往 ${currentDest}`,
        orig: route.orig,
        dest: route.dest,
      });
    }
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {route.route}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              route.company === 'KMB' ? 'bg-red-100 text-red-700' :
              route.company === 'CTB' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-700'
            }`}>
              {route.company === 'KMB' ? '九巴' : route.company === 'CTB' ? '城巴' : '大嶼山巴士'}
            </span>
          </h2>
          <p className="text-sm text-gray-500">
            {currentOrig} {currentDest && <span className="mx-1">→</span>} {currentDest}
          </p>
        </div>
        <button
          onClick={toggleBookmark}
          className={`p-2 rounded-full transition-colors ${
            bookmarked ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-gray-200 text-gray-400'
          }`}
        >
          <Bookmark className={`w-6 h-6 ${bookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {route.company !== 'NLB' && (
        <button
          onClick={toggleDirection}
          className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowRightLeft className="w-4 h-4" />
          切換方向 (往 {currentOrig})
        </button>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入車站資料中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {stops.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {stops.map((s, i) => (
                <li key={`${s.stopId}-${i}`}>
                  <button
                    onClick={() => onSelectStop(route, s, dir)}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 flex items-center gap-4 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                      {s.seq}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{s.name}</div>
                    </div>
                    <MapPin className="w-5 h-5 text-gray-300 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12 text-gray-500">
              此方向沒有車站資料
            </div>
          )}
        </div>
      )}
    </div>
  );
}
