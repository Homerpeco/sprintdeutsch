// Verb Meister App — self-contained verb tracker served from public/verb-tracker.html.
// It manages its own data in the visitor's localStorage (key: de_verb_tracker_v1),
// so it needs no backend and survives redeployments. Update it by replacing
// public/verb-tracker.html with a newer version; built-in migrations handle old data.

export function VerbMeisterView() {
  return (
    <iframe
      src="/verb-tracker.html"
      title="Verb Meister App"
      className="w-full block"
      style={{ border: "none", height: "calc(100vh - 60px)", display: "block" }}
    />
  );
}
