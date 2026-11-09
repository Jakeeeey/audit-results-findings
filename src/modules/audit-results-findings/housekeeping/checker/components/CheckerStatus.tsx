export function CheckerActionStatus({ status, isOverdue = false }: { status: 'Open' | 'Done' | 'Cancelled'; isOverdue?: boolean }) {
    const style = status === 'Done' ? 'text-emerald-700 dark:text-emerald-300 border-emerald/20' : status === 'Cancelled' ? 'text-slate-700 dark:text-slate-300 border-slate/20' : 'text-amber-700 dark:text-amber-300 border-amber/20';
    return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style} ${isOverdue && status === 'Open' ? 'bg-red/10 text-red-700 border-red/20' : ''}`}>{isOverdue && status === 'Open' ? 'Overdue' : status}</span>;
}
