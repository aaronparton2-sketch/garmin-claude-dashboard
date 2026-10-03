import { useMemo } from "react";
import type { Bundle, DexaScan, WeighIn } from "../lib/data";

/**
 * Body Composition — DEXA (reference standard) vs the Garmin Index scale.
 *
 * The point of this page is the OFFSET, not the absolute numbers. Bioimpedance
 * scales are consistent but biased; DEXA is accurate but occasional. Pair them
 * and the daily scale reading becomes trustworthy once you know its bias.
 *
 * Data trap this page handles: some weigh-ins come from a phone/manual entry
 * rather than the Index scale. Those rows carry
 * body_fat_pct = 0 and null muscle/bone. Averaging them in would silently drag
 * every number toward zero, so anything without a real body-fat reading is
 * excluded from the comparison and shown separately as weight-only.
 */

const isIndexScale = (w: WeighIn) =>
  w.body_fat_pct != null && w.body_fat_pct > 0 && w.muscle_mass_kg != null;

const fmt = (n: number | null | undefined, d = 1, suffix = "") =>
  n == null || Number.isNaN(n) ? "—" : `${n.toFixed(d)}${suffix}`;

const daysBetween = (a: string, b: string) =>
  Math.abs(Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000));

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="font-display text-sm font-semibold text-white">{title}</h2>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One metric, DEXA vs scale, with the delta called out. */
function Row({
  label, dexa, garmin, unit, digits = 1, note, verdict,
}: {
  label: string; dexa: number | null; garmin: number | null;
  unit: string; digits?: number; note?: string;
  verdict?: "good" | "warn" | "bad";
}) {
  const delta = dexa != null && garmin != null ? garmin - dexa : null;
  const tone =
    verdict === "bad" ? "text-rose-400" : verdict === "warn" ? "text-amber-400" : "text-emerald-400";
  return (
    <tr className="border-t border-slate-800/70">
      <td className="py-3 pr-3">
        <div className="text-sm text-white">{label}</div>
        {note && <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{note}</div>}
      </td>
      <td className="py-3 px-3 text-right font-mono text-sm text-sky-300">{fmt(dexa, digits, unit)}</td>
      <td className="py-3 px-3 text-right font-mono text-sm text-slate-300">{fmt(garmin, digits, unit)}</td>
      <td className={`py-3 pl-3 text-right font-mono text-sm font-semibold ${tone}`}>
        {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(digits)}${unit}`}
      </td>
    </tr>
  );
}

export default function BodyComp({ data, refreshed }: { data: Bundle; refreshed?: string }) {
  const dexaScans = useMemo(
    () => [...(data.dexa ?? [])].sort((a, b) => b.scan_date.localeCompare(a.scan_date)),
    [data.dexa]
  );
  const scaleReadings = useMemo(
    () => data.weighIns.filter(isIndexScale).sort((a, b) => b.measured_date.localeCompare(a.measured_date)),
    [data.weighIns]
  );
  const weightOnly = data.weighIns.length - scaleReadings.length;

  const latestDexa: DexaScan | undefined = dexaScans[0];
  // Nearest Index-scale reading to the scan date, not simply the newest.
  const paired = useMemo(() => {
    if (!latestDexa || !scaleReadings.length) return undefined;
    return scaleReadings.reduce((best, w) =>
      daysBetween(w.measured_date, latestDexa.scan_date) <
      daysBetween(best.measured_date, latestDexa.scan_date) ? w : best
    );
  }, [latestDexa, scaleReadings]);

  const gap = latestDexa && paired ? daysBetween(paired.measured_date, latestDexa.scan_date) : null;
  const stale = gap != null && gap > 14;

  if (!latestDexa) {
    return (
      <div className="space-y-6">
        <Header refreshed={refreshed} />
        <Card title="No DEXA scans yet">
          <p className="text-sm text-slate-400">
            Add a scan to <code className="text-slate-300">dexa_scans</code> and this page fills in.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header refreshed={refreshed} />

      {/* ---- the headline: what the scale gets wrong ---- */}
      <section className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-sky-400">
          The number that matters
        </div>
        <p className="mt-2 font-display text-2xl leading-snug text-white">
          Your Garmin scale reads{" "}
          <span className="text-rose-400">
            {paired?.body_fat_pct != null && latestDexa.body_fat_pct != null
              ? `${(paired.body_fat_pct - latestDexa.body_fat_pct).toFixed(1)} points high`
              : "—"}
          </span>{" "}
          on body fat.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          DEXA measured <b className="text-sky-300">{fmt(latestDexa.body_fat_pct, 1, "%")}</b>. The scale said{" "}
          <b className="text-slate-200">{fmt(paired?.body_fat_pct, 1, "%")}</b>. Bioimpedance systematically
          overestimates body fat on lean, athletic bodies, so treat the scale's percentage as a{" "}
          <b>trend line, not a truth</b>. Its weight and muscle figures are far more reliable.
        </p>
      </section>

      {/* ---- side by side ---- */}
      <Card
        title="DEXA vs Garmin Index scale"
        sub={
          gap == null
            ? undefined
            : `DEXA ${latestDexa.scan_date} vs nearest scale reading ${paired?.measured_date} — ${gap} days apart.`
        }
      >
        {stale && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            ⚠️ Those readings are {gap} days apart, so some of the weight gap is real change rather than scale
            error. Stand on the Index scale to get a same-week pair and this comparison becomes exact.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3">Metric</th>
                <th className="pb-2 px-3 text-right text-sky-400">DEXA</th>
                <th className="pb-2 px-3 text-right">Garmin</th>
                <th className="pb-2 pl-3 text-right">Scale error</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Body fat" dexa={latestDexa.body_fat_pct} garmin={paired?.body_fat_pct ?? null}
                   unit="%" verdict="bad"
                   note="The big one. Don't chase this number on the scale." />
              <Row label="Weight" dexa={latestDexa.weight_kg} garmin={paired?.weight_kg ?? null}
                   unit="kg" digits={2} verdict="good"
                   note="Scales are good at weight. Trust this." />
              <Row label="Muscle / ASM" dexa={latestDexa.asm_kg} garmin={paired?.muscle_mass_kg ?? null}
                   unit="kg" digits={2} verdict="good"
                   note="Garmin muscle mass vs DEXA appendicular skeletal muscle. Close enough to track." />
              <Row label="Bone" dexa={latestDexa.bone_mineral_content_kg} garmin={paired?.bone_mass_kg ?? null}
                   unit="kg" digits={2} verdict="warn"
                   note="Different definitions: DEXA measures mineral content only, Garmin estimates whole bone. Not comparable — watch each on its own trend." />
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---- DEXA detail ---- */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="This scan" sub={`${latestDexa.scan_date} · ${latestDexa.provider ?? ""}`}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Body fat", fmt(latestDexa.body_fat_pct, 1, "%")],
              ["Fat mass", fmt(latestDexa.fat_mass_kg, 1, " kg")],
              ["Lean mass", fmt(latestDexa.lean_mass_kg, 1, " kg")],
              ["Fat-free mass", fmt(latestDexa.fat_free_mass_kg, 1, " kg")],
              ["ASM", fmt(latestDexa.asm_kg, 1, " kg")],
              ["ASM / height²", fmt(latestDexa.asm_height2, 1)],
              ["Visceral fat", fmt(latestDexa.vat_area_cm2, 0, " cm²")],
              ["A/G ratio", fmt(latestDexa.ag_ratio, 2)],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-slate-950/50 px-3 py-2">
                <dt className="text-[11px] text-slate-500">{k}</dt>
                <dd className="font-mono text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Bone density" sub="Whole-body BMD. Spine and hip are the clinical sites — treat this as directional.">
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-[11px] text-slate-500">Z-score (vs your age)</div>
              <div className="font-mono text-3xl text-amber-400">{fmt(latestDexa.z_score, 1)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">T-score</div>
              <div className="font-mono text-2xl text-slate-400">{fmt(latestDexa.t_score, 1)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">BMD</div>
              <div className="font-mono text-2xl text-slate-400">{fmt(latestDexa.bmd_total, 3)}</div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Under 50, the <b className="text-slate-200">Z-score is the one to read</b>: it compares you to your own
            age group, and "below expected range" only starts at −2.0. It matters because swimming and
            cycling load bone almost not at all, so keep lifting through the build and don't train in a deficit.
          </p>
          {latestDexa.notes && (
            <p className="mt-3 text-[11px] text-slate-600">Scan note: {latestDexa.notes}</p>
          )}
        </Card>
      </div>

      {/* ---- history ---- */}
      <Card
        title="Scale history"
        sub={
          weightOnly > 0
            ? `${scaleReadings.length} Index-scale readings. ${weightOnly} weight-only entries excluded — they carry no body-fat reading and would drag the averages toward zero.`
            : `${scaleReadings.length} Index-scale readings.`
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 px-3 text-right">Weight</th>
                <th className="pb-2 px-3 text-right">Body fat</th>
                <th className="pb-2 px-3 text-right">Muscle</th>
                <th className="pb-2 pl-3 text-right">Corrected fat*</th>
              </tr>
            </thead>
            <tbody>
              {scaleReadings.slice(0, 12).map((w) => {
                const bias =
                  paired?.body_fat_pct != null && latestDexa.body_fat_pct != null
                    ? paired.body_fat_pct - latestDexa.body_fat_pct
                    : null;
                const corrected = bias != null && w.body_fat_pct != null ? w.body_fat_pct - bias : null;
                return (
                  <tr key={w.measured_at} className="border-t border-slate-800/70">
                    <td className="py-2 pr-3 text-slate-300">{w.measured_date}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-300">{fmt(w.weight_kg, 2, " kg")}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500">{fmt(w.body_fat_pct, 1, "%")}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-300">{fmt(w.muscle_mass_kg, 2, " kg")}</td>
                    <td className="py-2 pl-3 text-right font-mono text-emerald-400">{fmt(corrected, 1, "%")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          *Corrected fat = the scale reading minus its measured bias against DEXA. It assumes the bias is
          constant, which is a fair assumption for the same scale on the same body but{" "}
          <b>only becomes trustworthy after a second scan</b>. Book the next one about six months after the first.
        </p>
      </Card>

      {dexaScans.length > 1 && (
        <Card title="DEXA over time" sub="The only numbers here worth trending.">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3">Date</th><th className="pb-2 px-3 text-right">Fat %</th>
                <th className="pb-2 px-3 text-right">Lean</th><th className="pb-2 px-3 text-right">ASM</th>
                <th className="pb-2 pl-3 text-right">Z-score</th>
              </tr>
            </thead>
            <tbody>
              {dexaScans.map((s) => (
                <tr key={s.scan_date} className="border-t border-slate-800/70">
                  <td className="py-2 pr-3 text-slate-300">{s.scan_date}</td>
                  <td className="py-2 px-3 text-right font-mono text-sky-300">{fmt(s.body_fat_pct, 1, "%")}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-300">{fmt(s.lean_mass_kg, 1, " kg")}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-300">{fmt(s.asm_kg, 1, " kg")}</td>
                  <td className="py-2 pl-3 text-right font-mono text-amber-400">{fmt(s.z_score, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Header({ refreshed }: { refreshed?: string }) {
  return (
    <header>
      <h1 className="font-display text-2xl font-semibold text-white">Body Composition</h1>
      <p className="mt-1 text-sm text-slate-500">
        DEXA as the reference standard, the Index scale as the daily proxy.
        {refreshed ? ` ${refreshed}.` : ""}
      </p>
    </header>
  );
}
