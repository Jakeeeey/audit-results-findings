/** Registry compatibility only; database module slugs need not change for a folder rename. */
export const LEGACY_HOUSEKEEPING_SLUG = 'evaluation-and-weekly-performance';
const oldRoot = `/arf/${LEGACY_HOUSEKEEPING_SLUG}`;
const root = '/arf/housekeeping';
/** Use the registered URLs for entry points; global authorization stays unchanged. */
export const HOUSEKEEPING_ENTRY_ROOT = oldRoot;
export function canonicalHousekeepingPath(value: string): string {
    return value === oldRoot || value.startsWith(`${oldRoot}/`) ? `${root}${value.slice(oldRoot.length)}` : value;
}
