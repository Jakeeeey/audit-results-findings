/** Roles are assigned through approved VOS module grants, never by a browser toggle. */
export const sopRoles = ['PLANNER', 'INSPECTOR'] as const;
export type SopRole = typeof sopRoles[number];
export type SopCapability = 'readPlanning' | 'managePlanning' | 'readAudits' | 'inspect';
export const sopRolePaths: Record<SopRole, string> = {
    PLANNER: '/arf/sop-safety/planner',
    INSPECTOR: '/arf/sop-safety/inspector',
};
export const sopWorkspaceScreens: Record<SopRole, readonly string[]> = {
    PLANNER: ['overview', 'audits', 'checklists', 'corrective-actions', 'schedules'],
    INSPECTOR: ['overview', 'audits', 'checklists', 'corrective-actions', 'schedules'],
};
export function sopCapabilities(roles: readonly SopRole[]) {
    return {
        readPlanning: roles.length > 0,
        managePlanning: roles.includes('PLANNER'),
        readAudits: roles.length > 0,
        inspect: roles.includes('INSPECTOR'),
    };
}

/** Shared/bookmarked URLs select an authorized view; they never grant another role. */
export function sopEntryPath(roles: readonly SopRole[], screen: string, auditId?: number): string | null {
    const role = roles.includes('INSPECTOR') ? 'INSPECTOR' : roles.includes('PLANNER') ? 'PLANNER' : null;
    if (!role || !sopWorkspaceScreens[role].includes(screen)) return null;
    if (auditId !== undefined && (screen !== 'audits' || !Number.isSafeInteger(auditId) || auditId <= 0)) return null;
    return `${sopRolePaths[role]}/${screen}${auditId !== undefined ? `/${auditId}` : ''}`;
}
export function sopOperationCapability(method: string, path: string): SopCapability {
    const planning = /^(checklists|items|schedule-rules|schedules)(\/|$)/.test(path);
    return method === 'GET' ? planning ? 'readPlanning' : 'readAudits' : planning ? 'managePlanning' : 'inspect';
}
export function rolesFromSopGrants(rows: unknown, userId: string): SopRole[] {
    if (!Array.isArray(rows)) return [];
    const paths = new Set(rows.filter(row => typeof row === 'object' && row !== null && String(row.userId) === userId && row.subsystemSlug === 'arf').map(row => row.basePath));
    // A shared parent/folder grant is not a business-role assignment.
    return sopRoles.filter(role => paths.has(sopRolePaths[role]));
}
