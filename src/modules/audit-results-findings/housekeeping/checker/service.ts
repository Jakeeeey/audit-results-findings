import { z } from 'zod';
import { parseContract, auditDetail, attachmentRow } from '../spring/workflow';
import { checkerAccessSchema, checkerAuditPage, checkerActionPage, checkerActionSchema, checkerSummarySchema } from './contracts';
const BASE = '/api/arf/housekeeping/spring/checker';
async function request<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal, body?: unknown): Promise<T> {
    const response = await fetch(`${BASE}/${path}`, { cache: 'no-store', signal, ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    const result: unknown = await response.json();
    if (!response.ok) throw new Error(result && typeof result === 'object' && 'message' in result && typeof result.message === 'string' ? result.message : 'Housekeeping Checker request failed.');
    return parseContract(schema, result);
}
export const checkerService = {
    access: (signal?: AbortSignal) => request('access', checkerAccessSchema, signal),
    summary: (query: URLSearchParams, signal?: AbortSignal) => request(`summary?${query}`, checkerSummarySchema, signal),
    audits: (query: URLSearchParams, signal?: AbortSignal) => request(`audits?${query}`, checkerAuditPage, signal),
    actions: (query: URLSearchParams, signal?: AbortSignal) => request(`actions?${query}`, checkerActionPage, signal),
    audit: (auditId: number, branchId: number, signal?: AbortSignal) => request(`audits/${auditId}?branchId=${branchId}`, auditDetail, signal),
    auditActions: (auditId: number, branchId: number, signal?: AbortSignal) => request(`audits/${auditId}/actions?branchId=${branchId}`, z.array(checkerActionSchema), signal),
    attachments: (auditId: number, branchId: number, signal?: AbortSignal) => request(`audits/${auditId}/attachments?branchId=${branchId}`, z.array(attachmentRow), signal),
};
export const completeCheckerAction = (actionId: number, auditId: number, branchId: number) => request(`actions/${actionId}/done`, z.object({ action: checkerActionSchema }), undefined, { auditId, branchId });
