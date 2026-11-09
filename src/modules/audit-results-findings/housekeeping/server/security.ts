import { z } from 'zod';

export class EvaluationError extends Error {
    constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 503, readonly code: string, message: string) { super(message); }
}
export function secureEndpoint(base: string | undefined, route: string): URL {
    try {
        if (!base) throw new Error();
        const url = new URL(base.endsWith('/') ? base : `${base}/`);
        if (url.username || url.password || url.search || url.hash ||
            !['https:', 'http:'].includes(url.protocol)) throw new Error();
        const endpoint = new URL(route, url);
        // Only the trusted server-configured backend may receive the credential.
        if (endpoint.origin !== url.origin) throw new Error();
        return endpoint;
    } catch { throw new EvaluationError(503, 'CONFIGURATION_REQUIRED', 'Secure evaluation backend configuration is required'); }
}
const claimsSchema = z.object({ sub: z.string().regex(/^[1-9]\d*$/), exp: z.number().int().positive(), role: z.string().nullish() });
/** Matches middleware's Spring auth/me verdict, without its five-minute cache. */
export async function verifySession(token: string | undefined, springBase: string | undefined,
    options: { fetch?: typeof fetch; now?: number } = {}): Promise<{ userId: number; isAdmin: boolean }> {
    if (!token || token.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new EvaluationError(401, 'UNAUTHENTICATED', 'Please sign in');
    const endpoint = secureEndpoint(springBase, 'auth/me');
    let response: Response;
    try {
        response = await (options.fetch ?? fetch)(endpoint, { method: 'GET', headers: { Authorization: `Bearer ${token}` },
            redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    } catch { throw new EvaluationError(503, 'AUTH_UNAVAILABLE', 'Session verification is unavailable'); }
    if ([401, 403, 404].includes(response.status)) throw new EvaluationError(401, 'UNAUTHENTICATED', 'Please sign in');
    if (response.status !== 200) throw new EvaluationError(503, 'AUTH_UNAVAILABLE', 'Session verification is unavailable');
    try {
        const claims = claimsSchema.parse(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')));
        const userId = Number(claims.sub);
        if (!Number.isSafeInteger(userId) || userId > 2147483647 || claims.exp * 1000 <= (options.now ?? Date.now())) throw new Error();
        return { userId, isAdmin: claims.role === 'ADMIN' };
    } catch { throw new EvaluationError(401, 'INVALID_IDENTITY', 'A valid VOS user session is required'); }
}
export type EvaluationRole = 'PLANNER' | 'INSPECTOR' | 'AUDITOR';
/** Called only after module authorization, never inferred from an employee job title. */
export function moduleAccess(userId: number, eligibleWarehouseIds: number[]) {
    const grants = eligibleWarehouseIds.map(branchId => ({ userId, branchId, roles: ['PLANNER', 'INSPECTOR', 'AUDITOR'] as EvaluationRole[] }));
    return { userId, mode: 'MODULE_ACCESS' as const, grants, eligibleWarehouseIds,
        require(branchId: number, role?: EvaluationRole) {
            if (!eligibleWarehouseIds.includes(branchId)) throw new EvaluationError(403, 'INELIGIBLE_WAREHOUSE', 'Select an active warehouse');
            if (!grants.some(g => g.branchId === branchId && (!role || g.roles.includes(role)))) throw new EvaluationError(403, 'FORBIDDEN', 'This action is not permitted for the warehouse');
        },
    };
}
