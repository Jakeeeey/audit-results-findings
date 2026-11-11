import type { z } from 'zod';
import type { sopChecklistSchema, sopChecklistDetailSchema } from './schemas/checklist.schema';

export type SopChecklist = z.infer<typeof sopChecklistSchema>;
export type ChecklistStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
export type SopChecklistDetail = z.infer<typeof sopChecklistDetailSchema>;
