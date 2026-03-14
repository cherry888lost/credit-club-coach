"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ── Types ─────────────────────────────────────────────────── */

export interface CloseTypeEntry {
  name: string;
  value: number;
  color: string;
}

export interface ObjectionEntry {
  objection: string;
  count: number;
}

export interface BreakdownEntry {
  name: string;
  score: number;
  max: number;
  pct: number;
}

interface Props {
  closeTypeData: CloseTypeEntry[];
  objectionData: ObjectionEntry[];
  breakdownData: BreakdownEntry[];
  closeRate: number | null;
  closedWeek: number;
  scoredCallsWeek: number;
}

/* ── Colors ────────────────────────────────────────────────── */

const OBJECTION_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8"];

const BREAKDOWN_COLORS: Record<string, string> = {
  close_quality: "#22c55e",
  objection_handling: "#3b82f6",
  value_stacking: "#a855f7",
  urgency_usage: "#f97316",
  discovery_rapport: "#06b6d4",
  professionalism: "#ec4899",
};

/* ── Custom tooltip (dark-mode aware) ─────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 shadow-lg text-xs">
      {label && (
        <p className="font-medium text-zinc-900 dark:text-white mb-1">{label}</p>
      )}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.payload?.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 shadow-lg text-xs">
      <p style={{ color: d.payload?.color }} className="font-semibold">
        {d.name}: {d.value}
      </p>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────── */

export default function SalesIntelligenceCharts({
  closeTypeData,
  objectionData,
  breakdownData,
  closeRate,
  closedWeek,
  scoredCallsWeek,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Close Type Donut ─────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Close Types
        </span>

        {closeTypeData.length > 0 ? (
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={closeTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {closeTypeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-4">
            No close type data this week
          </p>
        )}
      </div>

      {/* ── Close Rate + Objection Frequency ─────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 flex flex-col">
        {/* Close Rate hero */}
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Close Rate
        </span>
        <p
          className={`text-4xl font-bold mt-1 ${
            closeRate != null && closeRate >= 50
              ? "text-green-600 dark:text-green-400"
              : closeRate != null && closeRate >= 30
                ? "text-amber-600 dark:text-amber-400"
                : "text-zinc-900 dark:text-white"
          }`}
        >
          {closeRate != null ? `${closeRate}%` : "—"}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          {closedWeek} of {scoredCallsWeek} scored calls closed
        </p>

        {/* Objection bar chart */}
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Top Objections
        </span>
        {objectionData.length > 0 ? (
          <div className="flex-1 min-h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={objectionData}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="objection"
                  tick={{ fontSize: 10, fill: "#a1a1aa" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count">
                  {objectionData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={OBJECTION_COLORS[i % OBJECTION_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No objections this week
          </p>
        )}
      </div>

      {/* ── Score Breakdown Horizontal Bars ───────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Score Breakdown
        </span>

        {breakdownData.length > 0 ? (
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={breakdownData}
                layout="vertical"
                margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  hide
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#a1a1aa" }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as BreakdownEntry;
                    return (
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 shadow-lg text-xs">
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {d.name}
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400">
                          {d.score.toFixed(1)} / {d.max} ({d.pct}%)
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="pct"
                  radius={[0, 4, 4, 0]}
                  name="Score %"
                  barSize={14}
                >
                  {breakdownData.map((entry) => {
                    const key = entry.name
                      .toLowerCase()
                      .replace(/[^a-z]+/g, "_")
                      .replace(/_+$/, "");
                    return (
                      <Cell
                        key={key}
                        fill={
                          BREAKDOWN_COLORS[key] ||
                          (entry.pct >= 70
                            ? "#22c55e"
                            : entry.pct >= 50
                              ? "#f59e0b"
                              : "#ef4444")
                        }
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-4">
            No breakdown data this week
          </p>
        )}
      </div>
    </div>
  );
}
