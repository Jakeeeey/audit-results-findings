import { Badge } from '@/components/ui/badge';
import type { EvaluationStatus } from '../scheduling';
export const statusLabels: Record<EvaluationStatus, string> = { SCHEDULED: 'Scheduled', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', MISSED: 'Missed', EXPIRED_INCOMPLETE: 'Expired incomplete', CANCELLED: 'Cancelled' };
// Shared by badges, calendar entries and subtle summary accents.
export const statusColors: Record<EvaluationStatus, string> = {
    SCHEDULED: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-100',
    IN_PROGRESS: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200',
    COMPLETED: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200',
    MISSED: 'bg-red-100 text-red-900 border-red-400 dark:bg-red-950 dark:text-red-200',
    EXPIRED_INCOMPLETE: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300',
};
export function HousekeepingStatusBadge({ status }: { status: EvaluationStatus }) {
    return <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status]}`}>{statusLabels[status]}</Badge>;
}
