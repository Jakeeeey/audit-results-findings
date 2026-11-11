import type { SopChecklistDetail } from '../types';

/** First occurrence in configured item order determines section order. */
export function groupChecklistItems(items: SopChecklistDetail['items']) {
    const groups = new Map<string, SopChecklistDetail['items']>();
    for (const item of [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)) {
        const section = groups.get(item.section) ?? [];
        section.push(item);
        groups.set(item.section, section);
    }
    return Array.from(groups, ([section, rows]) => ({ section, items: rows }));
}
