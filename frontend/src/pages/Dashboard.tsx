import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Briefcase, Radar, Reply, Target, type LucideIcon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import CountUp from "../components/CountUp";
import { useTheme, type Theme } from "../theme";
import type { Stats } from "../types";

const FUNNEL_COLORS: Record<string, string> = {
  saved: "#64748b",
  applied: "#0ea5e9",
  interview: "#8b5cf6",
  offer: "#10b981",
  rejected: "#f43f5e",
};

// Charts draw SVG attributes, which cannot read the CSS variables, so each theme gets its own palette here
function palette(theme: Theme) {
  const dark = theme === "dark";
  const axis = { fontSize: 12, fill: dark ? "#94a3b8" : "#64748b" };
  return {
    axis,
    label: { ...axis, fill: dark ? "#cbd5e1" : "#334155" },
    grid: dark ? "#1d2634" : "#e2e8f0",
    line: dark ? "#34d399" : "#059669",
    gap: dark ? "#fbbf24" : "#d97706",
    tip: {
      contentStyle: { background: dark ? "#141b25" : "#ffffff", border: `1px solid ${dark ? "#2a3548" : "#e2e8f0"}`, borderRadius: 10, color: dark ? "#e2e8f0" : "#0f172a" },
      cursor: { fill: dark ? "rgba(148,163,184,.08)" : "rgba(100,116,139,.08)" },
    },
  };
}

function Stat({ label, value, suffix = "", hint, icon: Icon, tone, index }: { label: string; value: number | null; suffix?: string; hint: string; icon: LucideIcon; tone: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35 }}
      whileHover={{ y: -2 }}
      className="card relative overflow-hidden p-5"
    >
      <span className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl ${tone}`} aria-hidden="true" />
      <div className="relative flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <Icon size={16} className="text-slate-500" />
      </div>
      <p className="relative mt-3 text-4xl font-bold tracking-tight text-slate-100">{value === null ? "--" : <CountUp value={value} suffix={suffix} />}</p>
      <p className="relative mt-1 text-xs text-slate-500">{hint}</p>
    </motion.div>
  );
}

function Panel({ title, subtitle, children, index }: { title: string; subtitle?: string; children: React.ReactNode; index: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + index * 0.08, duration: 0.35 }} className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

export default function Dashboard() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/stats") });
  const s = stats.data;
  const c = palette(useTheme().theme);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">
        Your <span className="text-gradient">dashboard</span>
      </h1>
      <p className="mt-2 text-sm text-slate-400">Where your search stands, and what to learn next.</p>

      {stats.error && <p className="mt-4 text-bad">{(stats.error as Error).message}</p>}
      {stats.isLoading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      )}

      {s && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat index={0} label="Jobs tracked" value={s.tracked} hint="On your board" icon={Briefcase} tone="bg-sky-400" />
            <Stat index={1} label="Response rate" value={s.response_rate} suffix="%" hint="Applications that got an answer" icon={Reply} tone="bg-violet-400" />
            <Stat index={2} label="Top 10 match" value={s.avg_top_match} suffix="%" hint={s.avg_top_match === null ? "Add your resume first" : "Average of your best 10"} icon={Target} tone="bg-emerald-400" />
            <Stat index={3} label="Jobs on radar" value={s.total_jobs} hint="Across all sources" icon={Radar} tone="bg-amber-400" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel index={0} title="Application funnel">
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={s.funnel}>
                    <CartesianGrid stroke={c.grid} vertical={false} />
                    <XAxis dataKey="status" tick={c.axis} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={c.axis} axisLine={false} tickLine={false} width={28} domain={[0, (max: number) => Math.max(max, 3)]} />
                    <Tooltip {...c.tip} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {s.funnel.map((f) => (
                        <Cell key={f.status} fill={FUNNEL_COLORS[f.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel index={1} title="Jobs added to your board, per week">
              <div className="h-60">
                <ResponsiveContainer>
                  <AreaChart data={s.weekly}>
                    <defs>
                      <linearGradient id="weekly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.line} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={c.line} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={c.grid} vertical={false} />
                    <XAxis dataKey="week" tick={c.axis} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={c.axis} axisLine={false} tickLine={false} width={28} domain={[0, (max: number) => Math.max(max, 3)]} />
                    <Tooltip {...c.tip} />
                    <Area type="monotone" dataKey="count" stroke={c.line} strokeWidth={2.5} fill="url(#weekly)" dot={{ r: 3, fill: c.line, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="mt-4">
            <Panel index={2} title="Skills to learn next" subtitle="What your 30 best-matching jobs ask for that your resume does not mention.">
              {s.skill_gap.length === 0 ? (
                <p className="text-sm text-slate-500">Add your resume on the Profile page and the gaps show up here.</p>
              ) : (
                <div style={{ height: s.skill_gap.length * 38 + 20 }}>
                  <ResponsiveContainer>
                    <BarChart data={s.skill_gap} layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" allowDecimals={false} tick={c.axis} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="skill" tick={c.label} axisLine={false} tickLine={false} width={110} />
                      <Tooltip {...c.tip} formatter={(v) => [`${v} jobs`, "Ask for it"]} />
                      <Bar dataKey="jobs" fill={c.gap} radius={[0, 8, 8, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
