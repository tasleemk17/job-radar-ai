import { motion } from "framer-motion";

export interface Option {
  value: number;
  label: string;
}

/** A row of exclusive choices, with a pill that slides to the chosen one. `id` keeps two of these on one
 *  screen from sharing a pill. */
export default function Segmented({
  id,
  label,
  options,
  value,
  onChange,
  disabled = false,
  hint = "",
}: {
  id: string;
  label: string;
  options: Option[];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div role="group" aria-label={label} title={disabled ? hint : ""} className={`inline-flex items-center rounded-lg border border-ink-600 bg-ink-950 p-0.5 ${disabled ? "opacity-50" : ""}`}>
      <span className="px-2 text-xs text-slate-500">{label}</span>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`relative rounded-md px-3 py-1 text-sm font-medium transition-colors ${active ? "text-on-accent" : "text-slate-400 hover:text-slate-100"}`}
          >
            {active && <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-md bg-accent" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
