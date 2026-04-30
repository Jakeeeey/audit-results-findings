'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, TooltipProps,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartEmptyState } from '../../master-list/components/ChartEmptyState';
import type { AdherenceRateTrendDatum } from '../types';

interface Props { data: AdherenceRateTrendDatum[] }

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
      <p style={{ color: '#6366f1', margin: 0 }}>
        Adherence Rate: <strong>{payload[0].value}%</strong>
      </p>
    </div>
  );
}

export function AdherenceRateTrendChart({ data }: Props) {
  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-semibold">Adherence Rate Trend</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length === 0 ? (
          <ChartEmptyState label="adherence rate" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="adherenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="adherenceRate"
                name="Adherence Rate"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}