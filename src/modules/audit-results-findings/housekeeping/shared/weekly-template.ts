import { z } from 'zod';
import { weekdays } from './scheduling';

/** An indefinite weekly pattern, not a client-assigned date range. */
export const weeklyTemplateSchema = z.object({
    kind: z.literal('WEEKLY'),
    requestId: z.uuid(),
    branchId: z.number().int().positive().max(2147483647),
    weekdays: z.array(z.enum(weekdays)).min(1).max(5).refine(days => new Set(days).size === days.length, 'Select each weekday only once'),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    notes: z.string().max(4000).optional(),
}).strict().superRefine((value, context) => {
    if (value.endTime <= value.startTime) context.addIssue({ code: 'custom', path: ['endTime'], message: 'End must be later than start' });
    if (value.endTime > '17:00') context.addIssue({ code: 'custom', path: ['endTime'], message: 'End must be no later than 5:00 PM Manila' });
});
export const weeklyListSchema = z.array(z.object({ id:z.number().int().positive(),branchId:z.number().int().positive(),inspectorId:z.number().int().positive().nullable(),
    weekdays:z.array(z.enum(weekdays)).min(1).max(5),startTime:z.string(),endTime:z.string(),enabled:z.boolean(),notes:z.string().nullable() }));
