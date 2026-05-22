import { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/Icon.jsx';

function SourcesBlock({ sources, provider }) {
  const [open, setOpen] = useState(false);
  const grounded = sources && sources.length > 0;
  return (
    <div className="text-[11px] text-slate-500 ml-1 mt-1">
      {grounded ? (
        <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
          <Icon.Book className="w-3 h-3" /> {sources.length} Quellen
          {provider && <span className="text-slate-400">· {provider}</span>}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          <Icon.Sparkle className="w-3 h-3" /> {provider || "model"} · no library hit
        </span>
      )}
      {open && grounded && (
        <ul className="mt-2 space-y-2">
          {sources.map((s, idx) => (
            <li key={idx} className="p-2 rounded-lg bg-white border border-slate-200">
              <div className="font-medium text-slate-700">{idx + 1}. {s.citation}</div>
              <div className="text-slate-500 mt-0.5">{s.preview}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AITutor({ state, setState, isOpen, onClose, seed, clearSeed }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hallo! Ich bin dein KI-Tutor und ziehe Antworten direkt aus deiner Grammatik-Bibliothek. Frag mich z.B. nach Konjunktiv II der Vergangenheit oder lass mich deinen Text korrigieren. Womit fangen wir an?" }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [libraryStats, setLibraryStats] = useState(null);
  const [healthErr, setHealthErr] = useState("");
  const [nextRagQuery, setNextRagQuery] = useState("");
  const scrollRef = useRef(null);

  const cleanUrl = (state.backendUrl || "").replace(/\/$/, "");

  useEffect(() => {
    if (seed && seed.prompt) {
      setInput(seed.prompt);
      setNextRagQuery(seed.ragQuery || "");
      clearSeed();
    }
  }, [seed && seed.prompt]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [h, s] = await Promise.all([
          fetch(`${cleanUrl}/health`).then(r => r.ok ? r.json() : null),
          fetch(`${cleanUrl}/library/stats`).then(r => r.ok ? r.json() : null),
        ]);
        if (cancelled) return;
        setLibraryStats(s);
        setHealthErr(h ? "" : "Backend reachable but /health returned non-ok.");
      } catch {
        if (cancelled) return;
        setLibraryStats(null);
        setHealthErr(`Couldn't reach ${cleanUrl}. Is the server running?`);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, cleanUrl]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);

    // Insert a placeholder assistant message that we'll stream into.
    // We capture its index so subsequent updates target only that slot.
    const placeholderIdx = next.length;
    setMessages([...next, { role: "assistant", content: "", streaming: true, sources: [], provider: state.provider }]);

    const updateMsg = (updater) => {
      setMessages(msgs =>
        msgs.map((m, i) =>
          i === placeholderIdx
            ? (typeof updater === "function" ? updater(m) : { ...m, ...updater })
            : m
        )
      );
    };

    try {
      const res = await fetch(`${cleanUrl}/chat/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          level: state.level,
          provider: state.provider,
          use_rag: true,
          rag_query: nextRagQuery || undefined,
        }),
      });
      setNextRagQuery("");

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        updateMsg({
          content: `Backend error (${res.status}). ${errText.slice(0, 400)}\n\nCheck the server logs.`,
          streaming: false,
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line. Keep the trailing
        // incomplete event in `buffer` until the next read fills it in.
        const rawEvents = buffer.split("\n\n");
        buffer = rawEvents.pop() || "";

        for (const raw of rawEvents) {
          if (!raw.trim()) continue;

          let eventType = "message";
          let dataLine = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trimStart();
          }
          if (!dataLine) continue;

          let payload;
          try { payload = JSON.parse(dataLine); } catch { continue; }

          if (eventType === "sources") {
            updateMsg({
              sources: payload.sources || [],
              provider: payload.provider || state.provider,
              ragUsed: !!payload.rag_used,
            });
          } else if (eventType === "chunk") {
            accumulated += payload.text || "";
            updateMsg(m => ({ ...m, content: accumulated }));
          } else if (eventType === "error") {
            accumulated += `\n\n[stream error: ${payload.error}]`;
            updateMsg(m => ({ ...m, content: accumulated, streaming: false }));
          } else if (eventType === "done") {
            updateMsg(m => ({ ...m, streaming: false }));
          }
        }
      }

      // Make sure we settle into a non-streaming state even if `done` was missed.
      updateMsg(m => ({ ...m, streaming: false }));
    } catch (e) {
      updateMsg({
        content: `Couldn't reach backend at ${cleanUrl}.\n\n${e.message}`,
        streaming: false,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-40 ${isOpen ? "" : "pointer-events-none"}`}>
      <div className={`absolute inset-0 bg-slate-900/40 transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white shrink-0">
              <Icon.Sparkle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">AI Tutor · {state.level}</div>
              <div className="text-xs text-slate-500 truncate">
                {libraryStats
                  ? <>📚 {libraryStats.source_count} PDFs · {libraryStats.chunks} chunks · {state.provider}</>
                  : healthErr
                    ? <span className="text-rose-600">{healthErr}</span>
                    : <>Verbinde mit Backend…</>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><Icon.X className="w-5 h-5" /></button>
        </div>

        {healthErr && (
          <div className="m-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            {healthErr} <br />Set the backend URL in Settings (gear, top right), or run:<br />
            <code className="text-xs">cd backend && uvicorn app:app --reload --port 8000</code>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-4 scrollbar-thin">
          {messages.map((m, i) => (
            <div key={i}>
              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "ml-auto bg-indigo-600 text-white bubble-user" : "bg-slate-100 text-slate-800 bubble-ai"}`}>
                {m.content}
                {m.streaming && (
                  <span className="inline-block w-[6px] h-[14px] -mb-0.5 ml-0.5 bg-slate-500 animate-pulse" aria-hidden="true" />
                )}
              </div>
              {m.role === "assistant" && !m.streaming && (m.sources || m.provider) && (
                <SourcesBlock sources={m.sources} provider={m.provider} ragUsed={m.ragUsed} />
              )}
            </div>
          ))}
          {busy && !messages.some(m => m.streaming) && (
            <div className="bg-slate-100 text-slate-500 text-sm px-3.5 py-2.5 rounded-2xl bubble-ai w-fit">…thinking</div>
          )}
        </div>

        <div className="p-3 border-t border-slate-200">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Schreib auf Deutsch oder Englisch…"
              className="flex-1 resize-none p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm"
            />
            <button onClick={send} disabled={busy || !input.trim()} className="p-2.5 rounded-xl bg-indigo-600 text-white disabled:bg-slate-300 hover:bg-indigo-700">
              <Icon.Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Calls your SprintDeutsch backend → {state.provider} → ChromaDB-retrieved grammar excerpts.</p>
        </div>
      </div>
    </div>
  );
}