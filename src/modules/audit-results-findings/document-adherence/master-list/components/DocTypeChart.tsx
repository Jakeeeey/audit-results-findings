'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartEmptyState } from './ChartEmptyState';
import type { DocTypeChartDatum } from '../types';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#f97316', '#06b6d4', '#a855f7', '#14b8a6',
];

interface Props { 
  data: DocTypeChartDatum[];
  onBarClick?: (docType: string) => void;
}

export function SubsystemDocTypeChart({ data, onBarClick }: Props) {
  const sortedData = [...data]
    .filter(d => d.nonCompliant > 0)
    .sort((a, b) => b.nonCompliant - a.nonCompliant);

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          Non-Compliant by Doc Type
          {onBarClick && (
            <span className="text-[10px] font-normal text-muted-foreground">
              — click a bar to view list
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {sortedData.length === 0 ? (
          <ChartEmptyState label="non-compliant doc types" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, sortedData.length * 35 + 50)}>
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
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as DocTypeChartDatum;
                  return (
                    <div className="bg-popover border border-border rounded-md shadow-md px-2.5 py-1.5 text-xs">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-red-600 mt-0.5 font-medium">
                        Non-Compliant: <span className="font-bold">{item.nonCompliant}</span>
                      </p>
                      {onBarClick && <p className="text-primary mt-1 text-[10px]">Click to view non-compliant documents</p>}
                    </div>
                  );
                }}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
              />
              <Bar
                dataKey="nonCompliant"
                name="Non-Compliant Documents"
                radius={[0, 4, 4, 0]}
                barSize={20}
              >
                {sortedData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                <LabelList dataKey="nonCompliant" position="right" style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}