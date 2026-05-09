'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, TooltipProps,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartEmptyState } from '../../master-list/components/ChartEmptyState';
import type { PerDayChartDatum } from '../types';

interface Props { data: PerDayChartDatum[] }

// Custom tooltip so hovering shows the actual date + counts
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const formattedDate = (() => {
    try { return format(parseISO(label), 'MMM d, yyyy'); }
    catch { return label; }
  })();
  return (
    <div style={{
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: 12,
      color: 'hsl(var(--popover-foreground))',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{formattedDate}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color, margin: '2px 0' }}>
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

export function SubsystemPerDayChart({ data }: Props) {
  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold">Per Day</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length === 0 ? (
          <ChartEmptyState label="daily data" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
              <XAxis
                dataKey="date"
                tick={false}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Line
                type="monotone"
                dataKey="compliant"
                name="Compliant"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="nonCompliant"
                name="Non-Compliant"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}