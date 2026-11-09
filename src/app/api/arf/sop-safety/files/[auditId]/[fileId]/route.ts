import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeSop, SopAccessError } from '@/modules/audit-results-findings/sop-safety/server/access';
import { auditDetailSchema, attachmentSchema, actionSchema } from '@/modules/audit-results-findings/sop-safety/schemas/response.schema';
import { attachmentWriteSchema } from '@/modules/audit-results-findings/sop-safety/schemas/write.schema';
// Pure image decoding/metadata stripping is shared infrastructure, not 5S policy.
import { normalizePhoto } from '@/modules/audit-results-findings/housekeeping/server/image-processing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const error = (message: string, status: number) => NextResponse.json({ message }, { status, headers });

async function boundedBytes(response: Response, limit: number) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing file stream.');
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > limit) { await reader.cancel(); throw new Error('File exceeds access limit.'); }
        chunks.push(value);
    }
    const result = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
}

async function handle(req: NextRequest, context: { params: Promise<{ auditId: string; fileId: string }> }) {
    const { auditId, fileId } = await context.params;
    const uploading = req.method === 'POST';
    if (!/^[1-9]\d*$/.test(auditId) || (uploading ? fileId !== 'upload' : !/^[1-9]\d*$/.test(fileId))) return error('Invalid file resource.', 404);
    if (req.nextUrl.search) return error('File requests do not accept query parameters.', 400);
    if (uploading && req.headers.get('origin') !== req.nextUrl.origin) return error('Cross-origin upload denied.', 403);
    let uploadedId: string | undefined;
    try {
        const { fetchSop, requireCapability } = await authorizeSop(req);
        requireCapability(uploading ? 'inspect' : 'readAudits');
        const access = await fetchSop(`/api/sop-safety/audits/${auditId}`);
        if (!access.ok) return error('SOP denied audit access.', access.status);
        const parsed = auditDetailSchema.safeParse(await access.json());
        if (!parsed.success || parsed.data.audit.id !== Number(auditId)) return error('Audit response needs verification before file access.', 502);
        const directus = process.env.NEXT_PUBLIC_API_BASE_URL;
        const fileToken = process.env.DIRECTUS_STATIC_TOKEN;
        if (!directus || !fileToken) return error('Directus file infrastructure is not configured.', 503);
        const origin = new URL(directus);
        if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash) return error('Invalid file infrastructure configuration.', 503);
        const fileFetch = (path: string, init: RequestInit = {}) => fetch(new URL(path, origin), { ...init, headers: { Authorization: `Bearer ${fileToken}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
        if (!uploading) {
            const response = await fetchSop(`/api/sop-safety/audits/${auditId}/attachments`);
            if (!response.ok) return error('Attachment access denied.', response.status);
            const rows = z.array(attachmentSchema).safeParse(await response.json());
            if (!rows.success) return error('Attachment response needs verification.', 502);
            const file = rows.data.find(row => row.id === Number(fileId));
            if (!file) return error('Attachment does not belong to this audit.', 404);
            const bytesResponse = await fileFetch(`/assets/${file.directusFileId}`);
            if (!bytesResponse.ok) return error('File bytes unavailable.', 502);
            const bytes = await boundedBytes(bytesResponse, 20 * 1024 * 1024);
            const mime = bytesResponse.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
            const inline = ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
            return new NextResponse(new Blob([new Uint8Array(bytes)]), { headers: { ...headers, 'Content-Type': inline ? mime : 'application/octet-stream', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.fileName || `attachment-${file.id}`)}`, 'Content-Security-Policy': "default-src 'none'; sandbox" } });
        }
        if (parsed.data.audit.status === 'Cancelled') return error('Cancelled audits take no new attachments.', 409);
        if (Number(req.headers.get('content-length') ?? 0) > 9 * 1024 * 1024) return error('Upload exceeds limit.', 413);
        // Bound actual bytes too: Content-Length is absent on chunked requests.
        if (!req.body) return error('Missing upload body.', 400);
        const raw = await boundedBytes(new Response(req.body), 9 * 1024 * 1024);
        const form = await new Response(new Uint8Array(raw), { headers: { 'Content-Type': req.headers.get('content-type') ?? '' } }).formData();
        const file = form.get('file');
        if (!(file instanceof File) || file.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return error('Choose JPEG, PNG or WebP up to 8 MB.', 400);
        const links = { ...(form.has('gradeId') ? { gradeId: Number(form.get('gradeId')) } : {}), ...(form.has('correctiveActionId') ? { correctiveActionId: Number(form.get('correctiveActionId')) } : {}) };
        if (links.gradeId !== undefined && !parsed.data.grades.some(grade => grade.id === links.gradeId)) return error('Grade does not belong to this audit.', 400);
        if (links.correctiveActionId !== undefined) {
            const response = await fetchSop(`/api/sop-safety/audits/${auditId}/corrective-actions`);
            if (!response.ok) return error('Unable to verify linked corrective action.', response.status);
            const actions = z.array(actionSchema).safeParse(await response.json());
            if (!actions.success || !actions.data.some(action => action.id === links.correctiveActionId)) return error('Corrective action does not belong to this audit.', 400);
        }
        const metadata = attachmentWriteSchema.omit({ directusFileId: true }).safeParse({ kind: form.get('kind') ?? 'Evidence', ...links });
        if (!metadata.success) return error('Invalid attachment metadata.', 400);
        let bytes: Buffer;
        try { bytes = await normalizePhoto(Buffer.from(await file.arrayBuffer())); }
        catch (cause) { return error('Image could not be decoded or the image runtime is unavailable. Use a non-animated raster image under 20 megapixels.', typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 503 ? 503 : 400); }
        const name = `${file.name.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9 _.-]/g, '_').slice(0, 120) || 'evidence'}.jpg`;
        const upload = new FormData(); upload.set('title', `SOP audit ${auditId}`); upload.set('file', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), name);
        const storedResponse = await fileFetch('/files', { method: 'POST', body: upload });
        if (!storedResponse.ok) return error('Directus upload was not confirmed. Check file storage before retrying.', 502);
        const stored = z.object({ data: z.object({ id: z.uuid() }) }).safeParse(await storedResponse.json());
        if (!stored.success) return error('Unexpected file response. Check storage before retrying.', 502);
        uploadedId = stored.data.data.id;
        const linked = await fetchSop(`/api/sop-safety/audits/${auditId}/attachments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...metadata.data, directusFileId: uploadedId, fileName: name, mimeType: 'image/jpeg', fileSize: bytes.length }) });
        if (!linked.ok) throw new Error('Attachment link was not confirmed.');
        return NextResponse.json({ success: true }, { headers });
    } catch (cause) {
        if (cause instanceof SopAccessError) return error(cause.message, cause.status);
        return error(uploadedId ? `File stored as ${uploadedId}; its SOP link was not confirmed. Retain this UUID and reload attachments before retrying.` : 'File request failed. Reload attachments to confirm state before retrying an upload.', 502);
    }
}
export const GET = handle;
export const POST = handle;
