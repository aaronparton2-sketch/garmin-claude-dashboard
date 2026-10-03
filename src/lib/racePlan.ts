// A SAMPLE 16-week build for a half-distance triathlon (1.9 km swim, 90 km
// bike, 21.1 km run), day by day (Mon to Sun, AM/PM). Distinct from PLAN_70_3
// in ./plan, which is the stock weekly volume table the adherence tracker seeds.
//
// It is written for a fictional athlete coming back from a few months off, so
// the early weeks are deliberately gentle. Treat it as a template: edit the
// weeks below or, better, have Claude rewrite it off your own Garmin baselines.
//
// Every slot is filled on purpose. Easy days are walks, not blanks, so the
// habit holds daily without adding load.

export type SessionKind =
  | "swim" | "bike" | "run" | "brick" | "strength" | "walk" | "rest" | "race";

export type Slot = { kind: SessionKind; text: string; key?: boolean } | null;

export type PhaseTag = "base" | "build" | "down" | "peak" | "race";

export type RaceWeek = {
  n: number;
  label: string;      // "24–30 Aug", derived from start/end
  start: string;      // ISO, Monday
  end: string;        // ISO, Sunday
  phase: string;
  tag: PhaseTag;
  hours: string;
  goal: string;
  reminders: string[];
  swimNote?: string;
  /** Mon…Sun, each [AM, PM]. */
  days: [Slot, Slot][];
};

export const RACE_NAME = "Half-distance triathlon (sample build)";
export const RACE_PLACE = "Flat coastal course";
/** Race day. Change this and every week below re-dates itself. */
export const RACE_DATE = "2026-12-13";
export const TOTAL_WEEKS = 16;

export const KIND_META: Record<SessionKind, { label: string; color: string }> = {
  swim: { label: "Swim", color: "#38bdf8" },
  bike: { label: "Bike", color: "#fb923c" },
  run: { label: "Run", color: "#f87171" },
  brick: { label: "Brick", color: "#a78bfa" },
  strength: { label: "Strength", color: "#94a3b8" },
  walk: { label: "Walk", color: "#a3e635" },
  rest: { label: "Rest", color: "#64748b" },
  race: { label: "Race", color: "#fbbf24" },
};

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// shorthand builders keep the table below readable
const s = (text: string, key = false): Slot => ({ kind: "swim", text, key });
const b = (text: string, key = false): Slot => ({ kind: "bike", text, key });
const r = (text: string, key = false): Slot => ({ kind: "run", text, key });
const br = (text: string, key = true): Slot => ({ kind: "brick", text, key });
const st = (text: string): Slot => ({ kind: "strength", text });
const w = (text: string): Slot => ({ kind: "walk", text });
const z = (text: string): Slot => ({ kind: "rest", text });
const rc = (text: string): Slot => ({ kind: "race", text, key: true });

type WeekSpec = Omit<RaceWeek, "n" | "label" | "start" | "end">;

