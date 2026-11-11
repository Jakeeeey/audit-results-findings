import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { currentAccess, readItems } from './queries';
import { inspectionDetail } from './schedules';
import { EvaluationError, secureEndpoint } from './security';
import { submissionReadiness } from './save-readiness';
import { mutate } from './writes';
import { decryptPhoto, encryptPhoto } from './photo-crypto';
import { normalizePhoto } from './image-processing';
import { evaluationToken } from './configuration';
import { getPhotoKey } from './photo-keyring';

type Access = Awaited<ReturnType<typeof currentAccess>>;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const evidenceRow = z.object({ id: z.number().int().positive(), file_id: z.uuid(), content_hash: z.string(), description: z.string().nullable() });
function endpoint(path: string) {
    return secureEndpoint(process.env.NEXT_PUBLIC_API_BASE_URL, path);
}
function headers() { return { Authorization: `Bearer ${evaluationToken()}` }; }
async function encryptedAsset(fileId: string) {
    const response = await fetch(endpoint(`assets/${fileId}`), { headers: headers(), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok || Number(response.headers.get('content-length')) > MAX_PHOTO_BYTES + 36) throw new EvaluationError(503, 'PHOTO_UNAVAILABLE', 'Saved photo could not be loaded');
    // Bounded streaming, even when the upstream omits Content-Length.
    return boundedBytes(response, MAX_PHOTO_BYTES + 36);
}
export async function boundedBytes(source: Request | Response, limit: number): Promise<Buffer> {
    if (!source.body) throw new EvaluationError(400, 'EMPTY_UPLOAD', 'Choose an image');
    const reader = source.body.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            total += value.length;
            if (total > limit) { await reader.cancel(); throw new EvaluationError(400, 'PHOTO_TOO_LARGE', 'Image must be at most 8 MB'); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks);
}
export async function uploadEvidence(access: Access, scheduleId: number, file: File, requestId: string, description: string) {
    z.uuid().parse(requestId);
    z.string().max(2000).parse(description);
    if (!await submissionReadiness()) throw new EvaluationError(503, 'PHOTO_SETUP_REQUIRED', 'Install the submission migration and refresh Directus');
    const detail = await inspectionDetail(access, scheduleId);
    access.require(detail.schedule.branchId);
    if (!detail.evaluation || detail.schedule.inspectorId !== access.userId) throw new EvaluationError(403, 'NOT_OWNER', 'Only the evaluator can upload photos');
    if (!file.size || file.size > MAX_PHOTO_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new EvaluationError(400, 'INVALID_PHOTO', 'Choose a JPEG, PNG or WebP image up to 8 MB');
    const image = await normalizePhoto(Buffer.from(await file.arrayBuffer()));
    if (image.length + 36 > MAX_PHOTO_BYTES) throw new EvaluationError(400, 'PHOTO_TOO_LARGE', 'Processed image exceeds 8 MB');
    const requestKey = createHash('sha256').update(`${detail.evaluation.id}:${access.userId}:${requestId}`).digest('hex');
    const hash = createHash('sha256').update(image).digest('hex');
    const find = () => readItems('arf_evaluation_evidence', ['id', 'file_id', 'content_hash', 'description'], { evaluation_id: { _eq: detail.evaluation!.id }, request_key: { _eq: requestKey } }, z.array(evidenceRow));
    const match = (row: z.infer<typeof evidenceRow>) => {
        if (row.content_hash !== hash || row.description !== (description || null)) throw new EvaluationError(409, 'IDEMPOTENCY_CONFLICT', 'This upload request was already used for a different photo');
    };
    const previous = await find();
    if (previous[0]) { match(previous[0]); return inspectionDetail(access, scheduleId); }
    if (detail.schedule.status !== 'IN_PROGRESS') throw new EvaluationError(409, 'NOT_EDITABLE', 'Photos cannot be added after completion or the cutoff');
    if (detail.evaluation.evidence.length >= 20) throw new EvaluationError(409, 'PHOTO_LIMIT', 'A maximum of 20 photos is allowed');
    const key = await getPhotoKey(true);
    const h = requestKey.slice(0, 32).split(''); h[12] = '4'; h[16] = '8';
    const s = h.join(''); const fileId = `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
    const identity = `${detail.evaluation.id}:${fileId}`;
    const encrypted = encryptPhoto(image, key, identity);
    const form = new FormData();
    form.set('id', fileId);
    form.set('title', `Encrypted ARF evidence ${fileId}`);
    form.set('file', new Blob([new Uint8Array(encrypted)], { type: 'application/octet-stream' }), `${fileId}.arf`);
    try {
        await fetch(endpoint('files'), { method: 'POST', headers: headers(), body: form, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000) });
    } catch { /* A timed-out upload may have committed; verify its stable ID below. */ }
    // A retry may encounter an already-persisted file. Verify its authenticated
    // contents before linking it; never trust public metadata or a duplicate ID.
    let persisted: Buffer;
    try { persisted = decryptPhoto(await encryptedAsset(fileId), key, identity); }
    catch { throw new EvaluationError(503, 'UPLOAD_UNCONFIRMED', 'The stored photo could not be verified. Retry the same photo.'); }
    if (createHash('sha256').update(persisted).digest('hex') !== hash) throw new EvaluationError(409, 'IDEMPOTENCY_CONFLICT', 'This upload ID belongs to a different photo');
    try {
        await mutate('arf_evaluation_evidence', 'POST', { evaluation_id: detail.evaluation.id, file_id: fileId, criterion_code: null,
            description: description || null, uploaded_by: access.userId, validated_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            retained_bytes: encrypted.length, status: 'ACTIVE', request_key: requestKey, content_hash: hash });
    } catch (error) {
        const recovered = await find();
        if (!recovered[0]) throw error;
        match(recovered[0]);
    }
    return inspectionDetail(access, scheduleId);
}
export async function readEvidence(access: Access, scheduleId: number, evidenceId: number) {
    const detail = await inspectionDetail(access, scheduleId);
    if (!detail.evaluation || !detail.evaluation.evidence.some(e => e.id === evidenceId && e.status === 'ACTIVE')) throw new EvaluationError(404, 'NOT_FOUND', 'Photo was not found in this evaluation');
    const rows = await readItems('arf_evaluation_evidence', ['id', 'file_id', 'content_hash', 'description'], { id: { _eq: evidenceId }, evaluation_id: { _eq: detail.evaluation.id } }, z.array(evidenceRow));
    if (!rows[0]) throw new EvaluationError(404, 'NOT_FOUND', 'Photo not found');
    try {
        const bytes = decryptPhoto(await encryptedAsset(rows[0].file_id), await getPhotoKey(), `${detail.evaluation.id}:${rows[0].file_id}`);
        if (createHash('sha256').update(bytes).digest('hex') !== rows[0].content_hash) throw Error('Photo hash mismatch');
        return bytes;
    } catch { throw new EvaluationError(503, 'PHOTO_UNAVAILABLE', 'The saved photo could not be decrypted or verified'); }
}
