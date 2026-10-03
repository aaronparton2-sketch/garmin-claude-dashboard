import { useEffect, useMemo, useState } from "react";
import { lastRefreshed, loadData, login, type Bundle, type LoadResult } from "./lib/data";
import { datasetNow, ALL_BUCKETS, type Bucket, type PeriodKey } from "./lib/metrics";
import Nav, { WorkWithUs } from "./components/Nav";
import ChatWidget from "./components/ChatWidget";
import Overview from "./pages/Overview";
import Health from "./pages/Health";
import ActivityDetail from "./pages/ActivityDetail";
import SleepPage from "./pages/SleepPage";
import StepsPage from "./pages/StepsPage";
import TrainingPlan from "./pages/TrainingPlan";
import RacePlan from "./pages/RacePlan";
import Recovery from "./pages/Recovery";
import BodyComp from "./pages/BodyComp";
import Bloods from "./pages/Bloods";

function useHashRoute(): [string, (p: string) => void] {
  const [route, setRoute] = useState(() => normalize(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(normalize(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const go = (p: string) => {
    window.location.hash = p;
    window.scrollTo({ top: 0 });
  };
  return [route, go];
}
const normalize = (h: string) => (h.replace(/^#/, "") || "/");

export default function App() {
  const [state, setState] = useState<LoadResult | null>(null);
  const reload = () => { setState(null); loadData().then(setState); };
  useEffect(() => { reload(); }, []);

  if (!state) return <div className="grid h-full place-items-center text-slate-500">Loading…</div>;
  if ("needLogin" in state) return <Login onAuthed={reload} />;
  return <Shell data={state} />;
}

function Shell({ data }: { data: Bundle }) {
  const [route, go] = useHashRoute();
  const now = useMemo(() => datasetNow(data.activities, data.sleep, data.daily), [data]);
  // "Last refreshed" = the newest created_at across every table (when the pull
  // last wrote). Computed once and shown on every page's header.
  const refreshed = useMemo(() => lastRefreshed(data) ?? undefined, [data]);
  // Time-range slicer, shared across every page so the selection persists on
  // navigation. Defaults to "This year"; periods() derives the like-for-like
  // previous window (prev 30d / prev month / last year same span) for comparisons.
  const [period, setPeriod] = useState<PeriodKey>("year");

  return (
    <div className="min-h-full">
      <Nav route={route} go={go} source={data.source} />
      <main className="md:pl-56">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Page route={route} data={data} now={now} go={go} period={period} setPeriod={setPeriod} refreshed={refreshed} />
          <footer className="mt-12 text-center text-xs text-slate-700">
            {data.source === "sample" && (
              <div className="mx-auto mb-5 max-w-xs">
                <WorkWithUs className="text-left" />
              </div>
            )}
            {data.source === "sample" ? "Sample data (fictional athlete)" : "Garmin Connect"} · {data.activities.length} activities · {data.weighIns.length} weigh-ins · {data.sleep.length} nights
            <br />
            Built by <a className="text-slate-500 hover:text-slate-300" href="https://aaronautomates.com.au" target="_blank" rel="noreferrer">Aaron Automates</a> · <a className="text-slate-500 hover:text-slate-300" href="https://github.com/aaronparton2-sketch/garmin-claude-dashboard" target="_blank" rel="noreferrer">source on GitHub</a>
          </footer>
        </div>
      </main>
      <ChatWidget />
    </div>
  );
}

function Page({ route, data, now, go, period, setPeriod, refreshed }: {
  route: string; data: Bundle; now: Date; go: (p: string) => void;
  period: PeriodKey; setPeriod: (p: PeriodKey) => void; refreshed?: string;
}) {
  const p = { period, setPeriod, refreshed };
  if (route === "/" || route === "/overview") return <Overview data={data} now={now} go={go} {...p} />;
  if (route === "/health") return <Health data={data} now={now} {...p} />;
  if (route === "/sleep") return <SleepPage data={data} now={now} {...p} />;
  if (route === "/recovery") return <Recovery data={data} now={now} {...p} />;
  if (route === "/body") return <BodyComp data={data} refreshed={refreshed} />;
  if (route === "/bloods") return <Bloods data={data} refreshed={refreshed} />;
  if (route === "/plan") return <TrainingPlan data={data} now={now} refreshed={refreshed} />;
  if (route === "/race") return <RacePlan now={now} refreshed={refreshed} />;

  const m = route.match(/^\/activity\/(\w+)$/);
  if (m) {
    const b = m[1] as Bucket;
    if (b === "sleep") return <SleepPage data={data} now={now} {...p} />;
    if (b === "walking") return <StepsPage data={data} now={now} {...p} />;
    if (ALL_BUCKETS.includes(b)) return <ActivityDetail bucket={b} data={data} now={now} {...p} />;
  }
  // unknown route → overview
  return <Overview data={data} now={now} go={go} {...p} />;
}

function Login({ onAuthed }: { onAuthed: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(false);
    const ok = await login(pw);
    setBusy(false);
    if (ok) onAuthed(); else { setErr(true); setPw(""); }
  };

  return (
    <div className="grid min-h-full place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/15 text-lg">⌚</span>
          <h1 className="font-display text-xl font-semibold text-white">Garmin Health &amp; Fitness</h1>
        </div>
        <p className="mb-5 text-sm text-slate-500">Enter the access code to continue.</p>
        <input
          type="password" inputMode="numeric" autoFocus value={pw}
          onChange={(e) => setPw(e.target.value)} placeholder="Access code"
          className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
        />
        {err && <p className="mt-2 text-xs text-rose-400">Incorrect code, try again.</p>}
        <button
          type="submit" disabled={busy || !pw}
          className="mt-4 w-full rounded-xl bg-emerald-500/90 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
