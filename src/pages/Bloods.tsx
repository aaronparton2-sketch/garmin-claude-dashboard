import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine,
} from "recharts";
import type { Bundle, BloodMarker, BloodPanel, BloodRange } from "../lib/data";
import { MARKER_INFO } from "../lib/marker-info";
import { NEXT_PANEL, TIMING, REBATE } from "../lib/next-panel";
import { AXIS_TICK, TOOLTIP, GRID, Card, PageHeader, Stat, Pill, EmptyHint } from "../ui";

/**
 * Bloods — a dashboard, not a report.
 *
 * The rule that shapes this page: NO PARAGRAPHS OF PROSE. A lab result is data
 * and belongs in a position bar, a deviation figure or a trend line. Anything
 * that needs explaining is explanation ON DEMAND — it lives in the hover card,
 * where you get it for the marker you actually asked about and nowhere else.
 *
 * Three ideas do the work:
 *
 * 1. POSITION BAR. "5.1 (<5.0)" and "344 (<100)" both print as a red H, but one
 *    is a rounding error and the other is 3.4x over. Every marker is drawn where
 *    it actually sits in its interval, and the flag table quantifies the overshoot
 *    as a percentage so the two can never read alike.
 *
 * 2. TAGGED-UNION RANGES. HDL is good-when-high, total cholesterol is
 *    bad-when-high. A single low/high pair would paint excellent HDL as failure,
 *    so the three range shapes are drawn differently on purpose.
 *
 * 3. THE LAB'S FLAG IS NEVER RECOMPUTED. Their H/L governs. Our reading is
 *    confined to the hover card and is visibly ours.
 */

const ACCENT = "#f472b6";

/* ------------------------------------------------------------ range maths */
/**
 * Where does a value sit inside its interval, as 0..100 across a track?
 * Each range shape gets its own scale so the band always reads correctly:
 *   between -> band fills the middle, headroom either side
 *   below   -> band runs from the left edge to the target
 *   above   -> band runs from the target to the right edge
 * Values outside the track are clamped so an extreme result still renders.
 */
function geometry(range: BloodRange, value: number) {
  let min: number, max: number, bandFrom: number, bandTo: number;
  if (range.type === "between") {
    const span = range.high - range.low || 1;
    min = range.low - span * 0.25;
    max = range.high + span * 0.25;
    bandFrom = range.low;
    bandTo = range.high;
  } else if (range.type === "below") {
    min = 0;
    max = Math.max(range.high * 1.6, value * 1.12);
    bandFrom = 0;
    bandTo = range.high;
  } else {
    min = 0;
    max = Math.max(range.low * 2.6, value * 1.12);
    bandFrom = range.low;
    bandTo = max;
  }
  const span = max - min || 1;
  const at = (v: number) => Math.min(100, Math.max(0, ((v - min) / span) * 100));
  return { pct: at(value), bandStart: at(bandFrom), bandEnd: at(bandTo) };
}

/**
 * How far outside the interval, as a percentage of the boundary it crossed.
 * Returns 0 when inside. This is the number that separates "over by a hair"
 * from "over by 3x" without anyone having to write a sentence about it.
 */
function deviation(range: BloodRange, value: number): { pct: number; dir: "over" | "under" | null } {
  const over = (v: number, edge: number) => (edge === 0 ? 0 : ((v - edge) / edge) * 100);
  if (range.type === "between") {
    if (value > range.high) return { pct: over(value, range.high), dir: "over" };
    if (value < range.low) return { pct: over(range.low, value === 0 ? 1 : value), dir: "under" };
  } else if (range.type === "below") {
    if (value > range.high) return { pct: over(value, range.high), dir: "over" };
  } else if (value < range.low) {
    return { pct: ((range.low - value) / range.low) * 100, dir: "under" };
  }
  return { pct: 0, dir: null };
}

/** Position inside the normal band as 0..100, for "sitting at 63% of range". */
function bandPosition(range: BloodRange, value: number): number | null {
  if (range.type !== "between") return null;
  const span = range.high - range.low || 1;
  return Math.round(((value - range.low) / span) * 100);
}

