'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartEmptyState } from '../../master-list/components/ChartEmptyState';
import type { UserChartDatum } from '../types';

const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981',
  '#06b6d4', '#a855f7', '#f59e0b', '#14b8a6', '#6366f1',
  '#84cc16', '#ef4444', '#0ea5e9', '#d946ef', '#fb923c',
];

interface Props {
  data:      UserChartDatum[];
  userNames: string[];
}

export function SubsystemUserChart({ data}: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const sorted = data.slice().sort((a, b) => b.value - a.value);

  // Each row is ~36px tall; 5 rows = 180px
  const ROW_HEIGHT = 36;
  const MAX_ROWS   = 5;

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold">Per User</CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
        {data.length === 0 ? (
          <ChartEmptyState label="users" />
        ) : (
          <>
            {/* Donut chart */}
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const e = payload[0].payload as UserChartDatum;
                    return (
                      <div className="bg-popover border border-border rounded-md shadow-md px-2.5 py-1.5 text-xs">
                        <p className="font-semibold text-foreground">{e.name}</p>
                        <p className="text-muted-foreground">{e.value} docs · {((e.value / total) * 100).toFixed(1)}%</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend dropdown */}
            <div className="mt-2 rounded-md border border-border overflow-hidden">
              <details className="group">
                <summary className="flex items-center justify-between px-3 py-2 cursor-pointer bg-muted/40 hover:bg-muted/60 transition-colors select-none">
                  <span className="text-xs font-semibold text-foreground">
                    All Users
                    <span className="ml-1.5 text-muted-foreground font-normal">({data.length})</span>
                  </span>
                  <span className="text-muted-foreground text-[10px] group-open:rotate-180 transition-transform duration-200">▾</span>
                </summary>

                {/* Fixed height = 5 rows */}
                <div
                  className="overflow-y-auto divide-y divide-border/30"
                  style={{ height: ROW_HEIGHT * MAX_ROWS }}
                >
                  {sorted.map((entry, i) => {
                    const colorIdx = data.indexOf(entry);
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 hover:bg-muted/20 transition-colors"
                        style={{ height: ROW_HEIGHT }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[colorIdx % COLORS.length] }}
                          />
                          <span className="truncate text-xs text-foreground" title={entry.name}>
                            {entry.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {((entry.value / total) * 100).toFixed(1)}%
                          </span>
                          <span className="text-xs font-semibold text-primary tabular-nums w-14 text-right">
                            {entry.value} docs
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}