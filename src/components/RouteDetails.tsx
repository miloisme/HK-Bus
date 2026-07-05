import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRightLeft, Loader2, MapPin, Bookmark } from 'lucide-react';
import { Route, Stop, ETA, getRouteStops, getETA } from '../lib/api';
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
  const [stopsLoading, setStopsLoading] = useState(true);
  const [etasMap, setEtasMap] = useState<Record<string, ETA[]>>({});
  const [etasLoading, setEtasLoading] = useState(false);
  const mountedRef = useRef(true);
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setStopsLoading(true);
    setEtasMap({});
    setEtasLoading(true);
    getRouteStops(route, dir).then((data) => {
      if (!mountedRef.current) return;
      setStops(data);
      setStopsLoading(false);
    });
  }, [route, dir]);

  const fetchAllEtas = async (stopList: Stop[]) => {
    if (stopList.length === 0) return;
    setEtasLoading(true);
    const newMap: Record<string, ETA[]> = {};
    const batchSize = 5;
    for (let i = 0; i < stopList.length; i += batchSize) {
      if (!mountedRef.current) return;
      const batch = stopList.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(s => getETA(route, s.stopId, dir).catch(() => [] as ETA[]))
      );
      batch.forEach((s, j) => {
        const valid = results[j]
          .filter(e => e.eta)
          .sort((a, b) => new Date(a.eta!).getTime() - new Date(b.eta!).getTime());
        newMap[s.stopId] = valid.slice(0, 3);
      });
      if (mountedRef.current) {
        setEtasMap({ ...newMap });
      }
    }
    if (mountedRef.current) {
      setEtasLoading(false);
    }
  };

  useEffect(() => {
    if (stops.length === 0) return;
    fetchAllEtas(stops);
    const interval = setInterval(() => fetchAllEtas(stops), 30000);
    return () => clearInterval(interval);
  }, [stops, dir, route]);

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

      {stopsLoading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入車站資料中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {stops.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {stops.map((s, i) => {
                const stopEtas = etasMap[s.stopId];
                return (
                  <li key={`${s.stopId}-${i}`}>
                    <button
                      onClick={() => onSelectStop(route, s, dir)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-4 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-sm shrink-0 mt-0.5">
                        {s.seq}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{s.name}</div>
                        {etasLoading && !stopEtas ? (
                          <div className="mt-1 h-4 flex items-center">
                            <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                          </div>
                        ) : stopEtas && stopEtas.length > 0 ? (
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                            {stopEtas.map((eta, j) => {
                              const mins = Math.max(0, Math.floor((new Date(eta.eta!).getTime() - Date.now()) / 60000));
                              return (
                                <span key={j} className="flex items-center gap-1 text-gray-600">
                                  <span className="text-gray-400">往</span>
                                  <span className="text-gray-600 truncate max-w-[80px]">{eta.dest}</span>
                                  <span className="font-bold text-red-500">{mins === 0 ? '即將' : `${mins}分`}</span>
                                  {j < stopEtas.length - 1 && <span className="text-gray-300">|</span>}
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
