import { NextRequest, NextResponse } from 'next/server';
import { sopPath, sopQuery } from '@/modules/audit-results-findings/sop-safety/server/routes';
import { authorizeSop, SopAccessError } from '@/modules/audit-results-findings/sop-safety/server/access';
import { validateSopWrite } from '@/modules/audit-results-findings/sop-safety/schemas/write.schema';
import { sopOperationCapability } from '@/modules/audit-results-findings/sop-safety/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const error = (message: string, status: number) => NextResponse.json({ message }, { status, headers });

async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const writing = req.method !== 'GET';
    const { path } = await context.params;
    const resource = path.join('/');
    const target = sopPath(path, req.method);
    if (!target) return error('SOP resource not found.', 404);
    let payload: unknown;
    let query: URLSearchParams;
    try {
        query = sopQuery(resource, new URLSearchParams(req.nextUrl.search));
        if (writing) {
            if (req.headers.get('origin') !== req.nextUrl.origin) return error('Cross-origin SOP writes are not allowed.', 403);
            if (req.nextUrl.search) return error('Write requests do not accept query parameters.', 400);
            if (req.method !== 'DELETE' && req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return error('Send JSON.', 415);
            const text = req.method === 'DELETE' ? '' : await req.text();
            if (text.length > 256000) return error('Request too large.', 413);
            payload = validateSopWrite(resource, req.method, text ? JSON.parse(text) : undefined);
        }
    } catch (cause) { return error(cause instanceof Error ? cause.message : 'Invalid request.', 400); }
    try {
        const { fetchSop, requireCapability } = await authorizeSop(req);
        requireCapability(sopOperationCapability(req.method, resource));
        const response = await fetchSop(`${target}${!writing && query.size ? `?${query}` : ''}`, {
            method: req.method,
            ...(payload !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
        });
        if (response.status === 204) return new NextResponse(null, { status: 204, headers });
        const text = await response.text();
        if (!text && response.ok && writing) return new NextResponse(null, { status: 204, headers });
        let body: unknown;
        try { body = JSON.parse(text); } catch { return error(writing ? 'Unexpected backend response. Reload the record before retrying; the operation may have succeeded.' : 'SOP returned a non-JSON response.', 502); }
        return NextResponse.json(body, { status: response.status, headers });
    } catch (cause) {
        if (cause instanceof SopAccessError) return error(cause.message, cause.status);
        return error(writing ? 'Operation could not be confirmed. Reload before retrying; the operation may have succeeded.' : 'Dummy SOP backend unavailable, redirected, or timed out.', 502);
    }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
