/** Route + method allowlist; never proxy arbitrary Spring paths. */
export function springHousekeepingPath(segments: string[], method = 'GET'): string | null {
    const path = segments.join('/');
    if (method !== 'GET') {
        const allowed: Record<string, RegExp> = {
            POST: /^(checklists|checklists\/[1-9]\d*\/items|audits|audits\/[1-9]\d*\/(submit|cancel|attachments|corrective-actions)|corrective-actions\/[1-9]\d*\/(done|cancel)|schedule-rules|schedules|schedules\/[1-9]\d*\/cancel)$/,
            PUT: /^(checklists\/[1-9]\d*|items\/[1-9]\d*|audits\/[1-9]\d*(\/grades)?|corrective-actions\/[1-9]\d*|schedule-rules\/[1-9]\d*|schedules\/[1-9]\d*)$/,
            DELETE: /^(audits|attachments|schedules)\/[1-9]\d*$/,
        };
        return allowed[method]?.test(path) ? `/api/housekeeping/${path}` : null;
    }
    if (['checklists', 'audits', 'corrective-actions', 'schedule-rules', 'schedules'].includes(path)) return `/api/housekeeping/${path}`;
    if (/^(checklists|audits|schedule-rules)\/[1-9]\d*$/.test(path) || /^audits\/[1-9]\d*\/(attachments|corrective-actions)$/.test(path)) return `/api/housekeeping/${path}`;
    if (path === 'kpi') return '/api/bia/warehouse-kpi/housekeeping';
    return null;
}

const filters: Record<string, string[]> = {
    'schedule-rules': ['branchId', 'activeOnly'],
    audits: ['checklistId', 'branchId', 'status', 'from', 'to', 'page', 'pageSize'],
    'corrective-actions': ['status', 'assignedTo', 'branchId', 'page', 'pageSize'],
    schedules: ['branchId', 'from', 'to', 'outcome', 'page', 'pageSize'],
    kpi: ['branchId', 'from', 'to'],
};

export function springHousekeepingQuery(resource: string, input: URLSearchParams): URLSearchParams {
    const result = new URLSearchParams();
    const allowed = filters[resource] ?? [];
    for (const [key, value] of input) {
        if (!allowed.includes(key) || result.has(key) || value.length > 100) throw new Error('Unsupported or duplicate query parameter');
        if (['branchId', 'checklistId', 'assignedTo', 'page', 'pageSize'].includes(key) && !/^[1-9]\d*$/.test(value)) throw new Error('Identifiers and paging must be positive integers');
        if (key === 'pageSize' && Number(value) > 100) throw new Error('Page size must not exceed 100');
        if (key === 'activeOnly' && !['true', 'false'].includes(value)) throw new Error('Invalid activeOnly filter');
        if (['from', 'to'].includes(key) && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('Invalid date');
        result.set(key, value);
    }
    if (result.has('from') && result.has('to') && result.get('from')! > result.get('to')!) throw new Error('Start date must not follow end date');
    return result;
}
