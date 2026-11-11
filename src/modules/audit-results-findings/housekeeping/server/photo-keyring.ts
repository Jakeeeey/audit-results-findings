import 'server-only';
import { hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { decryptPhoto, encryptPhoto, photoKey } from './photo-crypto';
import { evaluationToken } from './configuration';
import { EvaluationError, secureEndpoint } from './security';

// Public identifier, NOT a secret. The persisted master key is encrypted using
// a key derived from the existing server-only Directus credential.
const keyringId = 'a6f9e420-08b6-4ee4-9f7c-1a4203e5191d';
const identity = `arf-evaluation-keyring-v1:${keyringId}`;
function endpoint(path: string) { return secureEndpoint(process.env.NEXT_PUBLIC_API_BASE_URL, path); }
function credential() {
    const token = evaluationToken();
    if (!token) throw new EvaluationError(503, 'PHOTO_KEY_UNAVAILABLE', 'The Directus server credential is missing');
    return { headers: { Authorization: `Bearer ${token}` }, wrappingKey: Buffer.from(hkdfSync('sha256', token, 'arf-evaluation-keyring-v1', 'master-key-wrapping', 32)) };
}
async function readCapsule(): Promise<Buffer | null> {
    const response = await fetch(endpoint(`assets/${keyringId}`), { headers: credential().headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.status === 403 || response.status === 404) return null;
    if (!response.ok || !response.body) throw new EvaluationError(503, 'PHOTO_KEY_UNAVAILABLE', 'Encrypted photo key storage is unavailable');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
    try {
        while (true) {
            const { done, value } = await reader.read(); if (done) break;
            total += value.length;
            if (total > 1024) { await reader.cancel(); throw new Error('Invalid key capsule'); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    try {
        const master = decryptPhoto(Buffer.concat(chunks), credential().wrappingKey, identity);
        if (master.length !== 32) throw new Error('Invalid master key');
        return master;
    } catch { throw new EvaluationError(503, 'PHOTO_KEY_UNAVAILABLE', 'The saved photo key cannot be unlocked with the current Directus credential. Restore the previous credential or migrate the key before rotating it.'); }
}
async function persistCapsule(master: Buffer): Promise<Buffer> {
    const bytes = encryptPhoto(master, credential().wrappingKey, identity);
    const form = new FormData();
    form.set('id', keyringId); form.set('title', 'ARF encrypted photo key');
    form.set('file', new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }), 'arf-evaluation-keyring.arf');
    try { await fetch(endpoint('files'), { method: 'POST', headers: credential().headers, body: form, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
    catch { /* A timed-out request may have persisted. Read the canonical ID. */ }
    const stored = await readCapsule();
    if (!stored) throw new EvaluationError(503, 'PHOTO_KEY_UNAVAILABLE', 'The encrypted photo key could not be persisted');
    return stored; // Concurrent creators always use the winning stored key.
}
export async function getPhotoKey(create = false): Promise<Buffer> {
    const existing = await readCapsule(); if (existing) return existing;
    if (!create) throw new EvaluationError(503, 'PHOTO_KEY_UNAVAILABLE', 'The saved photo key is missing. Restore its encrypted key file from backup.');
    const response = await fetch(endpoint('items/arf_evaluation_evidence?fields=id&filter[status][_eq]=ACTIVE&limit=1'), { headers: credential().headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const body = response.ok ? await response.json() : null;
    if (!body || !Array.isArray(body.data)) throw new EvaluationError(503, 'PHOTO_KEY_UNAVAILABLE', 'Existing photo storage could not be checked');
    if (body.data.length) throw new EvaluationError(503, 'PHOTO_KEY_MIGRATION_REQUIRED', 'Existing photos require their previous encryption key. Migrate that key before removing the old configuration.');
    return persistCapsule(randomBytes(32));
}
/** Administrative, one-time migration; not exposed by any API route. */
export async function migrateLegacyPhotoKey(hex: string): Promise<void> {
    const legacy = photoKey(hex);
    const stored = await readCapsule() ?? await persistCapsule(legacy);
    if (!timingSafeEqual(legacy, stored)) throw new EvaluationError(503, 'PHOTO_KEY_MIGRATION_CONFLICT', 'A different photo master key is already installed. No configuration should be removed.');
}
