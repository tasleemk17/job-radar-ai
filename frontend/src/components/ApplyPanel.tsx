import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink, Loader2, Mail } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api, applyTarget, mailtoLink } from "../api";
import type { Application, JobDetail, Profile } from "../types";
import { useToast } from "./Toast";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-200">{title}</p>
        <div className="mt-1.5 text-slate-400">{children}</div>
      </div>
    </li>
  );
}

/** The apply flow. The final submit always happens on the company's own page (or in the person's own
 *  email app), so this panel prepares everything, opens the right place, and records the result. */
export default function ApplyPanel({
  job,
  letter,
  tracked,
  saving,
  onApplied,
}: {
  job: JobDetail;
  letter: string;
  tracked: Application | undefined;
  saving: boolean;
  onApplied: () => void;
}) {
  const toast = useToast();
  const [opened, setOpened] = useState(false);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/profile") });
  const target = applyTarget(job.url);
  const applied = !!tracked && tracked.status !== "saved";

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied.`);
    } catch {
      toast("Could not copy. Select the text and copy it by hand.", "error");
    }
  }

  function openTarget() {
    if (!target) return;
    if (target.kind === "web") {
      window.open(target.href, "_blank", "noopener,noreferrer");
    } else {
      const body = letter || `Hello,\n\nI am applying for the ${job.title} role at ${job.company}.\n\nThank you.`;
      window.location.href = mailtoLink(target.href, `Application: ${job.title}`, body.slice(0, 1800));
    }
    setOpened(true);
  }

  let content: ReactNode;
  if (job.source === "demo") {
    content = (
      <p className="text-sm text-slate-400">
        This is a <b>demo job</b>, so there is no real company or posting behind it. Press <b>Fetch new jobs</b> on the Jobs page to get real jobs you can apply to.
      </p>
    );
  } else if (!target) {
    content = <p className="text-sm text-slate-400">This job has no apply link. Search for the company's careers page and apply there.</p>;
  } else {
    content = (
      <>
        <ol className="space-y-4 text-sm">
          <Step n={1} title="Get your cover letter ready">
            {letter ? (
              <button className="btn py-1.5" onClick={() => copy(letter, "Cover letter")}>
                <Copy size={14} /> Copy cover letter
              </button>
            ) : (
              <span>Optional. Generate one in the Cover letter section above, edit it, then copy it here.</span>
            )}
          </Step>
          <Step n={2} title="Have your resume at hand">
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn py-1.5" onClick={() => copy(profile.data?.resume_text ?? "", "Resume text")} disabled={!profile.data?.ready}>
                <Copy size={14} /> Copy resume text
              </button>
              <span>Many forms also ask for your PDF. Upload your own file there.</span>
            </div>
          </Step>
          <Step n={3} title={target.kind === "web" ? "Apply on the company's page" : "Send your application by email"}>
            <button className="btn btn-primary py-1.5" onClick={openTarget}>
              {target.kind === "web" ? <ExternalLink size={14} /> : <Mail size={14} />}
              {target.kind === "web" ? "Open application page" : "Write the email"}
            </button>
            {target.kind === "mail" && <p className="mt-1.5 text-xs">Your email app opens with the letter filled in. Attach your resume PDF before you send.</p>}
          </Step>
        </ol>

        {opened && !applied && (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
            <p className="font-medium text-ok">Did you finish applying?</p>
            <p className="mt-0.5 text-xs text-slate-400">We cannot see what happens on the company's site, so you confirm it here. This moves the job to Applied on your board.</p>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary py-1.5" onClick={onApplied} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Yes, mark as applied
              </button>
              <button className="btn py-1.5" onClick={() => setOpened(false)}>
                Not yet
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <section>
      <p className="label">Apply</p>
      <div className="space-y-4 rounded-xl border border-ink-700 bg-ink-950 p-4">
        {applied && tracked && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-ok">
            <CheckCircle2 size={16} />
            On your board as <b>{tracked.status}</b>
            {tracked.applied_at ? ` since ${new Date(tracked.applied_at + "Z").toLocaleDateString()}` : ""}.
          </p>
        )}
        {content}
      </div>
    </section>
  );
}
