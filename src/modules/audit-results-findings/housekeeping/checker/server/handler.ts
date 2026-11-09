import 'server-only';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authorizeChecker, checkerError, CheckerAccessError } from './access';
import { springHousekeepingQuery } from '../../spring/routes';
import { springKpiSchema } from '../../spring/contracts';
import { auditDetail, attachmentRow, parseContract } from '../../spring/workflow';
import { checkerActionSchema, checkerActionPage, checkerAuditPage, overdue } from '../contracts';
import { manilaToday } from '../../shared/contracts';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const id = z.coerce.number().int().positive().safe();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
export async function handleCheckerRequest(req: NextRequest, segments: string[]): Promise<Response> {
    try {
        const access = await authorizeChecker(req);
        const resource = segments.join('/');
        async function read(path: string) {
            const response = await access.fetchHousekeeping(path);
            if (!response.ok) throw new CheckerAccessError([400, 401, 403, 404, 409].includes(response.status) ? response.status : 503, 'The audit service could not complete the Checker request. Refresh and verify your access.');
            return response.json() as Promise<unknown>;
        }
        if (req.method === 'GET' && resource === 'access') {
            if (req.nextUrl.search) throw new CheckerAccessError(400, 'Access lookup does not accept filters.');
            return json({ userId: access.userId, warehouses: access.warehouses.map(w => ({ id: w.id, name: w.branch_name, code: w.branch_code })), canComplete: access.canComplete, commentsSupported: false, resolutionEvidenceSupported: false });
        }
        if (req.method === 'POST') {
            if (!/^actions\/[1-9]\d*\/done$/.test(resource)) throw new CheckerAccessError(403, 'This Checker operation is read-only.');
            const actionId = id.parse(segments[1]);
            if (!access.canComplete) throw new CheckerAccessError(403, 'Checker resolution permission is required.');
            if (req.headers.get('origin') !== req.nextUrl.origin) throw new CheckerAccessError(403, 'Status updates must originate from this application.');
            if (req.nextUrl.search || !req.headers.get('content-type')?.includes('application/json')) throw new CheckerAccessError(400, 'Send a JSON status confirmation without query parameters.');
            const text = await req.text(); if (text.length > 2000) throw new CheckerAccessError(413, 'Request too large.');
            const body = z.object({ auditId: id, branchId: id }).strict().parse(JSON.parse(text));
            access.requireWarehouse(body.branchId);
            const audit = parseContract(auditDetail, await read(`api/housekeeping/audits/${body.auditId}`)).audit;
            if (audit.id !== body.auditId || audit.branchId !== body.branchId || audit.status !== 'Submitted') throw new CheckerAccessError(403, 'The action must belong to a submitted audit in the selected warehouse.');
            const actions = parseContract(z.array(checkerActionSchema), await read(`api/housekeeping/audits/${body.auditId}/corrective-actions`));
            const action = actions.find(a => a.id === actionId);
            if (!action || (action.auditId !== undefined && action.auditId !== audit.id) || (action.branchId !== undefined && action.branchId !== audit.branchId)) throw new CheckerAccessError(403, 'The corrective action does not belong to this audit and warehouse.');
            if (action.status !== 'Open') throw new CheckerAccessError(409, 'Only an Open corrective action can be marked Done. Refresh the record.');
            if (action.assignedTo != null && String(action.assignedTo) !== String(access.userId)) throw new CheckerAccessError(403, 'Only unassigned Open actions or actions assigned to you may be updated.');
            const response = await access.fetchHousekeeping(`api/housekeeping/corrective-actions/${action.id}/done`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            if (!response.ok) throw new CheckerAccessError([400, 401, 403, 404, 409].includes(response.status) ? response.status : 503, 'The backend did not confirm completion. Refresh the action before retrying.');
            const updated = parseContract(z.array(checkerActionSchema), await read(`api/housekeeping/audits/${audit.id}/corrective-actions`)).find(a => a.id === action.id);
            if (!updated || updated.status !== 'Done') throw new CheckerAccessError(409, 'Completion was not confirmed on reload. Refresh before retrying.');
            return json({ action: updated });
        }
        if (req.method !== 'GET') throw new CheckerAccessError(403, 'This Checker operation is not permitted.');
        const detailMatch = /^audits\/([1-9]\d*)(\/(attachments|actions))?$/.exec(resource);
        const listResource = resource === 'actions' ? 'corrective-actions' : resource === 'summary' ? 'kpi' : 'audits';
        const query = springHousekeepingQuery(detailMatch ? 'kpi' : listResource, req.nextUrl.searchParams);
        const branchId = id.parse(query.get('branchId')); access.requireWarehouse(branchId);
        if (detailMatch) {
            const auditId = id.parse(detailMatch[1]);
            if ([...query.keys()].some(key => key !== 'branchId')) throw new CheckerAccessError(400, 'Audit detail accepts warehouse scope only.');
            const detail = parseContract(auditDetail, await read(`api/housekeeping/audits/${auditId}`));
            if (detail.audit.id !== auditId || detail.audit.branchId !== branchId || detail.audit.status !== 'Submitted') throw new CheckerAccessError(403, 'Checker results are limited to submitted audits in the selected warehouse.');
            if (detailMatch[3] === 'attachments') return json(parseContract(z.array(attachmentRow), await read(`api/housekeeping/audits/${detail.audit.id}/attachments`)));
            if (detailMatch[3] === 'actions') return json(parseContract(z.array(checkerActionSchema), await read(`api/housekeeping/audits/${detail.audit.id}/corrective-actions`)));
            return json(detail);
        }
        if (resource === 'audits') {
            if (query.has('status') && query.get('status') !== 'Submitted') throw new CheckerAccessError(403, 'Draft and cancelled audits are not enabled in the Checker.');
            query.set('status', 'Submitted');
            const body = parseContract(checkerAuditPage, await read(`api/housekeeping/audits?${query}`));
            if (body.audits.some(a => a.branchId !== branchId || (query.has('from') && a.auditDate < query.get('from')!) || (query.has('to') && a.auditDate > query.get('to')!))) throw new CheckerAccessError(503, 'The audit service returned records outside the selected warehouse or reporting period.');
            return json(body);
        }
        if (resource === 'actions') {
            const body = parseContract(checkerActionPage, await read(`api/housekeeping/corrective-actions?${query}`));
            if (body.actions.some(a => a.branchId !== undefined && a.branchId !== branchId)) throw new CheckerAccessError(503, 'The action service returned records outside the selected warehouse.');
            return json(body);
        }
        if (resource === 'summary') {
            z.iso.date().parse(query.get('from')); z.iso.date().parse(query.get('to'));
            const [kpi, open, done, recent] = await Promise.all([
                read(`api/bia/warehouse-kpi/housekeeping?${query}`).then(body => parseContract(springKpiSchema, body)),
                read(`api/housekeeping/corrective-actions?branchId=${branchId}&status=Open&page=1&pageSize=100`).then(body => parseContract(checkerActionPage, body)),
                read(`api/housekeeping/corrective-actions?branchId=${branchId}&status=Done&page=1&pageSize=1`).then(body => parseContract(checkerActionPage, body)),
                read(`api/housekeeping/audits?${new URLSearchParams({ branchId: String(branchId), from: query.get('from')!, to: query.get('to')!, status: 'Submitted', page: '1', pageSize: '5' })}`).then(body => parseContract(checkerAuditPage, body)),
            ]);
            if (kpi.branchIds.length !== 1 || kpi.branchIds[0] !== branchId || kpi.from !== query.get('from') || kpi.to !== query.get('to')) throw new CheckerAccessError(503, 'KPI scope did not match the requested warehouse and reporting period.');
            if (recent.audits.some(a => a.branchId !== branchId || a.auditDate < query.get('from')! || a.auditDate > query.get('to')!)) throw new CheckerAccessError(503, 'Recent audit scope did not match the selected warehouse and reporting period.');
            const allOpen = [...open.actions];
            if (open.total <= 1000) for (let page = 2; allOpen.length < open.total && page <= 10; page++) {
                const next = parseContract(checkerActionPage, await read(`api/housekeeping/corrective-actions?branchId=${branchId}&status=Open&page=${page}&pageSize=100`));
                if (!next.actions.length) break; allOpen.push(...next.actions);
            }
            if (allOpen.some(a => a.status !== 'Open' || (a.branchId !== undefined && a.branchId !== branchId)) || done.actions.some(a => a.status !== 'Done' || (a.branchId !== undefined && a.branchId !== branchId))) throw new CheckerAccessError(503, 'The backend action filters did not match the requested scope.');
            const complete = allOpen.length === open.total && new Set(allOpen.map(a => a.id)).size === open.total;
            const today = manilaToday();
            const attention = complete ? [...allOpen].sort((a, b) => Number(overdue(b, today)) - Number(overdue(a, today)) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.id - a.id).slice(0, 5) : [];
            return json({ kpi, openActions: open.total, completedActions: done.total, overdueActions: complete ? allOpen.filter(a => overdue(a, today)).length : null, attention, recentAudits: recent.audits, actionScope: 'all-dates', attentionComplete: complete, asOfDate: today });
        }
        throw new CheckerAccessError(404, 'Checker resource not found.');
    } catch (cause) {
        if (cause instanceof z.ZodError || cause instanceof SyntaxError || (cause instanceof Error && /Unsupported|Invalid|Identifiers|Page size|Start date/.test(cause.message))) return json({ message: 'Invalid Checker filter or confirmation request.' }, 400);
        const error = checkerError(cause); return json({ message: error.message }, error.status);
    }
}
