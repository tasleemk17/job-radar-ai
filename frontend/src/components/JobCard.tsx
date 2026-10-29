import { motion } from "framer-motion";
import { Banknote, ChevronRight, Globe, MapPin } from "lucide-react";
import type { Job } from "../types";
import ScoreRing from "./ScoreRing";

export const STATUS_STYLE: Record<string, string> = {
  saved: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  applied: "border-sky-500/40 bg-sky-500/10 text-info",
  interview: "border-violet-500/40 bg-violet-500/10 text-vio",
  offer: "border-emerald-500/40 bg-emerald-500/10 text-ok",
  rejected: "border-rose-500/40 bg-rose-500/10 text-bad",
};

export const STATUS_DOT: Record<string, string> = {
  saved: "bg-slate-400",
  applied: "bg-sky-400",
  interview: "bg-violet-400",
  offer: "bg-emerald-400",
  rejected: "bg-rose-400",
};

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso + "Z").getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

function accent(score: number | null): string {
  if (score === null) return "bg-ink-600";
  if (score >= 70) return "bg-emerald-400";
  if (score >= 45) return "bg-amber-400";
  return "bg-slate-600";
}

export default function JobCard({ job, index, onOpen }: { job: Job; index: number; onOpen: (id: number) => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => onOpen(job.id)}
      className="card group relative w-full overflow-hidden p-4 pl-5 text-left transition-colors duration-200 hover:border-emerald-500/40 hover:bg-ink-800/90 hover:shadow-lift"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${accent(job.score)}`} aria-hidden="true" />
      <div className="flex items-start gap-4">
        <ScoreRing score={job.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-slate-100">{job.title}</h3>
            {job.status && <span className={`chip ${STATUS_STYLE[job.status]}`}>{job.status}</span>}
          </div>
          <p className="mt-0.5 text-sm text-slate-400">{job.company}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {job.location}
              </span>
            )}
            {job.remote && (
              <span className="inline-flex items-center gap-1 text-ok">
                <Globe size={12} /> Remote
              </span>
            )}
            {job.salary && (
              <span className="inline-flex items-center gap-1">
                <Banknote size={12} /> {job.salary}
              </span>
            )}
            <span>{timeAgo(job.posted_at)}</span>
            <span className="chip">{job.source}</span>
          </div>
          {(job.matched.length > 0 || job.missing.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.matched.slice(0, 5).map((s) => (
                <span key={s} className="chip chip-ok">
                  {s}
                </span>
              ))}
              {job.missing.slice(0, 3).map((s) => (
                <span key={s} className="chip chip-miss" title="The job asks for this and your resume does not mention it">
                  + {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight size={18} className="mt-1 hidden shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-ok sm:block" />
      </div>
    </motion.button>
  );
}