const rangeLabel = (r: BloodRange) =>
  r.type === "between" ? `${r.low} – ${r.high}` : r.type === "below" ? `< ${r.high}` : `> ${r.low}`;

const show = (m: BloodMarker) => `${m.op ?? ""}${m.value}`;

const dotColor = (m: BloodMarker) => {
  if (m.flag == null) return "#6ee7b7";
  const d = deviation(m.range, m.value);
  return d.pct >= 100 ? "#fb7185" : d.pct >= 25 ? "#fb923c" : "#fbbf24";
};

/* ------------------------------------------------------------ hover card */

type Hover = { m: BloodMarker; rect: DOMRect };

/**
 * The explanation layer. Fixed-position rather than nested, because these cards
 * live inside a two-column grid of overflow-hidden cards that would clip a
 * normally-positioned popover on every right-hand column.
 */
function HoverCard({ hover }: { hover: Hover }) {
  const { m, rect } = hover;
  const info = MARKER_INFO[m.key];
  if (!info) return null;

  const W = 340;
  const flipLeft = rect.right + W + 16 > window.innerWidth;
  const left = flipLeft ? Math.max(8, rect.left - W - 12) : rect.right + 12;
  const top = Math.min(Math.max(8, rect.top - 8), Math.max(8, window.innerHeight - 300));

  const dev = deviation(m.range, m.value);
  const pos = bandPosition(m.range, m.value);
  const hot = m.flag === "H" ? "high" : m.flag === "L" ? "low" : null;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-xl border border-slate-700 bg-slate-900/97 p-4 shadow-2xl shadow-black/60 backdrop-blur"
      style={{ left, top, width: W }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-white">{m.name}</span>
        <span className="font-mono text-sm font-semibold" style={{ color: dotColor(m) }}>
          {show(m)} <span className="text-[10px] text-slate-500">{m.unit}</span>
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
        <span>ref {rangeLabel(m.range)}</span>
        {pos !== null && pos >= 0 && pos <= 100 && <span>{pos}% through range</span>}
        {dev.dir && (
          <span className="font-semibold" style={{ color: dotColor(m) }}>
            {dev.pct.toFixed(0)}% {dev.dir}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-[12px] leading-relaxed text-slate-300">{info.what}</p>

      <div className="mt-3 space-y-2">
        <div className={`rounded-lg border px-2.5 py-2 ${hot === "high" ? "border-amber-400/40 bg-amber-400/5" : "border-slate-800 bg-slate-950/40"}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-400">▲ HIGH</span>
            {hot === "high" && <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400">you are here</span>}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{info.high}</p>
        </div>
        <div className={`rounded-lg border px-2.5 py-2 ${hot === "low" ? "border-sky-400/40 bg-sky-400/5" : "border-slate-800 bg-slate-950/40"}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-sky-400">▼ LOW</span>
            {hot === "low" && <span className="text-[9px] font-semibold uppercase tracking-wide text-sky-400">you are here</span>}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{info.low}</p>
        </div>
      </div>

      {info.track && (
        <p className="mt-2.5 border-t border-slate-800 pt-2 text-[11px] leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-400">Trending it: </span>
          {info.track}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- marker row */

function MarkerRow({ m, onPick, onHover, active }: {
  m: BloodMarker;
  onPick: () => void;
  onHover: (h: Hover | null) => void;
  active: boolean;
}) {
  const g = geometry(m.range, m.value);
  const dot = dotColor(m);

  return (
    <button
      onClick={onPick}
      onMouseEnter={(e) => onHover({ m, rect: e.currentTarget.getBoundingClientRect() })}
      onMouseLeave={() => onHover(null)}
      onFocus={(e) => onHover({ m, rect: e.currentTarget.getBoundingClientRect() })}
      onBlur={() => onHover(null)}
      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
        active
          ? "border-slate-600 bg-slate-800/50"
          : "border-slate-800/70 bg-slate-950/30 hover:border-slate-600 hover:bg-slate-900/50"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] text-slate-200">{m.name}</span>
        <span className="flex shrink-0 items-baseline gap-1">
          <span className="font-mono text-[13px] font-semibold" style={{ color: dot }}>{show(m)}</span>
          <span className="text-[10px] text-slate-600">{m.unit}</span>
        </span>
      </div>

      <div className="relative mt-2 h-1.5 w-full rounded-full bg-slate-800/70">
        <div
          className="absolute inset-y-0 rounded-full bg-emerald-400/25"
          style={{ left: `${g.bandStart}%`, width: `${Math.max(1, g.bandEnd - g.bandStart)}%` }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950"
          style={{ left: `${g.pct}%`, background: dot }}
        />
      </div>
    </button>
  );
}

/* ------------------------------------------------------------ print sheet */

function PrintSheet({ panelDate, onClose }: { panelDate: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/80 backdrop-blur-sm print:static print:bg-white print:backdrop-blur-none">
      <div className="mx-auto my-8 max-w-3xl px-4 print:my-0 print:max-w-none print:px-0">
        <div className="mb-4 flex items-center justify-between gap-3 no-print">
          <h2 className="font-display text-lg font-semibold text-white">Next blood test — request sheet</h2>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-pink-500/90 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-pink-500"
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-3.5 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="print-sheet rounded-2xl border border-slate-800 bg-slate-900 p-6 print:rounded-none print:border-0 print:bg-white print:p-0">
          <header className="border-b border-slate-800 pb-4 print:border-slate-300">
            <h1 className="font-display text-xl font-bold text-white print:text-black">Blood test request</h1>
            <p className="mt-1 text-[12px] text-slate-400 print:text-slate-700">
              Built from the panel collected {panelDate}. Hand this to the GP.
            </p>
            <p className="mt-2 rounded-lg bg-slate-950/60 p-2.5 text-[12px] leading-relaxed text-slate-300 print:bg-slate-100 print:text-black">
              <b>The important bit:</b> in Australia the Medicare rebate follows the clinical reason, not the test name.
              The same test is free with a symptom on the form and billed without one. The "what to say" column is
              there to be read out.
            </p>
          </header>

          {/* legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {(Object.keys(REBATE) as (keyof typeof REBATE)[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] text-slate-400 print:text-black">
                <span className="h-2 w-2 rounded-full" style={{ background: REBATE[k].color }} />
                <b className="text-slate-300 print:text-black">{REBATE[k].label}</b> — {REBATE[k].blurb}
              </span>
            ))}
          </div>

          {NEXT_PANEL.map((g) => (
            <section key={g.title} className="mt-6 break-inside-avoid">
              <h2 className="font-display text-[15px] font-semibold text-white print:text-black">{g.title}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400 print:text-slate-700">{g.intro}</p>
              <div className="mt-2.5 space-y-1.5">
                {g.asks.map((a) => (
                  <div
                    key={a.test}
                    className="break-inside-avoid rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 print:border-slate-300 print:bg-white"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: REBATE[a.rebate].color }} />
                        <b className="text-[13px] text-white print:text-black">{a.test}</b>
                      </span>
                      <span className="text-[10px] uppercase tracking-wide" style={{ color: REBATE[a.rebate].color }}>
                        {REBATE[a.rebate].label}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-400 print:text-slate-700">{a.why}</p>
                    {a.say && (
                      <p className="mt-1 text-[12px] leading-relaxed text-sky-300 print:text-slate-900">
                        <b>Say:</b> {a.say}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="mt-6 break-inside-avoid">
            <h2 className="font-display text-[15px] font-semibold text-white print:text-black">
              7. Timing — this is what clears the false flags
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400 print:text-slate-700">
              On a typical athlete's panel several flags are method, not biology. These rules are free and remove more
              noise than any extra test adds.
            </p>
            <div className="mt-2.5 space-y-1.5">
              {TIMING.map((t) => (
                <div
                  key={t.rule}
                  className="break-inside-avoid rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 print:border-slate-300 print:bg-white"
                >
                  <b className="text-[13px] text-white print:text-black">{t.rule}</b>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-400 print:text-slate-700">{t.fixes}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="mt-6 border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-500 print:border-slate-300 print:text-slate-600">
            Prepared from your lab results for discussion with a GP. Rebate tiers are indicative; eligibility is the
            doctor's call and the rules change. Not medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function Bloods({ data, refreshed }: { data: Bundle; refreshed?: string }) {
  const panels = useMemo(
    () => [...(data.bloods ?? [])].sort((a, b) => a.panel_date.localeCompare(b.panel_date)),
    [data.bloods]
  );
  const latest: BloodPanel | undefined = panels[panels.length - 1];
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [sheet, setSheet] = useState(false);

  const stats = useMemo(() => {
    if (!latest) return null;
    const ms = latest.markers ?? [];
    const flagged = ms
      .filter((m) => m.flag != null)
      .map((m) => ({ m, dev: deviation(m.range, m.value) }))
      .sort((a, b) => b.dev.pct - a.dev.pct);
    const due = new Date(latest.panel_date + "T00:00:00");
    due.setMonth(due.getMonth() + 6);
    return {
      total: ms.length,
      inRange: ms.length - flagged.length,
      flagged,
      days: Math.round((Date.now() - new Date(latest.panel_date + "T00:00:00").getTime()) / 86400000),
      dueIn: Math.round((due.getTime() - Date.now()) / 86400000),
      dueOn: due.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
    };
  }, [latest]);

  const trend = useMemo(() => {
    if (!picked) return null;
    const points = panels
      .map((p) => {
        const m = p.markers?.find((x) => x.key === picked);
        return m ? { date: p.panel_date.slice(0, 7), value: m.value, marker: m } : null;
      })
      .filter((x): x is { date: string; value: number; marker: BloodMarker } => x !== null);
    if (!points.length) return null;
    return { points, marker: points[points.length - 1].marker };
  }, [picked, panels]);

  const groups = useMemo(() => {
    if (!latest) return [];
    const by = new Map<string, BloodMarker[]>();
    for (const m of latest.markers ?? []) {
      if (!by.has(m.group)) by.set(m.group, []);
      by.get(m.group)!.push(m);
    }
    return [...by.entries()];
  }, [latest]);

  if (!latest || !stats) {
    return (
      <>
        <PageHeader title="Bloods" icon="🩸" accent={ACCENT} subtitle="Pathology panels over time" refreshed={refreshed} />
        <EmptyHint>
          No blood panels yet. Once the <code className="text-slate-400">blood_panels</code> table exists and a panel is
          loaded, this page fills in automatically.
        </EmptyHint>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Bloods"
        icon="🩸"
        accent={ACCENT}
        subtitle={`${latest.lab ?? "Pathology"} · collected ${new Date(latest.panel_date + "T00:00:00").toLocaleDateString(
          "en-AU",
          { day: "numeric", month: "long", year: "numeric" }
        )}`}
        refreshed={refreshed}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Pill color={ACCENT}>{panels.length} panel{panels.length === 1 ? "" : "s"}</Pill>
            {stats.dueIn > 0 && <Pill color="#38bdf8">next due {stats.dueOn}</Pill>}
            <button
              onClick={() => setSheet(true)}
              className="rounded-lg border border-pink-400/40 bg-pink-500/10 px-3 py-1.5 text-[12px] font-semibold text-pink-300 transition hover:bg-pink-500/20"
            >
              What to ask for next time
            </button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Markers tracked" value={stats.total} />
        <Stat label="In range" value={stats.inRange} color="#6ee7b7" />
        <Stat label="Flagged by lab" value={stats.flagged.length} color={stats.flagged.length ? "#fbbf24" : "#6ee7b7"} />
        <Stat label="Days since draw" value={stats.days} unit="d" />
      </div>

      {/* ---- flags, quantified ---- */}
      {stats.flagged.length > 0 && (
        <Card className="mb-5 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
            <h2 className="font-display text-sm font-semibold text-white">Out of range</h2>
            <span className="text-[11px] text-slate-500">sorted by how far out · hover any row</span>
          </div>
          <div className="divide-y divide-slate-800/70">
            {stats.flagged.map(({ m, dev }) => {
              const c = dotColor(m);
              return (
                <button
                  key={m.key}
                  onClick={() => setPicked(picked === m.key ? null : m.key)}
                  onMouseEnter={(e) => setHover({ m, rect: e.currentTarget.getBoundingClientRect() })}
                  onMouseLeave={() => setHover(null)}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-2.5 text-left transition hover:bg-slate-800/40 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
                >
                  <span className="truncate text-[13px] font-medium text-white">{m.name}</span>
                  <span className="hidden font-mono text-[12px] text-slate-300 sm:block">
                    {show(m)} <span className="text-[10px] text-slate-600">{m.unit}</span>
                  </span>
                  <span className="hidden text-[11px] text-slate-500 sm:block">ref {rangeLabel(m.range)}</span>
                  <span className="justify-self-end whitespace-nowrap font-mono text-[12px] font-bold" style={{ color: c }}>
                    {dev.pct < 1 ? "<1" : dev.pct.toFixed(0)}% {dev.dir}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* ---- trend ---- */}
      <Card className="mb-5 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-white">{trend ? trend.marker.name : "Trend"}</h2>
            <p className="text-xs text-slate-500">
              {trend
                ? `${trend.marker.group} · reference ${rangeLabel(trend.marker.range)} ${trend.marker.unit}`
                : "Click any marker to chart it across every panel"}
            </p>
          </div>
          {trend && <Pill color={ACCENT}>{trend.points.length} reading{trend.points.length === 1 ? "" : "s"}</Pill>}
        </div>

        {!trend ? (
          <EmptyHint>Click a marker below to chart it. Hover to see what it means.</EmptyHint>
        ) : trend.points.length < 2 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 px-4 py-7 text-center">
            <div className="font-mono text-3xl font-semibold text-white">
              {show(trend.marker)} <span className="text-base text-slate-500">{trend.marker.unit}</span>
            </div>
            {bandPosition(trend.marker.range, trend.marker.value) !== null && (
              <div className="mt-1 text-[12px] text-slate-500">
                {bandPosition(trend.marker.range, trend.marker.value)}% through the reference range
              </div>
            )}
            <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-slate-500">
              One panel so far. The line chart appears from your second test — <b className="text-slate-300">{stats.dueOn}</b>.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend.points} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="date" tick={AXIS_TICK} stroke="#334155" />
              <YAxis tick={AXIS_TICK} stroke="#334155" domain={["auto", "auto"]} />
              <Tooltip {...TOOLTIP} formatter={(v: number) => [`${v} ${trend.marker.unit}`, trend.marker.name]} />
              {trend.marker.range.type === "between" && (
                <ReferenceArea y1={trend.marker.range.low} y2={trend.marker.range.high} fill="#6ee7b7" fillOpacity={0.08} />
              )}
              {trend.marker.range.type === "below" && (
                <ReferenceLine y={trend.marker.range.high} stroke="#fbbf24" strokeDasharray="4 4" />
              )}
              {trend.marker.range.type === "above" && (
                <ReferenceLine y={trend.marker.range.low} stroke="#fbbf24" strokeDasharray="4 4" />
              )}
              <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ---- every marker ---- */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {groups.map(([group, markers]) => (
          <Card key={group} className="p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="font-display text-[13px] font-semibold text-white">{group}</h2>
              <span className="text-[11px] text-slate-600">{markers.length}</span>
            </div>
            <div className="space-y-1.5">
              {markers.map((m) => (
                <MarkerRow
                  key={m.key}
                  m={m}
                  active={picked === m.key}
                  onPick={() => setPicked(picked === m.key ? null : m.key)}
                  onHover={setHover}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>

      {latest.lab_comments && latest.lab_comments.length > 0 && (
        <Card className="mt-5 p-5">
          <h2 className="font-display text-sm font-semibold text-white">Lab comments</h2>
          <ul className="mt-2.5 space-y-1.5">
            {latest.lab_comments.map((c, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-slate-500">— {c}</li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-slate-600">
            Lab measurements are the lab's. Hover explanations are ours, and are not medical advice.
          </p>
        </Card>
      )}

      {hover && <HoverCard hover={hover} />}
      {sheet && (
        <PrintSheet
          panelDate={new Date(latest.panel_date + "T00:00:00").toLocaleDateString("en-AU", {
            day: "numeric", month: "long", year: "numeric",
          })}
          onClose={() => setSheet(false)}
        />
      )}
    </>
  );
}
