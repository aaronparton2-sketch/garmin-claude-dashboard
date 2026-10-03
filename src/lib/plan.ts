// Training plan: user-entered targets per activity, stored locally (single user),
// compared against the real Garmin actuals. v1 persistence = localStorage; a
// Supabase-backed version (write via a gated API route) is the natural next step.
import type { Activity, Daily } from "./data";
import { ACTIVITY_BUCKETS, BUCKET_META, activitiesIn, aggregate, type Bucket } from "./metrics";

export type ActivityTarget = {
  enabled: boolean;
  sessionsPerWeek: number;
  distancePerWeekKm: number;
  durationPerWeekMin: number;
  stepsPerDay: number; // walking only
};

export type TrainingPlan = {
  goalName: string;
  goalDate: string; // yyyy-mm-dd
  focus: string;
  targets: Record<Bucket, ActivityTarget>;
  updatedAt: string;
};

const KEY = "garmin.trainingPlan.v1";

export function blankTarget(): ActivityTarget {
  return { enabled: false, sessionsPerWeek: 0, distancePerWeekKm: 0, durationPerWeekMin: 0, stepsPerDay: 0 };
}

export function blankPlan(): TrainingPlan {
  const targets = {} as Record<Bucket, ActivityTarget>;
  for (const b of ACTIVITY_BUCKETS) targets[b] = blankTarget();
  return { goalName: "", goalDate: "", focus: "", targets, updatedAt: "" };
}

/** Seeded default: a basic half-distance triathlon weekly target set, shown until
 *  the user saves their own. updatedAt = "seed" so hasPlan is true (the plan renders, not the editor). */
export function default70Plan(): TrainingPlan {
  const targets = {} as Record<Bucket, ActivityTarget>;
  for (const b of ACTIVITY_BUCKETS) targets[b] = blankTarget();
  targets.swimming = { enabled: true, sessionsPerWeek: 3, distancePerWeekKm: 6, durationPerWeekMin: 150, stepsPerDay: 0 };
  targets.cycling = { enabled: true, sessionsPerWeek: 3, distancePerWeekKm: 120, durationPerWeekMin: 330, stepsPerDay: 0 };
  targets.running = { enabled: true, sessionsPerWeek: 3, distancePerWeekKm: 32, durationPerWeekMin: 180, stepsPerDay: 0 };
  targets.weights = { enabled: true, sessionsPerWeek: 2, distancePerWeekKm: 0, durationPerWeekMin: 60, stepsPerDay: 0 };
  targets.walking = { enabled: true, sessionsPerWeek: 0, distancePerWeekKm: 0, durationPerWeekMin: 0, stepsPerDay: 8000 };
  return {
    goalName: "Half-distance triathlon (sample)",
    goalDate: "2026-12-13",
    focus: "16-week build · Base → Build → Peak → Taper",
    targets,
    updatedAt: "seed",
  };
}

// ---- 16-week half-distance schedule (generic volume table) ------------------
export type PlanWeek = { week: number; phase: string; swim: string; bike: string; run: string; key: string };

export const PLAN_70_3: PlanWeek[] = [
  { week: 1, phase: "Base", swim: "3 × · 2.5 km", bike: "3 × · 80 km", run: "3 × · 25 km", key: "50 km long ride" },
  { week: 2, phase: "Base", swim: "3 × · 3.0 km", bike: "3 × · 90 km", run: "3 × · 28 km", key: "12 km long run" },
  { week: 3, phase: "Base", swim: "3 × · 3.5 km", bike: "3 × · 100 km", run: "3 × · 30 km", key: "60 km ride + 15′ brick" },
  { week: 4, phase: "Recovery", swim: "2 × · 2.5 km", bike: "2 × · 70 km", run: "3 × · 22 km", key: "easy week · time-trial 1.9 km swim" },
  { week: 5, phase: "Build", swim: "3 × · 4.0 km", bike: "3 × · 110 km", run: "3 × · 32 km", key: "70 km ride, 14 km run" },
  { week: 6, phase: "Build", swim: "3 × · 4.5 km", bike: "4 × · 120 km", run: "3 × · 35 km", key: "brick 60 km + 8 km" },
  { week: 7, phase: "Build", swim: "3 × · 5.0 km", bike: "4 × · 130 km", run: "4 × · 38 km", key: "80 km long ride" },
  { week: 8, phase: "Build", swim: "3 × · 5.0 km", bike: "4 × · 140 km", run: "4 × · 40 km", key: "16 km long run" },
  { week: 9, phase: "Recovery", swim: "2 × · 3.5 km", bike: "2 × · 90 km", run: "3 × · 28 km", key: "easy week · open-water swim" },
  { week: 10, phase: "Peak", swim: "3 × · 5.5 km", bike: "4 × · 150 km", run: "4 × · 42 km", key: "90 km race-sim ride" },
  { week: 11, phase: "Peak", swim: "4 × · 6.0 km", bike: "4 × · 160 km", run: "4 × · 45 km", key: "brick 80 km + 10 km @ race pace" },
  { week: 12, phase: "Peak", swim: "4 × · 6.0 km", bike: "4 × · 150 km", run: "4 × · 45 km", key: "18 km long run" },
  { week: 13, phase: "Peak", swim: "3 × · 5.5 km", bike: "4 × · 140 km", run: "4 × · 42 km", key: "full race simulation (90 / 21)" },
  { week: 14, phase: "Taper", swim: "3 × · 4.0 km", bike: "3 × · 100 km", run: "3 × · 30 km", key: "sharpen · short race-pace efforts" },
  { week: 15, phase: "Taper", swim: "2 × · 3.0 km", bike: "2 × · 70 km", run: "3 × · 20 km", key: "race-week openers · rest up" },
  { week: 16, phase: "Race", swim: "1.9 km", bike: "90 km", run: "21.1 km", key: "🏁 RACE DAY" },
];

