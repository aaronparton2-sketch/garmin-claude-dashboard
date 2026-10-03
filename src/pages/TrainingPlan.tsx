import { useMemo, useState } from "react";
import type { Bundle } from "../lib/data";
import { ACTIVITY_BUCKETS, BUCKET_META, fmtKm, type Bucket } from "../lib/metrics";
import {
  adherence, blankPlan, clearPlan, currentPlanWeek, daysUntil, default70Plan, loadPlan,
  PLAN_70_3, savePlan, weekProgress, weekStart, type TrainingPlan as Plan,
} from "../lib/plan";
import { Card, EmptyHint, PageHeader, Pill } from "../ui";

export default function TrainingPlan({ data, now, refreshed }: { data: Bundle; now: Date; refreshed?: string }) {
  // Seed a basic half-distance triathlon plan so the page is populated out of the
  // box; a user-saved plan in localStorage takes precedence.
  const [plan, setPlan] = useState<Plan>(() => loadPlan() ?? default70Plan());
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<Plan>(plan);

  const hasPlan = !!plan.updatedAt;
  const rows = useMemo(() => adherence(plan, data.activities, data.daily, now), [plan, data, now]);
  const dleft = daysUntil(plan.goalDate, now);
  const pace = Math.round(weekProgress(now) * 100);
  const wkStart = weekStart(now);

  const save = () => { savePlan(draft); setPlan({ ...draft }); setEditing(false); };
  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(plan))); setEditing(true); };
  const reset = () => { clearPlan(); const b = blankPlan(); setPlan(b); setDraft(b); setEditing(true); };

  return (
    <div>
      <PageHeader
        title="Training Plan"
        icon="🎯"
        accent="#34d399"
        refreshed={refreshed}
        subtitle={hasPlan ? `Week of ${wkStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} · ${pace}% through the week` : "Set your weekly targets to track adherence"}
        right={
          !editing && hasPlan ? (
            <div className="flex gap-2">
              <button onClick={startEdit} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800">Edit plan</button>
              <button onClick={reset} className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-400">Reset</button>
            </div>
          ) : null
        }
      />

      {hasPlan && (plan.goalName || dleft != null) && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-400/15 text-2xl">🎯</span>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Training for</div>
              <div className="font-display text-xl font-semibold text-white">{plan.goalName || "—"}</div>
              {plan.focus && <div className="mt-1 text-sm text-slate-400">{plan.focus}</div>}
            </div>
          </div>
          {dleft != null && (
            <div className="text-right">
              <div className="font-display text-3xl font-semibold text-emerald-400">{dleft >= 0 ? dleft : 0}</div>
              <div className="text-xs text-slate-500">days to {new Date(plan.goalDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
            </div>
          )}
        </Card>
      )}

      {editing ? (
        <PlanEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={() => hasPlan && setEditing(false)} canCancel={hasPlan} />
      ) : !hasPlan ? (
        <EmptyHint>No plan yet — <button onClick={() => setEditing(true)} className="text-emerald-400 underline">create one</button>.</EmptyHint>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.filter((r) => r.target.enabled).map((r) => (
            <AdherenceCard key={r.bucket} row={r} pace={pace} />
          ))}
          {rows.every((r) => !r.target.enabled) && <EmptyHint>No activities enabled in your plan. <button onClick={startEdit} className="text-emerald-400 underline">Edit it</button>.</EmptyHint>}
        </div>
      )}

      {hasPlan && !editing && <ScheduleCard now={now} goalDate={plan.goalDate} />}
    </div>
  );
}

const PHASE_COLOR: Record<string, string> = {
  Base: "#38bdf8", Build: "#a78bfa", Peak: "#fb923c", Taper: "#34d399", Recovery: "#64748b", Race: "#f43f5e",
};

