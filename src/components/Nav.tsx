import { ACTIVITY_BUCKETS, BUCKET_META } from "../lib/metrics";

export type NavItem = { path: string; label: string; icon: string; color?: string };

export const NAV_SECTIONS: { heading?: string; items: NavItem[] }[] = [
  { items: [
    { path: "/", label: "Overview", icon: "📊" },
    { path: "/health", label: "Health", icon: "❤️", color: "#6ee7b7" },
    { path: "/body", label: "Body Comp", icon: "🧬", color: "#38bdf8" },
    { path: "/bloods", label: "Bloods", icon: "🩸", color: "#f472b6" },
  ] },
  {
    heading: "Activities",
    items: [
      ...ACTIVITY_BUCKETS.map((b) =>
        b === "walking"
          ? { path: "/activity/walking", label: "Steps", icon: "👟", color: BUCKET_META.walking.color }
          : { path: `/activity/${b}`, label: BUCKET_META[b].label, icon: BUCKET_META[b].icon, color: BUCKET_META[b].color }
      ),
      { path: "/sleep", label: "Sleep", icon: BUCKET_META.sleep.icon, color: BUCKET_META.sleep.color },
    ],
  },
  { heading: "Recovery", items: [{ path: "/recovery", label: "Recovery", icon: "🌙", color: "#38bdf8" }] },
  { heading: "Plan", items: [
    { path: "/race", label: "Race Plan", icon: "🏁", color: "#fbbf24" },
    { path: "/plan", label: "Training Plan", icon: "🎯", color: "#34d399" },
  ] },
];

/** Demo-only call to action. Rendered when source === "sample", so a copy you
 *  deploy on your own data carries no agency link by default. */
export function WorkWithUs({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const box = `group block rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] transition hover:border-emerald-400/50 hover:bg-emerald-500/[0.12] ${className}`;
  if (compact) {
    // Sidebar version: one line, so the nav above it keeps its room on a laptop screen.
    return (
      <a href="https://myceliumai.com.au" target="_blank" rel="noopener noreferrer" className={`${box} px-3 py-2 text-[11px] leading-snug`}>
        <span className="text-slate-400">Want one built for you?</span>{" "}
        <span className="whitespace-nowrap font-semibold text-emerald-200">
          Work with us <span className="inline-block transition group-hover:translate-x-0.5">→</span>
        </span>
      </a>
    );
  }
  return (
    <a href="https://myceliumai.com.au" target="_blank" rel="noopener noreferrer" className={`${box} px-3 py-2.5`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">Want one built for you?</div>
      <div className="mt-0.5 text-[12px] font-medium text-emerald-200">
        Work with us <span className="inline-block transition group-hover:translate-x-0.5">→</span>
      </div>
    </a>
  );
}

function isActive(current: string, path: string) {
  if (path === "/") return current === "/" || current === "/overview";
  return current === path;
}

export default function Nav({ route, go, source }: { route: string; go: (p: string) => void; source: string }) {
  return (
    <>
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-slate-800 bg-slate-950/60 px-3 py-5 backdrop-blur md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-lg">⌚</span>
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold text-white">Garmin</div>
            <div className="text-[10px] text-slate-500">Health &amp; Fitness</div>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto">
          {NAV_SECTIONS.map((sec, i) => (
            <div key={i}>
              {sec.heading && <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{sec.heading}</div>}
              <div className="space-y-0.5">
                {sec.items.map((it) => (
                  <button
                    key={it.path}
                    onClick={() => go(it.path)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive(route, it.path) ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-base" style={isActive(route, it.path) && it.color ? { filter: "saturate(1.4)" } : undefined}>{it.icon}</span>
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-4 px-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${source === "supabase" ? "bg-emerald-500/15 text-emerald-300" : source === "sample" ? "bg-amber-500/15 text-amber-300" : "bg-slate-700/50 text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${source === "supabase" ? "bg-emerald-400" : source === "sample" ? "bg-amber-400" : "bg-slate-400"}`} />
            {source === "supabase" ? "live · supabase" : source === "sample" ? "sample data · demo" : "snapshot"}
          </span>
          {/* Hidden on short laptop screens so the Plan links stay visible; the footer CTA still shows there. */}
          {source === "sample" && <WorkWithUs compact className="mt-2.5 hidden [@media(min-height:860px)]:block" />}
        </div>
      </aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/85 backdrop-blur md:hidden">
        <div className="flex items-center gap-2 overflow-x-auto px-3 py-2.5">
          {NAV_SECTIONS.flatMap((s) => s.items).map((it) => (
            <button
              key={it.path}
              onClick={() => go(it.path)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isActive(route, it.path) ? "bg-slate-800 text-white" : "bg-slate-900/60 text-slate-400"
              }`}
            >
              <span>{it.icon}</span>{it.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
