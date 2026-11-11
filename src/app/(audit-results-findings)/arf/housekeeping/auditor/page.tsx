import { redirect } from 'next/navigation';
import { HousekeepingEntry } from '@/modules/audit-results-findings/housekeeping/HousekeepingEntry';
import { HOUSEKEEPING_ENTRY_ROOT } from '@/modules/audit-results-findings/housekeeping/paths';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<{ source?: string }> }) { if ((await searchParams).source === 'legacy') redirect(`${HOUSEKEEPING_ENTRY_ROOT}/auditor`); return <HousekeepingEntry mode="auditor" />; }
