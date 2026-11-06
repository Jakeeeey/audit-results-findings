import { z } from 'zod';
import { accessSchema, detailSchema, scheduleListSchema, warehouseListSchema } from '../contracts';
import { weeklyListSchema } from '../weekly-template';

export class EvaluationRequestError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
const BASE = '/api/arf/evaluation-and-weekly-performance';
async function get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal, mutation?: { method: 'POST' | 'PATCH'; body: unknown }): Promise<T> {
    const response = await fetch(`${BASE}${path}`, { cache: 'no-store', signal,
        ...(mutation ? { method: mutation.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mutation.body) } : {}) });
    const body: unknown = await response.json();
    if (!response.ok) {
        const error = z.object({ error: z.object({ code: z.string(), message: z.string().max(500) }) }).safeParse(body);
        throw new EvaluationRequestError(response.status, error.success ? error.data.error.code : 'UNAVAILABLE',
            error.success ? error.data.error.message : 'Evaluation request failed. Please try again.');
    }
    const parsed = z.object({ data: schema }).safeParse(body);
    if (!parsed.success) throw new EvaluationRequestError(503, 'INVALID_RESPONSE', 'The evaluation service returned an invalid response');
    return parsed.data.data;
}
export const evaluationService = {
    weeklyTemplates:(branchId:number,signal?:AbortSignal)=>get(`/recurrences?branchId=${branchId}`,weeklyListSchema,signal),
    disableWeekly:(id:number)=>get(`/recurrences/${id}/disable`,z.object({id:z.number().int().positive()}),undefined,{method:'POST',body:{}}),
    me: (signal?: AbortSignal) => get('/me', accessSchema, signal),
    warehouses: (signal?: AbortSignal) => get('/warehouses', warehouseListSchema, signal),
    schedules: (branchId: number, from: string, through: string, view: 'scheduler' | 'viewer', signal?: AbortSignal) =>
        get(`/schedules?${new URLSearchParams({ branchId: String(branchId), from, through, view })}`, scheduleListSchema, signal),
    detail: (id: number, signal?: AbortSignal) => get(`/schedules/${id}`, detailSchema, signal),
    create: (body: unknown) => get('/schedules', z.object({ id: z.number().int().positive() }), undefined, { method: 'POST', body }),
    start: (id: number) => get(`/schedules/${id}/start`, z.object({ id: z.number().int().positive() }), undefined, { method: 'POST', body: {} }),
    cancel: (id: number) => get(`/schedules/${id}/cancel`, detailSchema, undefined, { method: 'POST', body: {} }),
    submit: (id: number, body: unknown) => get(`/schedules/${id}/submit`, detailSchema, undefined, { method: 'POST', body }),
    uploadPhoto: async (id: number, file: File, requestId: string, description: string) => {
        const form = new FormData();
        form.set('file', file); form.set('requestId', requestId); form.set('description', description);
        const response = await fetch(`${BASE}/schedules/${id}/evidence`, { method: 'POST', body: form, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(z.object({ error: z.object({ message: z.string().max(500) }) }).safeParse(body).data?.error.message ?? 'Photo upload failed. Retry the same photo.');
        return z.object({ data: detailSchema }).parse(body).data;
    },
    saveDraft: (id: number, body: unknown) => get(`/schedules/${id}/draft`, detailSchema, undefined, { method: 'PATCH', body }),
};
