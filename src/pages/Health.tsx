import { useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Bundle } from "../lib/data";
import { fmtDate, last, recent, rolling } from "../lib/data";
import { periods, type PeriodKey } from "../lib/metrics";
import { AXIS_TICK, ChartCard, GRID, PageHeader, PeriodMenu, Stat, TOOLTIP } from "../ui";

const C = { weight: "#6ee7b7", fat: "#fbbf24", muscle: "#818cf8", sleep: "#a78bfa", hr: "#f87171", steps: "#38bdf8" };

export default function Health({ data, now, period, setPeriod, refreshed }: {
  data: Bundle; now: Date; period: PeriodKey; setPeriod: (p: PeriodKey) => void; refreshed?: string;
}) {
  const { current, prev } = periods(now, period);
  const inCur = (d: string) => { const t = new Date(d).getTime(); return t >= current.start.getTime() && t <= current.end.getTime(); };
  const inPrev = (d: string) => { const t = new Date(d).getTime(); return t >= prev.start.getTime() && t <= prev.end.getTime(); };

  const wiAll = useMemo(
    () => [...data.weighIns].sort((a, b) => a.measured_date.localeCompare(b.measured_date)),
    [data]
  );
  const wi = useMemo(() => wiAll.filter((w) => inCur(w.measured_date)), [wiAll, period, now]);
  const wiPrev = useMemo(() => wiAll.filter((w) => inPrev(w.measured_date)), [wiAll, period, now]);
  // headline = latest weigh-in in the window (fall back to overall latest so it's never blank).
  // delta is like-for-like: this window's latest vs the PREVIOUS window's latest.
  const latest = last(wi) ?? last(wiAll);
  const first = wi[0] ?? wiAll[0];
  const prevLatest = last(wiPrev);

  const weightSeries = useMemo(() => {
    const smooth = rolling(wiAll.map((w) => w.weight_kg), 7);
    const pos = (v: number | null) => (v && v > 0 ? v : null);
    return wiAll
      .map((w, i) => ({
        date: fmtDate(w.measured_date),
        raw: w.measured_date,
        weight: w.weight_kg,
        trend: smooth[i],
        fat: pos(w.body_fat_pct),
        muscle: pos(w.muscle_mass_kg),
      }))
      .filter((r) => inCur(r.raw));
  }, [wiAll, period, now]);

  const daily = useMemo(
    () => [...data.daily].sort((a, b) => a.summary_date.localeCompare(b.summary_date)).filter((d) => inCur(d.summary_date)),
    [data, period, now]
  );
  const sleep = useMemo(() => [...data.sleep].sort((a, b) => a.sleep_date.localeCompare(b.sleep_date)), [data]);

  const stepSeries = daily.map((d) => ({ date: fmtDate(d.summary_date), steps: d.total_steps, rhr: d.resting_hr }));

  const avgSleep = useMemo(() => {
    const r = recent(sleep, "sleep_date", 7).map((s) => s.total_sleep_s).filter(Boolean) as number[];
    return r.length ? (r.reduce((a, b) => a + b, 0) / r.length / 3600).toFixed(1) : "–";
  }, [sleep]);
  const latestRhr = last(daily.filter((d) => d.resting_hr))?.resting_hr ?? "–";

  const pd = (from?: number | null, to?: number | null) =>
    from == null || to == null || !from ? null : Math.round(((to - from) / from) * 100);

  return (
    <div>
      <PageHeader
        title="Health"
        icon="❤️"
        accent={C.weight}
        subtitle={`Body composition · ${wi.length} weigh-ins · ${current.label} vs ${prev.label}`}
        refreshed={refreshed}
        right={<PeriodMenu value={period} onChange={setPeriod} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Weight" value={latest?.weight_kg ?? "–"} unit="kg" color={C.weight} delta={pd(prevLatest?.weight_kg, latest?.weight_kg)} deltaGood={false} />
        <Stat label="Body fat" value={latest?.body_fat_pct ?? "–"} unit="%" color={C.fat} delta={pd(prevLatest?.body_fat_pct, latest?.body_fat_pct)} deltaGood={false} />
        <Stat label="Muscle" value={latest?.muscle_mass_kg ?? "–"} unit="kg" color={C.muscle} delta={pd(prevLatest?.muscle_mass_kg, latest?.muscle_mass_kg)} deltaGood />
        <Stat label="Resting HR" value={latestRhr} unit="bpm" color={C.hr} />
        <Stat label="Sleep avg 7d" value={avgSleep} unit="h" color={C.sleep} />
      </div>

      <ChartCard title="Body composition" subtitle={`${first?.measured_date} → ${latest?.measured_date}`} className="mb-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={weightSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.weight} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.weight} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" minTickGap={24} />
            <YAxis domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => `${Math.round(v)}`} tick={AXIS_TICK} stroke="#334155" unit="kg" width={58} />
            <Tooltip {...TOOLTIP} />
            <Area type="monotone" dataKey="weight" stroke={C.weight} strokeWidth={2} fill="url(#gw)" dot={{ r: 2 }} name="Weight" isAnimationActive={false} />
            <Line type="monotone" dataKey="trend" stroke="#fff" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="7-pt trend" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Body fat %" subtitle="per weigh-in">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={weightSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" minTickGap={24} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => `${Math.round(v)}`} tick={AXIS_TICK} stroke="#334155" unit="%" width={52} />
              <Tooltip {...TOOLTIP} />
              <Line type="monotone" dataKey="fat" stroke={C.fat} strokeWidth={2} dot={{ r: 2 }} name="Body fat" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Muscle mass" subtitle="per weigh-in">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={weightSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" minTickGap={24} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v) => `${Math.round(v)}`} tick={AXIS_TICK} stroke="#334155" unit="kg" width={56} />
              <Tooltip {...TOOLTIP} />
              <Line type="monotone" dataKey="muscle" stroke={C.muscle} strokeWidth={2} dot={{ r: 2 }} name="Muscle" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Steps & resting HR" subtitle="last 60 days">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={stepSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" minTickGap={24} />
            <YAxis yAxisId="l" tick={AXIS_TICK} stroke="#334155" width={48} />
            <YAxis yAxisId="r" orientation="right" tick={AXIS_TICK} stroke="#334155" width={36} />
            <Tooltip {...TOOLTIP} />
            <Line yAxisId="l" type="monotone" dataKey="steps" stroke={C.steps} strokeWidth={2} dot={false} name="Steps" isAnimationActive={false} />
            <Line yAxisId="r" type="monotone" dataKey="rhr" stroke={C.hr} strokeWidth={2} dot={false} name="Resting HR" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
