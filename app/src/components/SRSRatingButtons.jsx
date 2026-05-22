export function SRSRatingButtons({ srs, onRate }) {
  return (
    <div className="flex items-center gap-1 ml-auto">
      {srs && srs.lastReviewed && (
        <span className="text-[10px] text-slate-400 mr-1">
          {srs.successCount}✓ · {srs.failCount}✗
        </span>
      )}
      <button onClick={() => onRate(1)} title="Wieder — ich konnte es nicht"
        className="text-xs px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200">Wieder</button>
      <button onClick={() => onRate(3)} title="Schwer — geschafft, aber mit Mühe"
        className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200">Schwer</button>
      <button onClick={() => onRate(5)} title="Gut — saß"
        className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">Gut</button>
    </div>
  );
}
