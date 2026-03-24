import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Clock, RefreshCw, Bookmark } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Route, Stop, ETA, getETA } from '../lib/api';
import { useBookmarkStore } from '../lib/store';

interface StopETAProps {
  route: Route;
  stop: Stop;
  dir: 'inbound' | 'outbound';
  onBack: () => void;
}

export function StopETA({ route, stop, dir, onBack }: StopETAProps) {
  const [etas, setEtas] = useState<ETA[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();

  const fetchETA = async () => {
    setLoading(true);
    const data = await getETA(route, stop.stopId, dir);
    
    const validEtas = data.filter(e => e.eta);
    validEtas.sort((a, b) => new Date(a.eta!).getTime() - new Date(b.eta!).getTime());
    setEtas(validEtas);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchETA();
    const interval = setInterval(fetchETA, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [route, stop, dir]);

  const bookmarkId = `stop-${route.company}-${route.route}-${dir}-${stop.stopId}`;
  const bookmarked = isBookmarked(bookmarkId);

  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(bookmarkId);
    } else {
      addBookmark({
        id: bookmarkId,
        type: 'stop',
        company: route.company,
        route: route.route,
        routeId: route.routeId,
        bound: route.bound,
        serviceType: route.serviceType,
        dir,
        stopId: stop.stopId,
        name: stop.name,
        subtitle: `${route.route} (${route.company === 'KMB' ? '九巴' : route.company === 'CTB' ? '城巴' : '大嶼山巴士'})`,
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
          <h2 className="text-2xl font-bold">{stop.name}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <span className="font-bold text-gray-700">{route.route}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              route.company === 'KMB' ? 'bg-red-100 text-red-700' :
              route.company === 'CTB' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-700'
            }`}>
              {route.company === 'KMB' ? '九巴' : route.company === 'CTB' ? '城巴' : '大嶼山巴士'}
            </span>
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

      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span>即將到站</span>
        <button 
          onClick={fetchETA}
          className="flex items-center gap-1 hover:text-red-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          最後更新: {lastUpdated.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </button>
      </div>

      {loading && etas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入到站時間中...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {etas.length > 0 ? (
            etas.map((eta, i) => {
              const etaDate = parseISO(eta.eta!);
              const minutes = Math.max(0, Math.floor((etaDate.getTime() - new Date().getTime()) / 60000));
              
              return (
                <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">往 {eta.dest}</div>
                    {eta.rmk && <div className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded mt-1 inline-block">{eta.rmk}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">
                      {minutes === 0 ? '即將抵達' : `${minutes}`}
                      {minutes > 0 && <span className="text-sm font-normal text-gray-500 ml-1">分鐘</span>}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-1">
                      <Clock className="w-3 h-3" />
                      {etaDate.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
              暫時沒有巴士到站資料
            </div>
          )}
        </div>
      )}
    </div>
  );
}
