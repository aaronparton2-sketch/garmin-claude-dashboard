import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Activity, Bundle } from "../lib/data";
import {
  BUCKET_META, activitiesIn, fmtDuration, fmtKm, fmtPace, fmtSpeed, monthlySeries,
  periods, windowStat, pct, type Bucket, type PeriodKey,
} from "../lib/metrics";
import { AXIS_TICK, ChartCard, EmptyHint, GRID, PageHeader, PeriodMenu, Stat, TOOLTIP } from "../ui";

export default function ActivityDetail({ bucket, data, now, period, setPeriod, refreshed }: {
  bucket: Bucket; data: Bundle; now: Date; period: PeriodKey; setPeriod: (p: PeriodKey) => void; refreshed?: string;
}) {
  const m = BUCKET_META[bucket];
  const acts = useMemo(
    () => activitiesIn(data.activities, bucket).sort((a, b) => a.activity_date.localeCompare(b.activity_date)),
    [data, bucket]
  );
  const { current, prev } = periods(now, period);
  const cur = windowStat(acts, current);
  const pre = windowStat(acts, prev);

  const months = useMemo(() => monthlySeries(acts, 12, now), [acts, now]);
  const recent = useMemo(() => [...acts].slice(-60).map((a) => ({
    date: new Date(a.activity_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
    km: +((a.distance_m || 0) / 1000).toFixed(2),
    hr: a.avg_hr || null,
    load: a.training_load || 0,
    paceVal: a.distance_m && a.duration_s ? a.duration_s / 60 / (a.distance_m / 1000) : null,
  })), [acts]);

  const tiles = m.distance
    ? [
        { label: "Distance", value: fmtKm(cur.distanceKm), unit: "km", d: pct(cur.distanceKm, pre.distanceKm), good: true },
        { label: "Sessions", value: cur.sessions, unit: "", d: pct(cur.sessions, pre.sessions), good: true },
        { label: "Time", value: (cur.durationS / 3600).toFixed(1), unit: "h", d: pct(cur.durationS, pre.durationS), good: true,
          note: cur.indoorDurationS ? `incl. ${Math.round(cur.indoorDurationS / 60)} min indoor` : undefined },
        m.paceStyle === "speed"
          // movingDurationS, NOT durationS -- see the note on Stat. A 0 km indoor
          // ride would otherwise be divided into the outdoor kilometres.
          ? { label: "Avg speed", value: fmtSpeed(cur.distanceKm * 1000, cur.movingDurationS), unit: "km/h", d: null, good: true,
              note: cur.indoorSessions ? `outdoor only · ${cur.indoorSessions} indoor session${cur.indoorSessions > 1 ? "s" : ""} excluded` : undefined }
          : { label: "Avg pace", value: fmtPace(cur.distanceKm * 1000, cur.movingDurationS), unit: "/km", d: null, good: false,
              note: cur.indoorSessions ? `outdoor only · ${cur.indoorSessions} indoor session${cur.indoorSessions > 1 ? "s" : ""} excluded` : undefined },
        { label: "Avg HR", value: cur.avgHr ? Math.round(cur.avgHr) : "–", unit: "bpm", d: null, good: false },
        { label: "Training load", value: Math.round(cur.load), unit: "", d: pct(cur.load, pre.load), good: true },
      ]
    : [
        { label: "Sessions", value: cur.sessions, unit: "", d: pct(cur.sessions, pre.sessions), good: true },
        { label: "Time", value: (cur.durationS / 3600).toFixed(1), unit: "h", d: pct(cur.durationS, pre.durationS), good: true },
        { label: "Training load", value: Math.round(cur.load), unit: "", d: pct(cur.load, pre.load), good: true },
        { label: "Avg HR", value: cur.avgHr ? Math.round(cur.avgHr) : "–", unit: "bpm", d: null, good: false },
        { label: "Calories", value: cur.calories.toLocaleString(), unit: "", d: pct(cur.calories, pre.calories), good: true },
        { label: "Avg session", value: cur.sessions ? fmtDuration(cur.durationS / cur.sessions) : "–", unit: "", d: null, good: true },
      ];

  if (!acts.length) {
    return (
      <div>
        <PageHeader title={m.label} icon={m.icon} accent={m.color} subtitle="No sessions recorded yet" refreshed={refreshed} />
        <EmptyHint>Nothing logged for {m.label.toLowerCase()} in this dataset yet.</EmptyHint>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={m.label}
        icon={m.icon}
        accent={m.color}
        subtitle={`${acts.length} sessions all-time · ${current.label} vs ${prev.label}`}
        refreshed={refreshed}
        right={<PeriodMenu value={period} onChange={setPeriod} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Stat key={t.label} label={t.label} value={t.value} unit={t.unit} color={m.color} delta={t.d} deltaGood={t.good} note={(t as { note?: string }).note} />
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly volume" subtitle={m.distance ? "km + sessions · 12 months" : "hours + sessions · 12 months"}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={months} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} stroke="#334155" />
              <YAxis yAxisId="l" tick={AXIS_TICK} stroke="#334155" width={40} />
              <YAxis yAxisId="r" orientation="right" tick={AXIS_TICK} stroke="#334155" width={28} />
              <Tooltip {...TOOLTIP} />
              <Bar yAxisId="l" dataKey={m.distance ? "km" : "hours"} fill={m.color} radius={[3, 3, 0, 0]} name={m.distance ? "km" : "hours"} isAnimationActive={false} />
              <Line yAxisId="r" type="monotone" dataKey="sessions" stroke="#e2e8f0" strokeWidth={1.5} dot={{ r: 2 }} name="sessions" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={m.distance ? "Per-session distance & HR" : "Per-session load & HR"} subtitle="last 60 sessions">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={recent} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" minTickGap={28} />
              <YAxis yAxisId="l" tick={AXIS_TICK} stroke="#334155" width={40} />
              <YAxis yAxisId="r" orientation="right" tick={AXIS_TICK} stroke="#334155" width={32} domain={["dataMin - 8", "dataMax + 8"]} />
              <Tooltip {...TOOLTIP} />
              <Bar yAxisId="l" dataKey={m.distance ? "km" : "load"} fill={m.color} radius={[2, 2, 0, 0]} name={m.distance ? "km" : "load"} isAnimationActive={false} />
              <Line yAxisId="r" type="monotone" dataKey="hr" stroke="#f87171" strokeWidth={1.5} dot={false} name="avg HR" connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {m.distance && m.paceStyle === "pace" && (
        <ChartCard title="Pace trend" subtitle="min/km · last 60 sessions · lower is faster" className="mb-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={recent} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" minTickGap={28} />
              <YAxis reversed tick={AXIS_TICK} stroke="#334155" width={44} tickFormatter={(v) => `${Math.floor(v)}:${Math.round((v % 1) * 60).toString().padStart(2, "0")}`} />
              <Tooltip {...TOOLTIP} formatter={(v: number) => [`${Math.floor(v)}:${Math.round((v % 1) * 60).toString().padStart(2, "0")} /km`, "pace"]} />
              <Line type="monotone" dataKey="paceVal" stroke={m.color} strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <RecentTable bucket={bucket} acts={[...acts].reverse().slice(0, 12)} />
    </div>
  );
}

function RecentTable({ bucket, acts }: { bucket: Bucket; acts: Activity[] }) {
  const m = BUCKET_META[bucket];
  return (
    <ChartCard title="Recent sessions" subtitle="latest 12">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Session</th>
              {m.distance && <th className="py-2 pr-3 text-right font-medium">Dist</th>}
              <th className="py-2 pr-3 text-right font-medium">Time</th>
              {m.distance && <th className="py-2 pr-3 text-right font-medium">{m.paceStyle === "speed" ? "Speed" : "Pace"}</th>}
              <th className="py-2 pr-3 text-right font-medium">HR</th>
              <th className="py-2 text-right font-medium">Load</th>
            </tr>
          </thead>
          <tbody>
            {acts.map((a) => (
              <tr key={a.activity_id} className="border-b border-slate-800/50 text-slate-300">
                <td className="py-2 pr-3 text-slate-400">{new Date(a.activity_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "2-digit" })}</td>
                <td className="py-2 pr-3 text-white">{a.name || m.label}</td>
                {m.distance && <td className="py-2 pr-3 text-right">{fmtKm((a.distance_m || 0) / 1000)}</td>}
                <td className="py-2 pr-3 text-right">{fmtDuration(a.duration_s || 0)}</td>
                {m.distance && (
                  <td className="py-2 pr-3 text-right">
                    {m.paceStyle === "speed" ? fmtSpeed(a.distance_m || 0, a.duration_s || 0) : fmtPace(a.distance_m || 0, a.duration_s || 0)}
                  </td>
                )}
                <td className="py-2 pr-3 text-right">{a.avg_hr || "–"}</td>
                <td className="py-2 text-right">{a.training_load ? Math.round(a.training_load) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
