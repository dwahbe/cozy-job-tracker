'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import type { ParsedJob, Column } from '@/lib/markdown';
import { STATUS_OPTIONS, statusColor } from '@/lib/job-utils';
import { celebrateOffer } from '@/lib/confetti';
import type { DropAnimation } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import { KanbanExpandPanel } from './KanbanExpandPanel';
import { showToast } from './Toast';

const DROP_ANIMATION: DropAnimation = { duration: 200, easing: 'ease' };

interface KanbanBoardProps {
  jobs: ParsedJob[];
  columns: Column[];
  highlightJobId: string | null;
  onHighlightDone: () => void;
}

function DraggableCard({
  job,
  columns,
  highlight,
  onHighlightDone,
  onCardClick,
}: {
  job: ParsedJob;
  columns: Column[];
  highlight: boolean;
  onHighlightDone: () => void;
  onCardClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    data: { status: job.status, link: job.link },
  });

  return (
    <KanbanCard
      job={job}
      columns={columns}
      isDragging={isDragging}
      highlight={highlight}
      onHighlightDone={onHighlightDone}
      onClick={onCardClick}
      dragRef={setNodeRef}
      dragListeners={listeners as React.HTMLAttributes<HTMLElement>}
      dragAttributes={attributes as React.HTMLAttributes<HTMLElement>}
    />
  );
}

function KanbanColumn({
  status,
  jobs,
  columns,
  highlightJobId,
  onHighlightDone,
  onCardClick,
}: {
  status: string;
  jobs: ParsedJob[];
  columns: Column[];
  highlightJobId: string | null;
  onHighlightDone: () => void;
  onCardClick: (jobId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className={`kanban-column${isOver ? ' drag-over' : ''}`}>
      <div className={`kanban-column-header ${statusColor(status)}`}>
        <span>{status}</span>
        <span className="kanban-column-count">{jobs.length}</span>
      </div>
      <div ref={setNodeRef} className="kanban-column-body">
        {jobs.map((job) => (
          <DraggableCard
            key={job.id}
            job={job}
            columns={columns}
            highlight={job.id === highlightJobId}
            onHighlightDone={onHighlightDone}
            onCardClick={() => onCardClick(job.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({ jobs, columns, highlightJobId, onHighlightDone }: KanbanBoardProps) {
  const router = useRouter();
  // Status moves that are in flight or not yet reflected in `jobs`, by job id. Layering these
  // over the server data (instead of copying `jobs` into state) means a search or refresh can't
  // snap a card back to its old column mid-move.
  const [pendingMoves, setPendingMoves] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  // The element that opened the details panel, so focus can go back to it on close.
  const triggerRef = useRef<HTMLElement | null>(null);

  // Drop pending moves once the server data agrees with them (adjusted during render, the
  // React-recommended way to derive state from props without an extra effect pass).
  const settledIds = Object.keys(pendingMoves).filter(
    (id) => jobs.find((j) => j.id === id)?.status === pendingMoves[id]
  );
  if (settledIds.length > 0) {
    const next = { ...pendingMoves };
    for (const id of settledIds) delete next[id];
    setPendingMoves(next);
  }

  const localJobs = useMemo(() => {
    if (Object.keys(pendingMoves).length === 0) return jobs;
    return jobs.map((job) =>
      pendingMoves[job.id] && pendingMoves[job.id] !== job.status
        ? { ...job, status: pendingMoves[job.id] }
        : job
    );
  }, [jobs, pendingMoves]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Space picks up / drops a card; Enter is left free to open the card's details.
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ParsedJob[]>();
    for (const status of STATUS_OPTIONS) {
      map.set(status, []);
    }
    for (const job of localJobs) {
      const list = map.get(job.status);
      if (list) list.push(job);
      else map.get('Saved')!.push(job);
    }
    return map;
  }, [localJobs]);

  const activeJob = useMemo(
    () => (activeId ? (localJobs.find((j) => j.id === activeId) ?? null) : null),
    [activeId, localJobs]
  );

  const expandedJob = useMemo(
    () => (expandedJobId ? (localJobs.find((j) => j.id === expandedJobId) ?? null) : null),
    [expandedJobId, localJobs]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const jobId = active.id as string;
      const dragData = active.data.current as { status: string; link: string } | undefined;
      const oldStatus = dragData?.status;

      let newStatus = over.id as string;
      if (!STATUS_OPTIONS.includes(newStatus)) {
        newStatus = (over.data.current as { status: string })?.status;
      }

      if (!newStatus || !oldStatus || newStatus === oldStatus) return;

      // Optimistic update
      setPendingMoves((prev) => ({ ...prev, [jobId]: newStatus }));
      const rollback = () =>
        setPendingMoves((prev) => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });

      try {
        const response = await fetch('/api/update-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, field: 'Status', value: newStatus }),
        });

        if (response.ok) {
          if (newStatus === 'Offer') celebrateOffer();
          router.refresh();
        } else {
          const data = (await response.json().catch(() => ({}))) as { error?: unknown };
          showToast(typeof data.error === 'string' ? data.error : "Couldn't move the job.");
          rollback();
        }
      } catch {
        showToast("Couldn't move the job — check your connection.");
        rollback();
      }
    },
    [router]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleCardClick = useCallback((jobId: string) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setExpandedJobId(jobId);
  }, []);

  const handleClosePanel = useCallback(() => {
    setExpandedJobId(null);
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger?.isConnected) trigger.focus();
  }, []);

  return (
    <>
      <DndContext
        id="kanban-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="kanban-board">
          {STATUS_OPTIONS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              jobs={grouped.get(status) ?? []}
              columns={columns}
              highlightJobId={highlightJobId}
              onHighlightDone={onHighlightDone}
              onCardClick={handleCardClick}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={DROP_ANIMATION}>
          {activeJob ? (
            <div className="kanban-card kanban-card-overlay">
              <span className="font-semibold text-sm block">{activeJob.title}</span>
              <p className="muted text-xs mt-0.5">{activeJob.company}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {expandedJob && (
        <KanbanExpandPanel job={expandedJob} columns={columns} onClose={handleClosePanel} />
      )}
    </>
  );
}
