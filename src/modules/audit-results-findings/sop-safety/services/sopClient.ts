import { z } from 'zod';

export class SopApiError extends Error {
    constructor(message: string, readonly status: number, readonly uncertain: boolean, readonly body?: unknown) { super(message); }
}
export class SopContractError extends Error {
    constructor(readonly body: unknown, paths: string) { super(`SOP response needs verification (${paths}). Records were not treated as empty. No automatic retries were made.`); }
}

export async function sopRequest(path: string, options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; query?: URLSearchParams; signal?: AbortSignal } = {}): Promise<unknown> {
    const method = options.method ?? 'GET';
    const writing = method !== 'GET';
    let response: Response;
    try {
        response = await fetch(`/api/arf/sop-safety/${path}${options.query?.size ? `?${options.query}` : ''}`, {
            method, signal: options.signal, cache: 'no-store',
            ...(writing && method !== 'DELETE' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body ?? {}) } : {}),
        });
    } catch (cause) {
        if (options.signal?.aborted) throw cause;
        throw new SopApiError(writing ? 'Operation could not be confirmed. Reload before retrying; it may have succeeded.' : 'Unable to contact SOP service.', 0, writing);
    }
    if (response.status === 204) return null;
    let body: unknown;
    try { body = await response.json(); } catch { throw new SopApiError('Unexpected response. Reload to confirm record state before retrying.', response.status, writing); }
    if (!response.ok) {
        const message = typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string' ? body.message : 'SOP request failed.';
        throw new SopApiError(`${response.status}: ${message}`, response.status, writing && response.status >= 500, body);
    }
    return body;
}

export function parseSop<T>(schema: z.ZodType<T>, body: unknown): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new SopContractError(body, parsed.error.issues.slice(0, 4).map(issue => issue.path.join('.')).join(', '));
    return parsed.data;
}

export async function readSop<T>(path: string, schema: z.ZodType<T>, query = new URLSearchParams(), signal?: AbortSignal) {
    return parseSop(schema, await sopRequest(path, { query, signal }));
}
