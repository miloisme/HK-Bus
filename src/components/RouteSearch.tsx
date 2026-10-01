import { useState } from 'react';
import { Search, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { getAllVariants, type RouteVariant } from '../lib/api';
import { COMPANY_ORDER, operatorMeta } from '../lib/operators';
import { usePolling } from '../hooks/usePolling';
import { OperatorBadge } from './OperatorBadge';

interface RouteSearchProps {
  onSelectRoute: (variant: RouteVariant) => void;
}

const RESULT_LIMIT = 60;

function matches(variant: RouteVariant, needle: string): boolean {
  return (
    variant.route.toLowerCase().includes(needle) ||
    variant.orig.toLowerCase().includes(needle) ||
    variant.dest.toLowerCase().includes(needle)
  );
}

export function RouteSearch({ onSelectRoute }: RouteSearchProps) {
  const [query, setQuery] = useState('');
  const [onlyCompany, setOnlyCompany] = useState<string | null>(null);

  const { data: variants, loading, error, refresh } = usePolling<RouteVariant[]>(
    (signal) => getAllVariants(signal),
    [],
    [],
    { poll: false },
  );

  const needle = query.trim().toLowerCase();
  const filtered = variants
    .filter((variant) => (onlyCompany ? variant.company === onlyCompany : true))
    .filter((variant) => (needle === '' ? true : matches(variant, needle)))
    .slice(0, RESULT_LIMIT);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="搜尋路線號碼或地點..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {COMPANY_ORDER.map((company) => (
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

      {loading && variants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm text-gray-500">載入路線資料中...</p>
        </div>
      ) : error && variants.length === 0 ? (
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
            <>
              {variants.length > RESULT_LIMIT && (
                <p className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">
                  只顯示前 {RESULT_LIMIT} 筆結果，請輸入更關鍵的字詞
                </p>
              )}
              <ul className="divide-y divide-gray-100">
                {filtered.map((variant) => (
                  <li key={variant.id}>
                    <button
                      onClick={() => onSelectRoute(variant)}
                      className="w-full text-left px-4 py-4 hover:bg-gray-50 flex items-center justify-between gap-4 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-gray-900">{variant.route}</span>
                          <OperatorBadge company={variant.company} />
                        </div>
                        <div className="text-sm text-gray-500 mt-1 truncate">
                          {variant.orig}
                          {variant.dest && (
                            <>
                              <span className="mx-1">→</span>
                              {variant.dest}
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              {needle === '' ? '請輸入路線號碼或地點' : `找不到符合「${query}」的路線`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
