import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Clock, AlertCircle, RefreshCw, Bookmark } from 'lucide-react';
import { Stop, ETA, getStopETAs } from '../lib/api';
import { useBookmarkStore } from '../lib/store';

interface StopDetailsProps {
  stop: Stop;
  onBack: () => void;
}

export function StopDetails({ stop, onBack }: StopDetailsProps) {
  const [etas, setEtas] = useState<ETA[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();

  const fetchETAs = async () => {
    setLoading(true);
    const data = await getStopETAs(stop.company, stop.stopId);
    const validEtas = data.filter(e => e.eta);
    validEtas.sort((a, b) => new Date(a.eta!).getTime() - new Date(b.eta!).getTime());
    setEtas(validEtas);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchETAs();
    const interval = setInterval(fetchETAs, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [stop]);

  const bookmarkId = `stop-only-${stop.company}-${stop.stopId}`;
  const bookmarked = isBookmarked(bookmarkId);

  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(bookmarkId);
    } else {
      addBookmark({
        id: bookmarkId,
        type: 'stop-only',
        company: stop.company,
        stopId: stop.stopId,
        name: stop.name,
        subtitle: `所有到站路線 (${stop.company === 'KMB' ? '九巴' : stop.company === 'CTB' ? '城巴' : '大嶼山巴士'})`,
        route: '',
      });
    }
  };

  const formatETA = (etaStr: string | null) => {
    if (!etaStr) return '未有資料';
    const etaDate = new Date(etaStr);
    const now = new Date();
    const diffMins = Math.floor((etaDate.getTime() - now.getTime()) / 60000);
    
    if (diffMins < 0) return '已離開';
    if (diffMins === 0) return '即將抵達';
    return `${diffMins} 分鐘`;
  };

  // Group ETAs by route
  const groupedETAs = etas.reduce((acc, eta) => {
    const key = `${eta.route}-${eta.dest}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(eta);
    return acc;
  }, {} as Record<string, ETA[]>);

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{stop.name}</h2>
          <p className="text-sm text-gray-500">所有到站路線</p>
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

      <div className="flex justify-between items-center text-sm text-gray-500 px-1">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          最後更新: {lastUpdated.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <button 
          onClick={fetchETAs}
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
      ) : Object.keys(groupedETAs).length > 0 ? (
        <div className="space-y-4">
          {(Object.entries(groupedETAs) as [string, ETA[]][]).map(([key, routeEtas]) => {
            const firstEta = routeEtas[0];
            return (
              <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xl text-gray-900">{firstEta.route}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        往 {firstEta.dest}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {routeEtas.slice(0, 3).map((eta, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {i === 0 ? '下一班' : i === 1 ? '第二班' : '第三班'}
                      </span>
                      <div className="flex items-center gap-2">
                        {eta.rmk && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                            {eta.rmk}
                          </span>
                        )}
                        <span className={`font-bold ${i === 0 ? 'text-lg text-red-600' : 'text-gray-700'}`}>
                          {formatETA(eta.eta)}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">暫時沒有巴士到站資料</p>
        </div>
      )}
    </div>
  );
}
