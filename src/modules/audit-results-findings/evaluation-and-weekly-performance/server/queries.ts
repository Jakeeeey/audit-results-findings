import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { COOKIE_NAME } from '@/lib/auth-utils';
import { EvaluationError, moduleAccess, secureEndpoint, verifySession } from './security';
import { saveReadiness, weeklyReadiness, submissionReadiness } from './save-readiness';
import { evaluationToken } from './configuration';

export async function currentAccess() {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const actor = await verifySession(token, process.env.SPRING_API_BASE_URL);
    if (actor.isAdmin) {
        // Matches the existing sidebar's verified ADMIN -> active Directus module convention.
        const modules = await readItems('modules', ['id'], { slug: { _eq: 'evaluation-and-weekly-performance' }, subsystem_id: { slug: { _eq: 'arf' } }, status: { _eq: 'active' } }, z.array(z.object({ id: z.number().int().positive() })));
        if (!modules.length) throw new EvaluationError(403, 'FORBIDDEN', 'The evaluation module is not enabled');
    } else {
        let response: Response;
        try { response = await fetch(secureEndpoint(process.env.SPRING_API_BASE_URL, 'api/view-user-authorized-module/all?subsystem_slug=arf'), {
            headers: { Authorization: `Bearer ${token}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
        }); } catch { throw new EvaluationError(503, 'AUTHORIZATION_UNAVAILABLE', 'Module access lookup is unavailable'); }
        if (!response.ok) throw new EvaluationError(response.status === 401 || response.status === 403 ? 403 : 503, 'MODULE_ACCESS_REQUIRED', 'Evaluation module access could not be verified');
        const item = z.object({ userId: z.coerce.number().int().positive(), subsystemSlug: z.string(), basePath: z.string().nullish(), slug: z.string().nullish(), status: z.string().optional() });
        let rows: z.infer<typeof item>[];
        try { const body: unknown = await response.json(); rows = z.union([z.array(item), z.object({ data: z.array(item) }).transform(v => v.data)]).parse(body); }
        catch { throw new EvaluationError(503, 'AUTHORIZATION_UNAVAILABLE', 'Module access response could not be validated'); }
        const root = '/arf/evaluation-and-weekly-performance';
        if (!rows.some(row => row.userId === actor.userId && row.subsystemSlug === 'arf' && (!row.status || row.status.toLowerCase() === 'active') &&
            (row.slug === 'evaluation-and-weekly-performance' || row.basePath === root || row.basePath?.startsWith(`${root}/`)))) {
            throw new EvaluationError(403, 'FORBIDDEN', 'You have not been granted access to the evaluation module');
        }
    }
    const branches = await readItems('branches', ['id', 'branch_name', 'branch_code', 'isActive'], { isActive: { _eq: 1 } }, warehouseSchema);
    return { ...moduleAccess(actor.userId, branches.map(branch => branch.id)), savesEnabled: await saveReadiness(), weeklySavesEnabled: await weeklyReadiness(), submissionEnabled: await submissionReadiness() };
}
/** Read-only, explicit fields, bounded pagination. No generic proxy or write helper. */
export async function readItems<T>(collection: 'branches' | 'modules' | 'user' | 'arf_evaluation_recurrences' | 'arf_evaluation_schedules' | 'arf_evaluations' | 'arf_evaluation_responses' | 'arf_evaluation_evidence', fields: string[], filter: Record<string, unknown>, schema: z.ZodType<T[]>) {
    const token = evaluationToken();
    if (!token) throw new EvaluationError(503, 'STORAGE_NOT_CONFIGURED', 'A dedicated evaluation credential is required');
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    const records: T[] = [];
    try {
        for (let page = 1; page <= 11; page++) {
            const url = secureEndpoint(base, `items/${collection}`);
            url.searchParams.set('fields', fields.join(','));
            url.searchParams.set('filter', JSON.stringify(filter));
            url.searchParams.set('sort', collection === 'user' ? 'user_id' : 'id');
            url.searchParams.set('limit', '100'); url.searchParams.set('page', String(page));
            const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, method: 'GET',
                redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (!response.ok) throw new Error();
            const data = z.object({ data: schema }).parse(await response.json()).data;
            records.push(...data);
            if (records.length > 1000) throw new Error();
            if (data.length < 100) return records;
        }
        throw new Error();
    } catch (error) {
        if (error instanceof EvaluationError) throw error;
        throw new EvaluationError(503, 'STORAGE_UNAVAILABLE', 'Evaluation lookups are unavailable');
    }
}
const warehouseSchema = z.array(z.object({ id: z.number().int().positive(), branch_name: z.string(), branch_code: z.string(), isActive: z.union([z.literal(1), z.literal(true)]) }));
export async function warehouses(access: Awaited<ReturnType<typeof currentAccess>>) {
    const ids = [...new Set(access.grants.map(g => g.branchId))].filter(id => access.eligibleWarehouseIds.includes(id));
    if (!ids.length) return [];
    return readItems('branches', ['id', 'branch_name', 'branch_code', 'isActive'], { id: { _in: ids }, isActive: { _eq: 1 } }, warehouseSchema);
}
export function failure(error: unknown) {
    const known = error instanceof EvaluationError;
    const invalid = error instanceof z.ZodError;
    return NextResponse.json({ error: { code: known ? error.code : invalid ? 'INVALID_REQUEST' : 'UNAVAILABLE',
        message: known ? error.message : invalid ? 'Invalid evaluation request' : 'Evaluation service is unavailable' } },
    { status: known ? error.status : invalid ? 400 : 503, headers: { 'Cache-Control': 'no-store' } });
}
