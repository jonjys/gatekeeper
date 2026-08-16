'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

type Point = { label: string; cost: number; calls: number };

export default function UsageChart({ data }: { data: Point[] }) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
        No usage yet — proxy a call via /api/gate/…
      </div>
    );
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="label" stroke="#71717a" fontSize={11} />
          <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{
              background: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 8
            }}
          />
          <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
