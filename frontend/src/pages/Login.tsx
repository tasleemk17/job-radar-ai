import { motion } from "framer-motion";
import { Brain, Eye, EyeOff, KanbanSquare, Radar } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import RadarMark from "../components/RadarMark";
import ThemeToggle from "../components/ThemeToggle";

const POINTS = [
  { icon: Radar, text: "Every job gets a match score against your resume" },
  { icon: Brain, text: "AI explains your gaps and writes a cover letter" },
  { icon: KanbanSquare, text: "Track every application on one board" },
];

export default function Login() {
  const { submit } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await submit(mode, email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <ThemeToggle className="fixed right-4 top-4 z-10" />
      <section className="relative hidden flex-col justify-center overflow-hidden border-r border-ink-700 bg-ink-900 p-14 lg:flex">
        <div className="absolute -right-32 -top-32 opacity-[0.07]">
          <RadarMark size={520} animated />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3">
            <RadarMark size={44} animated />
            <h1 className="text-3xl font-bold tracking-tight">Job Radar</h1>
          </div>
          <p className="mt-6 max-w-md text-xl leading-snug text-slate-300">Stop scrolling through job boards. Let the jobs that fit you show up first.</p>
          <ul className="mt-10 space-y-4">
            {POINTS.map(({ icon: Icon, text }, i) => (
              <motion.li
                key={text}
                className="flex items-center gap-3 text-slate-300"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 * i + 0.2 }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-ok">
                  <Icon size={18} />
                </span>
                {text}
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <RadarMark size={32} animated />
            <span className="text-xl font-bold">Job Radar</span>
          </div>
          <h2 className="text-2xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {mode === "login" ? "Sign in to see your matches." : "Free. Takes ten seconds."}
          </p>

          <label className="label mt-6" htmlFor="email">
            Email
          </label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

          <label className="label mt-4" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-200"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mode === "register" && <p className="mt-1.5 text-xs text-slate-500">At least 8 characters.</p>}

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}

          <button className="btn btn-primary mt-6 w-full" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-200"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
