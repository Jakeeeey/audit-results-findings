import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Adherence Status Badge ───────────────────────────────────────────────────

const ADHERENCE_STYLES: Record<string, string> = {
  'Compliant':     'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Non-Compliant': 'bg-red-50 text-red-700 border-red-200',
  'Pending':       'bg-blue-50 text-blue-700 border-blue-200',
  'Overdue':       'bg-amber-50 text-amber-700 border-amber-200',
};

const ADHERENCE_ICONS: Record<string, React.ReactNode> = {
  'Compliant':     <CheckCircle2 className="w-3 h-3" />,
  'Non-Compliant': <XCircle className="w-3 h-3" />,
  'Pending':       <AlertCircle className="w-3 h-3" />,
  'Overdue':       <Clock className="w-3 h-3" />,
};

const FALLBACK_STYLE = 'bg-slate-50 text-slate-600 border-slate-200';

export function AdherenceBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        ADHERENCE_STYLES[status] ?? FALLBACK_STYLE
      )}
    >
      {ADHERENCE_ICONS[status] ?? <AlertCircle className="w-3 h-3" />}
      {status}
    </span>
  );
}

// ─── Document Status Badge ────────────────────────────────────────────────────

const DOC_STATUS_STYLES: Record<string, string> = {
  'Approved':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Rejected':   'bg-red-50 text-red-700 border-red-200',
  'For Review': 'bg-purple-50 text-purple-700 border-purple-200',
  'Draft':      'bg-slate-50 text-slate-600 border-slate-200',
  'Open':       'bg-blue-50 text-blue-700 border-blue-200',
};

export function DocumentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        DOC_STATUS_STYLES[status] ?? FALLBACK_STYLE
      )}
    >
      {status}
    </span>
  );
}