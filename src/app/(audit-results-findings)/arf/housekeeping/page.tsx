import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The existing module registry points to this parent path. */
export default function Page() {
    redirect('/arf/housekeeping/auditor');
}
