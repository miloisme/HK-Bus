import { useState } from 'react';
import { Search, ChevronRight, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { getAllStops, supportsStopSearch, type Stop } from '../lib/api';
import { COMPANY_ORDER, operatorMeta } from '../lib/operators';
import { usePolling } from '../hooks/usePolling';
import { OperatorBadge } from './OperatorBadge';

interface StopSearchProps {
  onSelectStop: (stop: Stop) => void;
}

const RESULT_LIMIT = 60;
const EMPTY_STOPS: Stop[] = [];

export function StopSearch({ onSelectStop }: StopSearchProps) {
  const [query, setQuery] = useState('');
  const [onlyCompany, setOnlyCompany] = useState<string | null>(null);

  const searchable = COMPANY_ORDER.filter(supportsStopSearch);

  const { data: stops, loading, error, refresh } = usePolling<Stop[]>(
    (signal) => getAllStops(signal),
    [],
    EMPTY_STOPS,
    { poll: false },
  );

  const needle = query.trim().toLowerCase();
  const filtered = stops
    .filter((stop) => (onlyCompany ? stop.company === onlyCompany : true))
    .filter((stop) => (needle === '' ? false : stop.name.toLowerCase().includes(needle)))
    .slice(0, RESULT_LIMIT);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="搜尋車站名稱..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
        />
      </div>

      {searchable.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {searchable.map((company) => (
            <button
              key={company}
              onClick={() => setOnlyCompany((prev) => (prev === company ? null : company))}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                onlyCompany === company
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400'
              }`}
            >
              {operatorMeta(company).nameTc}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 px-1">
        車站搜尋目前涵蓋 {searchable.map((company) => operatorMeta(company).nameTc).join('、')}；
        其他營運商請使用路線搜尋。
      </p>

      {loading && stops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入車站資料中...</p>
        </div>
      ) : error && stops.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center space-y-3">
          <AlertCircle className="w-10 h-10 mx-auto text-gray-300" />
          <p className="text-sm text-gray-500">{error}</p>
          <button onClick={refresh} className="text-sm text-red-600 hover:text-red-800">
            重新載入
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {filtered.map((stop) => (
                <li key={`${stop.company}-${stop.stopId}`}>
                  <button
                    onClick={() => onSelectStop(stop)}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <div className="bg-red-100 p-2 rounded-full text-red-600 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{stop.name}</div>
                      <OperatorBadge company={stop.company} className="mt-1 inline-block" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          ) : needle === '' ? (
            <div className="text-center py-12 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-200" />
              <p>請輸入車站名稱進行搜尋</p>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">找不到符合「{query}」的車站</div>
          )}
        </div>
      )}
    </div>
  );
}
