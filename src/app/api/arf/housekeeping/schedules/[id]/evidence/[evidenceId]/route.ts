import { z } from 'zod';
import { currentAccess, failure } from '@/modules/audit-results-findings/housekeeping/server/queries';
import { readEvidence } from '@/modules/audit-results-findings/housekeeping/server/evidence';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string; evidenceId: string }> }) {
    try {
        const access = await currentAccess();
        const params = await context.params;
        const id = z.coerce.number().int().positive().max(2147483647);
        const bytes = await readEvidence(access, id.parse(params.id), id.parse(params.evidenceId));
        return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': 'inline; filename="evaluation-photo.jpg"' } });
    } catch (error) { return failure(error); }
}
