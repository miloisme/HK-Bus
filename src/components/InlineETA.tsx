import { Loader2 } from 'lucide-react';
import {
  getStopEtas,
  getVariantEtas,
  sortEtasByTime,
  type Eta,
  type RouteVariant,
  type Stop,
} from '../lib/api';
import { compactEtaLabel } from '../lib/format';
import { usePolling } from '../hooks/usePolling';

interface InlineETAProps {
  /** 有傳則顯示單一路線的到站時間，否則顯示整個車站的到站時間 */
  variant?: RouteVariant;
  stop?: Stop;
}

const EMPTY_ETAS: Eta[] = [];
const PER_LIMIT = 3;

export function InlineETA({ variant, stop }: InlineETAProps) {
  const enabled = stop !== undefined;

  const load = async (signal: AbortSignal): Promise<Eta[]> => {
    if (!stop) return EMPTY_ETAS;
    const raw = variant
      ? await getVariantEtas(variant, stop, signal)
      : await getStopEtas(stop.company, stop.stopId, signal);
    return sortEtasByTime(raw).slice(0, PER_LIMIT);
  };

  const { data: etas, loading } = usePolling<Eta[]>(
    load,
    [variant?.id ?? '', stop?.stopId ?? ''],
    EMPTY_ETAS,
    { enabled },
  );

  if (loading && etas.length === 0) {
    return (
      <div className="h-5 flex items-center">
        <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
      </div>
    );
  }

  const visible = etas
    .map((eta, index) => ({ eta, index, label: compactEtaLabel(eta.eta) }))
    .filter((item) => item.label !== null);

  if (visible.length === 0) {
    return <div className="text-xs text-gray-400">暫無資料</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {visible.map(({ eta, index, label }) => (
        <span key={index} className="flex items-center gap-1 text-gray-600">
          {!variant && <span className="font-medium text-gray-800">{eta.route}</span>}
          <span className="text-gray-400">往</span>
          <span className="text-gray-600 truncate max-w-[80px]">{eta.dest}</span>
          <span className="font-bold text-red-500">{label}</span>
          {index < visible.length - 1 && <span className="text-gray-300">|</span>}
        </span>
      ))}
    </div>
  );
}
