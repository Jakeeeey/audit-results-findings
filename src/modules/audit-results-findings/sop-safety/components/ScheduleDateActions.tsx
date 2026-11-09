'use client';
import { Button } from '@/components/ui/button';
import type { SopSchedule } from '../schemas/response.schema';
import { sopRequest } from '../services/sopClient';
import type { SopForm } from './SopFormDialog';
import { todayManila } from './SopShared';

export function ScheduleDateActions({ schedule, canManage, onForm }: { schedule: SopSchedule; canManage: boolean; onForm: (form: SopForm) => void }) {
    if (!canManage || schedule.status === 'Cancelled' || schedule.auditId) return null;
    return <div className="flex flex-wrap items-center gap-1">
        {schedule.scheduledDate > todayManila() && <>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onForm({ title: 'Move inspection date', fields: [{ name: 'scheduledDate', label: 'New date (after today)', type: 'date', required: true }], initial: { scheduledDate: schedule.scheduledDate }, save: async values => { await sopRequest(`schedules/${schedule.id}`, { method: 'PUT', body: { scheduledDate: values.scheduledDate } }); } })}>Move</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => onForm({ title: 'Delete future unused date?', fields: [], save: async () => { await sopRequest(`schedules/${schedule.id}`, { method: 'DELETE' }); } })}>Delete</Button>
        </>}
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => onForm({ title: 'Cancel planned inspection', fields: [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }], save: async values => { await sopRequest(`schedules/${schedule.id}/cancel`, { method: 'POST', body: { reason: values.reason } }); } })}>Cancel</Button>
    </div>;
}
