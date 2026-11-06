'use client';
import { useEffect,useState } from 'react';
import type { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from '@/components/ui/table';
import { evaluationService } from '../../shared/services/evaluationService';
import type { weeklyListSchema } from '../../shared/weekly-template';
const labels:Record<string,string>={MO:'Mon',TU:'Tue',WE:'Wed',TH:'Thu',FR:'Fri'};
export function WeeklyTemplateTable({branchId,refreshKey,onChanged}:{branchId:number;refreshKey:string;onChanged:()=>void}) {
    const [rows,setRows]=useState<z.infer<typeof weeklyListSchema>>();const [error,setError]=useState('');const [busy,setBusy]=useState<number>();
    useEffect(()=>{const controller=new AbortController();evaluationService.weeklyTemplates(branchId,controller.signal)
        .then(data=>{if(!controller.signal.aborted){setRows(data);setError('');}})
        .catch(e=>{if(!controller.signal.aborted){setRows(undefined);setError(e instanceof Error?e.message:'Weekly schedules could not be loaded');}});
        return()=>controller.abort();},[branchId,refreshKey]);
    async function disable(id:number){if(!window.confirm('Stop generating new evaluations for this weekly schedule? Existing evaluations will remain unchanged.'))return;
        setBusy(id);try{await evaluationService.disableWeekly(id);toast.success('Weekly schedule disabled. Existing evaluations are preserved.');onChanged();}
        catch(e){setError(e instanceof Error?e.message:'Disable failed');}finally{setBusy(undefined);}}
    if(error)return <p role="alert" className="text-sm text-destructive">{error}</p>;
    if(!rows)return <p role="status">Loading weekly schedules…</p>;
    return <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Every week</TableHead><TableHead>Time (Manila)</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map(row=><TableRow key={row.id}><TableCell>{row.weekdays.map(day=>labels[day]).join(', ')}</TableCell><TableCell>{row.startTime}–{row.endTime}</TableCell><TableCell>{row.enabled?'Repeats until disabled':'Disabled'}</TableCell><TableCell><Button variant="outline" size="sm" disabled={!row.enabled||busy!==undefined} onClick={()=>disable(row.id)}>{busy===row.id?'Disabling…':'Disable'}</Button></TableCell></TableRow>)}
            {!rows.length&&<TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No saved weekly schedules for this branch.</TableCell></TableRow>}</TableBody></Table></div>;
}
