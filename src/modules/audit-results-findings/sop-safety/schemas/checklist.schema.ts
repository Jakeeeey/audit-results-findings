import { z } from 'zod';

/** Verified against the authenticated Dummy checklist response supplied by the user. */
export const sopChecklistSchema = z.object({
    id: z.number().int().positive().safe(),
    name: z.string(),
    description: z.string().nullable(),
    branchId: z.number().int().positive().safe().nullable(),
    frequency: z.enum(['Daily', 'Weekly', 'Monthly']),
    maxGrade: z.number().finite().positive(),
    active: z.boolean(),
    createdAt: z.string(),
});

export const sopChecklistListSchema = z.array(sopChecklistSchema).superRefine((rows, context) => {
    if (new Set(rows.map(row => row.id)).size !== rows.length) {
        context.addIssue({ code: 'custom', message: 'Duplicate checklist IDs in backend response.' });
    }
});

/** Verified against the user's authenticated checklist detail response. */
export const sopChecklistItemSchema = z.object({
    id: z.number().int().positive().safe(),
    checklistId: z.number().int().positive().safe(),
    section: z.string().min(1).max(100),
    description: z.string().min(1),
    weight: z.number().finite().nonnegative(),
    sortOrder: z.number().int(),
    active: z.boolean(),
});

export const sopChecklistDetailSchema = z.object({
    checklist: sopChecklistSchema,
    items: z.array(sopChecklistItemSchema),
}).superRefine(({ checklist, items }, context) => {
    if (items.some(item => item.checklistId !== checklist.id)) context.addIssue({ code: 'custom', message: 'Item belongs to another checklist.' });
    if (new Set(items.map(item => item.id)).size !== items.length) context.addIssue({ code: 'custom', message: 'Duplicate checklist items.' });
});
