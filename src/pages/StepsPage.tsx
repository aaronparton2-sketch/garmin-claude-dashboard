import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Bundle } from "../lib/data";
import { fmtDate } from "../lib/data";
import { fmtKm, fmtSteps, periods, stepStat, pct, type PeriodKey } from "../lib/metrics";
import { AXIS_TICK, ChartCard, EmptyHint, GRID, PageHeader, PeriodMenu, Stat, TOOLTIP } from "../ui";

const COLOR = "#a3e635";
const GOAL = "#38bdf8";

export default function StepsPage({ data, now, period, setPeriod, refreshed }: {
  data: Bundle; now: Date; period: PeriodKey; setPeriod: (p: PeriodKey) => void; refreshed?: string;
}) {
  const daily = useMemo(() => [...data.daily].sort((a, b) => a.summary_date.localeCompare(b.summary_date)), [data]);
  const { current, prev } = periods(now, period);
  const cur = stepStat(daily, current);
  const pre = stepStat(daily, prev);

  // typical goal over the period (for the reference line)
  const goal = useMemo(() => {
    const goals = daily.map((d) => d.step_goal).filter((g): g is number => !!g);
    return goals.length ? Math.round(goals.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, goals.length)) : null;
  }, [daily]);

  const series = useMemo(() => daily.slice(-60).map((d) => ({
    date: fmtDate(d.summary_date),
    steps: d.total_steps ?? 0,
    goalHit: d.step_goal ? (d.total_steps || 0) >= d.step_goal : false,
    floors: d.floors_ascended ?? 0,
  })), [daily]);

  // monthly average steps/day, 12 months
  const monthly = useMemo(() => {
    const out: { label: string; avg: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = dt.toISOString().slice(0, 7);
      const rows = daily.filter((d) => d.summary_date.slice(0, 7) === key && d.total_steps != null);
      const avg = rows.length ? Math.round(rows.reduce((a, d) => a + (d.total_steps || 0), 0) / rows.length) : 0;
      out.push({ label: dt.toLocaleDateString("en-AU", { month: "short" }), avg });
    }
    return out;
  }, [daily, now]);

  if (!daily.length) {
    return (
      <div>
        <PageHeader title="Steps" icon="👟" accent={COLOR} subtitle="No daily step data yet" refreshed={refreshed} />
        <EmptyHint>No daily summary data in this dataset.</EmptyHint>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Steps" icon="👟" accent={COLOR} subtitle={`Daily activity · ${current.label} vs ${prev.label}`} refreshed={refreshed} right={<PeriodMenu value={period} onChange={setPeriod} />} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total steps" value={fmtSteps(cur.totalSteps)} color={COLOR} delta={pct(cur.totalSteps, pre.totalSteps)} deltaGood />
        <Stat label="Avg / day" value={cur.avgSteps?.toLocaleString("en-AU") ?? "–"} color={COLOR} delta={pct(cur.avgSteps || 0, pre.avgSteps || 0)} deltaGood />
        <Stat label="Goal days" value={`${cur.goalDays}/${cur.totalDays}`} color={GOAL} delta={pct(cur.goalDays, pre.goalDays)} deltaGood />
        <Stat label="Distance" value={fmtKm(cur.distanceKm)} unit="km" color={COLOR} delta={pct(cur.distanceKm, pre.distanceKm)} deltaGood />
        <Stat label="Best day" value={fmtSteps(cur.bestDay)} color={COLOR} />
        <Stat label="Floors" value={cur.floors.toLocaleString("en-AU")} color="#fbbf24" delta={pct(cur.floors, pre.floors)} deltaGood />
      </div>

      <ChartCard title="Daily steps" subtitle={`last 60 days${goal ? ` · goal ${goal.toLocaleString("en-AU")}` : ""} · green = goal hit`} className="mb-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" minTickGap={24} />
            <YAxis tick={AXIS_TICK} stroke="#334155" width={48} tickFormatter={(v) => fmtSteps(v)} />
            <Tooltip {...TOOLTIP} formatter={(v: number) => [v.toLocaleString("en-AU"), "steps"]} />
            {goal && <ReferenceLine y={goal} stroke={GOAL} strokeDasharray="4 3" strokeOpacity={0.7} />}
            <Bar dataKey="steps" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {series.map((d, i) => <Cell key={i} fill={d.goalHit ? COLOR : "#475569"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Monthly average" subtitle="avg steps / day · 12 months">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} stroke="#334155" />
            <YAxis tick={AXIS_TICK} stroke="#334155" width={48} tickFormatter={(v) => fmtSteps(v)} />
            <Tooltip {...TOOLTIP} formatter={(v: number) => [v.toLocaleString("en-AU"), "avg/day"]} />
            {goal && <ReferenceLine y={goal} stroke={GOAL} strokeDasharray="4 3" strokeOpacity={0.6} />}
            <Bar dataKey="avg" fill={COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Line type="monotone" dataKey="avg" stroke="#fff" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
