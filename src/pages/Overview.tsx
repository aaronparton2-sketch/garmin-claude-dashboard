import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Bundle } from "../lib/data";
import {
  ACTIVITY_BUCKETS, BUCKET_META, activitiesIn, fmtKm, fmtSteps, monthlySeries,
  periods, sleepStat, stepStat, windowStat, pct, type Bucket, type PeriodKey,
} from "../lib/metrics";
import { AXIS_TICK, Card, GRID, PageHeader, Pill, PeriodMenu, TOOLTIP, Delta } from "../ui";

export default function Overview({ data, now, go, period, setPeriod, refreshed }: {
  data: Bundle; now: Date; go: (path: string) => void; period: PeriodKey; setPeriod: (p: PeriodKey) => void; refreshed?: string;
}) {
  const { current, prev } = periods(now, period);

  const cards = useMemo(() => ACTIVITY_BUCKETS.map((b) => {
    const acts = activitiesIn(data.activities, b);
    return { bucket: b, curr: windowStat(acts, current), prevStat: windowStat(acts, prev) };
  }), [data, current, prev]);

  const sleepNow = sleepStat(data.sleep, current);
  const sleepPrev = sleepStat(data.sleep, prev);
  const stepNow = stepStat(data.daily, current);
  const stepPrev = stepStat(data.daily, prev);

  // stacked monthly hours per bucket (last 12 months)
  const trend = useMemo(() => {
    const series = ACTIVITY_BUCKETS.map((b) => monthlySeries(activitiesIn(data.activities, b), 12, now));
    return series[0].map((_, i) => {
      const row: Record<string, number | string> = { label: series[0][i].label };
      ACTIVITY_BUCKETS.forEach((b, bi) => (row[b] = series[bi][i].hours));
      return row;
    });
  }, [data, now]);

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={`${current.label} vs ${prev.label} · ${data.activities.length} activities · ${data.sleep.length} sleep nights`}
        refreshed={refreshed}
        right={<PeriodMenu value={period} onChange={setPeriod} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ bucket, curr, prevStat }) =>
          bucket === "walking"
            ? <StepsCard key="walking" now={stepNow} prev={stepPrev} go={go} />
            : <ActivityCard key={bucket} bucket={bucket} curr={curr} prev={prevStat} go={go} />
        )}
        <SleepCard now={sleepNow} prev={sleepPrev} go={go} />
      </div>

      <div className="mt-4">
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-white">Training hours by activity</h2>
            <p className="text-xs text-slate-500">last 12 months · stacked hours</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} stroke="#334155" />
              <YAxis tick={AXIS_TICK} stroke="#334155" unit="h" width={44} />
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => BUCKET_META[v as Bucket]?.label ?? v} />
              {ACTIVITY_BUCKETS.map((b) => (
                <Bar key={b} dataKey={b} stackId="h" fill={BUCKET_META[b].color} radius={[0, 0, 0, 0]} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function ActivityCard({ bucket, curr, prev, go }: {
  bucket: Bucket; curr: ReturnType<typeof windowStat>; prev: ReturnType<typeof windowStat>; go: (p: string) => void;
}) {
  const m = BUCKET_META[bucket];
  const tiles = m.distance
    ? [
        { label: "Distance", value: fmtKm(curr.distanceKm), unit: "km", d: pct(curr.distanceKm, prev.distanceKm) },
        { label: "Sessions", value: curr.sessions, unit: "", d: pct(curr.sessions, prev.sessions) },
        { label: "Time", value: (curr.durationS / 3600).toFixed(1), unit: "h", d: pct(curr.durationS, prev.durationS) },
      ]
    : [
        { label: "Sessions", value: curr.sessions, unit: "", d: pct(curr.sessions, prev.sessions) },
        { label: "Time", value: (curr.durationS / 3600).toFixed(1), unit: "h", d: pct(curr.durationS, prev.durationS) },
        { label: "Load", value: Math.round(curr.load), unit: "", d: pct(curr.load, prev.load) },
      ];
  return (
    <button
      onClick={() => go(`/activity/${bucket}`)}
      className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900/70"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg text-xl" style={{ background: `${m.color}1a` }}>{m.icon}</span>
          <span className="font-display text-base font-semibold text-white">{m.label}</span>
        </div>
        <span className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-400">›</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label}>
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{t.label}</div>
            <div className="mt-0.5 flex items-baseline gap-0.5">
              <span className="font-display text-xl font-semibold text-white" style={{ color: m.color }}>{t.value}</span>
              {t.unit && <span className="text-[10px] text-slate-500">{t.unit}</span>}
            </div>
            <Delta delta={t.d} suffix="" />
          </div>
        ))}
      </div>
    </button>
  );
}

function SleepCard({ now, prev, go }: {
  now: ReturnType<typeof sleepStat>; prev: ReturnType<typeof sleepStat>; go: (p: string) => void;
}) {
  const m = BUCKET_META.sleep;
  const tiles = [
    { label: "Avg score", value: now.avgScore ?? "–", unit: "", d: pct(now.avgScore || 0, prev.avgScore || 0) },
    { label: "Avg hours", value: now.avgHours ?? "–", unit: "h", d: pct(now.avgHours || 0, prev.avgHours || 0) },
    { label: "Nights", value: now.nights, unit: "", d: pct(now.nights, prev.nights) },
  ];
  return (
    <button
      onClick={() => go("/sleep")}
      className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900/70"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg text-xl" style={{ background: `${m.color}1a` }}>{m.icon}</span>
          <span className="font-display text-base font-semibold text-white">{m.label}</span>
        </div>
        <span className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-400">›</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label}>
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{t.label}</div>
            <div className="mt-0.5 flex items-baseline gap-0.5">
              <span className="font-display text-xl font-semibold text-white" style={{ color: m.color }}>{t.value}</span>
              {t.unit && <span className="text-[10px] text-slate-500">{t.unit}</span>}
            </div>
            <Delta delta={t.d} good={t.label !== "Avg hours" ? true : true} suffix="" />
          </div>
        ))}
      </div>
      <div className="mt-3"><Pill color={m.color}>Sleep quality tracked</Pill></div>
    </button>
  );
}

function StepsCard({ now, prev, go }: {
  now: ReturnType<typeof stepStat>; prev: ReturnType<typeof stepStat>; go: (p: string) => void;
}) {
  const color = "#a3e635";
  const tiles = [
    { label: "Steps", value: fmtSteps(now.totalSteps), unit: "", d: pct(now.totalSteps, prev.totalSteps) },
    { label: "Avg/day", value: now.avgSteps?.toLocaleString("en-AU") ?? "–", unit: "", d: pct(now.avgSteps || 0, prev.avgSteps || 0) },
    { label: "Goal days", value: `${now.goalDays}/${now.totalDays}`, unit: "", d: pct(now.goalDays, prev.goalDays) },
  ];
  return (
    <button
      onClick={() => go("/activity/walking")}
      className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900/70"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg text-xl" style={{ background: `${color}1a` }}>👟</span>
          <span className="font-display text-base font-semibold text-white">Steps</span>
        </div>
        <span className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-400">›</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label}>
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{t.label}</div>
            <div className="mt-0.5 flex items-baseline gap-0.5">
              <span className="font-display text-xl font-semibold text-white" style={{ color }}>{t.value}</span>
            </div>
            <Delta delta={t.d} suffix="" />
          </div>
        ))}
      </div>
    </button>
  );
}
