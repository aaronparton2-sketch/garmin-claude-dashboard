// Shared by /api/data and /api/chat.
//
// Two modes, picked by env:
//   LIVE   - GARMIN_SUPABASE_URL + GARMIN_SUPABASE_SERVICE_ROLE_KEY are set.
//            Reads your tables server-side with the service_role key, so the
//            key never reaches the browser.
//   SAMPLE - neither is set. Serves the generated dataset in data/sample/
//            (a fictional athlete; see scripts/generate_sample_data.py).
//            This is what the public demo runs on.
//
// Optional password gate: set GH_PASSWORD (and GH_SESSION_TOKEN) and every
// data route requires the session cookie that /api/login sets. Leave them
// unset and the dashboard is open, which is right for the sample data and
// wrong for your own.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const isLive = () =>
  !!(process.env.GARMIN_SUPABASE_URL && process.env.GARMIN_SUPABASE_SERVICE_ROLE_KEY);

export const isGated = () => !!process.env.GH_PASSWORD;

/** true when the request may read data (no gate, or a valid session cookie). */
export function authorised(req) {
  if (!isGated()) return true;
  const token = process.env.GH_SESSION_TOKEN || "ok";
  const cookies = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .reduce((acc, s) => {
      const i = s.indexOf("=");
      if (i > 0) acc[s.slice(0, i)] = s.slice(i + 1);
      return acc;
    }, {});
  return cookies.gh_auth === token;
}

export function sampleBundle() {
  // Literal require paths so Vercel's file tracer bundles the JSON with the function.
  return {
    weighIns: require("../data/sample/weigh_ins.json"),
    activities: require("../data/sample/activities.json"),
    sleep: require("../data/sample/sleep.json"),
    daily: require("../data/sample/daily_summary.json"),
    dexa: require("../data/sample/dexa_scans.json"),
    bloods: require("../data/sample/blood_panels.json"),
    source: "sample",
  };
}

// Supabase/PostgREST caps a single response at 1000 rows (the `limit` param
// can't raise it). daily_summary passes 1000 rows within three years, and an
// unpaginated read silently drops the newest rows, so page with Range headers.
const PAGE = 1000;
export async function sbGet(table, order) {
  const url = process.env.GARMIN_SUPABASE_URL;
  const key = process.env.GARMIN_SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(`${url}/rest/v1/${table}?select=*&order=${order}`, {
      headers: { ...headers, "Range-Unit": "items", Range: `${from}-${from + PAGE - 1}` },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status}`);
    const batch = await r.json();
    all.push(...batch);
    if (batch.length < PAGE) return all;
  }
}

export async function liveBundle() {
  const [weighIns, activities, sleep, daily, dexa, bloods] = await Promise.all([
    sbGet("garmin_weigh_ins", "measured_date.asc"),
    sbGet("garmin_activities", "activity_date.asc"),
    sbGet("garmin_sleep", "sleep_date.asc"),
    sbGet("garmin_daily_summary", "summary_date.asc"),
    // Optional side-tables: absent until you run their migrations, and that
    // must not take the whole dashboard down.
    sbGet("dexa_scans", "scan_date.asc").catch(() => []),
    sbGet("blood_panels", "panel_date.asc").catch(() => []),
  ]);
  return { weighIns, activities, sleep, daily, dexa, bloods, source: "supabase" };
}

export const loadBundle = () => (isLive() ? liveBundle() : Promise.resolve(sampleBundle()));
