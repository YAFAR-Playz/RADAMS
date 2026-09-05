"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { toneColors } from "@/lib/tone";
import type { Tone } from "@/lib/roles";

const AXIS_STYLE = { fontSize: 11, fill: "var(--subtle)" };

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[8px] shadow-[var(--shadow)]">
      <div className="mb-[3px] text-[11px] font-semibold text-[var(--subtle)]">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-[6px] text-[12.5px] font-semibold text-[var(--text)]">
          <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: p.color }} />
          {formatter ? formatter(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

// A single-series trend area chart — payroll-over-time, enrollment-over-time,
// anything shaped like [{label, value}, ...].
export function TrendAreaChart({
  data,
  color = "var(--brand)",
  valueFormatter,
}: {
  data: { label: string; value: number }[];
  color?: string;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border2)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => (valueFormatter ? valueFormatter(v) : String(v))} />
          <Tooltip content={<ChartTooltip formatter={valueFormatter} />} cursor={{ stroke: "var(--border)" }} />
          <Area type="monotone" dataKey="value" name="value" stroke={color} strokeWidth={2.5} fill="url(#trendFill)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Two-series bar chart, e.g. staffing added vs removed per month.
export function GroupedBarChart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border2)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface2)" }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
            formatter={(value) => series.find((s) => s.key === value)?.label ?? value}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const RATING_TONE: Record<string, Tone> = { outstanding: "brand", exceeds: "ok", meets: "info", below: "warn" };

// Ratings distribution donut — takes {rating, label, count} slices (see
// getMyRatingDistribution/getOrgRatingDistribution in dashboard-charts.ts).
export function RatingDonut({ data }: { data: { rating: string; label: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return null;
  return (
    <div className="flex items-center gap-[18px]">
      <div className="h-[150px] w-[150px] flex-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={44} outerRadius={68} paddingAngle={2} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.rating} fill={toneColors(RATING_TONE[d.rating] ?? "neutral").fg} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-1 flex-col gap-[9px]">
        {data.map((d) => {
          const { fg } = toneColors(RATING_TONE[d.rating] ?? "neutral");
          return (
            <div key={d.rating} className="flex items-center gap-[8px]">
              <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: fg }} />
              <span className="flex-1 text-[13px] text-[var(--muted)]">{d.label}</span>
              <span className="text-[13px] font-bold text-[var(--text)]">{d.count}</span>
              <span className="w-[38px] flex-none text-right text-[11.5px] text-[var(--subtle)]">
                {Math.round((d.count / total) * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
