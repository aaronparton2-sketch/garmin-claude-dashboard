// Shared visual primitives + chart theme. Imported by every page.
import type { ReactNode } from "react";
import type { PeriodKey } from "./lib/metrics";

export const AXIS_TICK = { fontSize: 11, fill: "#94a3b8" } as const;
export const TOOLTIP = {
  contentStyle: { background: "#0f1623", border: "1px solid #1e293b", borderRadius: 10, fontSize: 12 },
  labelStyle: { color: "#cbd5e1" },
  cursor: { stroke: "#334155", strokeWidth: 1 },
} as const;
export const GRID = { strokeDasharray: "3 3", stroke: "#1e293b" } as const;

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/40 ${className}`}>{children}</div>
  );
}

export function ChartCard({
  title, subtitle, children, className = "", right,
}: {
  title: string; subtitle?: string; children: ReactNode; className?: string; right?: ReactNode;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function PageHeader({ title, subtitle, accent, icon, right, refreshed }: {
  title: string; subtitle?: string; accent?: string; icon?: string; right?: ReactNode;
  /** "Last refreshed …" stamp — when the data was last pulled. */
  refreshed?: string;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <span
            className="grid h-11 w-11 place-items-center rounded-xl text-2xl"
            style={{ background: accent ? `${accent}1a` : "#1e293b" }}
          >
            {icon}
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          {refreshed && <p className="mt-0.5 text-[11px] text-slate-500">{refreshed}</p>}
        </div>
      </div>
      {right}
    </header>
  );
}

/** A single metric tile: big number + unit, optional delta badge. */
export function Stat({ label, value, unit, delta, deltaGood, color, note }: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: number | null;          // percent
  deltaGood?: boolean;            // is an increase good? (false to invert)
  color?: string;
  /** small caveat under the number, e.g. "outdoor only - 1 indoor session
   *  excluded". Explains a figure rather than leaving it to be misread. */
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/30 p-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-display text-2xl font-semibold leading-none text-white" style={color ? { color } : undefined}>
          {value}
        </span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
      <Delta delta={delta} good={deltaGood} />
      {note && <div className="mt-0.5 text-[10px] leading-tight text-slate-600">{note}</div>}
    </div>
  );
}

export function Delta({ delta, good = true, suffix = "vs last" }: {
  delta?: number | null; good?: boolean; suffix?: string;
}) {
  // A null delta means there's no baseline (the prior window has no data, so
  // pct() couldn't be computed). Say so plainly rather than a bare dash, so an
  // empty comparison window is never mysteriously blank.
  if (delta == null) return <div className="mt-1 h-4 whitespace-nowrap text-[11px] text-slate-600">no prior data</div>;
  const up = delta > 0;
  const positive = up === good;
  const flat = delta === 0;
  return (
    <div className={`mt-1 h-4 text-[11px] font-medium ${flat ? "text-slate-500" : positive ? "text-emerald-400" : "text-rose-400"}`}>
      {up ? "▲" : delta < 0 ? "▼" : ""} {Math.abs(delta)}% <span className="text-slate-600">{suffix}</span>
    </div>
  );
}

export function Pill({ children, color, soft = true }: { children: ReactNode; color: string; soft?: boolean }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={soft ? { background: `${color}1f`, color } : { background: color, color: "#0a0c10" }}
    >
      {children}
    </span>
  );
}

export function SegMenu<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            value === o.value ? "bg-slate-700/70 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <div className="grid place-items-center py-12 text-center text-sm text-slate-600">{children}</div>;
}

/** The standard time-range slicer used on every page. This year is the default. */
export function PeriodMenu({ value, onChange }: { value: PeriodKey; onChange: (v: PeriodKey) => void }) {
  return (
    <SegMenu
      value={value}
      onChange={onChange}
      options={[
        { value: "month", label: "This month" },
        { value: "30d", label: "30 days" },
        { value: "year", label: "This year" },
      ]}
    />
  );
}
