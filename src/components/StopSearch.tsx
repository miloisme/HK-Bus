import { useState, useEffect } from 'react';
import { Search, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { getAllKmbStops, Stop } from '../lib/api';

interface StopSearchProps {
  onSelectStop: (stop: Stop) => void;
}

export function StopSearch({ onSelectStop }: StopSearchProps) {
  const [query, setQuery] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllKmbStops().then((data) => {
      // Remove duplicates by stopId
      const uniqueStops = Array.from(new Map(data.map(item => [item.stopId, item])).values());
      setStops(uniqueStops);
      setLoading(false);
    });
  }, []);

  const filteredStops = query.trim() === '' 
    ? [] 
    : stops.filter(
        (s) => s.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="搜尋車站名稱 (目前僅支援九巴)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入車站資料中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {query.trim() === '' ? (
            <div className="text-center py-12 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-200" />
              <p>請輸入車站名稱進行搜尋</p>
            </div>
          ) : filteredStops.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {filteredStops.map((s) => (
                <li key={s.stopId}>
                  <button
                    onClick={() => onSelectStop(s)}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-red-100 p-2 rounded-full text-red-600">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-lg text-gray-900">{s.name}</div>
                        <div className="text-xs font-medium px-2 py-0.5 mt-1 inline-block rounded-full bg-red-100 text-red-700">
                          {s.company}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12 text-gray-500">
              找不到符合「{query}」的車站
            </div>
          )}
        </div>
      )}
    </div>
  );
}
