import { HousekeepingPageShell } from './shared/components/HousekeepingPageShell';
import { HousekeepingWorkspace } from './spring/HousekeepingWorkspace';

/** Shared implementation for renamed source routes and existing registry entry points. */
export function HousekeepingEntry({ mode }: { mode: 'auditor' | 'scheduler' }) {
    return <HousekeepingPageShell title={`Housekeeping ${mode === 'auditor' ? 'Auditor' : 'Scheduler'}`}><HousekeepingWorkspace mode={mode} /></HousekeepingPageShell>;
}
