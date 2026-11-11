const guidance = ['Non-compliant', 'Poor compliance', 'Below standard', 'Partially compliant', 'Mostly compliant', 'Fully compliant'];
export function ScoringLegend({ maximum }: { maximum: number }) {
    return <details className="rounded-md border bg-muted/30 px-3 py-2 text-xs"><summary className="cursor-pointer font-medium">Scoring reference · {maximum === 5 ? 'suggested guidance' : `0–${maximum} scale`}</summary>
        <div className="mt-2 space-y-2 text-muted-foreground">{maximum === 5 ? <><p>Suggested guidance, not a verified company-approved rubric. Follow any approved checklist-specific instructions.</p><dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">{guidance.map((label, grade) => <div key={grade} className="flex gap-2"><dt className="font-semibold text-foreground">{grade}</dt><dd>{label}</dd></div>)}</dl></> : <p>Grades run from 0 to {maximum}. No approved grade-by-grade descriptions are available for this scale.</p>}
            <p><strong>0</strong> is a scored result. <strong>N/A</strong> is an explicit answer excluded from earned and possible points. Unanswered items still need a response. Each item’s weight influences the total.</p>
        </div></details>;
}