const WEEKS: WeekSpec[] = [
  {
    phase: "Baseline & re-entry", tag: "base", hours: "~4 hrs",
    goal: "Establish real baselines. Do not chase fitness this week; it is measurement, not training.",
    reminders: [
      "Check the watch's pool-length setting against the actual pool",
      "Book a swim lesson or a video stroke analysis",
      "Make sure the watch syncs to the Connect app every day so the dashboard fills in",
    ],
    swimNote: "Benchmark 400 m in week one. Count the lengths yourself, compare to the watch, note the time. Slot into Mon or Thu AM.",
    days: [
      [w("30 min brisk walk"), z("Mobility 15 min")],
      [b("40 min easy, trainer"), w("20 min walk")],
      [w("25 min walk"), r("20 min easy, note how the legs feel after")],
      [b("45 min easy"), st("Strength 20 min")],
      [w("30 min walk"), z("Rest")],
      [b("Long ride 45 min", true), w("20 min walk")],
      [r("Long run 25 min, with a mate", true), w("20 min walk + stretch")],
    ],
  },
  {
    phase: "Re-entry", tag: "base", hours: "~4.5 hrs",
    goal: "Lock in a repeatable weekly rhythm: same sessions, same days. Consistency now beats intensity.",
    reminders: [
      "Book race-weekend accommodation; host towns sell out",
      "Book a bike service",
    ],
    days: [
      [s("800 m technique, drills not laps"), w("30 min walk")],
      [w("25 min walk"), r("30 min easy + Strength 20 min")],
      [b("45 min easy, trainer"), w("25 min walk")],
      [s("800 m technique"), r("25 min easy")],
      [w("30 min walk"), st("Strength 25 min")],
      [b("Long ride 60 min", true), w("25 min walk")],
      [r("Long run 30 min, with a mate", true), w("25 min walk")],
    ],
  },
  {
    phase: "Re-entry", tag: "base", hours: "~5.5 hrs",
    goal: "First mid-ride fuel test: one gel at the 45-minute mark on Saturday. Note how it sits, nothing more.",
    reminders: ["Confirm race entry details and check when the athlete guide is released"],
    days: [
      [s("1,000 m as 10 x 100 m, short rest"), w("30 min walk")],
      [w("25 min walk"), r("30 min easy + 4 strides · Strength 20 min")],
      [b("50 min easy"), w("25 min walk")],
      [s("1,000 m"), r("25 min easy")],
      [w("30 min walk"), st("Strength 25 min")],
      [b("Long ride 75 min, gel at 45 min", true), w("25 min walk")],
      [r("Long run 35 min", true), w("25 min walk")],
    ],
  },
  {
    phase: "Down week", tag: "down", hours: "~4 hrs",
    goal: "Sleep. Hit a 7.5 h+ average and notice how much better the sessions feel.",
    reminders: ["Sort the wetsuit: own, hire or buy? If the swim is wetsuit-legal it is free speed"],
    days: [
      [s("800 m easy"), w("30 min walk")],
      [w("25 min walk"), r("25 min easy")],
      [b("40 min easy"), w("25 min walk")],
      [s("800 m easy"), z("Rest, full day off")],
      [w("30 min walk"), st("Strength 20 min")],
      [b("Long ride 60 min", true), w("20 min walk")],
      [r("Long run 30 min", true), w("25 min walk")],
    ],
  },
  {
    phase: "Base", tag: "base", hours: "~6.5 hrs",
    goal: "Test a second fuel type. You are hunting for the one your gut likes; it must be settled by week 12.",
    reminders: ["Check tyres and tubes, buy spares", "Have you actually booked that swim lesson yet?"],
    days: [
      [s("1,200 m, drill ladder"), b("30 min easy spin")],
      [w("25 min walk"), r("Quality: 4 x 3 min hard, 2 min jog · 40 min · Strength", true)],
      [b("Quality: 4 x 8 min moderately hard · 55 min", true), w("25 min walk")],
      [s("1,000 m"), r("30 min easy")],
      [w("30 min walk"), st("Strength 25 min")],
      [b("Long ride 1h30", true), w("25 min walk")],
      [r("Long run 40 min, with a mate", true), w("25 min walk")],
    ],
  },
  {
    phase: "Base", tag: "base", hours: "~7.5 hrs",
    goal: "Practise drinking from the bottle without slowing down. Sounds trivial, and it is 90 km of doing it.",
    reminders: ["Scout open-water swim locations for next month"],
    days: [
      [s("1,200 m"), b("35 min easy spin")],
      [w("25 min walk"), r("Quality: 5 x 3 min · 45 min · Strength", true)],
      [b("Quality: 3 x 10 min · 60 min", true), w("25 min walk")],
      [s("1,200 m"), r("30 min easy")],
      [b("30 min easy spin"), st("Strength 25 min")],
      [b("Long ride 1h45, bottle practice", true), w("25 min walk")],
      [r("Long run 45 min", true), w("25 min walk")],
    ],
  },
  {
    phase: "Base", tag: "base", hours: "~8 hrs",
    goal: "Your first brick. Note how many minutes the jelly legs last. That number shrinks every time, and knowing it kills the race-day panic.",
    reminders: ["Start pricing race nutrition in bulk"],
    days: [
      [s("1,400 m"), b("35 min easy spin")],
      [w("25 min walk"), r("Quality: 3 x 8 min · 45 min · Strength", true)],
      [b("Quality: 4 x 10 min · 65 min", true), w("25 min walk")],
      [s("1,400 m"), r("30 min easy")],
      [b("30 min easy spin"), st("Strength 25 min")],
      [b("Long ride 2h", true), br("Brick run 15 min straight off the bike")],
      [r("Long run 50 min", true), w("25 min walk")],
    ],
  },
  {
    phase: "Down week", tag: "down", hours: "~5.5 hrs",
    goal: "Test a caffeine gel mid-ride. Some people fly, some get jittery and gutted. Better to find out now than at 60 km on race day.",
    reminders: ["Book the final bike service for the week before race week; workshops fill early"],
    days: [
      [s("1,000 m easy"), w("30 min walk")],
      [w("25 min walk"), r("30 min easy")],
      [b("45 min easy"), w("25 min walk")],
      [s("1,000 m"), z("Rest, full day off")],
      [w("30 min walk"), st("Strength 25 min")],
      [b("Long ride 1h30, caffeine gel test", true), w("25 min walk")],
      [r("Long run 40 min", true), w("25 min walk")],
    ],
  },
  {
    phase: "Build", tag: "build", hours: "~8.5 hrs",
    goal: "Rehearse your full race-morning breakfast before Saturday's ride. Same food, same timing, then repeat it every long ride from here.",
    reminders: ["Sort bike transport to the race: car rack, or a shop transport service"],
    days: [
      [s("1,500 m"), b("35 min easy spin")],
      [w("25 min walk"), r("Quality: 4 x 8 min · 50 min · Strength", true)],
      [b("Quality: 3 x 12 min · 70 min", true), w("25 min walk")],
      [s("1,500 m"), r("30 min easy")],
      [b("35 min easy spin"), st("Strength 25 min")],
      [b("Long ride 2h30, 60 to 90 g carbs/hr", true), br("Brick run 20 min")],
      [r("Long run 60 min, with a mate", true), w("25 min walk")],
    ],
  },
  {
    phase: "Build", tag: "build", hours: "~9.5 hrs",
    goal: "Ride into the wind on purpose: head out into the breeze so you come home with it. Learn what sustainable effort feels like when you are going slow.",
    reminders: ["Confirm the accommodation booking is locked in"],
    days: [
      [s("1,600 m"), b("40 min easy spin")],
      [w("25 min walk"), r("Quality: 5 x 6 min · 50 min · Strength", true)],
      [b("Quality: 2 x 20 min · 75 min", true), w("25 min walk")],
      [s("1,600 m"), r("35 min easy")],
      [b("35 min easy spin"), st("Strength 25 min")],
      [b("Long ride 2h45, out into the wind", true), br("Brick run 25 min")],
      [r("Long run 70 min", true), w("25 min walk")],
    ],
  },
  {
    phase: "Build", tag: "build", hours: "~10 hrs",
    goal: "First open-water swim in the wetsuit. Sighting, and getting comfortable in dark water. Finding this out on race morning is how a good day goes wrong in the first 400 m.",
    reminders: ["Check race kit for chafe on a long session; better now than at 80 km"],
    days: [
      [s("1,900 m continuous, full race distance", true), b("40 min easy spin")],
      [w("25 min walk"), r("Quality: 4 x 8 min · 50 min · Strength", true)],
      [b("Quality: 3 x 15 min · 75 min", true), w("25 min walk")],
      [s("Open water #1, wetsuit + sighting", true), r("35 min easy")],
      [b("35 min easy spin"), st("Strength 25 min")],
      [b("Long ride 3h", true), br("Brick run 30 min")],
      [r("Long run 80 min, with a mate", true), w("25 min walk")],
    ],
  },
  {
    phase: "Down week", tag: "down", hours: "~6.5 hrs",
    goal: "Full race kit on Saturday's brick: exact shoes, socks, shorts, top, sunnies. Nothing new after this week.",
    reminders: ["Final bike service: book it now if you somehow haven't"],
    days: [
      [s("1,200 m easy"), w("30 min walk")],
      [w("25 min walk"), r("35 min easy")],
      [b("50 min easy"), w("25 min walk")],
      [s("Open water #2", true), z("Rest, full day off")],
      [w("30 min walk"), st("Strength 25 min")],
      [b("Long ride 2h, full race kit", true), br("Brick run 20 min")],
      [r("Long run 55 min", true), w("25 min walk")],
    ],
  },
  {
    phase: "PEAK, dress rehearsal", tag: "peak", hours: "~11 hrs",
    goal: "The big week. Saturday is a full dress rehearsal: race kit, race nutrition, race-morning breakfast. If something is wrong, this is the last comfortable chance to fix it.",
    reminders: ["Athlete guide: read it properly, check transition and racking rules"],
    days: [
      [s("2,000 m race simulation", true), b("40 min easy spin")],
      [w("25 min walk"), r("Quality: 4 x 8 min · 50 min · Strength", true)],
      [b("Quality: 3 x 15 min · 75 min", true), w("25 min walk")],
      [s("1,500 m easy"), r("35 min easy")],
      [b("30 min easy spin"), z("Rest, pre-load for Saturday")],
      [b("LONG RIDE 3h30 (~90 km), the big one", true), br("Brick run 30 min")],
      [r("Long run 95 to 105 min (~16 km), your peak", true), w("25 min walk + legs up")],
    ],
  },
  {
    phase: "Peak", tag: "peak", hours: "~10 hrs",
    goal: "Heat prep. Two sessions in the hottest part of the day. Adaptation takes about two weeks and is worth real minutes on a warm course.",
    reminders: ["Final bike service happens this week", "Draft the pack list"],
    days: [
      [s("1,500 m"), b("35 min easy spin")],
      [w("25 min walk"), r("Quality: 3 x 8 min · 45 min · Strength", true)],
      [b("Quality 70 min, ride in the heat", true), w("25 min walk")],
      [s("Open water #3", true), r("30 min easy, in the heat")],
      [b("30 min easy spin"), z("Rest")],
      [b("Long ride 3h", true), br("Race-sim brick 40 min at goal pace")],
      [r("Long run 75 min", true), w("25 min walk")],
    ],
  },
  {
    phase: "Taper", tag: "base", hours: "~6.5 hrs",
    goal: "Taper discipline. You will feel sluggish and want to add sessions. Don't. Volume drops, intensity stays light. Write the race-day nutrition plan out on paper.",
    reminders: ["Confirm check-in times and bike racking day", "Charge the Garmin, check the bike computer"],
    days: [
      [s("1,200 m with a few sharp 50s"), w("30 min walk")],
      [w("25 min walk"), r("35 min with 6 x 1 min at race pace · light Strength")],
      [b("50 min with 4 x 2 min efforts"), w("25 min walk")],
      [s("1,000 m easy"), r("25 min easy")],
      [b("30 min easy spin"), w("25 min walk")],
      [b("Long ride 1h45", true), w("25 min walk")],
      [r("Long run 45 min", true), w("25 min walk")],
    ],
  },
  {
    phase: "RACE WEEK", tag: "race", hours: "~3.5 hrs + race",
    goal: "Nothing new. Sleep, hydrate, pack, eat what you know. The fitness is already banked; this week you only protect it.",
    reminders: [
      "Travel on the Friday",
      "Bike racking is usually the day before; confirm the time",
      "Lay everything out Saturday night",
    ],
    days: [
      [s("800 m easy"), w("25 min walk")],
      [b("40 min with 3 x 1 min openers"), w("25 min walk")],
      [r("25 min easy + 4 strides"), w("20 min walk, start packing")],
      [s("600 m easy, just feel the water"), z("Rest, pack the bags")],
      [r("20 min shakeout jog"), z("Travel to the race")],
      [b("20 min spin + 10 min jog · register + rack the bike"), z("Rest, legs up, early night")],
      [rc("🏁 RACE DAY"), z("Celebrate. You've earned it.")],
    ],
  },
];

