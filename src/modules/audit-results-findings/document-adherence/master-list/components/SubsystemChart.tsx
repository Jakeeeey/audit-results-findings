'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartEmptyState } from './ChartEmptyState';
import type { SubsystemChartDatum } from '../types';

const COLORS = [
  '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#3b82f6',
  '#f59e0b', '#06b6d4', '#a855f7', '#14b8a6', '#6366f1',
];

interface Props {
  data: SubsystemChartDatum[];
  onBarClick?: (subsystem: string) => void;
}

export function SubsystemAnalyticsChart({ data, onBarClick }: Props) {
  const sortedData = [...data].sort((a, b) => b.total - a.total);

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          Adherence by Subsystem
          {onBarClick && (
            <span className="text-[10px] font-normal text-muted-foreground">
              — click a bar to view subsystem details
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length === 0 ? (
          <ChartEmptyState label="subsystems" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, sortedData.length * 35 + 50)}>
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              onClick={(e) => {
                if (onBarClick && e?.activeLabel) {
                  onBarClick(e.activeLabel as string);
                }
              }}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}
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
                  return value.length > 12 ? `${value.substring(0, 10)}...` : value;
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as SubsystemChartDatum;
                  return (
                     <div className="bg-popover border border-border rounded-md shadow-md px-2.5 py-1.5 text-xs">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-muted-foreground mt-0.5">
                        Total: <span className="font-bold text-foreground">{item.total}</span>
                      </p>
                      <div className="flex gap-2 mt-1 text-[10px]">
                        <span className="text-emerald-600 font-medium">Compliant: {item.compliant}</span>
                        <span className="text-red-600 font-medium">Non-Compliant: {item.nonCompliant}</span>
                      </div>
                      {onBarClick && <p className="text-primary mt-1 text-[10px]">Click to view details</p>}
                    </div>
                  );
                }}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
              />
              <Bar
                dataKey="total"
                name="Total Documents"
                radius={[0, 4, 4, 0]}
                barSize={20}
              >
                {sortedData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                <LabelList dataKey="total" position="right" style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
