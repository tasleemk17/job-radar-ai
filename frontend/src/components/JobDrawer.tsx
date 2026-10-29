import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Lightbulb, Loader2, Sparkles, Square, ThumbsUp, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, streamCoverLetter } from "../api";
import { lockScroll } from "../scroll";
import { STATUSES, type Analysis, type Application, type JobDetail, type Status } from "../types";
import ApplyPanel from "./ApplyPanel";
import ScoreRing from "./ScoreRing";
import { useToast } from "./Toast";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export default function JobDrawer({ jobId, onClose }: { jobId: number | null; onClose: () => void }) {
  useEffect(() => {
    if (jobId === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    lockScroll(true); // the page behind must not move while the drawer is open
    return () => {
      window.removeEventListener("keydown", onKey);
      lockScroll(false);
    };
  }, [jobId, onClose]);

  return (
    <AnimatePresence>
      {jobId !== null && (
        <>
          <motion.div
            key="shade"
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-label="Job details"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-ink-700 bg-ink-900 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <Content jobId={jobId} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Content({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [letter, setLetter] = useState(""); // shared: written in the Cover letter section, used by Apply
  const job = useQuery({ queryKey: ["job", jobId], queryFn: () => api<JobDetail>(`/jobs/${jobId}`) });
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => api<Application[]>("/applications") });
  const tracked = apps.data?.find((a) => a.job.id === jobId);

  const refreshLists = () => {
    for (const key of ["job", "jobs", "applications", "stats"]) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const track = useMutation({
    mutationFn: (status: Status) =>
      tracked
        ? api(`/applications/${tracked.id}`, { method: "PATCH", body: { status } })
        : api("/applications", { method: "POST", body: { job_id: jobId, status } }),
    onSuccess: refreshLists,
  });
  const untrack = useMutation({
    mutationFn: () => api(`/applications/${tracked!.id}`, { method: "DELETE" }),
    onSuccess: refreshLists,
  });

  const data = job.data;
  return (
    <>
      <header className="flex items-start gap-4 border-b border-ink-700 p-5">
        <ScoreRing score={data?.score ?? null} size={60} />
        <div className="min-w-0 flex-1">
          {job.isLoading && (
            <div className="space-y-2" aria-label="Loading">
              <div className="skeleton h-5 w-3/4 !rounded-md" />
              <div className="skeleton h-4 w-1/2 !rounded-md" />
            </div>
          )}
          {job.error && <p className="text-bad">{errorText(job.error)}</p>}
          {data && (
            <>
              <h2 className="text-lg font-semibold leading-snug text-slate-100">{data.title}</h2>
              <p className="text-sm text-slate-400">
                {data.company}
                {data.location ? ` · ${data.location}` : ""}
                {data.salary ? ` · ${data.salary}` : ""}
              </p>
            </>
          )}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-ink-800 hover:text-slate-200" aria-label="Close">
          <X size={18} />
        </button>
      </header>

      {data && (
        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain p-5">
          <section className="flex flex-wrap items-center gap-2">
            {tracked ? (
              <>
                <select
                  className="input w-auto"
                  value={tracked.status}
                  onChange={(e) => track.mutate(e.target.value as Status)}
                  aria-label="Application status"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button className="btn" onClick={() => untrack.mutate()} disabled={untrack.isPending}>
                  Remove from board
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => track.mutate("saved")} disabled={track.isPending}>
                Save to board
              </button>
            )}
            {(track.error || untrack.error) && <p className="w-full text-sm text-bad">{errorText(track.error ?? untrack.error)}</p>}
          </section>

          {(data.matched.length > 0 || data.missing.length > 0) && (
            <section>
              <p className="label">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {data.matched.map((s) => (
                  <span key={s} className="chip chip-ok">
                    {s}
                  </span>
                ))}
                {data.missing.map((s) => (
                  <span key={s} className="chip chip-miss">
                    + {s}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Green: on your resume. Amber: the job asks, you have not mentioned it.</p>
            </section>
          )}

          <AnalysisPanel jobId={jobId} canRun={data.score !== null} />
          <CoverLetterPanel jobId={jobId} canRun={data.score !== null} text={letter} setText={setLetter} />
          <ApplyPanel
            job={data}
            letter={letter}
            tracked={tracked}
            saving={track.isPending}
            onApplied={() => track.mutate("applied", { onSuccess: () => toast("Marked as applied. Good luck!") })}
          />

          <section>
            <p className="label">Description</p>
            <p className="max-h-72 overflow-y-auto whitespace-pre-line rounded-lg border border-ink-700 bg-ink-950 p-3 text-sm leading-relaxed text-slate-300">
              {data.description || "No description."}
            </p>
          </section>
        </div>
      )}
    </>
  );
}

function AnalysisPanel({ jobId, canRun }: { jobId: number; canRun: boolean }) {
  const run = useMutation({ mutationFn: (refresh: boolean) => api<Analysis>("/ai/analyze", { method: "POST", body: { job_id: jobId, refresh } }) });
  const a = run.data;
  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="label !mb-0">AI fit analysis</p>
        <button className="btn" onClick={() => run.mutate(!!a)} disabled={!canRun || run.isPending}>
          {run.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {a ? "Run again" : "Analyze my fit"}
        </button>
      </div>
      {!canRun && <p className="mt-2 text-sm text-slate-500">Add your resume on the Profile page to unlock this.</p>}
      {run.error && <p className="mt-2 text-sm text-bad">{errorText(run.error)}</p>}
      {a && (
        <div className="mt-3 space-y-4 rounded-lg border border-ink-700 bg-ink-950 p-4 text-sm">
          <p className="leading-relaxed text-slate-200">{a.summary}</p>
          <List icon={<ThumbsUp size={14} className="text-ok" />} title="Strengths" items={a.strengths} />
          <List icon={<TriangleAlert size={14} className="text-warn" />} title="Gaps" items={a.gaps} />
          <List icon={<Lightbulb size={14} className="text-info" />} title="What to do" items={a.tips} />
          <p className="text-xs text-slate-500">{a.source === "claude" ? "Written by Claude" : "Rule-based answer (no AI key set on the server)"}</p>
        </div>
      )}
    </section>
  );
}

function List({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
        {icon} {title}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function CoverLetterPanel({ jobId, canRun, text, setText }: { jobId: number; canRun: boolean; text: string; setText: (value: string | ((previous: string) => string)) => void }) {
  const [tone, setTone] = useState("professional");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function generate() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setText("");
    setError("");
    setBusy(true);
    try {
      await streamCoverLetter(jobId, tone, (piece) => setText((t) => t + piece), controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Cover letter copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy. Select the text and copy it by hand.");
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label !mb-0">Cover letter</p>
        <div className="flex items-center gap-2">
          <select className="input w-auto py-1.5" value={tone} onChange={(e) => setTone(e.target.value)} disabled={busy} aria-label="Tone">
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="concise">Concise</option>
          </select>
          {busy ? (
            <button className="btn" onClick={() => abort.current?.abort()}>
              <Square size={13} /> Stop
            </button>
          ) : (
            <button className="btn" onClick={generate} disabled={!canRun}>
              <Sparkles size={15} /> Generate
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {(text || busy) && (
        <div className="mt-3 rounded-lg border border-ink-700 bg-ink-950 p-4">
          {busy ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
              {text}
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-emerald-400 align-middle" />
            </p>
          ) : (
            // Once it is written, the letter is editable, because people should tweak it before sending
            <textarea className="input h-56 resize-y leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} aria-label="Cover letter text" />
          )}
          {!busy && text && (
            <button className="btn mt-3" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
