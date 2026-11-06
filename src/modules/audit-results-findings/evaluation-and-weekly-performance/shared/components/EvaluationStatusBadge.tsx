import { Badge } from '@/components/ui/badge';
import type { EvaluationStatus } from '../scheduling';
export const statusLabels: Record<EvaluationStatus, string> = { SCHEDULED: 'Scheduled', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', MISSED: 'Missed', EXPIRED_INCOMPLETE: 'Expired incomplete', CANCELLED: 'Cancelled' };
export function EvaluationStatusBadge({ status }: { status: EvaluationStatus }) {
    return <Badge variant={status === 'COMPLETED' ? 'default' : status === 'MISSED' || status === 'EXPIRED_INCOMPLETE' ? 'destructive' : 'secondary'}>{statusLabels[status]}</Badge>;
}
