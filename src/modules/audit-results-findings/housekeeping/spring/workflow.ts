import { z } from 'zod';
import { springSections } from './contracts';
export const auditRow = z.object({ id: z.number().int().positive(), auditNo: z.string(), branchId: z.number().int().positive(),
    checklistId: z.number().int().positive(), auditDate: z.string(), status: z.enum(['Draft', 'Submitted', 'Cancelled']),
    maxGrade: z.number().positive(), branchName: z.string().nullish(), checkedByName: z.string().nullish(), area: z.string().nullish(), remarks: z.string().nullish(), checkedBy: z.union([z.number(), z.string()]).nullish(),
    pointsEarned: z.number().nullable().optional(), pointsPossible: z.number().nullable().optional(), scorePercent: z.number().nullable().optional(),
}).passthrough();
export const gradeRow = z.object({ id: z.number().int().positive(), itemId: z.number().int().positive(), section: z.enum(springSections),
    description: z.string(), weight: z.number().nonnegative(), grade: z.number().nullable(), remarks: z.string().nullish() }).passthrough();
export const pendingItem = z.object({ id: z.number().int().positive().optional(), itemId: z.number().int().positive().optional(),
    section: z.enum(springSections), description: z.string(), weight: z.number().nonnegative(), sortOrder: z.number().optional() }).passthrough().refine(v => v.id !== undefined || v.itemId !== undefined, 'Missing item identifier');
export const auditDetail = z.object({ audit: auditRow, grades: z.array(gradeRow), itemsToGrade: z.array(pendingItem).optional() });
export type Audit = z.infer<typeof auditRow>;
export type AuditDetail = z.infer<typeof auditDetail>;
export const scheduleRow = z.object({ id: z.number().int().positive(), branchId: z.number().int().positive(), branchName: z.string(), scheduledDate: z.string(),
    ruleId: z.number().nullable(), originalDate: z.string().nullable(), status: z.enum(['Scheduled', 'Cancelled']), auditId: z.number().nullable(),
    auditNo: z.string().nullable(), auditDate: z.string().nullable(), nextDate: z.string().nullable(),
    outcome: z.enum(['Upcoming', 'Due', 'Done', 'Done late', 'Missed', 'Cancelled']), cancelReason: z.string().nullable(),
}).passthrough();
export type Schedule = z.infer<typeof scheduleRow>;
export const ruleRow = z.object({ id: z.number().int().positive(), branchId: z.number().int().positive(), frequency: z.enum(['Weekly', 'Monthly']),
    weekday: z.number().nullable(), dayOfMonth: z.number().nullable(), startDate: z.string(), endDate: z.string().nullable(), active: z.boolean(), remarks: z.string().nullish() }).passthrough();
export type Rule = z.infer<typeof ruleRow>;
export const actionRow = z.object({ id: z.number().int().positive(), description: z.string(), status: z.enum(['Open', 'Done', 'Cancelled']),
    gradeId: z.number().nullish(), assignedTo: z.number().nullish(), assignedToName: z.string().nullish(), dueDate: z.string().nullish() }).passthrough();
export const attachmentRow = z.object({ id: z.number().int().positive(), directusFileId: z.uuid(), kind: z.enum(['Before', 'After', 'Evidence', 'Signature']),
    fileName: z.string().nullish(), mimeType: z.string().nullish(), fileSize: z.number().nullish(), uploadedAt: z.string().nullish(), createdAt: z.string().nullish(), gradeId: z.number().nullish(), correctiveActionId: z.number().nullish() }).passthrough();
export const pageOf = <T extends z.ZodType>(key: string, row: T) => z.object({ [key]: z.array(row), total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().positive() });
export function parseContract<T>(schema: z.ZodType<T>, body: unknown): T {
    const result = schema.safeParse(body);
    if (!result.success) throw new Error(`The audit service returned unexpected data (${result.error.issues.map(i => i.path.join('.')).slice(0, 3).join(', ')}). Please contact support; no records were treated as empty.`);
    return result.data;
}
export function editableItems(detail: AuditDetail) {
    const answered = detail.grades.map(g => ({ itemId: g.itemId, section: g.section, description: g.description, weight: g.weight, grade: g.grade, remarks: g.remarks ?? '', answered: true }));
    const seen = new Set(answered.map(g => g.itemId));
    const pending = (detail.itemsToGrade ?? []).filter(i => !seen.has(i.itemId ?? i.id!)).map(i => ({ itemId: i.itemId ?? i.id!, section: i.section, description: i.description, weight: i.weight, grade: null as number | null, remarks: '', answered: false }));
    return [...answered, ...pending];
}
