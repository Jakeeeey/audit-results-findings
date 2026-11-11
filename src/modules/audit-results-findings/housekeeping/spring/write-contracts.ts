import { z } from 'zod';
const id = z.number().int().positive().safe();
const date = z.iso.date();
const text = z.string().trim().max(4000);
const reason = z.object({ reason: text.min(1) }).strict();
const audit = z.object({ checklistId: id, branchId: id, auditDate: date, area: text.optional(), remarks: text.optional() }).strict();
const action = z.object({ description: text.min(1), gradeId: id.nullable().optional(), assignedTo: id.nullable().optional(), dueDate: date.nullable().optional() }).strict();
const checklist = z.object({ name: text.min(1), description: text.nullable().optional(), branchId: id.nullable().optional(), frequency: z.enum(['Daily', 'Weekly', 'Monthly']), maxGrade: z.number().int().min(1).max(100), active: z.boolean().optional() }).strict();
const item = z.object({ section: z.enum(['Sort', 'Set in Order', 'Shine', 'Standardize', 'Sustain']), description: text.min(1), weight: z.number().finite().positive(), sortOrder: z.number().int(), active: z.boolean().optional() }).strict();
const ruleFields = { branchId: id, frequency: z.enum(['Weekly', 'Monthly']), weekday: z.number().int().min(1).max(5).nullable().optional(), dayOfMonth: z.number().int().min(1).max(28).nullable().optional(), startDate: date, endDate: date.nullable().optional(), remarks: text.optional(), active: z.boolean().optional() };
const rule = z.object(ruleFields).strict().superRefine((v, ctx) => {
    if (v.frequency === 'Weekly' ? !v.weekday : !v.dayOfMonth) ctx.addIssue({ code: 'custom', message: 'Choose a weekday or monthly day for the selected frequency' });
    if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: 'custom', message: 'End must follow start date' });
});
export function validateSpringWrite(path: string, method: string, body: unknown): unknown {
    if (method === 'DELETE') return undefined;
    let schema: z.ZodType | undefined;
    if (/\/cancel$/.test(path)) schema = path.startsWith('corrective-actions/') ? z.object({}).strict() : reason;
    else if (/\/(submit|done)$/.test(path)) schema = z.object({}).strict();
    else if (path === 'audits') schema = audit;
    else if (/^audits\/\d+\/grades$/.test(path)) schema = z.array(z.object({ itemId: id, grade: z.number().finite().min(0).max(100).nullable(), remarks: text.optional() }).strict()).min(1).max(1000).refine(v => new Set(v.map(a => a.itemId)).size === v.length, 'Duplicate item');
    else if (/^audits\/\d+$/.test(path)) schema = z.object({ auditDate: date.optional(), area: text.optional(), remarks: text.optional() }).strict();
    else if (/^audits\/\d+\/corrective-actions$/.test(path) || /^corrective-actions\/\d+$/.test(path)) schema = action;
    else if (/^audits\/\d+\/attachments$/.test(path)) schema = z.object({ directusFileId: z.uuid(), kind: z.enum(['Before', 'After', 'Evidence', 'Signature']), gradeId: id.nullable().optional(), correctiveActionId: id.nullable().optional(), fileName: text.min(1), mimeType: z.string().max(100), fileSize: z.number().int().nonnegative() }).strict();
    else if (path === 'schedules') schema = z.object({ branchId: id, scheduledDate: date }).strict();
    else if (/^schedules\/\d+$/.test(path)) schema = z.object({ scheduledDate: date }).strict();
    else if (path === 'schedule-rules') schema = rule;
    else if (/^schedule-rules\/\d+$/.test(path)) schema = z.union([rule, z.object({ active: z.boolean() }).strict(), z.object({ remarks: text }).strict()]);
    else if (path === 'checklists' || /^checklists\/\d+$/.test(path)) schema = checklist;
    else if (/^(checklists\/\d+\/items|items\/\d+)$/.test(path)) schema = item;
    if (!schema) throw new Error('Unsupported Housekeeping operation');
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new Error(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ').slice(0, 500));
    return parsed.data;
}
