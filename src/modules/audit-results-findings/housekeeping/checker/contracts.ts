import { z } from 'zod';
import { actionRow, auditRow } from '../spring/workflow';
import { springKpiSchema } from '../spring/contracts';
const id = z.number().int().positive().safe();
export const checkerAccessSchema = z.object({ userId: id, warehouses: z.array(z.object({ id, name: z.string(), code: z.string() })), canComplete: z.boolean(), commentsSupported: z.literal(false), resolutionEvidenceSupported: z.literal(false) });
export type CheckerAccess = z.infer<typeof checkerAccessSchema>;
export const checkerActionSchema = actionRow.extend({ auditId: id.optional(), auditNo: z.string().nullish(), branchId: id.optional(), branchName: z.string().nullish(), criterionDescription: z.string().nullish(), dueDate: z.iso.date().nullish() });
export type CheckerAction = z.infer<typeof checkerActionSchema>;
const paging = { total: z.number().int().nonnegative(), page: id, pageSize: id };
export const checkerAuditPage = z.object({ audits: z.array(auditRow.extend({ auditDate: z.iso.date() }).refine(a => a.status === 'Submitted', 'Checker results must be submitted audits')), ...paging });
export const checkerActionPage = z.object({ actions: z.array(checkerActionSchema), ...paging });
export const checkerSummarySchema = z.object({ kpi: springKpiSchema, openActions: z.number().int().nonnegative(), completedActions: z.number().int().nonnegative(), overdueActions: z.number().int().nonnegative().nullable(), attention: z.array(checkerActionSchema), recentAudits: z.array(auditRow), actionScope: z.literal('all-dates'), attentionComplete: z.boolean(), asOfDate: z.iso.date() });
export function overdue(action: CheckerAction, today: string) { return action.status === 'Open' && !!action.dueDate && action.dueDate < today; }
