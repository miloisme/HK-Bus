import { useState, useEffect } from 'react';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import { getAllRoutes, Route } from '../lib/api';

interface RouteSearchProps {
  onSelectRoute: (route: Route) => void;
}

export function RouteSearch({ onSelectRoute }: RouteSearchProps) {
  const [query, setQuery] = useState('');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllRoutes().then((data) => {
      setRoutes(data);
      setLoading(false);
    });
  }, []);

  const filteredRoutes = routes.filter(
    (r) =>
      r.route.toLowerCase().includes(query.toLowerCase()) ||
      r.orig.toLowerCase().includes(query.toLowerCase()) ||
      r.dest.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 50); // limit to 50 results

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="搜尋路線號碼或地點..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入路線資料中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredRoutes.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {filteredRoutes.map((r, i) => (
                <li key={`${r.company}-${r.route}-${r.bound || ''}-${r.routeId || ''}-${i}`}>
                  <button
                    onClick={() => onSelectRoute(r)}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-gray-900">{r.route}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          r.company === 'KMB' ? 'bg-red-100 text-red-700' :
                          r.company === 'CTB' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {r.company === 'KMB' ? '九巴' : r.company === 'CTB' ? '城巴' : '大嶼山巴士'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {r.orig} {r.dest && <span className="mx-1">→</span>} {r.dest}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12 text-gray-500">
              找不到符合「{query}」的路線
            </div>
          )}
        </div>
      )}
    </div>
  );
}
