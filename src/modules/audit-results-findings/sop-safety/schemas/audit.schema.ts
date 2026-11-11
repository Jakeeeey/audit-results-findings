import { z } from 'zod';

/** Request fields documented in the SOP guide. Auditor and status are server-owned. */
export const createSopAuditSchema = z.object({
    checklistId: z.number().int().positive().safe(),
    branchId: z.number().int().positive().safe(),
    auditDate: z.iso.date(),
    area: z.string().optional(),
    remarks: z.string().optional(),
}).strict();

export type CreateSopAuditInput = z.infer<typeof createSopAuditSchema>;
