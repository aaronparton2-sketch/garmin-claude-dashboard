import { useMemo, useState } from "react";
import {
  DAY_NAMES, KIND_META, RACE_DATE, RACE_NAME, RACE_PLACE, RACE_PLAN, TARGET_SPLITS, TOTAL_WEEKS,
  currentRaceWeek, daysToRace, todayIndex,
  type RaceWeek, type Slot,
} from "../lib/racePlan";
import { Card, PageHeader, Pill } from "../ui";

const TAG_STYLE: Record<RaceWeek["tag"], string> = {
  base: "bg-emerald-500/15 text-emerald-300",
  build: "bg-orange-500/15 text-orange-300",
  down: "bg-slate-700/50 text-slate-400",
  peak: "bg-rose-500/15 text-rose-300",
  race: "bg-amber-400/20 text-amber-300",
};

function SlotCell({ slot, isToday }: { slot: Slot; isToday: boolean }) {
  if (!slot) {
    return <td className="border border-slate-800/70 p-2 align-top text-slate-700">—</td>;
  }
  const meta = KIND_META[slot.kind];
  return (
    <td
      className={`border p-2 align-top ${isToday ? "border-emerald-500/50 bg-emerald-500/[0.06]" : "border-slate-800/70"}`}
      style={{ background: isToday ? undefined : `${meta.color}0d` }}
    >
      <span
        className="mb-1 block text-[9px] font-bold uppercase tracking-wider"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
      <span className={`block text-[11.5px] leading-snug ${slot.key ? "font-semibold text-slate-100" : "text-slate-400"}`}>
        {slot.text}
      </span>
    </td>
  );
}

