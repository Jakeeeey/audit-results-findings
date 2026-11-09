import 'server-only';
import { z } from 'zod';
import { currentAccess, readItems } from './queries';
import { EvaluationError } from './security';
import { mutate } from './writes';
import { saveReadiness } from './save-readiness';
import { weeklyListSchema } from '../shared/weekly-template';
type Access = Awaited<ReturnType<typeof currentAccess>>;
const stored = z.object({ id: z.number().int().positive(), branch_id: z.number().int().positive(), inspector_id: z.number().int().positive().nullable(),
    days_of_week: z.union([z.array(z.string()), z.string()]), start_time: z.string(), end_time: z.string(),
    enabled: z.union([z.literal(0),z.literal(1),z.boolean()]), notes: z.string().nullable() });
const fields = ['id','branch_id','inspector_id','days_of_week','start_time','end_time','enabled','notes'];
export async function weeklyTemplates(access: Access, branchId: number) {
    access.require(branchId,'PLANNER');
    const rows = await readItems('arf_evaluation_recurrences',fields,{branch_id:{_eq:branchId},end_date:{_null:true}},z.array(stored));
    try { return weeklyListSchema.parse(rows.map(row=>({id:row.id,branchId:row.branch_id,inspectorId:row.inspector_id,
        weekdays:typeof row.days_of_week==='string'?JSON.parse(row.days_of_week):row.days_of_week,
        startTime:row.start_time.slice(0,5),endTime:row.end_time.slice(0,5),enabled:!!row.enabled,notes:row.notes}))); }
    catch { throw new EvaluationError(503,'INVALID_TEMPLATE','Stored weekly templates could not be validated'); }
}
export async function disableWeeklyTemplate(access: Access, id: number) {
    if (!await saveReadiness()) throw new EvaluationError(503,'SAVE_SETUP_REQUIRED','Weekly template updates require the configured database guards and an enabled write credential');
    const branchIds=access.grants.filter(g=>g.roles.includes('PLANNER')&&access.eligibleWarehouseIds.includes(g.branchId)).map(g=>g.branchId);
    const rows=await readItems('arf_evaluation_recurrences',fields,{id:{_eq:id},branch_id:{_in:branchIds}},z.array(stored));
    if (!rows[0]) throw new EvaluationError(404,'NOT_FOUND','Weekly template was not found in your permitted scope');
    access.require(rows[0].branch_id,'PLANNER');
    return mutate('arf_evaluation_recurrences','PATCH',{enabled:0},id);
}
