/**
 * Pill — reusable tab/level button.
 *
 * variant="dark"  (default) — sits on the dark forest-green header.
 *   inactive: translucent white  |  active: yellow
 *
 * variant="light" — sits on the light sage content area.
 *   inactive: white bg, dark green text  |  active: yellow
 */
export function Pill({ active, children, onClick, className = "", variant = "dark" }) {
  const activeStyle = {
    backgroundColor: '#f9e96a',
    color: '#284a18',
    fontWeight: 700,
    boxShadow: '0 1px 4px rgba(0,0,0,0.20)',
  };

  const inactiveClass = variant === "light"
    ? "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
    : "bg-white/15 text-white hover:bg-white/25 border border-white/30";

  return (
    <button
      onClick={onClick}
      style={active ? activeStyle : undefined}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
        active ? "ring-2 ring-yellow-300/50" : inactiveClass
      } ${className}`}
    >
      {children}
    </button>
  );
}
