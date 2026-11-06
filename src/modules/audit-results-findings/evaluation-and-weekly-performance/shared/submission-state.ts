import type { CriterionResponse } from './checklist';
import type { InspectionDetail } from './contracts';

/** Semantic comparison: API object key order must not keep Submit disabled. */
export function draftSubmissionState(detail: InspectionDetail, answers: CriterionResponse[], remarks: string, saving = false) {
    const evaluation = detail.evaluation!;
    const missing = evaluation.snapshot.criteria.filter(c => answers.find(a => a.criterionCode === c.code)?.rating == null);
    const dirty = (remarks || null) !== (evaluation.remarks || null) || evaluation.snapshot.criteria.some(c => {
        const current = answers.find(a => a.criterionCode === c.code);
        const saved = evaluation.responses.find(a => a.criterionCode === c.code);
        return (current?.rating ?? null) !== (saved?.rating ?? null) || (current?.remarks || null) !== (saved?.remarks || null);
    });
    const answered = evaluation.snapshot.criteria.length - missing.length;
    const canSubmit = !saving && !dirty && detail.capabilities.submit && missing.length === 0 && answered === 20;
    const reason = saving ? 'A save or submission is in progress.'
        : missing.length ? `${answered}/20 rated. Rate the ${missing.length} remaining question${missing.length === 1 ? '' : 's'}, then save the draft.`
            : dirty ? 'All 20 questions are rated. Save your draft to enable submission.'
                : !detail.capabilities.submit ? detail.capabilities.reason
                    : 'All 20 ratings are saved. You can submit now. Photos are optional.';
    return { missing, dirty, answered, canSubmit, reason };
}
