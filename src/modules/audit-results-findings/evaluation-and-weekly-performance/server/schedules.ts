import 'server-only';
import { z } from 'zod';
import { currentAccess, readItems } from './queries';
import { EvaluationError } from './security';
import { dateMillis, localInstant } from '../shared/scheduling';
import { detailSchema, scheduleListSchema, scheduleView, storedEvaluationSchema, storedScheduleSchema } from '../shared/contracts';
import { scoreChecklist, snapshotSchema } from '../shared/checklist';

const scheduleFields = ['id', 'evaluation_no', 'branch_id', 'warehouse_name_snapshot', 'inspector_id', 'scheduled_local_date', 'scheduled_start', 'scheduled_end',
    'submission_deadline', 'reporting_week_start', 'warehouse_area', 'notes', 'cancelled_at'];
const evaluationFields = ['id', 'schedule_id', 'inspector_id', 'status', 'started_at', 'submitted_at', 'final_percentage'];
const gate = 'Save setup required: apply scripts/evaluation-open-evaluator-migration.sql after the save and weekly migrations and refresh Directus. Submission and uploads remain unavailable.';
const localDate = z.string().refine(value => { try { dateMillis(value); return true; } catch { return false; } }, 'Invalid date');
export const scheduleQuerySchema = z.object({ branchId: z.coerce.number().int().positive().max(2147483647), from: localDate, through: localDate,
    view: z.enum(['scheduler', 'viewer']).default('viewer') }).strict().refine(q => q.through >= q.from && dateMillis(q.through) - dateMillis(q.from) <= 366 * 86400000, 'Date range must be at most 366 days');

