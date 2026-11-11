import 'server-only';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { currentAccess, readItems } from './queries';
import { EvaluationError, secureEndpoint } from './security';
import { createSnapshot, patchDraft, scoreChecklist } from '../shared/checklist';
import { localInstant } from '../shared/scheduling';
import { inspectionDetail } from './schedules';
import { saveReadiness, weeklyReadiness, submissionReadiness } from './save-readiness';
import { weeklyTemplateSchema } from '../shared/weekly-template';
import { evaluationToken } from './configuration';

type Access = Awaited<ReturnType<typeof currentAccess>>;
const integer = z.number().int().positive().max(2147483647);
const savedId = z.object({ id: integer });
export const draftSaveSchema = z.object({ requestId: z.uuid(), expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    patch: z.unknown() }).strict();
async function requireWrites() {
    if (!await saveReadiness()) throw new EvaluationError(503, 'SAVE_SETUP_REQUIRED', 'Apply scripts/evaluation-open-evaluator-migration.sql after the save and weekly migrations, then refresh the Directus schema.');
}
export function verifyWriteOrigin(request: Request) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) throw new EvaluationError(403, 'INVALID_ORIGIN', 'Save requests must originate from this application');
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new EvaluationError(400, 'INVALID_REQUEST', 'JSON is required');
}
export async function writeBody(request: Request): Promise<unknown> {
    verifyWriteOrigin(request);
    const text = await request.text();
    if (text.length > 128000) throw new EvaluationError(400, 'INVALID_REQUEST', 'Save request is too large');
    try { return JSON.parse(text); } catch { throw new EvaluationError(400, 'INVALID_REQUEST', 'Invalid JSON'); }
}
/** Explicit feature collections only. A single REST mutation = one DB transaction. */
export async function mutate(collection: 'arf_evaluation_schedules' | 'arf_evaluation_recurrences' | 'arf_evaluation_evidence' | 'arf_evaluations', method: 'POST' | 'PATCH', payload: unknown, id?: number) {
    const token = evaluationToken();
    if (!token) throw new EvaluationError(503, 'STORAGE_NOT_CONFIGURED', 'Evaluation storage credential is missing');
    const url = secureEndpoint(process.env.NEXT_PUBLIC_API_BASE_URL, `items/${collection}${id ? `/${id}` : ''}`);
    url.searchParams.set('fields', 'id');
    try {
        const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
            // Raw Directus / SQL details never leave the server.
            const body: unknown = await response.json().catch(() => null);
            const parsed = z.object({ errors: z.array(z.object({ message: z.string() })) }).safeParse(body);
            const messages = parsed.success ? parsed.data.errors.map(error => error.message).join('\n') : '';
            if (messages.includes('Illegal mix of collations')) {
                console.error('[Evaluation] Database trigger collation mismatch', { collection, method, status: response.status });
                throw new EvaluationError(503, 'STORAGE_COLLATION_REQUIRED', 'The database saving triggers have a collation mismatch. Apply scripts/evaluation-collation-fix.sql, then retry your draft.');
            }
            const conflicts: Record<string, string> = {
                chk_arf_evaluation_snapshot_shape: 'The database still supports only the historical 1–10 checklist. A versioned 0–5 database migration is required before starting a new evaluation. Existing evaluations remain available.',
                EVAL_STALE_DRAFT: 'The saved draft changed. Reload the evaluation before editing again.',
                EVAL_DEADLINE: 'The stored submission cutoff has passed. This evaluation cannot be reopened.',
                EVAL_ALL_RATINGS_REQUIRED: 'Save all 20 ratings before submitting.',
                EVAL_FINAL_IMMUTABLE: 'This evaluation is already finalized. Reload to view its saved result.',
            };
            for (const [code, message] of Object.entries(conflicts)) {
                if (new RegExp(`\\b${code}\\b`).test(messages)) throw new EvaluationError(409, code, message);
            }
            if (response.status >= 500 || response.status === 401) throw new EvaluationError(503, 'SAVE_UNAVAILABLE', 'Storage could not complete the save. Retry the same request or reload to confirm its state.');
            throw new EvaluationError(response.status === 403 ? 503 : 409, response.status === 403 ? 'WRITE_PERMISSION_REQUIRED' : 'SAVE_CONFLICT',
                response.status === 403 ? 'The evaluation credential needs write permission and refreshed schema access' : 'Save was rejected. The schedule may overlap, the draft revision may be stale, or its cutoff has passed. Reload before retrying.');
        }
        return z.object({ data: savedId }).parse(await response.json()).data;
    } catch (error) {
        if (error instanceof EvaluationError) throw error;
        throw new EvaluationError(503, 'SAVE_UNCONFIRMED', 'Save could not be confirmed. Retry the same request or reload; do not create a replacement.');
    }
}
export async function createSchedule(access: Access, value: unknown) {
    return createWeeklyTemplate(access, value);
}
async function createWeeklyTemplate(access: Access, value: unknown) {
    const input = weeklyTemplateSchema.parse(value);
    access.require(input.branchId, 'PLANNER');
    if (!await weeklyReadiness()) throw new EvaluationError(503, 'WEEKLY_SETUP_REQUIRED', 'Weekly saving requires the weekly and open-evaluator migrations, a refreshed Directus schema and a running MySQL event scheduler.');
    const requestKey = createHash('sha256').update(`${access.userId}:${input.requestId}`).digest('hex');
    const shape = savedId.extend({ created_by: integer, branch_id: integer, inspector_id: integer.nullable(), days_of_week: z.union([z.string(), z.array(z.string())]),
        start_time: z.string(), end_time: z.string(), notes: z.string().nullable() });
    const find = () => readItems('arf_evaluation_recurrences', ['id', 'created_by', 'branch_id', 'inspector_id', 'days_of_week', 'start_time', 'end_time', 'notes'], { request_key: { _eq: requestKey } }, z.array(shape));
    const match = (row: z.infer<typeof shape>) => {
        const days = typeof row.days_of_week === 'string' ? JSON.parse(row.days_of_week) : row.days_of_week;
        if (row.created_by !== access.userId || row.branch_id !== input.branchId || row.inspector_id !== null ||
            JSON.stringify([...days].sort()) !== JSON.stringify([...input.weekdays].sort()) || row.start_time.slice(0,5) !== input.startTime ||
            row.end_time.slice(0,5) !== input.endTime || row.notes !== (input.notes || null)) throw new EvaluationError(409, 'IDEMPOTENCY_CONFLICT', 'This weekly save request was already used with different details');
        return { id: row.id };
    };
    const previous = await find();
    if (previous[0]) return match(previous[0]);
    // Disabling a template does not cancel its generated occurrences. Explain
    // those conflicts before the DB guard rejects the atomic template insert.
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const existing = await readItems('arf_evaluation_schedules', ['id', 'scheduled_local_date', 'scheduled_start', 'scheduled_end'], {
        branch_id: { _eq: input.branchId },
        cancelled_at: { _null: true }, scheduled_local_date: { _gte: today },
    }, z.array(z.object({ id: integer, scheduled_local_date: z.string(), scheduled_start: z.string(), scheduled_end: z.string() })));
    const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    for (const row of existing) {
        const start = new Date(Date.parse(row.scheduled_start.replace(' ', 'T').replace(/Z?$/, 'Z')) + 8 * 3600000);
        const end = new Date(Date.parse(row.scheduled_end.replace(' ', 'T').replace(/Z?$/, 'Z')) + 8 * 3600000);
        const weekday = codes[start.getUTCDay()];
        if (input.weekdays.some(day => day === weekday) && start.toISOString().slice(11, 16) < input.endTime && end.toISOString().slice(11, 16) > input.startTime) {
            throw new EvaluationError(409, 'EXISTING_SCHEDULE_OVERLAP', `This overlaps saved evaluation #${row.id} on ${row.scheduled_local_date}. Disabling a weekly template stops new generation but preserves existing evaluations. Choose different weekdays or times.`);
        }
    }
    try {
        // The AFTER INSERT trigger creates the first horizon atomically. No partial template success.
        return await mutate('arf_evaluation_recurrences', 'POST', { branch_id: input.branchId, inspector_id: null, days_of_week: input.weekdays,
            start_date: new Date(Date.now()+8*3600000).toISOString().slice(0,10), end_date: null, start_time: `${input.startTime}:00`, end_time: `${input.endTime}:00`,
            timezone: 'Asia/Manila', created_by: access.userId, request_key: requestKey, enabled: 1, notes: input.notes || null });
    } catch (error) { const recovered = await find(); if (recovered[0]) return match(recovered[0]); throw error; }
}
export async function startInspection(access: Access, scheduleId: number) {
    await requireWrites();
    const detail = await inspectionDetail(access, scheduleId);
    access.require(detail.schedule.branchId);
    if (detail.evaluation) {
        if (detail.schedule.inspectorId !== access.userId) throw new EvaluationError(409, 'ALREADY_CLAIMED', 'Another evaluator has already started this evaluation. Only that person can edit it.');
        return { id: detail.evaluation.id };
    }
    if (detail.schedule.status !== 'SCHEDULED' || Date.now() < localInstant(detail.schedule.week, '00:00')) throw new EvaluationError(409, 'START_NOT_ALLOWED', 'This inspection cannot be started now');
    try {
        return await mutate('arf_evaluations', 'POST', { schedule_id: scheduleId, inspector_id: access.userId,
            checklist_version: 2, checklist_snapshot: createSnapshot(), status: 'IN_PROGRESS', started_at: new Date().toISOString().replace('T', ' ').replace('Z', '') });
    } catch (error) {
        const recovered = await inspectionDetail(access, scheduleId);
        if (recovered.evaluation) {
            if (recovered.schedule.inspectorId !== access.userId) throw new EvaluationError(409, 'ALREADY_CLAIMED', 'Another evaluator has already started this evaluation. Only that person can edit it.');
            return { id: recovered.evaluation.id };
        }
        throw error;
    }
}
export async function cancelInspection(access: Access, scheduleId: number) {
    await requireWrites();
    const detail = await inspectionDetail(access, scheduleId);
    access.require(detail.schedule.branchId, 'PLANNER');
    if (detail.schedule.status === 'CANCELLED') return detail;
    if (detail.evaluation || detail.schedule.status !== 'SCHEDULED' || Date.now() >= localInstant(detail.schedule.week, '00:00')) {
        throw new EvaluationError(409, 'CANCEL_NOT_ALLOWED', 'Only unstarted evaluations can be cancelled, before their reporting week begins.');
    }
    try {
        // The database requires the complete cancellation audit tuple together.
        await mutate('arf_evaluation_schedules', 'PATCH', {
            cancelled_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            cancelled_by: access.userId,
            cancellation_reason: 'Cancelled by planner through the evaluation UI.',
        }, scheduleId);
    } catch (error) {
        const recovered = await inspectionDetail(access, scheduleId);
        if (recovered.schedule.status === 'CANCELLED') return recovered;
        throw error;
    }
    return inspectionDetail(access, scheduleId);
}
export async function saveDraft(access: Access, scheduleId: number, value: unknown) {
    await requireWrites();
    const input = draftSaveSchema.parse(value);
    const detail = await inspectionDetail(access, scheduleId);
    access.require(detail.schedule.branchId);
    if (detail.schedule.inspectorId !== access.userId) throw new EvaluationError(403, 'NOT_OWNER', 'Only the person who started this evaluation can save it');
    if (!detail.evaluation || detail.schedule.status !== 'IN_PROGRESS') throw new EvaluationError(409, 'NOT_EDITABLE', 'Start this inspection first; expired or completed inspections cannot be edited');
    const draft = patchDraft({ remarks: detail.evaluation.remarks, responses: detail.evaluation.responses }, input.patch);
    const responses = detail.evaluation.snapshot.criteria.map(c => draft.responses.find(r => r.criterionCode === c.code) ?? { criterionCode: c.code, rating: null, remarks: null });
    scoreChecklist(detail.evaluation.snapshot, detail.evaluation.snapshot.version, responses);
    // No separate response writes: the DB applies all answers + revision atomically.
    await mutate('arf_evaluations', 'PATCH', { draft_save: { requestId: input.requestId, expectedRevision: input.expectedRevision, actorId: access.userId,
        remarks: draft.remarks, responses } }, detail.evaluation.id);
    return inspectionDetail(access, scheduleId);
}
export const submitSchema = z.object({ requestId: z.uuid(), expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();
export async function submitEvaluation(access: Access, scheduleId: number, value: unknown) {
    const input = submitSchema.parse(value);
    if (!await submissionReadiness()) throw new EvaluationError(503, 'SUBMISSION_SETUP_REQUIRED', 'Apply scripts/evaluation-submit-migration.sql and refresh Directus before submitting.');
    const detail = await inspectionDetail(access, scheduleId);
    access.require(detail.schedule.branchId);
    if (!detail.evaluation || detail.schedule.inspectorId !== access.userId) throw new EvaluationError(403, 'NOT_OWNER', 'Only the person who started this evaluation can submit it');
    if (detail.schedule.status === 'COMPLETED') return detail;
    if (detail.schedule.status !== 'IN_PROGRESS') throw new EvaluationError(409, 'NOT_EDITABLE', 'This evaluation is no longer open');
    if (detail.evaluation.revision !== input.expectedRevision) throw new EvaluationError(409, 'STALE_REVISION', 'The saved evaluation changed. Reload before submitting.');
    const score = scoreChecklist(detail.evaluation.snapshot, detail.evaluation.snapshot.version, detail.evaluation.responses);
    if (!score.complete) throw new EvaluationError(409, 'INCOMPLETE_RATINGS', 'Save all 20 ratings and at least one photo before submitting. Remarks are optional.');
    try {
        await mutate('arf_evaluations', 'PATCH', { submit_command: { ...input, actorId: access.userId } }, detail.evaluation.id);
    } catch (error) {
        const recovered = await inspectionDetail(access, scheduleId);
        if (recovered.schedule.status === 'COMPLETED' && recovered.schedule.inspectorId === access.userId) return recovered;
        throw error;
    }
    return inspectionDetail(access, scheduleId);
}
