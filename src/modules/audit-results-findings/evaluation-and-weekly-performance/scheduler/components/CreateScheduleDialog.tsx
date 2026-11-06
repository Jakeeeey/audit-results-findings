'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { weekdays } from '../../shared/scheduling';
import { weeklyTemplateSchema } from '../../shared/weekly-template';
import { evaluationService } from '../../shared/services/evaluationService';
import { requestId } from '../../shared/request-id';
const schema = z.object({
    weekdays: z.array(z.enum(weekdays)).min(1, 'Select at least one weekday'),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    notes: z.string().max(4000),
}).refine(value => value.endTime > value.startTime, { path: ['endTime'], message: 'End must be later than start on the same day' })
    .refine(value => value.endTime <= '17:00', { path: ['endTime'], message: 'End must be no later than 5:00 PM Manila' });
type FormValues = z.infer<typeof schema>;
export function CreateScheduleDialog({ branchId, warehouse, reason, canSave, onSaved }: { branchId: number; warehouse: string; reason: string; canSave: boolean; onSaved: () => void }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const pending = useRef<{ requestId: string; fingerprint: string } | null>(null);
    const [error, setError] = useState('');
    const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: {
        weekdays: ['MO'], startTime: '09:00', endTime: '10:00', notes: '' } });
    async function save(value: FormValues) {
        if (!canSave || saving) return;
        const fingerprint = JSON.stringify(value);
        if (!pending.current || pending.current.fingerprint !== fingerprint) pending.current = { requestId: requestId(), fingerprint };
        const payload = { kind: 'WEEKLY', branchId, weekdays: value.weekdays,
            startTime: value.startTime, endTime: value.endTime, notes: value.notes, requestId: pending.current.requestId };
        try {
            weeklyTemplateSchema.parse(payload);
            setSaving(true); setError('');
            await evaluationService.create(payload);
            pending.current = null;
            toast.success('Weekly schedule saved to Directus'); setOpen(false); onSaved();
        } catch (e) { setError(e instanceof Error ? e.message : 'Schedule save failed'); }
        finally { setSaving(false); }
    }
    return <Dialog open={open} onOpenChange={value => { if (saving) return; setOpen(value); }}><DialogTrigger asChild><Button>Create schedule</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Create weekly evaluation schedule</DialogTitle>
            <DialogDescription>{warehouse} · Asia/Manila</DialogDescription></DialogHeader>
            {!canSave && <Alert><AlertDescription>{reason}</AlertDescription></Alert>}
            <p className="text-sm text-muted-foreground">Repeats every week on the selected days, starting with the next matching day, until disabled. Each evaluation closes at 5:00 PM Manila on its occurrence date.</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <form onSubmit={form.handleSubmit(save)} className="space-y-4"><fieldset disabled={saving} className="space-y-4">
                <p className="text-sm text-muted-foreground">Anyone with module access can start. The first person to start becomes the evaluator and only editor.</p>
                <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-medium">Evaluation weekdays</legend>{weekdays.map((day, index) => <Label key={day} className="flex gap-2"><input type="checkbox" value={day} {...form.register('weekdays')} />{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][index]}</Label>)}</fieldset>
                <p role="alert" className="text-sm text-destructive">{form.formState.errors.weekdays?.message}</p>
                <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="schedule-start">Start time</Label><Input id="schedule-start" type="time" {...form.register('startTime')} /><p className="text-sm text-destructive">{form.formState.errors.startTime?.message}</p></div>
                    <div><Label htmlFor="schedule-end">End time</Label><Input id="schedule-end" type="time" {...form.register('endTime')} /><p className="text-sm text-destructive">{form.formState.errors.endTime?.message}</p></div></div>
                <div><Label htmlFor="schedule-notes">Notes (optional)</Label><Textarea id="schedule-notes" maxLength={4000} {...form.register('notes')} /></div>
                <Button type="submit" disabled={!canSave || saving}>{saving ? 'Saving…' : 'Save weekly schedule'}</Button>
                </fieldset>
            </form>
        </DialogContent>
    </Dialog>;
}
