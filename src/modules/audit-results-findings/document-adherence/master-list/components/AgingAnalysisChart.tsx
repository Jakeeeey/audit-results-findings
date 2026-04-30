'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartEmptyState } from './ChartEmptyState';
import type { AgingBucket } from '../types';

const BUCKET_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

interface Props { data: AgingBucket[] }

export function AgingAnalysisChart({ data }: Props) {
  const hasData = data.some(b => b.count > 0);

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold">Aging Analysis</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasData ? (
          <ChartEmptyState label="aging data" />
        ) : (
          <div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(128,128,128,0.1)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 12,
                    color: 'hsl(var(--popover-foreground))',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))', fontWeight: 600 }}
                  formatter={(value: number) => [value, 'Documents']}
                />
                <Bar
                  dataKey="count"
                  name="Documents"
                  radius={[4, 4, 0, 0]}
                  barSize={48}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Bucket summary below chart */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              {data.map((bucket, i) => (
                <div
                  key={bucket.label}
                  className="flex flex-col items-center rounded-md border border-border/50 py-2 px-1"
                >
                  <span
                    className="text-lg font-bold"
                    style={{ color: BUCKET_COLORS[i] }}
                  >
                    {bucket.count}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {bucket.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
