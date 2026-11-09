import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { COOKIE_NAME } from '@/lib/auth-utils';
import { normalizePhoto } from '@/modules/audit-results-findings/housekeeping/server/image-processing';
import { attachmentRow, auditRow } from '@/modules/audit-results-findings/housekeeping/spring/workflow';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const failure = (message: string, status: number) => NextResponse.json({ message }, { status, headers: noStore });
async function boundedBytes(response: Response, limit: number): Promise<Uint8Array> {
    const reader = response.body?.getReader();
    if (!reader) return new Uint8Array();
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
        if (size > limit) { await reader.cancel(); throw new Error('File exceeds access limit'); } chunks.push(value); }
    const result = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
}
async function handle(req: NextRequest, context: { params: Promise<{ auditId: string; fileId: string }> }) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return failure('Sign in to access Housekeeping photos.', 401);
    const { auditId, fileId } = await context.params;
    if (!/^[1-9]\d*$/.test(auditId) || (req.method === 'GET' ? !/^[1-9]\d*$/.test(fileId) : fileId !== 'upload')) return failure('Invalid resource.', 404);
    if (req.method === 'POST' && req.headers.get('origin') !== req.nextUrl.origin) return failure('Cross-origin upload denied.', 403);
    const spring = process.env.SPRING_API_BASE_URL, directus = process.env.NEXT_PUBLIC_API_BASE_URL, fileToken = process.env.DIRECTUS_STATIC_TOKEN;
    if (!spring || !directus || !fileToken) return failure('File services are not configured.', 503);
    const options = { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' as const, redirect: 'manual' as const, signal: AbortSignal.timeout(20000) };
    let uploadedId: string | undefined;
    try {
        const access = await fetch(`${spring.replace(/\/$/, '')}/api/housekeeping/audits/${auditId}`, options);
        if (!access.ok) return failure('Audit access was denied or the audit is unavailable.', access.status >= 300 && access.status < 400 ? 502 : access.status);
        const detail: unknown = await access.json();
        const parsed = z.object({ audit: auditRow }).safeParse(detail);
        if (!parsed.success || parsed.data.audit.id !== Number(auditId)) return failure('Unexpected audit response.', 502);
        if (req.method === 'GET') {
            const result = await fetch(`${spring.replace(/\/$/, '')}/api/housekeeping/audits/${auditId}/attachments`, options);
            if (!result.ok) return failure('Attachment access denied.', result.status >= 300 && result.status < 400 ? 502 : result.status);
            const rows = z.array(attachmentRow).safeParse(await result.json());
            if (!rows.success) return failure('Unexpected attachment response.', 502);
            const file = rows.data.find(row => row.id === Number(fileId));
            if (!file) return failure('Attachment not found on this audit.', 404);
            const response = await fetch(`${directus.replace(/\/$/, '')}/assets/${file.directusFileId}`, { ...options, headers: { Authorization: `Bearer ${fileToken}` } });
            if (!response.ok) return failure('Attachment bytes are unavailable.', 502);
            if (Number(response.headers.get('content-length') ?? 0) > 20 * 1024 * 1024) return failure('Attachment too large for inline access.', 413);
            const bytes = await boundedBytes(response, 20 * 1024 * 1024);
            const mime = response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
            const inline = ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
            return new NextResponse(new Blob([new Uint8Array(bytes)]), { headers: { ...noStore, 'Content-Type': inline ? mime : 'application/octet-stream', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.fileName || `attachment-${file.id}`)}`, 'Content-Security-Policy': "default-src 'none'; sandbox" } });
        }
        if (parsed.data.audit.status === 'Cancelled') return failure('Cancelled audits take no attachments.', 409);
        if (Number(req.headers.get('content-length') ?? 0) > 9 * 1024 * 1024) return failure('Photo exceeds upload limit.', 413);
        const form = await req.formData(); const file = form.get('file');
        const kind = z.enum(['Before', 'After', 'Evidence', 'Signature']).safeParse(form.get('kind') ?? 'Evidence');
        if (!kind.success) return failure('Choose a valid attachment kind.', 400);
        if (!(file instanceof File) || file.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return failure('Use a JPEG, PNG or WebP up to 8 MB.', 400);
        let bytes: Buffer;
        try { bytes = await normalizePhoto(Buffer.from(await file.arrayBuffer())); }
        catch (e) { return failure('Photo could not be decoded or the image runtime is unavailable. Use a non-animated JPEG, PNG or WebP under 20 megapixels.', typeof e === 'object' && e !== null && 'status' in e && e.status === 503 ? 503 : 400); }
        const name = `${file.name.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9 _.-]/g, '_').slice(0, 120) || 'evidence'}.jpg`;
        const upload = new FormData(); upload.set('title', `Housekeeping audit ${auditId}`); upload.set('file', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), name);
        const uploaded = await fetch(`${directus.replace(/\/$/, '')}/files`, { ...options, method: 'POST', headers: { Authorization: `Bearer ${fileToken}` }, body: upload });
        if (!uploaded.ok) return failure('The photo could not be stored.', 502);
        const stored = z.object({ data: z.object({ id: z.uuid() }) }).safeParse(await uploaded.json());
        if (!stored.success) return failure('Unexpected upload response. Check file storage before retrying.', 502);
        uploadedId = stored.data.data.id;
        const linked = await fetch(`${spring.replace(/\/$/, '')}/api/housekeeping/audits/${auditId}/attachments`, { ...options, method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ directusFileId: stored.data.data.id, kind: kind.data, fileName: name, mimeType: 'image/jpeg', fileSize: bytes.length }) });
        if (!linked.ok) {
            // Do not delete an uncertain reference after a timeout/failure. Surface UUID for reconciliation.
            return failure(`Photo stored as ${stored.data.data.id}, but its audit link was not confirmed. Reload attachments before retrying; retain this UUID for administrator reconciliation.`, 502);
        }
        return NextResponse.json({ success: true }, { headers: noStore });
    } catch { return failure(uploadedId ? `Photo stored as ${uploadedId}, but its audit link was not confirmed. Reload attachments before retrying; retain this UUID for administrator reconciliation.` : 'File request failed. Reload attachments to confirm state before retrying an upload.', 502); }
}
export const GET = handle;
export const POST = handle;
