'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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

const DROP_ANIMATION: DropAnimation = { duration: 200, easing: 'ease' };

interface KanbanBoardProps {
  jobs: ParsedJob[];
  slug: string;
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

export function KanbanBoard({
  jobs,
  slug,
  columns,
  highlightJobId,
  onHighlightDone,
}: KanbanBoardProps) {
  const router = useRouter();
  const [localJobs, setLocalJobs] = useState(jobs);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Sync with server data
  useEffect(() => {
    setLocalJobs(jobs);
  }, [jobs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
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
      const jobLink = dragData?.link;

      let newStatus = over.id as string;
      if (!STATUS_OPTIONS.includes(newStatus)) {
        newStatus = (over.data.current as { status: string })?.status;
      }

      if (!newStatus || !oldStatus || newStatus === oldStatus || !jobLink) return;

      // Optimistic update
      setLocalJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j)));

      try {
        const response = await fetch('/api/update-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, jobLink, field: 'Status', value: newStatus }),
        });

        if (response.ok) {
          if (newStatus === 'Offer') celebrateOffer();
          router.refresh();
        } else {
          setLocalJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, status: oldStatus } : j))
          );
        }
      } catch {
        setLocalJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: oldStatus } : j)));
      }
    },
    [slug, router]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleCardClick = useCallback((jobId: string) => {
    setExpandedJobId(jobId);
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
        <KanbanExpandPanel
          job={expandedJob}
          slug={slug}
          columns={columns}
          onClose={() => setExpandedJobId(null)}
        />
      )}
    </>
  );
}