type Access = Awaited<ReturnType<typeof currentAccess>>;
function scope(access: Access, branchId: number, view: 'scheduler' | 'viewer') {
    access.require(branchId, view === 'scheduler' ? 'PLANNER' : undefined);
    return { branch_id: { _eq: branchId } };
}
export async function listSchedules(access: Access, query: z.infer<typeof scheduleQuerySchema>) {
    const filter = { ...scope(access, query.branchId, query.view), scheduled_local_date: { _gte: query.from, _lte: query.through } };
    const rows = await readItems('arf_evaluation_schedules', scheduleFields, filter, z.array(storedScheduleSchema));
    const evaluations: z.infer<typeof storedEvaluationSchema>[] = [];
    for (let offset = 0; offset < rows.length; offset += 100) {
        evaluations.push(...await readItems('arf_evaluations', evaluationFields,
            { schedule_id: { _in: rows.slice(offset, offset + 100).map(r => r.id) } }, z.array(storedEvaluationSchema)));
    }
    if (new Set(evaluations.map(e => e.schedule_id)).size !== evaluations.length) throw new EvaluationError(503, 'DATA_INTEGRITY', 'Duplicate evaluation records require administrator review');
    const now = Date.now();
    try {
        const data = rows.map(row => scheduleView(row, evaluations.find(e => e.schedule_id === row.id), now));
        return scheduleListSchema.parse({ rows: data.sort((a, b) => a.startsAt.localeCompare(b.startsAt)), asOf: new Date(now).toISOString(),
            inspectorOptions: [...new Set(data.flatMap(r => r.inspectorId === null ? [] : [r.inspectorId]))], capabilities: { create: !!access.savesEnabled && access.grants.some(g => g.branchId === query.branchId && g.roles.includes('PLANNER')),
                weeklyCreate: !!access.weeklySavesEnabled && access.grants.some(g => g.branchId === query.branchId && g.roles.includes('PLANNER')),
                reason: access.weeklySavesEnabled ? 'Weekly templates repeat until disabled. Individual evaluations close at 5:00 PM Manila.' : 'Weekly setup required: install the weekly and open-evaluator migrations and refresh Directus. The MySQL event scheduler must be running.' } });
    } catch { throw new EvaluationError(503, 'DATA_INTEGRITY', 'Stored evaluation data could not be validated'); }
}
export async function inspectionDetail(access: Access, id: number) {
    const branchIds = [...new Set(access.grants.map(g => g.branchId))].filter(id => access.eligibleWarehouseIds.includes(id));
    const rows = await readItems('arf_evaluation_schedules', scheduleFields, { id: { _eq: id }, branch_id: { _in: branchIds } }, z.array(storedScheduleSchema));
    const row = rows[0];
    if (!row) throw new EvaluationError(404, 'NOT_FOUND', 'Inspection was not found in your permitted scope');
    scope(access, row.branch_id, 'viewer');
    const rawSchema = storedEvaluationSchema.extend({ checklist_version: z.number().int().positive(), checklist_snapshot: z.unknown(),
        revision: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)), remarks: z.string().nullable() });
    const records = await readItems('arf_evaluations', [...evaluationFields, 'checklist_version', 'checklist_snapshot', 'revision', 'remarks'], { schedule_id: { _eq: id } }, z.array(rawSchema));
    if (records.length > 1) throw new EvaluationError(503, 'DATA_INTEGRITY', 'Duplicate evaluations require administrator review');
    const record = records[0];
    const responses = record ? await readItems('arf_evaluation_responses', ['id', 'criterion_code', 'rating', 'remarks'], { evaluation_id: { _eq: record.id } },
        z.array(z.object({ id: z.number().int().positive(), criterion_code: z.string(), rating: z.number().int().min(1).max(10).nullable(), remarks: z.string().nullable() })).max(20)) : [];
    const evidence = record ? await readItems('arf_evaluation_evidence', ['id', 'criterion_code', 'description', 'status'], { evaluation_id: { _eq: record.id } },
        z.array(z.object({ id: z.number().int().positive(), criterion_code: z.string().nullable(), description: z.string().nullable(), status: z.enum(['ACTIVE', 'REMOVED', 'SUPERSEDED']) }))) : [];
    const now = Date.now();
    try {
        const snapshot = record ? snapshotSchema.parse(typeof record.checklist_snapshot === 'string' ? JSON.parse(record.checklist_snapshot) : record.checklist_snapshot) : null;
        if (snapshot && snapshot.version !== record.checklist_version) throw new Error('Version mismatch');
        if (new Set(responses.map(r => r.criterion_code)).size !== responses.length) throw new Error('Duplicate response');
        const mappedResponses = responses.map(r => ({ criterionCode: r.criterion_code, rating: r.rating, remarks: r.remarks }));
        if (record && snapshot) {
            const score = scoreChecklist(snapshot, record.checklist_version, mappedResponses, record.status === 'COMPLETED');
            if (record.status === 'COMPLETED' && score.percentage !== Number(record.final_percentage)) throw new Error('Incomplete finalized record');
        }
        const schedule = scheduleView(row, record, now);
        const member = !!access.savesEnabled && access.grants.some(g => g.branchId === row.branch_id);
        const assigned = member && record?.inspector_id === access.userId;
        return detailSchema.parse({ schedule, asOf: new Date(now).toISOString(),
            evaluation: record ? { id: record.id, revision: record.revision, snapshot, remarks: record.remarks,
                responses: mappedResponses,
                evidence: evidence.map(e => ({ id: e.id, criterionCode: e.criterion_code, description: e.description, status: e.status })) } : null,
            capabilities: { start: member && !record && schedule.status === 'SCHEDULED' && now >= localInstant(schedule.week, '00:00'), save: assigned && schedule.status === 'IN_PROGRESS',
                cancel: !!access.savesEnabled && !record && schedule.status === 'SCHEDULED' && now < localInstant(schedule.week, '00:00') && access.grants.some(g => g.branchId === row.branch_id && g.roles.includes('PLANNER')),
                upload: assigned && schedule.status === 'IN_PROGRESS' && !!access.submissionEnabled,
                submit: assigned && schedule.status === 'IN_PROGRESS' && !!access.submissionEnabled,
                reason: !access.savesEnabled ? gate : access.submissionEnabled ? 'Save your ratings before submitting. All 20 ratings are required; photos and remarks are optional. Submission is permanent.' : 'Draft saving is enabled. Upload and submission require the submission database migration and a refreshed Directus schema.' } });
    } catch { throw new EvaluationError(503, 'DATA_INTEGRITY', 'Stored inspection data could not be validated'); }
}
