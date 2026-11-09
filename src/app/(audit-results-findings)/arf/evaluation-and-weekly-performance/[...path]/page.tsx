import { redirect } from 'next/navigation';
import { HOUSEKEEPING_ENTRY_ROOT } from '@/modules/audit-results-findings/housekeeping/paths';
export const dynamic = 'force-dynamic';
/** Retired diagnostic/archive/editor bookmarks return to the active registered Checker. */
export default function Page() { redirect(`${HOUSEKEEPING_ENTRY_ROOT}/checker`); }
