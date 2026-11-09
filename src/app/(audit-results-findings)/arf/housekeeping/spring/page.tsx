import { redirect } from 'next/navigation';
/** Preserve bookmarked migration-screen URLs without retaining a diagnostic UI. */
export default function Page() { redirect('/arf/housekeeping/checker'); }
