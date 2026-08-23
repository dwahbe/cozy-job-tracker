'use client';

import { useEffect, useRef } from 'react';
import type { ParsedJob, Column } from '@/lib/markdown';
import { formatDateDisplay, toHref } from '@/lib/job-utils';
import { dropdownColorClass } from '@/lib/dropdown-colors';

interface KanbanCardProps {
  job: ParsedJob;
  columns: Column[];
  isDragging?: boolean;
  highlight?: boolean;
  onHighlightDone?: () => void;
  onClick?: () => void;
  dragRef?: (node: HTMLElement | null) => void;
  dragListeners?: React.HTMLAttributes<HTMLElement>;
  dragAttributes?: React.HTMLAttributes<HTMLElement>;
}

export function KanbanCard({
  job,
  columns,
  isDragging,
  highlight,
  onHighlightDone,
  onClick,
  dragRef,
  dragListeners,
  dragAttributes,
}: KanbanCardProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);

  // Scroll into view once when this card becomes the highlighted one, not on every render.
  useEffect(() => {
    if (highlight) {
      nodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [highlight]);

  const detail = [job.location, job.employmentType].filter(Boolean).join(' · ');

  // Custom columns that have a value set
  const activeCustom = columns.filter((col) => {
    const val = job.customFields[col.name];
    return val && val !== 'No';
  });

  return (
    <div
      ref={(node) => {
        nodeRef.current = node;
        dragRef?.(node);
      }}
      className={`kanban-card${isDragging ? ' dragging' : ''}${highlight ? ' card-highlight' : ''}`}
      onAnimationEnd={highlight ? onHighlightDone : undefined}
      onClick={onClick}
      {...dragListeners}
      {...dragAttributes}
      onKeyDown={(e) => {
        // dnd-kit's keyboard sensor listens here too (Space picks the card up).
        dragListeners?.onKeyDown?.(e);
        // Enter on the card itself (not on the link inside it) opens the details panel.
        if (e.key === 'Enter' && e.target === e.currentTarget && !e.defaultPrevented) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <a
        href={toHref(job.link)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-sm block hover:underline underline-offset-2 decoration-1"
        onClick={(e) => e.stopPropagation()}
      >
        {job.title}
      </a>
      <p className="muted text-xs mt-0.5">{job.company}</p>
      {detail && <p className="muted text-xs mt-1">{detail}</p>}
      {job.dueDate && (
        <p className="text-xs mt-1.5 muted">
          <span className="mr-1" aria-hidden="true">
            📅
          </span>
          {formatDateDisplay(job.dueDate)}
        </p>
      )}
      {activeCustom.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {activeCustom.map((col) => {
            const val = job.customFields[col.name];
            if (col.type === 'checkbox') {
              return (
                <span key={col.name} className="kanban-tag">
                  ✓ {col.name}
                </span>
              );
            }
            if (col.type === 'dropdown') {
              const colorCls = dropdownColorClass(col.optionColors?.[val]);
              return (
                <span key={col.name} className={`kanban-tag ${colorCls}`}>
                  {val}
                </span>
              );
            }
            return (
              <span key={col.name} className="kanban-tag">
                {col.type === 'date' ? formatDateDisplay(val) : val}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
