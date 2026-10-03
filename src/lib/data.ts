// Data layer.
// Production AND local dev: fetch /api/data (Vercel function in prod, the vite
//   dev shim locally). It serves your Supabase tables when configured, otherwise
//   the bundled sample set. Keys stay server-side; nothing sensitive is in the bundle.
// Fallback: a direct Supabase read using VITE_SUPABASE_* (publishable key under
//   read-only RLS) for anyone hosting the static build without the API routes.

export type WeighIn = {
  measured_at: string;
  measured_date: string;
  weight_kg: number;
  bmi: number | null;
  body_fat_pct: number | null;
  body_water_pct: number | null;
  muscle_mass_kg: number | null;
  bone_mass_kg: number | null;
  raw_impedance: number | null;
  created_at?: string | null;
};
export type DexaScan = {
  scan_date: string;
  provider: string | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  fat_mass_kg: number | null;
  lean_mass_kg: number | null;
  fat_free_mass_kg: number | null;
  bone_mineral_content_kg: number | null;
  bmi: number | null;
  asm_kg: number | null;
  asm_height2: number | null;
  bmd_total: number | null;
  t_score: number | null;
  z_score: number | null;
  vat_area_cm2: number | null;
  vat_mass_g: number | null;
  sat_mass_g: number | null;
  ag_ratio: number | null;
  regional: Record<string, { lean_g: number; fat_g: number }> | null;
  notes: string | null;
};
export type Activity = {
  activity_id: number;
  activity_date: string;
  started_at?: string | null;
  activity_type: string | null;
  name: string | null;
  duration_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr?: number | null;
  calories: number | null;
  elevation_gain_m?: number | null;
  aerobic_te?: number | null;
  anaerobic_te?: number | null;
  training_load: number | null;
  moderate_min?: number | null;
  vigorous_min?: number | null;
  created_at?: string | null;
};
export type Sleep = {
  sleep_date: string;
  total_sleep_s: number | null;
  deep_s: number | null;
  light_s: number | null;
  rem_s: number | null;
  awake_s?: number | null;
  sleep_score: number | null;
  avg_respiration?: number | null;
  avg_stress?: number | null;
  created_at?: string | null;
};
export type Daily = {
  summary_date: string;
  total_steps: number | null;
  step_goal?: number | null;
  distance_m: number | null;
  total_calories: number | null;
  active_calories?: number | null;
  resting_hr: number | null;
  min_hr?: number | null;
  max_hr?: number | null;
  moderate_min: number | null;
  vigorous_min: number | null;
  floors_ascended?: number | null;
  created_at?: string | null;
};

/** ---- Blood work -------------------------------------------------------
 * A reference interval comes in three shapes and they are NOT interchangeable:
 * a normal band, an upper target, or a lower target. Collapsing them all into
 * low/high is what makes a "high HDL" render as a failure when it is the
 * opposite. Keep the shape explicit and let the UI decide how to draw it.
 */
export type BloodRange =
  | { type: "between"; low: number; high: number }
  | { type: "below"; high: number }
  | { type: "above"; low: number };

export type BloodMarker = {
  /** Stable id and the trend join key across panels. Never rename one. */
  key: string;
  group: string;
  name: string;
  value: number;
  /** Set when the lab reported an inequality ("<1" -> value 1, op "<"). */
  op?: "<" | ">";
  unit: string;
  range: BloodRange;
  /** The LAB's own flag. Never recompute it - their call governs. */
  flag: "H" | "L" | null;
  note?: string;
};

export type BloodPanel = {
  panel_date: string;
  lab?: string | null;
  lab_id?: string | null;
  referrer?: string | null;
  clinical_notes?: string | null;
  fasting?: boolean | null;
  markers: BloodMarker[];
  lab_comments?: string[] | null;
  created_at?: string | null;
};

