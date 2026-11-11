import { HousekeepingEntry } from '@/modules/audit-results-findings/housekeeping/HousekeepingEntry';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Existing sidebar registry URL; all UI and business logic live under housekeeping. */
export default function Page() { return <HousekeepingEntry mode="auditor" />; }
