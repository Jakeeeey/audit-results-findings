import { Badge } from '@/components/ui/badge';
import { statusColors } from '../shared/components/HousekeepingStatusBadge';
export const springStatusKeys = { Draft: 'IN_PROGRESS', Submitted: 'COMPLETED', Cancelled: 'CANCELLED', Upcoming: 'SCHEDULED', Due: 'IN_PROGRESS', Done: 'COMPLETED', 'Done late': 'COMPLETED', Missed: 'MISSED', Open: 'IN_PROGRESS' } as const;
export function SpringStatusBadge({ status }: { status: keyof typeof springStatusKeys }) {
    return <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[springStatusKeys[status]]}`}>{status}</Badge>;
}