// ---- date the weeks off RACE_DATE -------------------------------------------
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const short = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });

function dateWeeks(specs: WeekSpec[]): RaceWeek[] {
  const race = new Date(RACE_DATE + "T00:00:00");
  const raceDow = (race.getDay() + 6) % 7;                 // Mon = 0
  const lastMonday = addDays(race, -raceDow);               // Monday of race week
  return specs.map((spec, i) => {
    const start = addDays(lastMonday, -(specs.length - 1 - i) * 7);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const label = sameMonth ? `${start.getDate()}–${short(end)}` : `${short(start)} – ${short(end)}`;
    return { n: i + 1, label, start: isoDate(start), end: isoDate(end), ...spec };
  });
}

export const RACE_PLAN: RaceWeek[] = dateWeeks(WEEKS);

/** Target splits for a first-timer aiming at roughly 6:45 to 7:20. */
export const TARGET_SPLITS: { leg: string; target: string; note: string }[] = [
  { leg: "Swim 1.9 km", target: "52–58 min", note: "~2:50 to 3:00 /100 m, wetsuit-assisted" },
  { leg: "T1", target: "5–8 min", note: "Allow for a long transition" },
  { leg: "Bike 90 km", target: "3:15–3:30", note: "26 to 28 km/h on a flat course" },
  { leg: "T2", target: "4–6 min", note: "" },
  { leg: "Run 21.1 km", target: "2:15–2:30", note: "With planned walk breaks at aid stations" },
  { leg: "Total", target: "6:45–7:20", note: "Typical cutoff 8:30, so over an hour of margin" },
];

/** Which plan week contains `now`; null if the block hasn't started or has finished. */
export function currentRaceWeek(now: Date): RaceWeek | null {
  const t = now.getTime();
  for (const wk of RACE_PLAN) {
    const start = new Date(wk.start + "T00:00:00").getTime();
    const end = new Date(wk.end + "T23:59:59").getTime();
    if (t >= start && t <= end) return wk;
  }
  return null;
}

/** Days until race day (negative once it's past). */
export function daysToRace(now: Date): number {
  const race = new Date(RACE_DATE + "T07:00:00").getTime();
  return Math.ceil((race - now.getTime()) / 86_400_000);
}

/** 0-based index of today within a week's Mon–Sun array, or -1. */
export function todayIndex(wk: RaceWeek, now: Date): number {
  const start = new Date(wk.start + "T00:00:00");
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  const startDow = (start.getDay() + 6) % 7; // Mon=0
  const idx = startDow + diff;
  return idx >= 0 && idx < 7 ? idx : -1;
}
