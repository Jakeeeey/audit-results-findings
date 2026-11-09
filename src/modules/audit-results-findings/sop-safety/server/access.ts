import { COOKIE_NAME, decodeJwtPayload } from '@/lib/auth-utils';
import { rolesFromSopGrants, sopCapabilities, sopRoles, type SopRole, type SopCapability } from '../permissions';

export class SopAccessError extends Error {
    constructor(readonly status: number, message: string) { super(message); }
}

export async function authorizeSop(req: { cookies: { get(name: string): { value: string } | undefined } }) {
    if (!process.env.SPRING_API_BASE_URL) throw new SopAccessError(503, 'SOP backend is not configured. Set SPRING_API_BASE_URL.');
    let base: URL;
    try {
        base = new URL(process.env.SPRING_API_BASE_URL.endsWith('/') ? process.env.SPRING_API_BASE_URL : `${process.env.SPRING_API_BASE_URL}/`);
        if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error();
    } catch { throw new SopAccessError(503, 'Configure a valid SOP backend origin.'); }
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) throw new SopAccessError(401, 'Please sign in.');
    const fetchSop = (path: string, init: RequestInit = {}) => {
        const url = new URL(path, base);
        if (url.origin !== base.origin) throw new SopAccessError(400, 'Invalid upstream origin.');
        return fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...init.headers }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000) });
    };
    const session = await fetchSop('/auth/me');
    if ([401, 404].includes(session.status)) throw new SopAccessError(401, 'Session rejected by Dummy backend.');
    if (session.status === 403) throw new SopAccessError(403, 'Session access denied.');
    if (!session.ok) throw new SopAccessError(503, 'Session verification unavailable.');
    const claims = decodeJwtPayload(token);
    if (!claims || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) throw new SopAccessError(401, 'Please sign in again.');
    let roles: SopRole[] = [...sopRoles];
    if (claims.role !== 'ADMIN') {
        const response = await fetchSop('/api/view-user-authorized-module/all?subsystem_slug=arf');
        if (!response.ok) throw new SopAccessError(response.status === 401 ? 401 : 403, 'Unable to verify SOP module access.');
        const rows: unknown = await response.json();
        roles = rolesFromSopGrants(rows, String(claims.sub));
        if (roles.length === 0) throw new SopAccessError(403, 'SOP role access has not been granted.');
    }
    const capabilities = sopCapabilities(roles);
    return { fetchSop, roles, capabilities, userId: String(claims.sub), requireCapability(capability: SopCapability) {
        if (!capabilities[capability]) throw new SopAccessError(403, capability === 'managePlanning' ? 'Planner access is required to manage SOP checklists and schedules.' : capability === 'inspect' ? 'Inspector access is required to change audits, corrective actions, or evidence.' : 'Planner or Inspector access is required to read SOP audits and results.');
    } };
}
