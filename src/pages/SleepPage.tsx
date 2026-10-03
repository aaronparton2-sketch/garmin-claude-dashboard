import { useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Bundle } from "../lib/data";
import { fmtDate } from "../lib/data";
import { BUCKET_META, periods, sleepStat, sleepScoreOf, pct, type PeriodKey } from "../lib/metrics";
import { AXIS_TICK, ChartCard, EmptyHint, GRID, PageHeader, PeriodMenu, Stat, TOOLTIP } from "../ui";

const STAGE = { deep: "#6366f1", light: "#818cf8", rem: "#22d3ee", awake: "#475569" };

export default function SleepPage({ data, now, period, setPeriod, refreshed }: {
  data: Bundle; now: Date; period: PeriodKey; setPeriod: (p: PeriodKey) => void; refreshed?: string;
}) {
  const m = BUCKET_META.sleep;
  const sleep = useMemo(() => [...data.sleep].sort((a, b) => a.sleep_date.localeCompare(b.sleep_date)), [data]);
  const { current, prev } = periods(now, period);
  const cur = sleepStat(sleep, current);
  const pre = sleepStat(sleep, prev);

  const series = useMemo(() => sleep.slice(-60).map((s) => ({
    date: fmtDate(s.sleep_date),
    hours: s.total_sleep_s ? +(s.total_sleep_s / 3600).toFixed(1) : null,
    score: sleepScoreOf(s),
    deep: s.deep_s ? +(s.deep_s / 3600).toFixed(2) : 0,
    light: s.light_s ? +(s.light_s / 3600).toFixed(2) : 0,
    rem: s.rem_s ? +(s.rem_s / 3600).toFixed(2) : 0,
    awake: s.awake_s ? +(s.awake_s / 3600).toFixed(2) : 0,
  })), [sleep]);

  if (!sleep.length) {
    return (
      <div>
        <PageHeader title="Sleep" icon={m.icon} accent={m.color} subtitle="No sleep nights recorded yet" refreshed={refreshed} />
        <EmptyHint>No sleep data in this dataset.</EmptyHint>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Sleep" icon={m.icon} accent={m.color} subtitle={`${sleep.length} nights tracked · ${current.label} vs ${prev.label}`} refreshed={refreshed} right={<PeriodMenu value={period} onChange={setPeriod} />} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Stat label="Avg score" value={cur.avgScore ?? "–"} color={m.color} delta={pct(cur.avgScore || 0, pre.avgScore || 0)} deltaGood />
        <Stat label="Avg hours" value={cur.avgHours ?? "–"} unit="h" color={m.color} delta={pct(cur.avgHours || 0, pre.avgHours || 0)} deltaGood />
        <Stat label="Avg deep" value={cur.avgDeepPct ?? "–"} unit="%" color={STAGE.deep} delta={pct(cur.avgDeepPct || 0, pre.avgDeepPct || 0)} deltaGood />
        <Stat label="Avg REM" value={cur.avgRemPct ?? "–"} unit="%" color={STAGE.rem} delta={pct(cur.avgRemPct || 0, pre.avgRemPct || 0)} deltaGood />
        <Stat label="Nights" value={cur.nights} color={m.color} delta={pct(cur.nights, pre.nights)} deltaGood />
      </div>

      <ChartCard title="Sleep hours & score" subtitle="last 60 nights · score derived from sleep stages where Garmin's own isn't recorded" className="mb-4">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gsl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={m.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" minTickGap={24} />
            <YAxis yAxisId="l" tick={AXIS_TICK} stroke="#334155" unit="h" width={42} />
            <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={AXIS_TICK} stroke="#334155" width={32} />
            <Tooltip {...TOOLTIP} />
            <Area yAxisId="l" type="monotone" dataKey="hours" stroke={m.color} strokeWidth={2} fill="url(#gsl)" name="Hours" connectNulls isAnimationActive={false} />
            <Line yAxisId="r" type="monotone" dataKey="score" stroke="#fbbf24" strokeWidth={1.5} dot={false} name="Score" connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Sleep stages" subtitle="hours by stage · last 60 nights">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} stackOffset="none">
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" minTickGap={24} />
            <YAxis tick={AXIS_TICK} stroke="#334155" unit="h" width={42} />
            <Tooltip {...TOOLTIP} />
            <Area type="monotone" dataKey="deep" stackId="s" stroke={STAGE.deep} fill={STAGE.deep} fillOpacity={0.75} name="Deep" isAnimationActive={false} />
            <Area type="monotone" dataKey="light" stackId="s" stroke={STAGE.light} fill={STAGE.light} fillOpacity={0.55} name="Light" isAnimationActive={false} />
            <Area type="monotone" dataKey="rem" stackId="s" stroke={STAGE.rem} fill={STAGE.rem} fillOpacity={0.6} name="REM" isAnimationActive={false} />
            <Area type="monotone" dataKey="awake" stackId="s" stroke={STAGE.awake} fill={STAGE.awake} fillOpacity={0.5} name="Awake" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