function ScheduleCard({ now, goalDate }: { now: Date; goalDate: string }) {
  const cur = currentPlanWeek(goalDate, now);
  const live = typeof cur === "number" && cur >= 1 && cur <= PLAN_70_3.length;
  return (
    <Card className="mt-4 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-white">16-week schedule</h2>
          <p className="text-xs text-slate-500">Base → Build → Peak → Taper · weekly volume + key session</p>
        </div>
        {live && <Pill color="#34d399">This week · W{cur}</Pill>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-medium">Wk</th>
              <th className="py-2 pr-3 font-medium">Phase</th>
              <th className="py-2 pr-3 font-medium">🏊 Swim</th>
              <th className="py-2 pr-3 font-medium">🚴 Bike</th>
              <th className="py-2 pr-3 font-medium">🏃 Run</th>
              <th className="py-2 font-medium">Key session</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_70_3.map((w) => {
              const isNow = cur === w.week;
              const isRace = w.phase === "Race";
              return (
                <tr key={w.week} className={`border-t border-slate-800/60 ${isNow ? "bg-emerald-500/10" : ""}`}>
                  <td className={`py-2.5 pr-3 font-semibold ${isNow ? "text-emerald-400" : "text-slate-400"}`}>{w.week}</td>
                  <td className="py-2.5 pr-3"><Pill color={PHASE_COLOR[w.phase] ?? "#64748b"}>{w.phase}</Pill></td>
                  <td className="py-2.5 pr-3 text-slate-300">{w.swim}</td>
                  <td className="py-2.5 pr-3 text-slate-300">{w.bike}</td>
                  <td className="py-2.5 pr-3 text-slate-300">{w.run}</td>
                  <td className={`py-2.5 ${isRace ? "font-semibold text-emerald-400" : "text-white"}`}>{w.key}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-600">A generic 70.3 build for illustration — adjust volumes to your level. The highlighted row is the current week (counted back from race day).</p>
    </Card>
  );
}

function AdherenceCard({ row, pace }: { row: ReturnType<typeof adherence>[number]; pace: number }) {
  const m = BUCKET_META[row.bucket];
  const icon = row.bucket === "walking" ? "👟" : m.icon;
  const label = row.bucket === "walking" ? "Steps" : m.label;
  const statusMeta = {
    ahead: { label: "Target hit", color: "#34d399" },
    ontrack: { label: "On track", color: "#38bdf8" },
    behind: { label: "Behind", color: "#fb923c" },
    none: { label: "—", color: "#64748b" },
  }[row.status];
  const bars: { label: string; actual: string; target: string; ratio: number }[] = [];
  if (row.bucket === "walking") {
    if (row.target.stepsPerDay > 0)
      bars.push({ label: "Steps / day", actual: row.actualStepsPerDay.toLocaleString("en-AU"), target: `${row.target.stepsPerDay.toLocaleString("en-AU")}`, ratio: row.actualStepsPerDay / row.target.stepsPerDay });
  } else {
    if (row.target.sessionsPerWeek > 0)
      bars.push({ label: "Sessions", actual: `${row.actualSessions}`, target: `${row.target.sessionsPerWeek}`, ratio: row.actualSessions / row.target.sessionsPerWeek });
    if (m.distance && row.target.distancePerWeekKm > 0)
      bars.push({ label: "Distance", actual: `${fmtKm(row.actualKm)}`, target: `${row.target.distancePerWeekKm} km`, ratio: row.actualKm / row.target.distancePerWeekKm });
    if (row.target.durationPerWeekMin > 0)
      bars.push({ label: "Time", actual: `${row.actualMin}`, target: `${row.target.durationPerWeekMin} min`, ratio: row.actualMin / row.target.durationPerWeekMin });
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg text-xl" style={{ background: `${m.color}1a` }}>{icon}</span>
          <span className="font-display text-base font-semibold text-white">{label}</span>
        </div>
        <Pill color={statusMeta.color}>{statusMeta.label}</Pill>
      </div>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-slate-400">{b.label}</span>
              <span className="text-slate-300"><span className="font-semibold text-white">{b.actual}</span> / {b.target}</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-slate-800">
              {/* pace marker = how far through the week we are */}
              <div className="absolute top-0 z-10 h-2 w-px bg-slate-400/70" style={{ left: `${Math.min(100, pace)}%` }} />
              <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, Math.round(b.ratio * 100))}%`, background: m.color }} />
            </div>
          </div>
        ))}
        {!bars.length && <div className="text-xs text-slate-600">No targets set.</div>}
      </div>
    </Card>
  );
}

function PlanEditor({ draft, setDraft, onSave, onCancel, canCancel }: {
  draft: Plan; setDraft: (p: Plan) => void; onSave: () => void; onCancel: () => void; canCancel: boolean;
}) {
  const setTarget = (b: Bucket, patch: Partial<Plan["targets"][Bucket]>) =>
    setDraft({ ...draft, targets: { ...draft.targets, [b]: { ...draft.targets[b], ...patch } } });

  return (
    <Card className="p-5">
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Field label="What are you training for?">
          <input value={draft.goalName} onChange={(e) => setDraft({ ...draft, goalName: e.target.value })}
            placeholder="e.g. Half-distance triathlon" className={inputCls} />
        </Field>
        <Field label="Goal date">
          <input type="date" value={draft.goalDate} onChange={(e) => setDraft({ ...draft, goalDate: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Focus / phase">
          <input value={draft.focus} onChange={(e) => setDraft({ ...draft, focus: e.target.value })}
            placeholder="e.g. Base building" className={inputCls} />
        </Field>
      </div>

      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Weekly targets per activity</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-medium">Activity</th>
              <th className="py-2 pr-3 text-center font-medium">Track</th>
              <th className="py-2 pr-3 text-right font-medium">Sessions / wk</th>
              <th className="py-2 pr-3 text-right font-medium">Distance / wk (km)</th>
              <th className="py-2 text-right font-medium">Minutes / wk</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVITY_BUCKETS.map((b) => {
              const m = BUCKET_META[b];
              const t = draft.targets[b];
              return (
                <tr key={b} className={`border-t border-slate-800/60 ${t.enabled ? "" : "opacity-50"}`}>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span>{b === "walking" ? "👟" : m.icon}</span>
                      <span className="text-white">{b === "walking" ? "Steps" : m.label}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-center">
                    <input type="checkbox" checked={t.enabled} onChange={(e) => setTarget(b, { enabled: e.target.checked })}
                      className="h-4 w-4 accent-emerald-500" />
                  </td>
                  {b === "walking" ? (
                    <td colSpan={3} className="py-2.5 text-right">
                      <span className="mr-2 text-xs text-slate-500">Steps / day target</span>
                      <input type="number" min={0} step={500} value={t.stepsPerDay || ""} disabled={!t.enabled}
                        onChange={(e) => setTarget(b, { stepsPerDay: +e.target.value })} placeholder="10000" className={numCls} />
                    </td>
                  ) : (
                    <>
                      <td className="py-2.5 pr-3 text-right">
                        <input type="number" min={0} value={t.sessionsPerWeek || ""} disabled={!t.enabled}
                          onChange={(e) => setTarget(b, { sessionsPerWeek: +e.target.value })} className={numCls} />
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <input type="number" min={0} value={m.distance ? t.distancePerWeekKm || "" : ""} disabled={!t.enabled || !m.distance}
                          onChange={(e) => setTarget(b, { distancePerWeekKm: +e.target.value })}
                          placeholder={m.distance ? "" : "n/a"} className={numCls} />
                      </td>
                      <td className="py-2.5 text-right">
                        <input type="number" min={0} value={t.durationPerWeekMin || ""} disabled={!t.enabled}
                          onChange={(e) => setTarget(b, { durationPerWeekMin: +e.target.value })} className={numCls} />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        {canCancel && <button onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">Cancel</button>}
        <button onClick={onSave} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">Save plan</button>
      </div>
      <p className="mt-3 text-xs text-slate-600">Saved on this device. Targets compare against the current week (Mon→now). The thin marker on each bar shows how far through the week you are.</p>
    </Card>
  );
}

const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500";
const numCls = "w-20 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-right text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