function WeekCard({ wk, isCurrent, now, open, onToggle }: {
  wk: RaceWeek; isCurrent: boolean; now: Date; open: boolean; onToggle: () => void;
}) {
  const tIdx = isCurrent ? todayIndex(wk, now) : -1;

  return (
    <Card className={`mb-3 overflow-hidden ${isCurrent ? "border-emerald-500/40" : ""}`}>
      <button
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/30 px-5 py-3 text-left transition hover:bg-slate-900/50"
      >
        <span className="font-display text-base font-semibold text-white">Week {wk.n}</span>
        <span className="text-xs tabular-nums text-slate-500">{wk.label}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TAG_STYLE[wk.tag]}`}>
          {wk.phase}
        </span>
        {isCurrent && (
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            This week
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-[11px] font-medium text-slate-500">{wk.hours}</span>
          <span className={`text-slate-600 transition ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>

      {open && (
        <div className="px-5 py-4">
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[940px] table-fixed border-collapse">
              <thead>
                <tr>
                  <th className="w-11 p-1.5" />
                  {DAY_NAMES.map((d, i) => (
                    <th
                      key={d}
                      className={`p-1.5 text-center text-[10px] font-bold uppercase tracking-wider ${
                        i === tIdx ? "text-emerald-300" : "text-slate-500"
                      }`}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([["AM", 0], ["PM", 1]] as const).map(([label, si]) => (
                  <tr key={label}>
                    <th className="p-1.5 text-left align-middle text-[11px] font-bold text-slate-300">{label}</th>
                    {wk.days.map((d, i) => (
                      <SlotCell key={i} slot={d[si]} isToday={i === tIdx} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {wk.swimNote && (
            <div className="mt-3 rounded-lg border-l-2 border-sky-400 bg-sky-400/[0.07] px-3.5 py-2.5 text-[13px] text-slate-300">
              <span className="font-semibold text-sky-300">Swim this week — </span>
              {wk.swimNote}
            </div>
          )}

          <div className="mt-3 rounded-lg border-l-2 border-violet-400 bg-violet-400/[0.07] px-3.5 py-2.5">
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">Goal this week</div>
            <p className="text-[13px] leading-snug text-slate-300">{wk.goal}</p>
          </div>

          <div className="mt-2.5 rounded-lg border-l-2 border-slate-600 bg-slate-500/[0.07] px-3.5 py-2.5">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Reminders</div>
            <ul className="list-disc space-y-0.5 pl-4 text-[13px] leading-snug text-slate-400">
              {wk.reminders.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function RacePlan({ now, refreshed }: { now: Date; refreshed?: string }) {
  // The dashboard's `now` is dataset-relative; the plan is a calendar, so use
  // the real clock here and fall back to the dataset date if it's ahead.
  const today = useMemo(() => {
    const real = new Date();
    return real.getTime() > now.getTime() ? real : now;
  }, [now]);

  const current = useMemo(() => currentRaceWeek(today), [today]);
  const dLeft = daysToRace(today);
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(
    () => new Set(current ? [current.n] : [1])
  );

  const toggle = (n: number) =>
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  const allOpen = openWeeks.size === RACE_PLAN.length;
  const toggleAll = () =>
    setOpenWeeks(allOpen ? new Set() : new Set(RACE_PLAN.map((w) => w.n)));

  const raceDay = new Date(RACE_DATE + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div>
      <PageHeader
        title="Race Plan"
        icon="🏁"
        accent="#fbbf24"
        refreshed={refreshed}
        subtitle={`${RACE_NAME} · ${RACE_PLACE} · ${raceDay}`}
        right={
          <button
            onClick={toggleAll}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        }
      />

      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-amber-400/15 text-2xl">🏁</span>
          <div>
            <div className="font-display text-lg font-semibold text-white">
              1.9 km swim · 90 km bike · 21.1 km run
            </div>
            <div className="text-xs text-slate-500">
              {current ? `Week ${current.n} of ${TOTAL_WEEKS} · ${current.phase}` : `${TOTAL_WEEKS}-week build`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill color="#fbbf24">{dLeft > 0 ? `${dLeft} days to go` : dLeft === 0 ? "Race day" : "Done"}</Pill>
          <Pill color="#34d399">Target 6:45–7:20</Pill>
        </div>
      </Card>

      <Card className="mb-5 p-5">
        <h2 className="font-display text-base font-semibold text-white">How this plan works</h2>
        <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-[13.5px] leading-snug text-slate-400">
          <li>
            <span className="text-slate-200">Something every day.</span> Every AM and PM slot is filled —
            easy days are walks, not blanks, so the habit holds without adding load.
          </li>
          <li>
            <span className="text-slate-200">Two hard sessions a week.</span> Tuesday PM is the quality run,
            Wednesday AM the quality bike. Everything else is conversational.
          </li>
          <li>
            <span className="text-slate-200">Frequency beats duration on the run.</span> Volume climbs by
            adding days, not by lengthening the long run. Peak long run is 16 km — you never run 21.1 km in training.
          </li>
          <li>
            <span className="text-slate-200">Indoors or outdoors is your call.</span> Ride the trainer when the
            weather's rubbish; get the 2h+ rides outside when it's good, for position, handling and wind.
          </li>
          <li>
            <span className="text-slate-200">Every fourth week is a down week</span> (4, 8, 12) at ~60% volume.
            That's when adaptation actually happens.
          </li>
          <li>
            <span className="text-slate-200">A flat course means you never stop pedalling.</span>{" "}
            Wind and heat replace hills as the things to train for.
          </li>
          <li>
            <span className="text-slate-200">This is a sample plan.</span> Edit <code className="text-slate-300">src/lib/racePlan.ts</code>,
            or paste your own Garmin baselines into Claude and have it rewrite the 16 weeks for you.
          </li>
        </ul>
      </Card>

      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(KIND_META).map(([k, m]) => (
          <span
            key={k}
            className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${m.color}1a`, color: m.color }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {RACE_PLAN.map((wk) => (
        <WeekCard
          key={wk.n}
          wk={wk}
          now={today}
          isCurrent={current?.n === wk.n}
          open={openWeeks.has(wk.n)}
          onToggle={() => toggle(wk.n)}
        />
      ))}

      <Card className="mt-5 p-5">
        <h2 className="font-display text-base font-semibold text-white">Target splits</h2>
        <p className="mb-3 text-xs text-slate-500">For a 6:45–7:20 finish. Typical cutoff is 8:30.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                <th className="border-b border-slate-800 py-2 text-left font-semibold">Leg</th>
                <th className="border-b border-slate-800 py-2 text-left font-semibold">Target</th>
                <th className="border-b border-slate-800 py-2 text-left font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {TARGET_SPLITS.map((s) => (
                <tr key={s.leg} className={s.leg === "Total" ? "font-semibold text-white" : "text-slate-400"}>
                  <td className="border-b border-slate-800/60 py-2">{s.leg}</td>
                  <td className="border-b border-slate-800/60 py-2 tabular-nums">{s.target}</td>
                  <td className="border-b border-slate-800/60 py-2 text-[13px] text-slate-500">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
