// Activity classification + period maths shared across every page.
import type { Activity, Sleep, Daily } from "./data";

export type Bucket = "cycling" | "running" | "swimming" | "walking" | "weights" | "sleep";

export const ACTIVITY_BUCKETS: Bucket[] = ["cycling", "running", "swimming", "walking", "weights"];
export const ALL_BUCKETS: Bucket[] = [...ACTIVITY_BUCKETS, "sleep"];

export type BucketMeta = {
  label: string;
  icon: string;
  color: string;
  /** does this activity have a meaningful distance? (weights/sleep do not) */
  distance: boolean;
  /** running/swimming are reported as pace (min/km); cycling as speed (km/h) */
  paceStyle: "pace" | "speed" | "none";
};

export const BUCKET_META: Record<Bucket, BucketMeta> = {
  cycling: { label: "Cycling", icon: "🚴", color: "#fb923c", distance: true, paceStyle: "speed" },
  running: { label: "Running", icon: "🏃", color: "#f87171", distance: true, paceStyle: "pace" },
  swimming: { label: "Swimming", icon: "🏊", color: "#38bdf8", distance: true, paceStyle: "pace" },
  walking: { label: "Walking", icon: "🚶", color: "#a3e635", distance: true, paceStyle: "pace" },
  weights: { label: "Weights", icon: "🏋️", color: "#a78bfa", distance: false, paceStyle: "none" },
  sleep: { label: "Sleep", icon: "😴", color: "#818cf8", distance: false, paceStyle: "none" },
};

// Map raw Garmin activity_type values onto the six tracked buckets.
const TYPE_MAP: Record<string, Bucket> = {
  // cycling
  cycling: "cycling", road_biking: "cycling", mountain_biking: "cycling", gravel_cycling: "cycling",
  indoor_cycling: "cycling", virtual_ride: "cycling", cyclocross: "cycling", track_cycling: "cycling",
  // running
  running: "running", trail_running: "running", treadmill_running: "running", track_running: "running",
  indoor_running: "running", obstacle_run: "running", street_running: "running",
  // swimming
  lap_swimming: "swimming", open_water_swimming: "swimming", swimming: "swimming",
  // walking
  walking: "walking", casual_walking: "walking", speed_walking: "walking", hiking: "walking",
  // weights / gym
  strength_training: "weights", fitness_equipment: "weights", indoor_cardio: "weights",
  training: "weights", strength: "weights", pilates: "weights", yoga: "weights", hiit: "weights",
};

export function bucketOf(type: string | null | undefined): Bucket | null {
  if (!type) return null;
  return TYPE_MAP[type.toLowerCase()] ?? null;
}

export function activitiesIn(activities: Activity[], bucket: Bucket): Activity[] {
  return activities.filter((a) => bucketOf(a.activity_type) === bucket);
}

// ---- period windows --------------------------------------------------------
// Anchor "now" to the most recent data point (never beyond real today) so the
// dashboard is meaningful on both the live feed and a static snapshot.
export function datasetNow(activities: Activity[], sleep: Sleep[], daily: Daily[]): Date {
  const dates = [
    ...activities.map((a) => a.activity_date),
    ...sleep.map((s) => s.sleep_date),
    ...daily.map((d) => d.summary_date),
  ].filter(Boolean) as string[];
  if (!dates.length) return new Date();
  const latest = new Date(dates.reduce((m, d) => (d > m ? d : m)));
  const today = new Date();
  return latest > today ? today : latest;
}

export type Window = { start: Date; end: Date; label: string };
export type PeriodKey = "month" | "30d" | "year";

