import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorizeSop, SopAccessError } from './access';
import { sopEntryPath } from '../permissions';

/** Only old shared entry points use this; explicit role URLs remain exact-role guarded. */
export async function SopEntryRedirect({ screen = 'overview', auditId }: { screen?: string; auditId?: number }) {
    let access: Awaited<ReturnType<typeof authorizeSop>>;
    try { access = await authorizeSop({ cookies: await cookies() }); }
    catch (cause) {
        if (cause instanceof SopAccessError && cause.status === 401) redirect('/login?next=%2Farf%2Fsop-safety');
        if (cause instanceof SopAccessError && cause.status === 403) redirect('/main-dashboard?error=unauthorized_access&module=arf');
        return <div role="alert" className="rounded-lg border p-4 text-sm">SOP access verification is unavailable. Reload when the authentication service is available.</div>;
    }
    const destination = sopEntryPath(access.roles, screen, auditId);
    redirect(destination ?? '/main-dashboard?error=unauthorized_access&module=arf');
}
