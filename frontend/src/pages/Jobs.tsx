import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FlaskConical, Globe, Loader2, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import JobCard from "../components/JobCard";
import JobDrawer from "../components/JobDrawer";
import RadarMark from "../components/RadarMark";
import Segmented from "../components/Segmented";
import { lockScroll } from "../scroll";
import { useToast } from "../components/Toast";
import type { JobList, Profile } from "../types";

const PAGE = 20;
const MATCH = [
  { value: 0, label: "Any" },
  { value: 40, label: "40+" },
  { value: 60, label: "60+" },
  { value: 75, label: "75+" },
];
const POSTED = [
  { value: 0, label: "Any" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
];

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Jobs() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [remote, setRemote] = useState(false);
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("match");
  const [minScore, setMinScore] = useState(0);
  const [maxAge, setMaxAge] = useState(0); // 0 means any age
  const [showDemo, setShowDemo] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const searchBox = useRef<HTMLInputElement>(null);
  const q = useDebounced(search);

  // Press "/" anywhere to jump to the search box, like on GitHub
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchBox.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/profile") });
  const sources = useQuery({ queryKey: ["sources"], queryFn: () => api<Record<string, number>>("/jobs/sources") });

  const jobs = useInfiniteQuery({
    queryKey: ["jobs", { q, remote, source, sort, minScore, maxAge, showDemo }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ q, sort, min_score: String(minScore), limit: String(PAGE), offset: String(pageParam) });
      if (remote) params.set("remote", "true");
      if (source) params.set("source", source);
      if (maxAge) params.set("max_age_days", String(maxAge));
      if (showDemo) params.set("demo", "true");
      return api<JobList>(`/jobs?${params}`);
    },
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    placeholderData: (previous) => previous, // keep the old list on screen while a filter loads: no flash
  });

  const refresh = useMutation({
    mutationFn: () => api<{ fetched: number; added: number; errors: Record<string, string>; skipped: string[] }>("/jobs/refresh", { method: "POST" }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      const down = Object.entries(res.errors).map(([name, why]) => `${name} (${why})`);
      const notes = [
        down.length ? `Could not reach: ${down.join(", ")}.` : "",
        res.skipped.length ? `Not set up yet: ${res.skipped.join(", ")} (add their API keys on the server).` : "",
      ].filter(Boolean);
      toast(`Found ${res.fetched} jobs, ${res.added} new. ${notes.join(" ")}`.trim(), notes.length ? "info" : "success");
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  const items = jobs.data?.pages.flatMap((p) => p.items) ?? [];
  const total = jobs.data?.pages[0]?.total ?? 0;
  const topScore = items[0]?.score ?? null;
  const ready = profile.data?.ready ?? false;
  const demoAvailable = jobs.data?.pages[0]?.demo_available ?? false;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Your <span className="text-gradient">radar</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            {jobs.isSuccess ? (
              <>
                <span>{total} jobs</span>
                {topScore !== null && sort === "match" && (
                  <span className="chip chip-ok">
                    <Sparkles size={11} className="mr-1" /> best match {topScore}%
                  </span>
                )}
              </>
            ) : (
              <span>Scanning...</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add a job
          </button>
          <button className="btn" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw size={15} className={refresh.isPending ? "animate-spin" : ""} /> Fetch new jobs
          </button>
        </div>
      </div>

      {profile.data && !ready && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative mt-5 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-sky-500/5 p-5">
          <div className="pointer-events-none absolute -right-6 -top-6 opacity-20">
            <RadarMark size={120} animated />
          </div>
          <p className="font-semibold text-ok">Add your resume to unlock match scores</p>
          <p className="mt-1 max-w-md text-sm text-slate-300">
            Right now every job shows "--". Paste your resume or upload a PDF and the best jobs rise to the top.
          </p>
          <Link to="/profile" className="btn btn-primary mt-4">
            Add resume
          </Link>
        </motion.div>
      )}

      {/* Stays at the top while the list scrolls, so filters are always one tap away */}
      <div className="sticky top-14 z-20 -mx-4 mt-5 border-b border-ink-800/80 bg-ink-950/85 px-4 py-3 backdrop-blur-md md:top-0 md:-mx-10 md:px-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative col-span-2 sm:col-span-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchBox}
              className="input pl-9 pr-10"
              placeholder="Search title, company or skill"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search jobs"
            />
            <span className="kbd pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:block">/</span>
          </div>
          <select className="input sm:w-40" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
            <option value="">All sources</option>
            {Object.entries(sources.data ?? {}).map(([name, n]) => (
              <option key={name} value={name}>
                {name} ({n})
              </option>
            ))}
          </select>
          <select className="input sm:w-36" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="match">Best match</option>
            <option value="recent">Most recent</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Segmented id="match" label="Match" options={MATCH} value={minScore} onChange={setMinScore} disabled={!ready} hint="Add your resume to filter by match" />
          <Segmented id="posted" label="Posted" options={POSTED} value={maxAge} onChange={setMaxAge} />
          <button
            aria-pressed={remote}
            onClick={() => setRemote(!remote)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${remote ? "border-emerald-400 bg-emerald-400/10 text-ok" : "border-ink-600 text-slate-400 hover:text-slate-100"}`}
          >
            <Globe size={14} /> Remote only
          </button>
          {/* Only offered when there are both real and demo jobs; demo jobs are hidden by default */}
          {demoAvailable && (
            <button
              aria-pressed={showDemo}
              onClick={() => setShowDemo(!showDemo)}
              title="Made-up sample jobs with fake links"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${showDemo ? "border-amber-500 bg-amber-500/10 text-warn" : "border-ink-600 text-slate-400 hover:text-slate-100"}`}
            >
              <FlaskConical size={14} /> {showDemo ? "Demo jobs shown" : "Show demo jobs"}
            </button>
          )}
        </div>
      </div>

      <div className={`mt-5 space-y-3 transition-opacity ${jobs.isPlaceholderData ? "opacity-60" : ""}`}>
        {jobs.isLoading && Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-28" />)}
        {jobs.error && <p className="text-bad">{(jobs.error as Error).message}</p>}
        {jobs.isSuccess && items.length === 0 && (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <div className="animate-float">
              <RadarMark size={64} animated />
            </div>
            <p className="mt-4 font-semibold text-slate-200">Nothing on the radar</p>
            <p className="mt-1 max-w-sm text-sm text-slate-400">No jobs match these filters. Loosen a filter, or fetch the latest jobs.</p>
            <button
              className="btn mt-5"
              onClick={() => {
                setSearch("");
                setRemote(false);
                setSource("");
                setMinScore(0);
                setMaxAge(0);
                setShowDemo(false);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        {items.map((job, i) => (
          <JobCard key={job.id} job={job} index={i} onOpen={setOpen} />
        ))}
      </div>

      {jobs.hasNextPage && (
        <div className="mt-6 text-center">
          <button className="btn" onClick={() => jobs.fetchNextPage()} disabled={jobs.isFetchingNextPage}>
            {jobs.isFetchingNextPage && <Loader2 size={15} className="animate-spin" />} Show more
          </button>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-slate-500">
        Jobs come from Remotive, Arbeitnow,{" "}
        <a href="https://www.adzuna.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">
          Adzuna
        </a>{" "}
        and{" "}
        <a href="https://jooble.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">
          Jooble
        </a>
        . Every job links to its original posting.
      </p>

      <JobDrawer jobId={open} onClose={() => setOpen(null)} />
      {adding && (
        <AddJob
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            setAdding(false);
            setOpen(id);
            toast("Job added and scored.");
          }}
        />
      )}
    </div>
  );
}

function AddJob({ onClose, onAdded }: { onClose: () => void; onAdded: (id: number) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", company: "", location: "", url: "", description: "", remote: false });
  const add = useMutation({
    mutationFn: () => api<{ id: number }>("/jobs", { method: "POST", body: form }),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      onAdded(job.id);
    },
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    lockScroll(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      lockScroll(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate();
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
      <motion.form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        role="dialog"
        aria-label="Add a job"
        className="card max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto overscroll-contain rounded-b-none p-6 sm:rounded-2xl"
      >
        <h2 className="text-lg font-semibold">Add a job you found elsewhere</h2>
        <p className="-mt-2 text-sm text-slate-400">Paste the description and it is scored against your resume like every other job.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={set("title")} required minLength={2} autoFocus />
          </div>
          <div>
            <label className="label">Company</label>
            <input className="input" value={form.company} onChange={set("company")} required />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={set("location")} />
          </div>
          <div>
            <label className="label">Apply link (https:// or mailto:)</label>
            <input className="input" value={form.url} onChange={set("url")} pattern="(https?://\S+|mailto:[^\s?@]+@[^\s?@]+\.[^\s?@]+)" title="A web link (https://...) or an email link (mailto:hr@company.com)" />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input h-36" value={form.description} onChange={set("description")} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" className="accent-emerald-500" checked={form.remote} onChange={(e) => setForm({ ...form, remote: e.target.checked })} /> Remote
        </label>
        {add.error && <p className="text-sm text-bad">{(add.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={add.isPending}>
            {add.isPending && <Loader2 size={15} className="animate-spin" />} Add and score
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
