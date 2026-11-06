import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentAccess, failure } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/queries';
import { EvaluationError } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/security';
import { boundedBytes, MAX_PHOTO_BYTES, uploadEvidence } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/evidence';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const access = await currentAccess();
        if (request.headers.get('origin') !== new URL(request.url).origin) throw new EvaluationError(403, 'INVALID_ORIGIN', 'Upload must originate from this application');
        const type = request.headers.get('content-type') ?? '';
        if (!type.startsWith('multipart/form-data;')) throw new EvaluationError(400, 'INVALID_REQUEST', 'Multipart image upload is required');
        const id = z.coerce.number().int().positive().max(2147483647).parse((await context.params).id);
        const bytes = await boundedBytes(request, MAX_PHOTO_BYTES + 65536);
        const form = await new Request('https://upload.invalid', { method: 'POST', headers: { 'Content-Type': type }, body: new Uint8Array(bytes) }).formData();
        const file = form.get('file');
        if (!(file instanceof File)) throw new EvaluationError(400, 'INVALID_PHOTO', 'Choose one image');
        const requestId = z.uuid().parse(form.get('requestId'));
        const description = z.string().max(2000).parse(form.get('description') ?? '');
        if (form.getAll('file').length !== 1) throw new EvaluationError(400, 'INVALID_PHOTO', 'Upload one image at a time');
        return NextResponse.json({ data: await uploadEvidence(access, id, file, requestId, description) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}
