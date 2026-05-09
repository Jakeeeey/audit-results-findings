interface Props {
  label?: string;
}

export function ChartEmptyState({ label = 'data' }: Props) {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <div className="flex items-end gap-1 mb-1">
        <div className="w-3 h-8 rounded-sm bg-muted/50" />
        <div className="w-3 h-12 rounded-sm bg-muted/50" />
        <div className="w-3 h-6 rounded-sm bg-muted/50" />
        <div className="w-3 h-10 rounded-sm bg-muted/50" />
        <div className="w-3 h-4 rounded-sm bg-muted/50" />
      </div>
      <p className="text-xs">No data for {label}</p>
    </div>
  );
}