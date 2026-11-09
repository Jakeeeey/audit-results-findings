export type SpringResource = 'checklists' | 'audits' | 'schedules' | 'schedule-rules' | 'corrective-actions' | 'kpi';
export type SpringReadPath = SpringResource | `checklists/${number}` | `audits/${number}` | `audits/${number}/attachments` | `audits/${number}/corrective-actions` | `schedule-rules/${number}`;

export async function readSpringHousekeeping(resource: SpringReadPath, query = new URLSearchParams(), signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(`/api/arf/housekeeping/spring/${resource}?${query}`, { cache: 'no-store', signal });
    const body: unknown = await response.json();
    if (!response.ok) {
        const message = typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string' ? body.message : 'Housekeeping request failed.';
        throw new Error(message);
    }
    return body;
}

export async function writeSpringHousekeeping(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<unknown> {
    const response = await fetch(`/api/arf/housekeeping/spring/${path}`, { method, cache: 'no-store',
        headers: method === 'DELETE' ? {} : { 'Content-Type': 'application/json' },
        ...(method !== 'DELETE' ? { body: JSON.stringify(body ?? {}) } : {}) });
    if (response.status === 204) return null;
    const result: unknown = await response.json();
    if (!response.ok) throw new Error(typeof result === 'object' && result !== null && 'message' in result && typeof result.message === 'string' ? result.message : 'Housekeeping write failed. Reload before retrying.');
    return result;
}

/** Omitted item = unanswered; explicitly saved null = N/A. Never default missing values to null. */
export type SpringGradeInput = { itemId: number; grade: number | null; remarks?: string };
export function springGradePayload(answers: SpringGradeInput[], maxGrade: number): SpringGradeInput[] {
    if (!Number.isFinite(maxGrade) || maxGrade <= 0) throw new Error('Invalid maximum grade');
    const seen = new Set<number>();
    return answers.map(answer => {
        if (!Number.isSafeInteger(answer.itemId) || answer.itemId <= 0 || seen.has(answer.itemId)) throw new Error('Invalid or duplicate item');
        if (answer.grade !== null && (!Number.isFinite(answer.grade) || answer.grade < 0 || answer.grade > maxGrade)) throw new Error('Grade outside checklist scale');
        seen.add(answer.itemId);
        return { ...answer };
    });
}
