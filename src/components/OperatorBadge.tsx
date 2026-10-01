import type { Company } from '../lib/types';
import { operatorMeta } from '../lib/operators';

interface OperatorBadgeProps {
  company: Company;
  className?: string;
}

/** 營運商徽章。顏色與名稱一律取自 adapter 的 meta，避免各處複製三元運算。 */
export function OperatorBadge({ company, className = '' }: OperatorBadgeProps) {
  const meta = operatorMeta(company);
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.badgeClass} ${className}`}
    >
      {meta.nameTc}
    </span>
  );
}
