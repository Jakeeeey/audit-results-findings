import 'server-only';
import { COOKIE_NAME } from '@/lib/auth-utils';
import { secureEndpoint, verifySession } from '../../server/security';
import { readItems } from '../../server/queries';
import { housekeepingRoles } from '../permissions';
import { z } from 'zod';

export class CheckerAccessError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export async function authorizeHousekeeping(req: { cookies: { get(name: string): { value: string } | undefined } }) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const actor = await verifySession(token, process.env.SPRING_API_BASE_URL);
    const fetchHousekeeping = (path: string, init: RequestInit = {}) => fetch(secureEndpoint(process.env.SPRING_API_BASE_URL, path), {
        ...init, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...init.headers }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    let roles: string[];
    if (actor.isAdmin) roles = ['checker', 'auditor', 'scheduler'];
    else {
        const response = await fetchHousekeeping('api/view-user-authorized-module/all?subsystem_slug=arf');
        if (!response.ok) throw new CheckerAccessError(response.status === 401 ? 401 : response.status === 403 ? 403 : 503, 'Housekeeping workspace permissions could not be verified.');
        roles = housekeepingRoles(await response.json(), actor.userId);
    }
    return { ...actor, roles, fetchHousekeeping, requireRole(...allowed: string[]) {
        if (!allowed.some(role => roles.includes(role))) throw new CheckerAccessError(403, 'Your account does not have permission for this Housekeeping workspace operation.');
    } };
}
export const approvedWarehouseSchema = z.object({ id: z.number().int().positive().safe(), branch_name: z.string(), branch_code: z.string(), isActive: z.union([z.literal(1), z.literal(true)]) });
export async function authorizeChecker(req: Parameters<typeof authorizeHousekeeping>[0]) {
    const access = await authorizeHousekeeping(req); access.requireRole('checker');
    // Verified Checker workspace access grants active-warehouse reads. Selection
    // remains a filter; resolution writes have a separate authorization policy.
    const warehouses = await readItems('branches', ['id', 'branch_name', 'branch_code', 'isActive'], { isActive: { _eq: 1 } }, z.array(approvedWarehouseSchema));
    // Like SOP Safety: role grants resolution access; the mutation handler
    // independently verifies the current action's assignment and lifecycle.
    const canComplete = access.roles.includes('checker');
    return { ...access, warehouses, canComplete, requireWarehouse(id: number) {
        if (!warehouses.some(w => w.id === id)) throw new CheckerAccessError(403, 'This warehouse is not approved for Housekeeping visibility.');
    } };
}
export function checkerError(cause: unknown): { status: number; message: string } {
    if (cause instanceof CheckerAccessError) return { status: cause.status, message: cause.message };
    if (cause && typeof cause === 'object' && 'status' in cause && typeof cause.status === 'number' && [400, 401, 403, 404, 409, 503].includes(cause.status) && 'message' in cause && typeof cause.message === 'string') return { status: cause.status, message: cause.message };
    return { status: 503, message: 'Housekeeping access or data is temporarily unavailable. Please retry.' };
}
