import { z } from 'zod';
import { dateMillis, effectiveStatus, formatLocalDate, localInstant, reportingWeek, submissionDeadline, type EvaluationOccurrence } from './scheduling';
import { responseSchema, snapshotSchema } from './checklist';

export const statusSchema = z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'EXPIRED_INCOMPLETE', 'CANCELLED']);
export const roleSchema = z.enum(['PLANNER', 'INSPECTOR', 'AUDITOR']);
export const accessSchema = z.object({ userId: z.number().int().positive(), authorizationMode: z.string(),
    grants: z.array(z.object({ branchId: z.number().int().positive(), userId: z.number().int().positive(), roles: z.array(roleSchema) })),
    eligibleWarehouseIds: z.array(z.number().int().positive()), persistence: z.literal('NOT_VERIFIED') });
export type AccessInfo = z.infer<typeof accessSchema>;
export const warehouseListSchema = z.array(z.object({ id: z.number().int().positive(), branch_name: z.string(), branch_code: z.string(), isActive: z.union([z.literal(1), z.literal(true)]) }));
export const scheduleViewSchema = z.object({
    id: z.number().int().positive(), reference: z.string(), branchId: z.number().int().positive(), warehouse: z.string(),
    inspectorId: z.number().int().positive().nullable(), localDate: z.string(), startsAt: z.string(), endsAt: z.string(), deadline: z.string(),
    week: z.string(), area: z.string().nullable(), notes: z.string().nullable(), status: statusSchema,
    evaluationId: z.number().int().positive().nullable(), percentage: z.number().nullable(),
    startedAt: z.string().nullable(), submittedAt: z.string().nullable(),
});
export type ScheduleView = z.infer<typeof scheduleViewSchema>;
export const scheduleListSchema = z.object({ rows: z.array(scheduleViewSchema), asOf: z.string(),
    inspectorOptions: z.array(z.number().int().positive()), capabilities: z.object({ create: z.boolean(), weeklyCreate: z.boolean().default(false), reason: z.string() }) });
export type ScheduleList = z.infer<typeof scheduleListSchema>;
export const detailSchema = z.object({ schedule: scheduleViewSchema, asOf: z.string(),
    evaluation: z.object({ id: z.number().int().positive(), revision: z.number().int().nonnegative(), snapshot: snapshotSchema,
        remarks: z.string().nullable(), responses: z.array(responseSchema),
        evidence: z.array(z.object({ id: z.number().int().positive(), criterionCode: z.string().nullable(), description: z.string().nullable(), status: z.string() })),
    }).nullable(),
    capabilities: z.object({ start: z.boolean(), save: z.boolean(), cancel: z.boolean().default(false), submit: z.boolean(), upload: z.boolean(), reason: z.string() }),
});
export type InspectionDetail = z.infer<typeof detailSchema>;
export function utcMillis(value: string): number {
    if (!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?Z?$/.test(value)) throw new Error('Invalid stored timestamp');
    const result = Date.parse(value.replace(' ', 'T').replace(/Z?$/, 'Z'));
    if (!Number.isFinite(result)) throw new Error('Invalid stored timestamp');
    return result;
}
const id = z.number().int().positive();
export const storedScheduleSchema = z.object({ id, evaluation_no: z.string(), branch_id: id, warehouse_name_snapshot: z.string(), inspector_id: id.nullable(),
    scheduled_local_date: z.string(), scheduled_start: z.string(), scheduled_end: z.string(), submission_deadline: z.string(), reporting_week_start: z.string(),
    warehouse_area: z.string().nullable(), notes: z.string().nullable(), cancelled_at: z.string().nullable() });
export const storedEvaluationSchema = z.object({ id, schedule_id: id, inspector_id: id, status: z.enum(['IN_PROGRESS', 'COMPLETED', 'EXPIRED_INCOMPLETE']),
    started_at: z.string(), submitted_at: z.string().nullable(), final_percentage: z.union([z.number(), z.string()]).nullable() });
export type StoredSchedule = z.infer<typeof storedScheduleSchema>;
export type StoredEvaluation = z.infer<typeof storedEvaluationSchema>;
export function scheduleView(row: StoredSchedule, evaluation: StoredEvaluation | undefined, now: number): ScheduleView {
    dateMillis(row.scheduled_local_date);
    const start = utcMillis(row.scheduled_start), end = utcMillis(row.scheduled_end), deadline = utcMillis(row.submission_deadline);
    const dateAt = (time: number) => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
    const weekday = new Date(dateMillis(row.scheduled_local_date)).getUTCDay();
    if (weekday < 1 || weekday > 5 || start >= end || dateAt(start) !== row.scheduled_local_date || dateAt(end) !== row.scheduled_local_date ||
        row.reporting_week_start !== reportingWeek(row.scheduled_local_date) ||
        (deadline !== submissionDeadline(row.scheduled_local_date) && deadline !== dateMillis(row.scheduled_local_date) + 28 * 3600000)) throw new Error('Stored schedule integrity failure');
    if (evaluation && (evaluation.schedule_id !== row.id ||
        (evaluation.status === 'COMPLETED') !== (evaluation.submitted_at !== null))) throw new Error('Stored evaluation integrity failure');
    const occurrence: EvaluationOccurrence = { schedule: { key: String(row.id), branchId: row.branch_id, inspectorId: evaluation?.inspector_id ?? null,
        localDate: row.scheduled_local_date, reportingWeek: row.reporting_week_start, startsAt: start, endsAt: end, submissionDeadline: deadline },
        ...(evaluation ? { startedAt: utcMillis(evaluation.started_at) } : {}),
        ...(evaluation?.submitted_at ? { submittedAt: utcMillis(evaluation.submitted_at) } : {}),
        ...(row.cancelled_at ? { cancelledAt: utcMillis(row.cancelled_at) } : {}),
    };
    const status = effectiveStatus(occurrence, now);
    if (evaluation?.status === 'EXPIRED_INCOMPLETE' && status !== 'EXPIRED_INCOMPLETE') throw new Error('Invalid stored expiry');
    const percentage = evaluation?.final_percentage == null ? null : Number(evaluation.final_percentage);
    if (status === 'COMPLETED' ? percentage === null || !Number.isFinite(percentage) || percentage < 10 || percentage > 100 : percentage !== null) throw new Error('Invalid stored final score');
    // No browser clock or stored marker can override deadline-derived lifecycle.
    return scheduleViewSchema.parse({ id: row.id, reference: row.evaluation_no, branchId: row.branch_id, warehouse: row.warehouse_name_snapshot,
        inspectorId: evaluation?.inspector_id ?? null, localDate: row.scheduled_local_date, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(),
        deadline: new Date(deadline).toISOString(), week: row.reporting_week_start, area: row.warehouse_area, notes: row.notes, status,
        evaluationId: evaluation?.id ?? null, percentage, startedAt: evaluation ? new Date(utcMillis(evaluation.started_at)).toISOString() : null,
        submittedAt: evaluation?.submitted_at ? new Date(utcMillis(evaluation.submitted_at)).toISOString() : null });
}
export function monthRange(month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Invalid month');
    const from = `${month}-01`;
    const start = new Date(dateMillis(from));
    const through = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { from, through };
}
export function manilaToday(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
export function displayTime(iso: string) { return new Date(iso).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }); }
export function displayTimestamp(iso: string) { return `${formatLocalDate(new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 10))} ${displayTime(iso)}`; }
export function startsInWeek(row: ScheduleView, now: number) { return now >= localInstant(row.week, '00:00') && now < Date.parse(row.endsAt); }
