import { z } from 'zod';

export const dummyWarehouses = [
    { id: 190, name: 'WAREHOUSE - DRY22' },
    { id: 194, name: 'WAREHOUSE - FROZEN' },
    { id: 196, name: 'WAREHOUSE - INDUSTRIAL' },
    { id: 278, name: 'CENTRAL WAREHOUSE' },
] as const;

const id = z.number().int().positive();
const nonnegative = z.number().finite().nonnegative();
const percentage = z.number().finite().min(0).max(100).nullable();
export const springChecklistSchema = z.object({
    id, name: z.string(), description: z.string().nullable(), branchId: id.nullable(),
    frequency: z.enum(['Daily', 'Weekly', 'Monthly']), maxGrade: z.number().finite().positive(),
    active: z.boolean(), createdAt: z.string(),
});
export const springChecklistListSchema = z.array(springChecklistSchema);
export type SpringChecklist = z.infer<typeof springChecklistSchema>;
export const springSections = ['Sort', 'Set in Order', 'Shine', 'Standardize', 'Sustain'] as const;
export const springItemSchema = z.object({
    id, checklistId: id, section: z.enum(springSections), description: z.string().min(1),
    weight: nonnegative, sortOrder: z.number().int(), active: z.boolean(),
});
export const springChecklistDetailSchema = z.object({ checklist: springChecklistSchema, items: z.array(springItemSchema) }).superRefine((detail, ctx) => {
    if (new Set(detail.items.map(item => item.id)).size !== detail.items.length) ctx.addIssue({ code: 'custom', message: 'Duplicate checklist item ID' });
    if (detail.items.some(item => item.checklistId !== detail.checklist.id)) ctx.addIssue({ code: 'custom', message: 'Item belongs to another checklist' });
});
export type SpringChecklistDetail = z.infer<typeof springChecklistDetailSchema>;
const paging = { total: nonnegative.int(), page: id, pageSize: id };
// Only envelopes are confirmed by the supplied empty lists. Row schemas remain unverified.
export const springAuditPageSchema = z.object({ audits: z.array(z.unknown()), ...paging });
export const springSchedulePageSchema = z.object({ schedules: z.array(z.unknown()), ...paging });
export const springActionPageSchema = z.object({ actions: z.array(z.unknown()), ...paging });
const score = { pointsEarned: nonnegative, pointsPossible: nonnegative, scorePercent: percentage };
export const springKpiSchema = z.object({
    branchIds: z.array(id), from: z.iso.date(), to: z.iso.date(), audits: nonnegative.int(), ...score,
    sections: z.array(z.object({ section: z.enum(['Sort', 'Set in Order', 'Shine', 'Standardize', 'Sustain']), ...score })),
    weeks: z.array(z.unknown()),
    schedule: z.object({ scheduled: nonnegative.int(), done: nonnegative.int(), doneLate: nonnegative.int(),
        missed: nonnegative.int(), due: nonnegative.int(), upcoming: nonnegative.int(), cancelled: nonnegative.int(),
        counted: nonnegative.int(), donePercent: percentage }),
});

export function validateSpringResponse(resource: string, body: unknown): string {
    const schemas: Record<string, z.ZodType> = { checklists: springChecklistListSchema, audits: springAuditPageSchema,
        schedules: springSchedulePageSchema, 'corrective-actions': springActionPageSchema,
        'schedule-rules': z.array(z.unknown()), kpi: springKpiSchema };
    const schema = schemas[resource];
    if (!schema) return 'Detail contract not yet verified. Raw response only.';
    if (!schema.safeParse(body).success) return 'Response does not match the confirmed contract. Do not use for cutover.';
    if (resource === 'checklists') return 'Checklist list validated.';
    if (resource === 'kpi') return 'KPI fields validated; populated weekly rows remain unverified.';
    return 'List envelope validated; individual record fields remain unverified.';
}