/** current window + the equivalent previous window for comparison. */
export function periods(now: Date, key: PeriodKey): { current: Window; prev: Window } {
  const end = endOfDay(now);
  if (key === "30d") {
    return {
      current: { start: addDays(end, -29), end, label: "Last 30 days" },
      prev: { start: addDays(end, -59), end: addDays(end, -30), label: "Prev 30 days" },
    };
  }
  if (key === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const prevStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59);
    return {
      current: { start, end, label: `${now.getFullYear()} YTD` },
      prev: { start: prevStart, end: prevEnd, label: `${now.getFullYear() - 1} same` },
    };
  }
  // month-to-date vs same span of the previous month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 23, 59, 59);
  return {
    current: { start, end, label: monthName(now) },
    prev: { start: prevStart, end: prevEnd, label: monthName(prevStart) },
  };
}

function inWindow(date: string, w: Window): boolean {
  const t = new Date(date).getTime();
  return t >= w.start.getTime() && t <= w.end.getTime();
}

// ---- aggregation -----------------------------------------------------------
export type Stat = {
  sessions: number;
  distanceKm: number;
  durationS: number;
  /** duration from sessions that actually logged distance. Pace/speed MUST use
   *  this, never durationS: an indoor ride logs 30 min and 0.00 km, so dividing
   *  outdoor km by total time understated cycling speed by ~18%. */
  movingDurationS: number;
  /** sessions with no distance at all (indoor trainer, treadmill) */
  indoorSessions: number;
  indoorDurationS: number;
  calories: number;
  load: number;
  avgHr: number | null;
  elevationM: number;
};

export function aggregate(acts: Activity[]): Stat {
  let distanceKm = 0, durationS = 0, calories = 0, load = 0, elevationM = 0, hrSum = 0, hrN = 0;
  let movingDurationS = 0, indoorSessions = 0, indoorDurationS = 0;
  for (const a of acts) {
    const distM = a.distance_m || 0;
    const durS = a.duration_s || 0;
    distanceKm += distM / 1000;
    durationS += durS;
    // An indoor/trainer session logs real time and zero distance. It is real
    // training, so it counts as a session and as time, but its minutes must be
    // kept out of any per-kilometre maths.
    if (distM > 0) movingDurationS += durS;
    else if (durS > 0) { indoorSessions++; indoorDurationS += durS; }
    calories += a.calories || 0;
    load += a.training_load || 0;
    elevationM += a.elevation_gain_m || 0;
    if (a.avg_hr) { hrSum += a.avg_hr; hrN++; }
  }
  return {
    sessions: acts.length, distanceKm, durationS, movingDurationS,
    indoorSessions, indoorDurationS,
    calories, load, avgHr: hrN ? hrSum / hrN : null, elevationM,
  };
}

export function windowStat(acts: Activity[], w: Window): Stat {
  return aggregate(acts.filter((a) => inWindow(a.activity_date, w)));
}

