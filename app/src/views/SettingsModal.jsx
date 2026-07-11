import { useState } from 'react';
import { CONTEXT_PRESETS, CONTEXT_PRESET_LABELS, STORE_KEY } from '../lib/storage.js';
import { detectPreset } from '../lib/prompts.js';
import { Icon } from '../components/Icon.jsx';

export function SettingsModal({ state, setState, isOpen, onClose }) {
  const [backendUrl, setBackendUrl] = useState(state.backendUrl || "http://localhost:8000");
  const [provider, setProvider] = useState(state.provider || "gemini");
  const [contextDomain, setContextDomain] = useState(
    state.contextDomain != null ? state.contextDomain : CONTEXT_PRESETS.manufacturing
  );
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);

  if (!isOpen) return null;

  const activePreset = detectPreset(contextDomain);

  async function probe() {
    setProbing(true);
    setProbeResult(null);
    const url = backendUrl.replace(/\/$/, "");
    try {
      const [h, s] = await Promise.all([
        fetch(`${url}/health`).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)),
        fetch(`${url}/library/stats`).then(r => r.ok ? r.json() : null),
      ]);
      setProbeResult({ ok: true, health: h, stats: s });
    } catch (e) {
      setProbeResult({ ok: false, error: String(e) });
    } finally {
      setProbing(false);
    }
  }

  function save() {
    setState({ ...state, backendUrl: backendUrl.trim(), provider, contextDomain });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><Icon.X className="w-5 h-5" /></button>
        </div>

        <label className="block text-sm font-medium mb-1">Backend URL</label>
        <input
          value={backendUrl}
          onChange={e => setBackendUrl(e.target.value)}
          placeholder="https://sprintdeutsch-backend.onrender.com"
          className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-mono"
        />
        <p className="text-xs text-slate-500 mt-2">
          Run the Python backend: <code className="bg-slate-100 px-1 rounded">cd backend && uvicorn app:app --reload --port 8000</code>
        </p>

        <button onClick={probe} disabled={probing} className="mt-3 px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50">
          {probing ? "Probing…" : "Test connection"}
        </button>
        {probeResult && (
          <div className={`mt-3 p-3 rounded-xl text-xs ${probeResult.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"}`}>
            {probeResult.ok ? (
              <>
                <div className="font-medium">✓ Connected</div>
                <div>Default provider: {probeResult.health.default_provider}</div>
                <div>Embedding: {probeResult.health.embedding_model}</div>
                <div>Providers configured: {Object.entries(probeResult.health.providers_configured).filter(([,v])=>v).map(([k])=>k).join(", ") || "(none)"}</div>
                {probeResult.stats && <div className="mt-1">Library: {probeResult.stats.chunks} chunks · {probeResult.stats.source_count} PDFs</div>}
              </>
            ) : (
              <div>✗ {probeResult.error}</div>
            )}
          </div>
        )}

        <div className="mt-5">
          <label className="block text-sm font-medium mb-2">AI provider</label>
          <div className="flex gap-2">
            {["gemini","claude"].map(p => (
              <button key={p} onClick={() => setProvider(p)}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium ${provider === p ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {p === "gemini" ? "Gemini Flash" : "Claude Sonnet"}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Provider keys live on the backend (in <code>.env</code>), not in this browser.</p>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium mb-2">Context Domain</label>
          <p className="text-xs text-slate-500 mb-2">
            The AI uses this block as the source of example-sentence vocabulary when you click <span className="font-medium">Quiz starten</span> or <span className="font-medium">Mit KI lernen</span>. Pick a preset or edit freely.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {Object.keys(CONTEXT_PRESETS).map(k => (
              <button key={k}
                onClick={() => setContextDomain(CONTEXT_PRESETS[k])}
                className={`text-xs px-2.5 py-1 rounded-full border ${activePreset === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {CONTEXT_PRESET_LABELS[k]}
              </button>
            ))}
            {activePreset === "custom" && (
              <span className="text-xs px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Custom</span>
            )}
          </div>
          <textarea
            value={contextDomain}
            onChange={e => setContextDomain(e.target.value)}
            rows={6}
            placeholder="Leave blank for no domain context. The AI will pick neutral examples."
            className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-xs font-mono leading-relaxed"
          />
          <p className="text-[10px] text-slate-400 mt-1">Saved locally. Used for Quiz + Lern prompts; general chat is not affected.</p>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-200">
          <label className="block text-sm font-medium mb-2">Danger zone</label>
          <button
            onClick={() => {
              if (confirm("Reset all progress?")) {
                localStorage.removeItem(STORE_KEY);
                location.reload();
              }
            }}
            className="text-sm text-rose-600 hover:text-rose-700"
          >
            Reset all progress
          </button>
        </div>

        <button onClick={save} className="mt-6 w-full py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700">Save</button>
      </div>
    </div>
  );
}
