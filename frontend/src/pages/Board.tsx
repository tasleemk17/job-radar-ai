import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { STATUS_DOT, STATUS_STYLE, timeAgo } from "../components/JobCard";
import JobDrawer from "../components/JobDrawer";
import ScoreRing from "../components/ScoreRing";
import { useToast } from "../components/Toast";
import { STATUSES, type Application, type Status } from "../types";

const TITLES: Record<Status, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export default function Board() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(null);
  const [dragging, setDragging] = useState<Application | null>(null);
  // Mouse: a drag starts after 6px, so a plain click still opens the job.
  // Touch: press and hold for a moment, so swiping the board sideways still scrolls it.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const apps = useQuery({ queryKey: ["applications"], queryFn: () => api<Application[]>("/applications") });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Status }) => api(`/applications/${id}`, { method: "PATCH", body: { status } }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["applications"] });
      const before = queryClient.getQueryData<Application[]>(["applications"]);
      // Move the card at once; the server answer only confirms it
      queryClient.setQueryData<Application[]>(["applications"], (old) => old?.map((a) => (a.id === id ? { ...a, status } : a)));
      return { before };
    },
    onError: (e, _v, ctx) => {
      queryClient.setQueryData(["applications"], ctx?.before);
      toast(`Could not move the card: ${(e as Error).message}`, "error");
    },
    onSuccess: (_d, v) => toast(`Moved to ${TITLES[v.status]}.`),
    onSettled: () => {
      for (const key of ["applications", "stats", "jobs"]) queryClient.invalidateQueries({ queryKey: [key] });
    },
  });

  const onDragStart = (e: DragStartEvent) => setDragging(apps.data?.find((a) => a.id === e.active.id) ?? null);

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const status = e.over?.id as Status | undefined;
    const app = apps.data?.find((a) => a.id === e.active.id);
    if (app && status && status !== app.status) move.mutate({ id: app.id, status });
  }

  const list = apps.data ?? [];
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        Application <span className="text-gradient">board</span>
      </h1>
      <p className="mt-2 text-sm text-slate-400">Drag a card to the next stage. On a phone, press and hold first. Click a card for details and the cover letter.</p>

      {apps.error && <p className="mt-4 text-bad">{(apps.error as Error).message}</p>}
      {apps.isLoading && (
        <div className="mt-6 flex gap-4 overflow-hidden">
          {STATUSES.map((s) => (
            <div key={s} className="skeleton h-48 w-72 shrink-0" />
          ))}
        </div>
      )}
      {apps.isSuccess && list.length === 0 && (
        <div className="card mt-6 px-6 py-10 text-center">
          <p className="font-semibold text-slate-200">No applications yet</p>
          <p className="mt-1 text-sm text-slate-400">Open a job and press "Save to board". It will show up here.</p>
          <Link to="/" className="btn btn-primary mt-4">
            Browse jobs
          </Link>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0">
          {STATUSES.map((status, i) => (
            <Column key={status} index={i} status={status} items={list.filter((a) => a.status === status)} draggingId={dragging?.id ?? null} onOpen={setOpen} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }}>
          {dragging && <CardBody app={dragging} overlay />}
        </DragOverlay>
      </DndContext>

      <JobDrawer jobId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Column({ status, index, items, draggingId, onOpen }: { status: Status; index: number; items: Application[]; draggingId: number | null; onOpen: (id: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <motion.section
      ref={setNodeRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className={`w-[82vw] shrink-0 snap-start rounded-2xl border p-3 transition-colors duration-200 sm:w-72 ${isOver ? "border-emerald-500/60 bg-emerald-500/5" : "border-ink-700 bg-ink-900/70"}`}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          {TITLES[status]}
        </span>
        <span className={`chip ${STATUS_STYLE[status]}`}>{items.length}</span>
      </header>
      <div className="min-h-28 space-y-2.5">
        {items.map((app) => (
          <DraggableCard key={app.id} app={app} hidden={app.id === draggingId} onOpen={onOpen} />
        ))}
        {items.length === 0 && (
          <div className={`flex h-24 items-center justify-center rounded-xl border border-dashed text-xs transition-colors ${isOver ? "border-emerald-500/60 text-ok" : "border-ink-600 text-slate-600"}`}>
            Drop a job here
          </div>
        )}
      </div>
    </motion.section>
  );
}

function DraggableCard({ app, hidden, onOpen }: { app: Application; hidden: boolean; onOpen: (id: number) => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: app.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(app.job.id)}
      style={{ touchAction: "manipulation" }}
      className={`transition-opacity ${hidden ? "opacity-30" : ""}`}
    >
      <CardBody app={app} />
    </div>
  );
}

function CardBody({ app, overlay = false }: { app: Application; overlay?: boolean }) {
  return (
    <div
      className={`cursor-grab rounded-xl border bg-ink-800 p-3 transition-shadow active:cursor-grabbing ${
        overlay ? "rotate-2 border-emerald-500/60 shadow-glow" : "border-ink-600 hover:border-emerald-500/40 hover:shadow-lift"
      }`}
    >
      <div className="flex items-start gap-3">
        <ScoreRing score={app.job.score} size={38} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100">{app.job.title}</p>
          <p className="truncate text-xs text-slate-400">{app.job.company}</p>
          <p className="mt-1 text-xs text-slate-500">{timeAgo(app.updated_at)}</p>
        </div>
      </div>
    </div>
  );
}
