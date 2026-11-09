import { HousekeepingPageShell } from './shared/components/HousekeepingPageShell';
import { HousekeepingWorkspace } from './spring/HousekeepingWorkspace';
import HousekeepingCheckerModule from './checker/HousekeepingCheckerModule';

/** Shared implementation for renamed source routes and existing registry entry points. */
export function HousekeepingEntry({ mode }: { mode: 'auditor' | 'checker' | 'scheduler' }) {
    return <HousekeepingPageShell title={`Housekeeping ${mode === 'scheduler' ? 'Scheduler' : mode === 'checker' ? 'Checker' : 'Auditor'}`}>{mode === 'checker' ? <HousekeepingCheckerModule /> : <HousekeepingWorkspace mode={mode} />}</HousekeepingPageShell>;
}
