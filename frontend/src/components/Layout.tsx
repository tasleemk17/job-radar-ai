import { motion } from "framer-motion";
import { Gauge, KanbanSquare, LogOut, Radar, UserRound } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import RadarMark from "./RadarMark";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Jobs", icon: Radar, end: true },
  { to: "/board", label: "Board", icon: KanbanSquare, end: false },
  { to: "/dashboard", label: "Dashboard", icon: Gauge, end: false },
  { to: "/profile", label: "Profile", icon: UserRound, end: false },
];

export default function Layout() {
  const { email, logout } = useAuth();
  const { pathname } = useLocation();
  const initial = (email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop: sidebar */}
      <aside className="hidden border-r border-ink-700/70 bg-ink-900/60 backdrop-blur md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <RadarMark />
          <span className="text-lg font-bold tracking-tight">Job Radar</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "text-ok" : "text-slate-400 hover:text-slate-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/25"
                      transition={{ type: "spring", damping: 30, stiffness: 380 }}
                    />
                  )}
                  <Icon size={18} className="relative" />
                  <span className="relative">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-600 text-sm font-bold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-300" title={email ?? ""}>
              {email}
            </p>
            <button onClick={logout} className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200">
              <LogOut size={12} /> Sign out
            </button>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Phone: top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-800 bg-ink-950/85 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <RadarMark size={26} />
          <span className="font-bold tracking-tight">Job Radar</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={logout} className="rounded-lg p-2 text-slate-400 hover:bg-ink-800 hover:text-slate-100" aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 md:px-10 md:pb-12 md:pt-10">
        {/* A new key per page replays the entrance animation */}
        <motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <Outlet />
        </motion.div>
      </main>

      {/* Phone: bottom tabs, easy to reach with a thumb */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-ink-700 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${isActive ? "text-ok" : "text-slate-500"}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="tab-line" className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-emerald-400" />}
                <Icon size={20} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
