import type { SopAuditDetail } from '../schemas/response.schema';

export type AuditAnswer = { itemId: number; grade: number | null; remarks?: string };
export function auditQuestions(detail: SopAuditDetail) {
    const saved = new Set(detail.grades.map(grade => grade.itemId));
    return [
        ...detail.grades.map((grade, index) => ({ itemId: grade.itemId, section: grade.section, description: grade.description, weight: grade.weight, sortOrder: grade.sortOrder ?? index, saved: true, grade: grade.grade, remarks: grade.remarks ?? '' })),
        ...detail.itemsToGrade.filter(item => !saved.has(item.id)).map(item => ({ itemId: item.id, section: item.section, description: item.description, weight: item.weight, sortOrder: item.sortOrder, saved: false, grade: undefined, remarks: '' })),
    ].sort((a, b) => a.sortOrder - b.sortOrder);
}
export function gradePayload(answers: AuditAnswer[], maximum: number): AuditAnswer[] {
    const ids = new Set<number>();
    for (const answer of answers) {
        if (!Number.isSafeInteger(answer.itemId) || answer.itemId <= 0 || ids.has(answer.itemId)) throw new Error('Invalid or duplicate item.');
        if (answer.grade !== null && (!Number.isFinite(answer.grade) || answer.grade < 0 || answer.grade > maximum)) throw new Error('Grade is outside the audit snapshot maximum.');
        ids.add(answer.itemId);
    }
    return answers;
}
