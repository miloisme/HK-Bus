import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Company, ETA, getETA, getStopETAs } from '../lib/api';

interface InlineETAProps {
  company: Company;
  stopId: string;
  route?: string;
  routeId?: string;
  bound?: string;
  serviceType?: string;
  dir?: 'inbound' | 'outbound';
}

function formatMinutes(etaStr: string | null): string | null {
  if (!etaStr) return null;
  const diffMins = Math.floor((new Date(etaStr).getTime() - Date.now()) / 60000);
  if (diffMins < 0) return null;
  if (diffMins === 0) return '即將';
  return `${diffMins}分`;
}

export function InlineETA({ company, stopId, route, routeId, bound, serviceType, dir }: InlineETAProps) {
  const [etas, setEtas] = useState<ETA[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const fetchETA = async () => {
      if (!mountedRef.current) return;
      setLoading(true);
      try {
        let data: ETA[];
        if (route) {
          const r: any = { company, route, routeId, bound, serviceType };
          data = await getETA(r, stopId, dir || 'outbound');
        } else {
          data = await getStopETAs(company, stopId);
        }
        const valid = data.filter(e => e.eta);
        valid.sort((a, b) => new Date(a.eta!).getTime() - new Date(b.eta!).getTime());
        if (mountedRef.current) {
          setEtas(valid.slice(0, 3));
          setLoading(false);
        }
      } catch {
        if (mountedRef.current) setLoading(false);
      }
    };
    fetchETA();
    const interval = setInterval(fetchETA, 30000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [company, stopId, route, routeId, bound, serviceType, dir]);

  if (loading) {
    return <div className="h-5 flex items-center"><Loader2 className="w-3 h-3 text-gray-400 animate-spin" /></div>;
  }

  if (etas.length === 0) {
    return <div className="text-xs text-gray-400">暫無資料</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {etas.map((eta, i) => {
        const mins = formatMinutes(eta.eta);
        if (!mins) return null;
        return (
          <span key={i} className="flex items-center gap-1 text-gray-600">
            {!route && <span className="font-medium text-gray-800">{eta.route}</span>}
            <span className="text-gray-400">往</span>
            <span className="text-gray-600 truncate max-w-[80px]">{eta.dest}</span>
            <span className="font-bold text-red-500">{mins}</span>
            {i < etas.length - 1 && <span className="text-gray-300">|</span>}
          </span>
        );
      })}
    </div>
  );
}
