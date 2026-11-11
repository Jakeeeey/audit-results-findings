/** SOP owns its contract; never forward arbitrary paths, queries, or credentials. */
export function sopReadPath(parts: string[]): string | null {
    const path = parts.join('/');
    if (path === 'checklists' || /^checklists\/[1-9]\d*$/.test(path)) return `/api/sop-safety/${path}`;
    if (path === 'audits' || /^audits\/[1-9]\d*$/.test(path)) return `/api/sop-safety/${path}`;
    if (['corrective-actions', 'schedule-rules', 'schedules'].includes(path) || /^schedule-rules\/[1-9]\d*$/.test(path) || /^audits\/[1-9]\d*\/(attachments|corrective-actions)$/.test(path)) return `/api/sop-safety/${path}`;
    if (path === 'kpi') return '/api/bia/warehouse-kpi/sop-safety';
    return null;
}

export const SOP_MODULE_PATH = '/arf/sop-safety';

export function sopPath(parts: string[], method: string): string | null {
    if (parts.some(part => /^\d+$/.test(part) && !Number.isSafeInteger(Number(part)))) return null;
    if (method === 'GET') return sopReadPath(parts);
    const path = parts.join('/');
    const allowed: Record<string, RegExp> = {
        POST: /^(checklists|checklists\/[1-9]\d*\/items|audits|audits\/[1-9]\d*\/(submit|cancel|corrective-actions|attachments)|corrective-actions\/[1-9]\d*\/(done|cancel)|schedule-rules|schedules|schedules\/[1-9]\d*\/cancel)$/,
        PUT: /^(checklists\/[1-9]\d*|items\/[1-9]\d*|audits\/[1-9]\d*(\/grades)?|corrective-actions\/[1-9]\d*|schedule-rules\/[1-9]\d*|schedules\/[1-9]\d*)$/,
        DELETE: /^(audits|attachments|schedules)\/[1-9]\d*$/,
    };
    return allowed[method]?.test(path) ? `/api/sop-safety/${path}` : null;
}

export function sopQuery(resource: string, input: URLSearchParams): URLSearchParams {
    if (resource === 'audits') return sopAuditListQuery(input);
    const fields: Record<string, string[]> = {
        'corrective-actions': ['status', 'assignedTo', 'branchId', 'page', 'pageSize'],
        schedules: ['branchId', 'from', 'to', 'outcome', 'page', 'pageSize'],
        'schedule-rules': [],
        kpi: ['branchId', 'from', 'to'],
    };
    const result = new URLSearchParams();
    for (const [key, value] of input) {
        if (!(fields[resource] ?? []).includes(key) || result.has(key) || value.length > 100) throw new Error('Unsupported or duplicate filter.');
        if (['branchId', 'assignedTo', 'page', 'pageSize'].includes(key) && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new Error('Identifiers and paging must be positive integers.');
        if (['from', 'to'].includes(key) && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('Invalid date.');
        if (key === 'status' && !['Open', 'Done', 'Cancelled'].includes(value)) throw new Error('Invalid action status.');
        if (key === 'outcome' && !['Upcoming', 'Due', 'Done', 'Done late', 'Missed', 'Cancelled'].includes(value)) throw new Error('Invalid schedule outcome.');
        result.set(key, value);
    }
    if (result.has('from') && result.has('to') && result.get('from')! > result.get('to')!) throw new Error('From date must not follow to date.');
    if (['corrective-actions', 'schedules'].includes(resource)) {
        if (!result.has('page')) result.set('page', '1');
        if (!result.has('pageSize')) result.set('pageSize', '25');
    }
    return result;
}

export function sopAuditListQuery(input: URLSearchParams): URLSearchParams {
    const result = new URLSearchParams();
    for (const [key, value] of input) {
        if (!['page', 'pageSize', 'checklistId', 'branchId', 'status', 'from', 'to'].includes(key) || result.has(key)) throw new Error('Unsupported or duplicate audit filter.');
        if (['page', 'pageSize', 'checklistId', 'branchId'].includes(key) && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new Error('Identifiers and paging must be positive integers.');
        if (key === 'status' && !['Draft', 'Submitted', 'Cancelled'].includes(value)) throw new Error('Invalid audit status.');
        if (['from', 'to'].includes(key) && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('Invalid audit date filter.');
        result.set(key, value);
    }
    if (result.has('from') && result.has('to') && result.get('from')! > result.get('to')!) throw new Error('From date must not follow to date.');
    if (!result.has('page')) result.set('page', '1');
    if (!result.has('pageSize')) result.set('pageSize', '25');
    return result;
}
