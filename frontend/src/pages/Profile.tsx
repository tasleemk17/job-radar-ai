import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, FileUp, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import type { Profile as ProfileType } from "../types";

export default function Profile() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<ProfileType>("/profile") });
  const status = useQuery({ queryKey: ["ai-status"], queryFn: () => api<{ claude: boolean }>("/ai/status") });

  const [resume, setResume] = useState("");
  const [roles, setRoles] = useState("");
  const [location, setLocation] = useState("");
  const [extra, setExtra] = useState("");
  const file = useRef<HTMLInputElement>(null);

  // The form is filled from the server once. After that the person's own typing is never overwritten, even if
  // the saved profile arrives late (a sleeping free server can take a minute) or is fetched again.
  const filled = useRef(false);
  useEffect(() => {
    if (!profile.data || filled.current) return;
    filled.current = true;
    setResume(profile.data.resume_text);
    setRoles(profile.data.roles);
    setLocation(profile.data.location);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      api<ProfileType>("/profile", {
        method: "PUT",
        body: { resume_text: resume, roles, location, extra_skills: extra.split(",").map((s) => s.trim()).filter(Boolean) },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data);
      // every score depends on the resume, so lists and charts must be fetched again
      for (const key of ["jobs", "applications", "stats", "job"]) queryClient.invalidateQueries({ queryKey: [key] });
      toast("Profile saved. Your jobs are re-scored.");
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  const upload = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData();
      form.append("file", f);
      return api<{ text: string }>("/profile/resume-pdf", { method: "POST", form });
    },
    onSuccess: (data) => {
      setResume(data.text);
      toast("PDF read. Check the text, then press Save.", "info");
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again
    if (f) upload.mutate(f);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const skills = profile.data?.skills ?? [];
  // A small checklist: each saved item raises the bar and tells the user what is still missing
  const steps = [
    { done: resume.trim().length > 200, text: "Resume added (a full resume works best)" },
    { done: roles.trim().length > 0, text: "Roles you want" },
    { done: skills.length >= 5, text: "At least 5 skills found" },
  ];
  const strength = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">
        Your <span className="text-gradient">profile</span>
      </h1>
      <p className="mt-2 text-sm text-slate-400">Your resume drives every match score, analysis and cover letter.</p>

      <div className="card mt-5 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-200">Profile strength</span>
          <span className="text-ok">{strength}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" animate={{ width: `${strength}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
        </div>
        <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.text} className={`flex items-start gap-2 ${s.done ? "text-slate-300" : "text-slate-500"}`}>
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-accent text-on-accent" : "border border-ink-600"}`}>
                {s.done && <Check size={11} strokeWidth={3} />}
              </span>
              {s.text}
            </li>
          ))}
        </ul>
      </div>

      <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${status.data?.claude ? "border-emerald-500/30 bg-emerald-500/10 text-ok" : "border-ink-600 bg-ink-900 text-slate-400"}`}>
        {status.data?.claude ? "AI answers are written by Claude." : "AI is in rule-based mode: scores work, analysis and letters are simpler. Add ANTHROPIC_API_KEY on the server to switch Claude on."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label !mb-0" htmlFor="resume">
              Resume text
            </label>
            <button type="button" className="btn py-1" onClick={() => file.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} Upload PDF
            </button>
            <input ref={file} type="file" accept="application/pdf" className="hidden" onChange={onFile} />
          </div>
          <textarea id="resume" className="input h-72 font-mono text-[13px] leading-relaxed" value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Paste your resume here, or upload a PDF above." maxLength={20000} />
          <p className="mt-1 text-xs text-slate-500">{resume.length.toLocaleString()} / 20,000 characters</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="roles">
              Roles you want
            </label>
            <input id="roles" className="input" value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="full stack developer, react developer" />
          </div>
          <div>
            <label className="label" htmlFor="location">
              Preferred location
            </label>
            <input id="location" className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Pune, or Remote" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="extra">
            Extra skills not in the resume (comma separated)
          </label>
          <input id="extra" className="input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="figma, scrum" />
        </div>

        <div className="flex items-center gap-4">
          <button className="btn btn-primary" disabled={save.isPending}>
            {save.isPending && <Loader2 size={15} className="animate-spin" />} Save profile
          </button>
        </div>
      </form>

      <section className="mt-8">
        <p className="label">Skills found on your profile ({skills.length})</p>
        {skills.length === 0 ? (
          <p className="text-sm text-slate-500">None yet. Save a resume and they appear here.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span key={s} className="chip chip-ok">
                {s}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
