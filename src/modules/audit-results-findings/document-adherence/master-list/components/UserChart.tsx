'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartEmptyState } from './ChartEmptyState';
import type { UserChartDatum } from '../types';

interface Props {
  data: UserChartDatum[];
  onUserClick?: (userName: string) => void;
}

export function SubsystemUserChart({ data, onUserClick }: Props) {
  const sortedData = [...data]
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const maxVal = sortedData.length > 0 ? Math.max(...sortedData.map(d => d.value)) : 1;
  const minVal = sortedData.length > 0 ? Math.min(...sortedData.map(d => d.value)) : 0;

  function getRedColor(val: number): string {
    if (maxVal === minVal) return 'hsl(0, 75%, 45%)';
    const ratio = (val - minVal) / (maxVal - minVal); // 0 to 1
    const lightness = Math.round(75 - (ratio * 40));  // 75% to 35%
    const saturation = Math.round(60 + (ratio * 25)); // 60% to 85%
    return `hsl(0, ${saturation}%, ${lightness}%)`;
  }

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          Non-Compliant by User
          {onUserClick && (
            <span className="text-[10px] font-normal text-muted-foreground">
              — click a bar to view list & create NTE
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {sortedData.length === 0 ? (
          <ChartEmptyState label="non-compliant users" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, sortedData.length * 35 + 50)}>
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              onClick={(e) => {
                if (onUserClick && e?.activeLabel) {
                  onUserClick(e.activeLabel as string);
                }
              }}
              style={{ cursor: onUserClick ? 'pointer' : 'default' }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={true}
                vertical={false}
                stroke="rgba(128,128,128,0.1)"
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--foreground))' }}
                tickLine={false}
                axisLine={false}
                width={80}
                tickFormatter={(value) => {
                  if (typeof value !== 'string') return value;
                  const parts = value.trim().split(/\s+/);
                  if (parts.length > 1) {
                    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
                  }
                  return parts[0] || '';
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as UserChartDatum;
                  return (
                    <div className="bg-popover border border-border rounded-md shadow-md px-2.5 py-1.5 text-xs">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-red-600 mt-0.5 font-medium">
                        Non-Compliant: <span className="font-bold">{item.value} docs</span>
                      </p>
                      {onUserClick && <p className="text-primary mt-1 text-[10px]">Click to view details & generate NTE</p>}
                    </div>
                  );
                }}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
              />
              <Bar
                dataKey="value"
                name="Non-Compliant"
                radius={[0, 4, 4, 0]}
                barSize={20}
              >
                {sortedData.map((d, i) => (
                  <Cell key={i} fill={getRedColor(d.value)} />
                ))}
                <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}