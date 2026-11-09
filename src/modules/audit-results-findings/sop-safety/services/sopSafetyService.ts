import { sopChecklistListSchema, sopChecklistDetailSchema } from '../schemas/checklist.schema';
import { readSop } from './sopClient';

export const sopSafetyService = {
    getChecklists: (signal?: AbortSignal) => readSop('checklists', sopChecklistListSchema, undefined, signal),
    async getChecklist(id: number, signal?: AbortSignal) {
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Select a valid checklist.');
        const result = await readSop(`checklists/${id}`, sopChecklistDetailSchema, undefined, signal);
        if (result.checklist.id !== id) throw new Error('Backend returned a different checklist.');
        return result;
    },
};
