// AI coach chat. Same auth rules as /api/data, reads a small window of recent
// data (Supabase when configured, otherwise the sample set) and asks Claude to
// answer as a training coach. Read-only: no write path exists here, and the
// Anthropic key stays server-side.
//
// Without ANTHROPIC_API_KEY the route answers { setup: true } and the widget
// shows how to add one. It never errors in the demo.
import { authorised, loadBundle } from "./_bundle.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  if (!authorised(req)) {
    res.status(401).json({ error: "auth" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ setup: true });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { message, history } = body || {};
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message required" });
    return;
  }

  // ---- recent data, compacted to what a coach actually needs ----
  let summary;
  try {
    const b = await loadBundle();
    const tail = (rows, key, n) => [...rows].sort((x, y) => String(y[key]).localeCompare(String(x[key]))).slice(0, n);
    summary = JSON.stringify({
      daily_last30: tail(b.daily, "summary_date", 30).map((d) => ({
        date: d.summary_date, steps: d.total_steps, resting_hr: d.resting_hr,
        min_hr: d.min_hr, max_hr: d.max_hr, moderate_min: d.moderate_min,
        vigorous_min: d.vigorous_min, total_calories: d.total_calories, active_calories: d.active_calories,
      })),
      sleep_last30: tail(b.sleep, "sleep_date", 30).map((s) => ({
        date: s.sleep_date, total_h: s.total_sleep_s ? +(s.total_sleep_s / 3600).toFixed(1) : null,
        deep_h: s.deep_s ? +(s.deep_s / 3600).toFixed(1) : null,
        rem_h: s.rem_s ? +(s.rem_s / 3600).toFixed(1) : null,
        score: s.sleep_score, avg_stress: s.avg_stress, avg_respiration: s.avg_respiration,
      })),
      activities_last20: tail(b.activities, "activity_date", 20).map((a) => ({
        date: a.activity_date, type: a.activity_type, duration_min: a.duration_s ? Math.round(a.duration_s / 60) : null,
        distance_km: a.distance_m ? +(a.distance_m / 1000).toFixed(1) : null, avg_hr: a.avg_hr,
        training_load: a.training_load, aerobic_te: a.aerobic_te, anaerobic_te: a.anaerobic_te, calories: a.calories,
      })),
      weigh_ins_last10: tail(b.weighIns, "measured_date", 10).map((w) => ({
        date: w.measured_date, weight_kg: w.weight_kg, body_fat_pct: w.body_fat_pct, muscle_mass_kg: w.muscle_mass_kg,
      })),
    });
  } catch (e) {
    res.status(502).json({ error: "upstream", detail: String(e) });
    return;
  }

  // ---- sanitise history to plain {role, content} turns ----
  const hist = Array.isArray(history)
    ? history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))
    : [];

  const system =
    "You are a concise, decisive endurance and strength coach embedded in the user's personal Garmin dashboard. " +
    "Ground every answer in the user's real numbers from the provided recent data (resting HR, sleep, stress, training load, activities, weight, body composition) and quote specific figures. " +
    "Give clear, actionable training guidance and recovery calls; make a recommendation rather than hedging. " +
    "Keep answers short (a few sentences to a short list). " +
    "You give training advice, not medical advice. If something looks like a health concern, say to see a doctor.";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system,
        messages: [
          ...hist,
          { role: "user", content: `${message}\n\nMy recent Garmin data: ${summary}` },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      res.status(502).json({ error: "anthropic", detail: j?.error?.message || r.status });
      return;
    }
    const reply = (j.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ reply: reply || "I couldn't come up with an answer. Try rephrasing." });
  } catch (e) {
    res.status(502).json({ error: "anthropic", detail: String(e) });
  }
}
