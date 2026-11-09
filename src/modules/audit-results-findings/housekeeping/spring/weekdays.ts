export const weeklyDayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((label, index) => ({ value: String(index + 1), label }));
/** Weekend names are display-only for records created before weekday restriction. */
export function weekdayLabel(value: number | null) {
    return value === null ? 'Not set' : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][value - 1] ?? 'Unknown weekday';
}
