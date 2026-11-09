'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuditWorkspace } from './components/AuditWorkspace';
import { useSopAccess, SopReadOnlyScope, SopWorkspaceScope } from './components/SopAccessProvider';
import { SopError } from './components/SopShared';
import { sopRolePaths, type SopRole } from './permissions';

export function AuditDetailModule({ id, readOnly = false, workspace }: { id: number; readOnly?: boolean; workspace: SopRole }) {
    return <SopWorkspaceScope workspace={workspace}><AuditDetailBody id={id} workspace={workspace} readOnly={workspace === 'PLANNER' || readOnly} /></SopWorkspaceScope>;
}

function AuditDetailBody({ id, readOnly, workspace }: { id: number; readOnly: boolean; workspace: SopRole }) {
    const router = useRouter();
    const [dirty, setDirty] = useState(false);
    const access = useSopAccess();
    const back = `${sopRolePaths[workspace]}/audits`;
    if (!access.readAudits) return <SopError error={new Error('Planner or Inspector access is required to view audit results.')} />;
    return <SopReadOnlyScope enabled={readOnly}><div className="space-y-4"><Button asChild variant="outline"><Link href={back} onClick={event => { if (dirty && !window.confirm('Leave without saving your grades?')) event.preventDefault(); }}>Back to compliance audits</Link></Button><AuditWorkspace id={id} onDirtyChange={setDirty} onDeleted={() => router.push(back)} /></div></SopReadOnlyScope>;
}