export type Bundle = {
  weighIns: WeighIn[];
  activities: Activity[];
  sleep: Sleep[];
  daily: Daily[];
  dexa: DexaScan[];
  bloods: BloodPanel[];
  /** sample = the bundled fictional dataset · supabase = your live tables */
  source: "snapshot" | "sample" | "supabase";
};
export type LoadResult = Bundle | { needLogin: true };

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Supabase/PostgREST caps a single response at 1000 rows (the `limit` param
// can't lift it). Tables like garmin_daily_summary already exceed 1000, so an
// unpaginated read silently drops the newest rows — recent months disappear
// and metrics like steps read 0. Page through with Range headers until a short
// page comes back.
const PAGE = 1000;
async function fromSupabase(table: string, order: string): Promise<any[]> {
  const headers = { apikey: SB_KEY!, Authorization: `Bearer ${SB_KEY}` };
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?select=*&order=${order}`, {
      headers: { ...headers, "Range-Unit": "items", Range: `${from}-${from + PAGE - 1}` },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < PAGE) return all;
  }
}

export async function loadData(): Promise<LoadResult> {
  // 1) Production: the gated proxy.
  try {
    const r = await fetch("/api/data", { credentials: "same-origin" });
    if (r.status === 401) return { needLogin: true };
    if (r.ok && (r.headers.get("content-type") || "").includes("application/json")) {
      return (await r.json()) as Bundle;
    }
  } catch {
    /* no serverless function locally — fall through to dev path */
  }

  // 2) Local dev: direct Supabase read.
  if (SB_URL && SB_KEY) {
    const [weighIns, activities, sleep, daily] = await Promise.all([
      fromSupabase("garmin_weigh_ins", "measured_date.asc"),
      fromSupabase("garmin_activities", "activity_date.asc"),
      fromSupabase("garmin_sleep", "sleep_date.asc"),
      fromSupabase("garmin_daily_summary", "summary_date.asc"),
    ]);
    // Both optional: the table may not exist yet on a fresh project, and a
    // missing side-table must never take the whole dashboard down.
    const [dexa, bloods] = await Promise.all([
      fromSupabase("dexa_scans", "scan_date.asc").catch(() => []),
      fromSupabase("blood_panels", "panel_date.asc").catch(() => []),
    ]);
    return { weighIns, activities, sleep, daily, dexa, bloods, source: "supabase" };
  }

  // 3) Nothing reachable.
  return { weighIns: [], activities: [], sleep: [], daily: [], dexa: [], bloods: [], source: "snapshot" };
}

export async function login(password: string): Promise<boolean> {
  const r = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ password }),
  });
  return r.ok;
}

// ---- derived helpers -------------------------------------------------------
export const last = <T,>(a: T[]): T | undefined => a[a.length - 1];

/** "Last refreshed" stamp: the newest created_at across every table (i.e. when
 *  the Garmin pull last wrote), formatted like "7 Jul 2026, 2:14 pm". */
export function lastRefreshed(b: Bundle): string | null {
  let max = "";
  const scan = (rows: { created_at?: string | null }[]) => {
    for (const r of rows) if (r.created_at && r.created_at > max) max = r.created_at;
  };
  scan(b.weighIns); scan(b.activities); scan(b.sleep); scan(b.daily);
  if (!max) return null;
  const d = new Date(max);
  if (isNaN(d.getTime())) return null;
  return `Last refreshed ${d.toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  })}`;
}

export function rolling(vals: (number | null)[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < vals.length; i++) {
    const slice = vals.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v != null);
    out.push(slice.length ? +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2) : null);
  }
  return out;
}

export function fmtDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function recent<T extends { [k: string]: any }>(rows: T[], key: string, days: number): T[] {
  if (!rows.length) return rows;
  const cutoff = new Date(rows[rows.length - 1][key]);
  cutoff.setDate(cutoff.getDate() - days);
  return rows.filter((r) => new Date(r[key]) >= cutoff);
}
