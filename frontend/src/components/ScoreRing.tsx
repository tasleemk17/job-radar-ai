import { useTheme, type Theme } from "../theme";

// Darker shades on white, lighter shades on dark, so the number stays readable in both
const COLORS: Record<Theme, { strong: string; partial: string; weak: string; track: string }> = {
  light: { strong: "#059669", partial: "#d97706", weak: "#64748b", track: "#e2e8f0" },
  dark: { strong: "#34d399", partial: "#fbbf24", weak: "#64748b", track: "#1d2634" },
};

export default function ScoreRing({ score, size = 52 }: { score: number | null; size?: number }) {
  const { theme } = useTheme();
  const palette = COLORS[theme];

  if (score === null) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-ink-600 text-xs text-slate-500"
        style={{ width: size, height: size }}
        title="Add your resume to see a match score"
      >
        --
      </div>
    );
  }
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const color = score >= 70 ? palette.strong : score >= 45 ? palette.partial : palette.weak;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${score}% match`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={palette.track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}
