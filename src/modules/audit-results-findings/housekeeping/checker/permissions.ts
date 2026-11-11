/** Roles are assigned through approved VOS module grants, never by a browser toggle. */
export const housekeepingRoles = (rows: unknown, userId: number): string[] => {
    const list = Array.isArray(rows) ? rows : rows && typeof rows === 'object' && 'data' in rows && Array.isArray(rows.data) ? rows.data : [];
    const roles = new Set<string>();
    for (const row of list) {
        if (!row || typeof row !== 'object' || Number(row.userId) !== userId || row.subsystemSlug !== 'arf' || (row.status && String(row.status).toLowerCase() !== 'active')) continue;
        const path = typeof row.basePath === 'string' ? row.basePath.replace(/\/$/, '') : '';
        if (path === '/arf/housekeeping/checker' || row.slug === 'housekeeping-checker') roles.add('checker');
        if (['/arf/housekeeping/auditor', '/arf/housekeeping/inspector', '/arf/evaluation-and-weekly-performance/auditor', '/arf/evaluation-and-weekly-performance/viewer'].includes(path) || ['housekeeping-auditor', 'housekeeping-inspector'].includes(row.slug)) roles.add('auditor');
        if (['/arf/housekeeping/scheduler', '/arf/evaluation-and-weekly-performance/scheduler'].includes(path) || row.slug === 'housekeeping-scheduler') roles.add('scheduler');
        if (['/arf/housekeeping', '/arf/evaluation-and-weekly-performance'].includes(path)) { roles.add('auditor'); roles.add('scheduler'); }
    }
    return [...roles];
};
