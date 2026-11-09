import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth-utils';
import { springHousekeepingPath, springHousekeepingQuery } from '@/modules/audit-results-findings/housekeeping/spring/routes';
import { validateSpringWrite } from '@/modules/audit-results-findings/housekeeping/spring/write-contracts';
import { authorizeHousekeeping, checkerError } from '@/modules/audit-results-findings/housekeeping/checker/server/access';
import { handleCheckerRequest } from '@/modules/audit-results-findings/housekeeping/checker/server/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const error = (message: string, status: number) => NextResponse.json({ message }, { status, headers });

async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const method = req.method;
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return error('Please sign in to access Housekeeping.', 401);
    const { path } = await context.params;
    if (path[0] === 'checker') return handleCheckerRequest(req, path.slice(1));
    const target = springHousekeepingPath(path, method);
    if (!target) return error('Housekeeping resource not found.', 404);
    try {
        const access = await authorizeHousekeeping(req);
        if (method === 'GET') access.requireRole('auditor', 'scheduler');
        else if (['checklists', 'items', 'schedule-rules', 'schedules'].includes(path[0])) access.requireRole('scheduler');
        else access.requireRole('auditor');
    } catch (cause) { const result = checkerError(cause); return error(result.message, result.status); }
    let query: URLSearchParams;
    try { query = springHousekeepingQuery(path.join('/'), req.nextUrl.searchParams); }
    catch (e) { return error(e instanceof Error ? e.message : 'Invalid filters.', 400); }
    const base = process.env.SPRING_API_BASE_URL;
    if (!base) return error('The audit service is not configured. Contact support.', 503);
    let payload: unknown;
    if (method !== 'GET') {
        // Cookie-authenticated mutations must originate from this app, not a third-party page.
        if (req.headers.get('origin') !== req.nextUrl.origin) return error('Cross-origin Housekeeping writes are not allowed.', 403);
        if (req.nextUrl.search) return error('Write requests do not accept query parameters.', 400);
        if (method !== 'DELETE' && !req.headers.get('content-type')?.includes('application/json')) return error('Send JSON.', 415);
        try {
            const raw = method === 'DELETE' ? undefined : await req.text();
            if (raw && raw.length > 256000) return error('Request too large.', 413);
            payload = validateSpringWrite(path.join('/'), method, raw ? JSON.parse(raw) : undefined);
        } catch (e) { return error(e instanceof Error ? e.message : 'Invalid request.', 400); }
    }
    try {
        const url = new URL(`${base.replace(/\/$/, '')}${target}`);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return error('The audit service configuration is invalid. Contact support.', 503);
        url.search = query.toString();
        const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}), cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15000) });
        if (response.status === 401) return error('Your session expired or was rejected. Please sign in again.', 401);
        if (response.status === 403) return error('You do not have access to this Housekeeping record.', 403);
        if (response.status === 404) return error('The requested audit resource is unavailable. Contact support if this persists.', 404);
        if (response.status >= 300 && response.status < 400) return error('The audit service returned an unexpected redirect. Contact support.', 502);
        if (response.status === 204) return new NextResponse(null, { status: 204, headers });
        let body: unknown;
        const responseText = await response.text();
        if (!responseText && response.ok && method !== 'GET') return new NextResponse(null, { status: 204, headers });
        try { body = JSON.parse(responseText); } catch { return error('The audit service returned an unexpected response. Reload to confirm whether a write succeeded before retrying.', 502); }
        if (!response.ok) {
            const message = typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string' ? body.message.slice(0, 500) : 'Housekeeping request failed.';
            return error(message, response.status);
        }
        // Preserve the actual response shape; do not guess or silently convert envelopes.
        return NextResponse.json(body, { status: response.status, headers });
    } catch { return error('The audit service is unavailable or timed out. Reload to confirm the record state before retrying a write.', 502); }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
