/** The logo: rings plus a sweeping beam. With `animated` it rotates like a radar screen.
 *  It draws in the current text color, set below, so it suits both themes. */
export default function RadarMark({ size = 32, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="text-emerald-600 dark:text-emerald-400">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
      <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".55" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
      <g className={animated ? "origin-center animate-sweep" : ""} style={{ transformOrigin: "16px 16px" }}>
        <path d="M16 16 L16 3 A13 13 0 0 1 27 9.5 Z" fill="currentColor" opacity=".25" />
        <line x1="16" y1="16" x2="16" y2="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <circle cx="22" cy="21" r="1.6" fill="currentColor" />
    </svg>
  );
}
