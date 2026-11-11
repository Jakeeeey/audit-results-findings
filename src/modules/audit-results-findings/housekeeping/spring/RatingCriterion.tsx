'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { editableItems } from './workflow';

export type CriterionAnswer = ReturnType<typeof editableItems>[number];
export function RatingCriterion({ answer, maximum, editable, disabled, missing, onChange }: {
    answer: CriterionAnswer; maximum: number; editable: boolean; disabled: boolean; missing: boolean;
    onChange: (patch: Partial<Pick<CriterionAnswer, 'grade' | 'answered' | 'remarks'>>) => void;
}) {
    const [remarksOpen, setRemarksOpen] = useState(!!answer.remarks);
    const labelId = `criterion-${answer.itemId}`;
    const selected = !answer.answered ? 'Unanswered' : answer.grade === null ? 'N/A' : `${answer.grade}/${maximum}`;
    const grades = Array.from({ length: Math.floor(maximum) + 1 }, (_, grade) => grade);
    return <div id={`criterion-row-${answer.itemId}`} className={`space-y-2 border-b py-3 last:border-b-0 ${missing ? 'border-l-2 border-l-destructive pl-3' : ''}`}>
        <div className="flex items-start justify-between gap-3"><h4 id={labelId} className="text-sm font-medium leading-relaxed">{answer.description}</h4><span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Weight {answer.weight}</span></div>
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
            {grades.map(grade => <Button key={grade} type="button" size="sm" className="h-8 min-w-8 px-2.5" variant={answer.answered && answer.grade === grade ? 'default' : 'outline'} aria-pressed={answer.answered && answer.grade === grade} aria-label={`${grade} out of ${maximum}`} disabled={!editable || disabled} onClick={() => onChange({ answered: true, grade })}>{grade}</Button>)}
            <Button type="button" size="sm" className="h-8 px-2.5" variant={answer.answered && answer.grade === null ? 'default' : 'outline'} aria-pressed={answer.answered && answer.grade === null} aria-label="Not applicable (N/A)" disabled={!editable || disabled} onClick={() => onChange({ answered: true, grade: null })}>N/A</Button>
        </div>
        <p className={`text-xs ${missing ? 'text-destructive' : 'text-muted-foreground'}`}>Selected: {selected}{missing ? ' — select a score or N/A.' : ''}</p>
        {(editable || answer.remarks) && <details open={remarksOpen} onToggle={event => setRemarksOpen(event.currentTarget.open)} className="text-xs">
            <summary className="w-fit cursor-pointer text-muted-foreground">{answer.remarks ? 'Remarks' : 'Add remark (optional)'}</summary>
            {editable ? <div className="mt-2"><Label htmlFor={`criterion-remarks-${answer.itemId}`} className="sr-only">Remarks for {answer.description}</Label><Textarea id={`criterion-remarks-${answer.itemId}`} rows={2} className="min-h-16 text-sm" value={answer.remarks} maxLength={4000} disabled={disabled || !answer.answered} placeholder="Add a remark…" onChange={event => onChange({ remarks: event.target.value })} />{!answer.answered && <p className="mt-1 text-muted-foreground">Select a score or N/A before adding a remark.</p>}</div> : <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{answer.remarks}</p>}
        </details>}
    </div>;
}
