import 'server-only';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorizeSop, SopAccessError } from './access';
import { sopRolePaths, type SopRole } from '../permissions';

/** Exact view grants are checked on the server, independently of UI controls. */
export async function SopRoleGate({ role, children }: { role: SopRole; children: ReactNode }) {
    let access: Awaited<ReturnType<typeof authorizeSop>>;
    try { access = await authorizeSop({ cookies: await cookies() }); }
    catch (cause) {
        if (cause instanceof SopAccessError && cause.status === 401) redirect(`/login?next=${encodeURIComponent(sopRolePaths[role])}`);
        if (cause instanceof SopAccessError && cause.status === 403) redirect('/main-dashboard?error=unauthorized_access&module=arf');
        return <div role="alert" className="rounded-lg border p-4 text-sm">SOP role verification is unavailable. Reload when the authentication service is available.</div>;
    }
    if (!access.roles.includes(role)) redirect('/main-dashboard?error=unauthorized_access&module=arf');
    return children;
}
