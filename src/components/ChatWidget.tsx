import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const NEED_KEY =
  "Add your Claude API key to chat with your coach. Set ANTHROPIC_API_KEY in your .env (local) or in Vercel's environment variables, redeploy, and this chat reads your recent data and answers like a coach. Keys at console.anthropic.com. Nothing else to change.";

/** Floating AI coach chat (bottom-right). Talks to /api/chat, which reads recent
 *  Garmin data read-only and answers via Claude. With no API key configured it
 *  shows how to add one instead of erroring. */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, open, busy]);

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    const history = msgs.slice(-10); // keep the request small
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message, history }),
      });
      const j = await r.json().catch(() => null);
      let reply: string;
      if (j && j.setup) {
        // No ANTHROPIC_API_KEY on the server (this is how the public demo runs).
        setNeedsKey(true);
        reply = NEED_KEY;
      } else if (j && typeof j.reply === "string" && j.reply) {
        reply = j.reply;
      } else {
        reply = "Sorry, I couldn't get an answer just now. Try again in a moment.";
      }
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Sorry, I couldn't get an answer just now. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-40 flex h-[500px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/95 shadow-2xl shadow-black/50 backdrop-blur">
          {/* header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-sm">🤖</span>
              <div className="leading-tight">
                <div className="font-display text-sm font-semibold text-white">AI Coach</div>
                <div className="text-[10px] text-slate-500">Training advice, not medical advice.</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* messages */}
          <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
            {!msgs.length && (
              <div className="px-2 py-6 text-center text-xs text-slate-600">
                Ask about your training: recovery, load, sleep, pacing. Answers use your recent Garmin data.
              </div>
            )}
            {needsKey && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
                🔑 Chat is off until you add <code className="text-amber-100">ANTHROPIC_API_KEY</code>. See the README, section "AI coach".
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-emerald-500/90 text-slate-950"
                      : "border border-slate-800 bg-slate-900/70 text-slate-200"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-500">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* input */}
          <div className="flex items-center gap-2 border-t border-slate-800 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask your coach…"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="rounded-xl bg-emerald-500/90 px-3.5 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI coach" : "Open AI coach"}
        className="fixed bottom-4 right-4 z-40 grid place-items-center rounded-full border border-slate-700 bg-slate-900 text-2xl shadow-lg shadow-black/40 transition hover:border-emerald-500/60 hover:bg-slate-800"
        style={{ height: 52, width: 52 }}
      >
        {open ? "▾" : "💬"}
      </button>
    </>
  );
}