// ---- sleep -----------------------------------------------------------------
export type SleepStat = {
  nights: number;
  avgHours: number | null;
  avgScore: number | null;
  avgDeepPct: number | null;
  avgRemPct: number | null;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Sleep score 0–100. Prefers Garmin's own score; when it's missing (older exports
 *  store it as null) derive a sensible proxy from duration + stage composition so the
 *  metric is never blank. Duration is weighted most, then deep + REM, minus awake time. */
export function sleepScoreOf(s: Sleep): number | null {
  if (s.sleep_score != null && s.sleep_score > 0) return s.sleep_score;
  const tot = s.total_sleep_s || 0;
  if (!tot) return null;
  const hrs = tot / 3600;
  const durPts = clamp01((hrs - 4) / 4) * 55;            // 4h→0, 8h→55
  const deepPts = clamp01((s.deep_s || 0) / tot / 0.18) * 20;  // ~18% deep = full
  const remPts = clamp01((s.rem_s || 0) / tot / 0.22) * 20;    // ~22% REM = full
  const awakePts = clamp01(1 - (s.awake_s || 0) / tot / 0.15) * 5;
  return Math.round(durPts + deepPts + remPts + awakePts);
}

export function sleepStat(rows: Sleep[], w?: Window): SleepStat {
  const r = w ? rows.filter((s) => inWindow(s.sleep_date, w)) : rows;
  const dur = r.map((s) => s.total_sleep_s).filter((v): v is number => !!v);
  const score = r.map((s) => sleepScoreOf(s)).filter((v): v is number => v != null);
  const deep = r.filter((s) => s.total_sleep_s).map((s) => (s.deep_s || 0) / (s.total_sleep_s || 1));
  const rem = r.filter((s) => s.total_sleep_s).map((s) => (s.rem_s || 0) / (s.total_sleep_s || 1));
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const h = mean(dur);
  return {
    nights: r.length,
    avgHours: h != null ? +(h / 3600).toFixed(1) : null,
    avgScore: score.length ? Math.round(score.reduce((a, b) => a + b, 0) / score.length) : null,
    avgDeepPct: deep.length ? Math.round((mean(deep) || 0) * 100) : null,
    avgRemPct: rem.length ? Math.round((mean(rem) || 0) * 100) : null,
  };
}

// ---- steps (daily summary, not logged activities) --------------------------
export type StepStat = {
  totalSteps: number;
  avgSteps: number | null;
  goalDays: number;
  totalDays: number;
  distanceKm: number;
  avgDistanceKm: number | null;
  bestDay: number;
  floors: number;
};

export function stepStat(daily: Daily[], w?: Window): StepStat {
  const r = w ? daily.filter((d) => inWindow(d.summary_date, w)) : daily;
  const withSteps = r.filter((d) => d.total_steps != null);
  const total = withSteps.reduce((a, d) => a + (d.total_steps || 0), 0);
  const goalDays = withSteps.filter((d) => d.step_goal && (d.total_steps || 0) >= (d.step_goal || 0)).length;
  const distanceKm = r.reduce((a, d) => a + (d.distance_m || 0) / 1000, 0);
  const best = withSteps.reduce((m, d) => Math.max(m, d.total_steps || 0), 0);
  const floors = r.reduce((a, d) => a + (d.floors_ascended || 0), 0);
  return {
    totalSteps: total,
    avgSteps: withSteps.length ? Math.round(total / withSteps.length) : null,
    goalDays,
    totalDays: withSteps.length,
    distanceKm,
    avgDistanceKm: withSteps.length ? +(distanceKm / withSteps.length).toFixed(2) : null,
    bestDay: best,
    floors: Math.round(floors),
  };
}

/** compact step count: 8,432 / 312k */
export function fmtSteps(n: number): string {
  if (n >= 100000) return `${Math.round(n / 1000)}k`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-AU");
}

// ---- monthly time-series for trend charts ----------------------------------
export type MonthPoint = { key: string; label: string; sessions: number; km: number; hours: number; load: number };

export function monthlySeries(acts: Activity[], months = 12, now = new Date()): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const rows = acts.filter((a) => a.activity_date.slice(0, 7) === key);
    const s = aggregate(rows);
    out.push({
      key,
      label: d.toLocaleDateString("en-AU", { month: "short" }),
      sessions: s.sessions,
      km: +s.distanceKm.toFixed(1),
      hours: +(s.durationS / 3600).toFixed(1),
      load: Math.round(s.load),
    });
  }
  return out;
}

// ---- formatters ------------------------------------------------------------
export const fmtKm = (km: number) => (km >= 100 ? km.toFixed(0) : km.toFixed(1));
export const fmtHours = (s: number) => (s / 3600).toFixed(1);

export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** pace in min/km from a distance + duration; "5:24" */
export function fmtPace(distanceM: number, durationS: number): string {
  if (!distanceM || !durationS) return "–";
  const secPerKm = durationS / (distanceM / 1000);
  const m = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function fmtSpeed(distanceM: number, durationS: number): string {
  if (!distanceM || !durationS) return "–";
  return (distanceM / 1000 / (durationS / 3600)).toFixed(1);
}

export const monthName = (d: Date) => d.toLocaleDateString("en-AU", { month: "long" });

function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/** % change between two numbers; null when prev is 0/missing (no baseline). */
export function pct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 100);
}
