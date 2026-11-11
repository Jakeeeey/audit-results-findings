import { HousekeepingEntry } from '@/modules/audit-results-findings/housekeeping/HousekeepingEntry';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Page() { return <HousekeepingEntry mode="scheduler" />; }
