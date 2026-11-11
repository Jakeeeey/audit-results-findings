import { z } from 'zod';

export const TIME_ZONE = 'Asia/Manila';
const DAY = 86_400_000;
export const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR'] as const;
export type Weekday = typeof weekdays[number];

export function dateMillis(value: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9998-12-31') throw new Error('Invalid local date');
    const ms = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date');
    return ms;
}
export function addDays(value: string, days: number): string {
    if (!Number.isSafeInteger(days)) throw new Error('Invalid day offset');
    const result = new Date(dateMillis(value) + days * DAY).toISOString().slice(0, 10);
    dateMillis(result);
    return result;
}
export function reportingWeek(value: string): string {
    const day = new Date(dateMillis(value)).getUTCDay();
    return addDays(value, -((day + 6) % 7));
}
export function localInstant(date: string, time: string): number {
    dateMillis(date);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid local time');
    return Date.parse(`${date}T${time}:00+08:00`);
}
export function submissionDeadline(date: string): number {
    return localInstant(date, '17:00');
}
export function formatLocalDate(date: string): string {
    dateMillis(date);
    return `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(2, 4)}`;
}
const dateSchema = z.string().refine(value => { try { dateMillis(value); return true; } catch { return false; } }, 'Invalid calendar date');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const assignment = {
    branchId: z.number().int().positive().max(2147483647),
    inspectorId: z.number().int().positive().max(2147483647),
    startTime: timeSchema, endTime: timeSchema,
    area: z.string().max(255).nullable().optional(), notes: z.string().max(4000).nullable().optional(),
    requestId: z.uuid(),
};
export const createScheduleSchema = z.discriminatedUnion('kind', [
    z.object({ ...assignment, kind: z.literal('ONE_TIME'), localDate: dateSchema }).strict(),
    z.object({ ...assignment, kind: z.literal('WEEKLY'), from: dateSchema, through: dateSchema,
        weekdays: z.array(z.enum(weekdays)).min(1).max(5).refine(days => new Set(days).size === days.length, 'Duplicate weekday') }).strict(),
]);
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export interface ScheduleOccurrence {
    readonly key: string;
    readonly branchId: number;
    readonly inspectorId: number | null;
    readonly localDate: string;
    readonly reportingWeek: string;
    readonly startsAt: number;
    readonly endsAt: number;
    readonly submissionDeadline: number;
}

/** Validation/generation only; persistence must separately prove atomicity and idempotency. */
export function generateOccurrences(value: unknown): readonly ScheduleOccurrence[] {
    const input = createScheduleSchema.parse(value);
    if (input.endTime <= input.startTime) throw new Error('End time must follow start on the same day');
    if (input.endTime > '17:00') throw new Error('Scheduled end must be no later than 5:00 PM Manila');
    const dates: string[] = [];
    if (input.kind === 'ONE_TIME') dates.push(input.localDate);
    else {
        const first = new Date(dateMillis(input.from));
        const lastDay = new Date(Date.UTC(first.getUTCFullYear() + 1, first.getUTCMonth() + 1, 0)).getUTCDate();
        const anniversary = new Date(Date.UTC(first.getUTCFullYear() + 1, first.getUTCMonth(), Math.min(first.getUTCDate(), lastDay))).toISOString().slice(0, 10);
        if (input.through < input.from || input.through > anniversary) throw new Error('Recurrence must be within 12 months');
        for (let date = input.from; date <= input.through; date = addDays(date, 1)) {
            const day = new Date(dateMillis(date)).getUTCDay();
            if (day >= 1 && day <= 5 && input.weekdays.includes(weekdays[day - 1])) dates.push(date);
            if (date === input.through) break;
        }
    }
    if (!dates.length || dates.length > 365) throw new Error('Expected 1–365 occurrences');
    return dates.map(date => {
        const weekday = new Date(dateMillis(date)).getUTCDay();
        if (weekday === 0 || weekday === 6) throw new Error('Only Monday–Friday schedules are allowed');
        return Object.freeze({ key: `${input.requestId}:${date}`, branchId: input.branchId, inspectorId: input.inspectorId,
            localDate: date, reportingWeek: reportingWeek(date), startsAt: localInstant(date, input.startTime),
            endsAt: localInstant(date, input.endTime), submissionDeadline: submissionDeadline(date) });
    });
}
export function overlaps(a: ScheduleOccurrence, b: ScheduleOccurrence): boolean {
    return (a.branchId === b.branchId || a.inspectorId !== null && a.inspectorId === b.inspectorId) && a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

export type EvaluationStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'EXPIRED_INCOMPLETE' | 'CANCELLED';
export interface EvaluationOccurrence {
    readonly schedule: ScheduleOccurrence;
    readonly startedAt?: number;
    readonly submittedAt?: number;
    readonly cancelledAt?: number;
}
function instant(value: number): void {
    if (!Number.isSafeInteger(value) || !Number.isFinite(new Date(value).getTime())) throw new Error('Invalid timestamp');
}
export function effectiveStatus(row: EvaluationOccurrence, now: number): EvaluationStatus {
    instant(now);
    const { schedule, startedAt, submittedAt, cancelledAt } = row;
    const monday = localInstant(schedule.reportingWeek, '00:00');
    if (cancelledAt !== undefined) {
        instant(cancelledAt);
        if (cancelledAt >= monday || cancelledAt > now || startedAt !== undefined || submittedAt !== undefined) throw new Error('Invalid cancellation history');
        return 'CANCELLED';
    }
    if (startedAt === undefined) {
        if (submittedAt !== undefined) throw new Error('Submission requires a start');
        return now >= schedule.endsAt ? 'MISSED' : 'SCHEDULED';
    }
    instant(startedAt);
    if (startedAt < monday || startedAt >= schedule.endsAt || startedAt > now) throw new Error('Invalid start history');
    if (submittedAt !== undefined) {
        instant(submittedAt);
        if (submittedAt < startedAt || submittedAt >= schedule.submissionDeadline || submittedAt > now) throw new Error('Invalid submission history');
        return 'COMPLETED';
    }
    return now >= schedule.submissionDeadline ? 'EXPIRED_INCOMPLETE' : 'IN_PROGRESS';
}
export function allowedActions(row: EvaluationOccurrence, now: number, assignedInspector: boolean, planner: boolean) {
    const status = effectiveStatus(row, now);
    const monday = localInstant(row.schedule.reportingWeek, '00:00');
    return { status, start: assignedInspector && status === 'SCHEDULED' && now >= monday,
        edit: assignedInspector && status === 'IN_PROGRESS',
        cancel: planner && status === 'SCHEDULED' && row.startedAt === undefined && now < monday };
}