/** which schedule week "now" falls in, counting back from the goal date.
 *  0 = not started yet · 1..N = current week · N+1 = done. null if no goal date. */
export function currentPlanWeek(goalDate: string, now: Date, total = PLAN_70_3.length): number | null {
  if (!goalDate) return null;
  const g = new Date(goalDate);
  if (isNaN(g.getTime())) return null;
  const weeksToGo = Math.ceil((g.getTime() - now.getTime()) / 86_400_000 / 7);
  const wk = total - weeksToGo + 1;
  if (wk < 1) return 0;
  if (wk > total) return total + 1;
  return wk;
}

export function loadPlan(): TrainingPlan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as TrainingPlan;
    // backfill any newly-added buckets
    const base = blankPlan();
    p.targets = { ...base.targets, ...p.targets };
    return p;
  } catch {
    return null;
  }
}

export function savePlan(p: TrainingPlan): void {
  p.updatedAt = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearPlan(): void {
  localStorage.removeItem(KEY);
}

// ---- adherence -------------------------------------------------------------
export type Adherence = {
  bucket: Bucket;
  target: ActivityTarget;
  actualSessions: number;
  actualKm: number;
  actualMin: number;
  actualStepsPerDay: number; // walking only — avg over days elapsed this week
  // primary adherence metric per bucket: sessions for all; the headline % is the
  // weakest of the set targets so "on track" means genuinely on track.
  pct: number;
  status: "ahead" | "ontrack" | "behind" | "none";
};

export function weekStart(now: Date): Date {
  const d = new Date(now);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** fraction of the current week elapsed (Mon→now), min 1 day, for pro-rata pace. */
export function weekProgress(now: Date): number {
  const start = weekStart(now);
  const elapsedDays = Math.min(7, Math.max(1, (now.getTime() - start.getTime()) / 86_400_000 + 1));
  return elapsedDays / 7;
}

export function adherence(plan: TrainingPlan, activities: Activity[], daily: Daily[], now: Date): Adherence[] {
  const start = weekStart(now);
  const pace = weekProgress(now);
  const out: Adherence[] = [];
  for (const bucket of ACTIVITY_BUCKETS) {
    const t = plan.targets[bucket];
    const base = { bucket, target: t ?? blankTarget(), actualSessions: 0, actualKm: 0, actualMin: 0, actualStepsPerDay: 0 };
    if (!t?.enabled) { out.push({ ...base, pct: 0, status: "none" }); continue; }

    // walking is a daily steps target, not logged sessions
    if (bucket === "walking") {
      const days = daily.filter((d) => new Date(d.summary_date) >= start && d.total_steps != null);
      const avg = days.length ? Math.round(days.reduce((a, d) => a + (d.total_steps || 0), 0) / days.length) : 0;
      const ratio = t.stepsPerDay > 0 ? avg / t.stepsPerDay : 0;
      const status: Adherence["status"] = ratio >= 1 ? "ahead" : ratio >= 0.85 ? "ontrack" : "behind";
      out.push({ ...base, actualStepsPerDay: avg, pct: Math.round(ratio * 100), status });
      continue;
    }

    const week = activitiesIn(activities, bucket).filter((a) => new Date(a.activity_date) >= start);
    const s = aggregate(week);
    const actualKm = +s.distanceKm.toFixed(1);
    const actualMin = Math.round(s.durationS / 60);

    const ratios: number[] = [];
    if (t.sessionsPerWeek > 0) ratios.push(s.sessions / t.sessionsPerWeek);
    if (BUCKET_META[bucket].distance && t.distancePerWeekKm > 0) ratios.push(actualKm / t.distancePerWeekKm);
    if (t.durationPerWeekMin > 0) ratios.push(actualMin / t.durationPerWeekMin);
    const ratio = ratios.length ? Math.min(...ratios) : 0;

    let status: Adherence["status"];
    if (ratio >= 1) status = "ahead";
    else if (ratio >= pace * 0.85) status = "ontrack";
    else status = "behind";

    out.push({ ...base, actualSessions: s.sessions, actualKm, actualMin, pct: Math.round(ratio * 100), status });
  }
  return out;
}

export function daysUntil(goalDate: string, now: Date): number | null {
  if (!goalDate) return null;
  const g = new Date(goalDate);
  if (isNaN(g.getTime())) return null;
  return Math.ceil((g.getTime() - now.getTime()) / 86_400_000);
}
