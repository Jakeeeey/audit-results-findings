'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { z } from 'zod';
import { sopCapabilities, sopRoles, type SopRole } from '../permissions';
import { useSopResource } from '../hooks/useSopResource';
import { readSop } from '../services/sopClient';
import { SopError, SopLoading } from './SopShared';

const accessSchema = z.object({ roles: z.array(z.enum(sopRoles)).min(1) });
const SopAccessContext = createContext<readonly SopRole[]>([]);
const SopReadOnlyContext = createContext(false);
export function useSopAccess(workspace?: SopRole) {
    const roles = useContext(SopAccessContext);
    const readOnly = useContext(SopReadOnlyContext);
    const scope = workspace ? roles.filter(role => role === workspace) : roles;
    const capabilities = sopCapabilities(scope);
    return { roles, ...capabilities, inspect: !readOnly && capabilities.inspect, managePlanning: !readOnly && capabilities.managePlanning };
}
export function SopReadOnlyScope({ enabled, children }: { enabled: boolean; children: ReactNode }) {
    const inherited = useContext(SopReadOnlyContext);
    return <SopReadOnlyContext.Provider value={inherited || enabled}>{children}</SopReadOnlyContext.Provider>;
}
export function SopWorkspaceScope({ workspace, children }: { workspace: SopRole; children: ReactNode }) {
    const roles = useContext(SopAccessContext);
    if (!roles.includes(workspace)) return <SopError error={new Error(`${workspace.charAt(0)}${workspace.slice(1).toLowerCase()} access has not been granted.`)} />;
    return <SopAccessContext.Provider value={[workspace]}>{children}</SopAccessContext.Provider>;
}
export function SopAccessProvider({ children }: { children: ReactNode }) {
    const resource = useSopResource('sop-access', signal => readSop('access', accessSchema, undefined, signal));
    if (resource.loading) return <SopLoading />;
    if (!resource.data) return <SopError error={resource.error} retry={resource.reload} />;
    return <SopAccessContext.Provider value={resource.data.roles}>{children}</SopAccessContext.Provider>;
}
