import { z } from 'zod';
import { createSopAuditSchema } from './audit.schema';

const id = z.number().int().positive().safe();
const text = z.string();
const empty = z.object({}).strict();
const reason = z.object({ reason: text.trim().min(1) }).strict();
export const checklistWriteSchema = z.object({ name: text.trim().min(1), description: text.nullable().optional(), branchId: id.nullable(), frequency: z.enum(['Daily', 'Weekly', 'Monthly']), maxGrade: z.number().finite().positive(), active: z.boolean() }).strict();
export const itemWriteSchema = z.object({ section: text.trim().min(1).max(100), description: text.trim().min(1), weight: z.number().finite().nonnegative(), sortOrder: z.number().int(), active: z.boolean() }).strict();
export const gradeWriteSchema = z.array(z.object({ itemId: id, grade: z.number().finite().nonnegative().nullable(), remarks: text.optional() }).strict()).min(1).refine(rows => new Set(rows.map(row => row.itemId)).size === rows.length, 'Duplicate grade item.');
export const actionWriteSchema = z.object({ description: text.trim().min(1), gradeId: id.nullable().optional(), assignedTo: id.nullable().optional(), dueDate: z.iso.date().nullable().optional() }).strict();
export const attachmentWriteSchema = z.object({ directusFileId: z.uuid(), kind: z.enum(['Before', 'After', 'Evidence', 'Signature']), gradeId: id.nullable().optional(), correctiveActionId: id.nullable().optional(), fileName: text.optional(), mimeType: text.optional(), fileSize: z.number().int().nonnegative().optional() }).strict();
export const ruleWriteSchema = z.object({ branchId: id, frequency: z.enum(['Weekly', 'Monthly']), weekday: z.number().int().min(1).max(7).nullable().optional(), dayOfMonth: z.number().int().min(1).max(28).nullable().optional(), startDate: z.iso.date(), endDate: z.iso.date().nullable().optional(), active: z.boolean().optional() }).strict().superRefine((rule, ctx) => {
    if (rule.frequency === 'Weekly' ? rule.weekday == null || rule.dayOfMonth != null : rule.dayOfMonth == null || rule.weekday != null) ctx.addIssue({ code: 'custom', message: 'Select only the weekday or monthly day matching the frequency.' });
    if (rule.endDate && rule.endDate < rule.startDate) ctx.addIssue({ code: 'custom', message: 'End date must not precede start date.' });
});

export function validateSopWrite(path: string, method: string, body: unknown): unknown {
    if (method === 'DELETE') return undefined;
    let schema: z.ZodType | undefined;
    if (path.endsWith('/cancel')) schema = path.startsWith('corrective-actions/') ? empty : reason;
    else if (/\/(submit|done)$/.test(path)) schema = empty;
    else if (path === 'audits') schema = createSopAuditSchema;
    else if (/^audits\/\d+\/grades$/.test(path)) schema = gradeWriteSchema;
    else if (/^audits\/\d+$/.test(path)) schema = z.object({ auditDate: z.iso.date().optional(), area: text.nullable().optional(), remarks: text.nullable().optional() }).strict();
    else if (path === 'checklists' || /^checklists\/\d+$/.test(path)) schema = checklistWriteSchema;
    else if (/^(checklists\/\d+\/items|items\/\d+)$/.test(path)) schema = itemWriteSchema;
    else if (/^audits\/\d+\/corrective-actions$/.test(path) || /^corrective-actions\/\d+$/.test(path)) schema = actionWriteSchema;
    else if (/^audits\/\d+\/attachments$/.test(path)) schema = attachmentWriteSchema;
    else if (path === 'schedule-rules') schema = ruleWriteSchema;
    else if (/^schedule-rules\/\d+$/.test(path)) schema = z.union([ruleWriteSchema, z.object({ active: z.boolean() }).strict()]);
    else if (path === 'schedules') schema = z.object({ branchId: id, scheduledDate: z.iso.date() }).strict();
    else if (/^schedules\/\d+$/.test(path)) schema = z.object({ scheduledDate: z.iso.date() }).strict();
    if (!schema) throw new Error('Unsupported SOP operation.');
    const result = schema.safeParse(body);
    if (!result.success) throw new Error(result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ').slice(0, 500));
    return result.data;
}
