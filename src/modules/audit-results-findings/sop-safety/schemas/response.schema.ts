import { z } from 'zod';
import { sopChecklistItemSchema } from './checklist.schema';

const id = z.number().int().positive().safe();
const number = z.number().finite();
const points = { pointsEarned: number.nonnegative().nullable(), pointsPossible: number.nonnegative().nullable(), scorePercent: number.min(0).max(100).nullable() };
/** Header and empty-grade detail verified from the user's successful draft creation. */
export const auditSchema = z.object({
    id, auditNo: z.string(), checklistId: id, checklistName: z.string(), branchId: id, branchName: z.string(), area: z.string().nullable(),
    auditDate: z.iso.date(), checkedBy: id, status: z.enum(['Draft', 'Submitted', 'Cancelled']), maxGrade: number.positive(), ...points,
    remarks: z.string().nullable(), submittedAt: z.string().nullable(), cancelledAt: z.string().nullable(), cancelledBy: id.nullable(), cancelReason: z.string().nullable(), createdAt: z.string(),
});
// Populated grades and remaining resource DTOs are guarded integration contracts,
// not yet proven by authenticated responses. Mismatches expose raw data for review.
export const gradeSchema = z.object({ id, itemId: id, section: z.string(), description: z.string(), weight: number.nonnegative(), grade: number.nonnegative().nullable(), remarks: z.string().nullish(), sortOrder: z.number().int().optional() });
export const auditDetailSchema = z.object({ audit: auditSchema, grades: z.array(gradeSchema), itemsToGrade: z.array(sopChecklistItemSchema) }).superRefine((value, ctx) => {
    if (new Set(value.grades.map(grade => grade.itemId)).size !== value.grades.length) ctx.addIssue({ code: 'custom', message: 'Duplicate grades.' });
    if (value.grades.some(grade => grade.grade !== null && grade.grade > value.audit.maxGrade)) ctx.addIssue({ code: 'custom', message: 'Grade exceeds snapshot maximum.' });
    if (value.itemsToGrade.some(item => item.checklistId !== value.audit.checklistId)) ctx.addIssue({ code: 'custom', message: 'Pending item belongs to another checklist.' });
});
export const actionSchema = z.object({ id, auditId: id.optional(), auditNo: z.string().nullish(), branchId: id.optional(), branchName: z.string().nullish(), description: z.string(), gradeId: id.nullish(), assignedTo: id.nullish(), dueDate: z.iso.date().nullish(), status: z.enum(['Open', 'Done', 'Cancelled']) });
export const attachmentSchema = z.object({ id, directusFileId: z.uuid(), kind: z.enum(['Before', 'After', 'Evidence', 'Signature']), gradeId: id.nullish(), correctiveActionId: id.nullish(), fileName: z.string().nullish(), mimeType: z.string().nullish(), fileSize: number.nonnegative().nullish() });
export const ruleSchema = z.object({ id, branchId: id, frequency: z.enum(['Weekly', 'Monthly']), weekday: z.number().int().min(1).max(7).nullish(), dayOfMonth: z.number().int().min(1).max(28).nullish(), startDate: z.iso.date(), endDate: z.iso.date().nullish(), active: z.boolean() });
export const outcomes = ['Upcoming', 'Due', 'Done', 'Done late', 'Missed', 'Cancelled'] as const;
export const scheduleSchema = z.object({ id, branchId: id, branchName: z.string().optional(), scheduledDate: z.iso.date(), ruleId: id.nullish(), originalDate: z.iso.date().nullish(), status: z.enum(['Scheduled', 'Cancelled']), auditId: id.nullish(), auditNo: z.string().nullish(), outcome: z.enum(outcomes), cancelReason: z.string().nullish() });
export const kpiSchema = z.object({ ...points, audits: z.number().int().nonnegative(), sections: z.array(z.object({ section: z.string(), ...points })), schedule: z.object({ upcoming: number.nonnegative(), due: number.nonnegative(), done: number.nonnegative(), doneLate: number.nonnegative(), missed: number.nonnegative(), cancelled: number.nonnegative() }).optional() });
export function pageSchema<K extends string, T extends z.ZodType>(key: K, row: T) {
    const rows = { [key]: z.array(row) } as { [P in K]: z.ZodArray<T> };
    return z.object({ ...rows, total: z.number().int().nonnegative(), page: id, pageSize: id });
}
export type SopAudit = z.infer<typeof auditSchema>;
export type SopAuditDetail = z.infer<typeof auditDetailSchema>;
export type SopAction = z.infer<typeof actionSchema>;
export type SopAttachment = z.infer<typeof attachmentSchema>;
export type SopRule = z.infer<typeof ruleSchema>;
export type SopSchedule = z.infer<typeof scheduleSchema>;
