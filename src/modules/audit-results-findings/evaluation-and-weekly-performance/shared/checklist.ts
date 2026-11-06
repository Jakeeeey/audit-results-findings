import { z } from 'zod';

// Existing database criterion codes are historical identities, not UI labels.
const definitions = [
    ['SORT', 'Sort (Seiri)', ['Unnecessary tools and materials are removed.', 'Unused supplies and scrap are segregated.', 'Only necessary materials remain at workstations.', 'Obsolete or damaged materials are properly identified.']],
    ['SET_IN_ORDER', 'Set in Order (Seiton)', ['Tools and materials are stored in designated locations.', 'Shelves, racks, and containers are properly labeled.', 'Walkways and floor markings remain visible.', 'Frequently used materials are organized and accessible.']],
    ['SHINE', 'Shine (Seiso)', ['Floors and work surfaces are clean.', 'Equipment is free from unnecessary dirt, dust, and oil.', 'Spills and waste are addressed promptly.', 'Cleaning tools are available and properly maintained.']],
    ['STANDARDIZE', 'Standardize (Seiketsu)', ['Cleaning schedules are displayed.', 'Workstations follow approved layouts.', 'Labels and color codes are consistent.', 'Inspection procedures and records are maintained.']],
    ['SUSTAIN', 'Sustain (Shitsuke)', ['Employees consistently follow 5S practices.', 'Cleanliness is maintained without frequent reminders.', 'Previous audit findings are acted upon.', 'Continuous improvement practices are sustained.']],
] as const;
export const CHECKLIST = Object.freeze(definitions.flatMap(([pillar, title, labels]) => labels.map((label, index) =>
    Object.freeze({ code: `${pillar}_${index + 1}`, pillar, pillarTitle: title, position: index + 1, label, maximum_rating: 10 as const }))));
const codes = new Set<string>(CHECKLIST.map(c => c.code));
const criterionCode = z.string().refine(value => codes.has(value), 'Unknown criterion');
const rating = z.number().int().min(0).max(10).nullable();
const criterionRemarks = z.string().max(4000).nullable();
export const responseSchema = z.object({ criterionCode, rating, remarks: criterionRemarks }).strict();
export type CriterionResponse = z.infer<typeof responseSchema>;
export const snapshotSchema = z.object({
    version: z.union([z.literal(1), z.literal(2)]), maximum_points: z.union([z.literal(200), z.literal(100)]), weighting: z.literal('EQUAL'),
    criteria: z.array(z.object({ code: criterionCode, pillar: z.string(), position: z.number().int().min(1).max(4),
        label: z.string().trim().min(1), maximum_rating: z.union([z.literal(10), z.literal(5)]) }).strict()).length(20),
}).strict().superRefine((snapshot, ctx) => {
    if (new Set(snapshot.criteria.map(c => c.code)).size !== 20) ctx.addIssue({ code: 'custom', message: 'Duplicate snapshot criterion' });
    const maximum = snapshot.version === 2 ? 5 : 10;
    if (snapshot.maximum_points !== maximum * 20 || snapshot.criteria.some(c => c.maximum_rating !== maximum)) ctx.addIssue({ code: 'custom', message: 'Checklist scale does not match its version' });
    for (const item of snapshot.criteria) {
        const expected = CHECKLIST.find(c => c.code === item.code);
        if (expected?.pillar !== item.pillar || expected.position !== item.position) ctx.addIssue({ code: 'custom', message: 'Invalid pillar or criterion position' });
    }
});
export type ChecklistSnapshot = z.infer<typeof snapshotSchema>;
export function createSnapshot(version: 1 | 2 = 2) {
    const snapshot = snapshotSchema.parse({ version, maximum_points: version === 2 ? 100 : 200, weighting: 'EQUAL', criteria: CHECKLIST.map(({ code, pillar, position, label }) => ({ code, pillar, position, label, maximum_rating: version === 2 ? 5 : 10 })) });
    snapshot.criteria.forEach(Object.freeze);
    Object.freeze(snapshot.criteria);
    return Object.freeze(snapshot);
}
export function scoreChecklist(storedSnapshot: unknown, expectedVersion: number, input: unknown, requireComplete = false) {
    const snapshot = snapshotSchema.parse(storedSnapshot);
    if (snapshot.version !== expectedVersion) throw new Error('Snapshot version mismatch');
    const responses = z.array(responseSchema).max(20).parse(input);
    if (new Set(responses.map(r => r.criterionCode)).size !== responses.length) throw new Error('Duplicate response');
    const minimum = snapshot.version === 2 ? 0 : 1;
    if (responses.some(r => r.rating !== null && (r.rating < minimum || r.rating > snapshot.criteria.find(c => c.code === r.criterionCode)!.maximum_rating))) throw new Error('Rating outside the saved checklist scale');
    const rated = responses.filter(r => r.rating !== null);
    if (requireComplete && rated.length !== 20) throw new Error('Exactly 20 ratings are required');
    const earned = rated.reduce((total, r) => total + (r.rating ?? 0), 0);
    const pillars = definitions.map(([code, title]) => {
        const selected = responses.filter(r => snapshot.criteria.some(c => c.code === r.criterionCode && c.pillar === code));
        const points = selected.reduce((total, r) => total + (r.rating ?? 0), 0);
        return { code, title, earned: points, maximum: snapshot.maximum_points / 5, answered: selected.filter(r => r.rating !== null).length };
    });
    return { earned, maximum: snapshot.maximum_points, answered: rated.length, complete: rated.length === 20,
        percentage: rated.length ? earned / snapshot.maximum_points * 100 : null, pillars };
}
export interface EvaluationDraft { responses: CriterionResponse[]; remarks: string | null }
const draftPatchSchema = z.object({
    remarks: z.string().max(2000).nullable().optional(),
    responses: z.array(z.object({ criterionCode, rating: rating.optional(), remarks: criterionRemarks.optional() }).strict()).max(20).optional(),
}).strict();
/** Omission preserves; null clears. This is validation, never a persistence claim. */
export function patchDraft(current: EvaluationDraft, value: unknown): EvaluationDraft {
    const saved = z.object({ responses: z.array(responseSchema).max(20), remarks: z.string().max(2000).nullable() }).strict().parse(current);
    const patch = draftPatchSchema.parse(value);
    const byCode = new Map(saved.responses.map(r => [r.criterionCode, { ...r }]));
    if (byCode.size !== saved.responses.length) throw new Error('Duplicate saved responses');
    const seen = new Set<string>();
    for (const supplied of patch.responses ?? []) {
        if (seen.has(supplied.criterionCode)) throw new Error('Duplicate patch response');
        seen.add(supplied.criterionCode);
        const previous = byCode.get(supplied.criterionCode) ?? { criterionCode: supplied.criterionCode, rating: null, remarks: null };
        byCode.set(supplied.criterionCode, { criterionCode: supplied.criterionCode,
            rating: supplied.rating === undefined ? previous.rating : supplied.rating,
            remarks: supplied.remarks === undefined ? previous.remarks : supplied.remarks || null });
    }
    return { responses: [...byCode.values()], remarks: patch.remarks === undefined ? saved.remarks : patch.remarks || null };
}
