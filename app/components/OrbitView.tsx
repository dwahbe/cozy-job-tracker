'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { forceSimulation, forceManyBody, forceCollide, forceRadial } from 'd3-force';
import type { Simulation, SimulationNodeDatum } from 'd3-force';
import type { Person, PersonStatus } from '@/lib/network';
import { STATUS_LABELS } from '@/lib/network';
import type { Column } from '@/lib/markdown';

interface OrbitViewProps {
  people: Person[];
  columns: Column[];
  userName: string | null;
}

interface OrbitNode extends SimulationNodeDatum {
  id: string;
  person: Person;
  radius: number;
  ring: number;
  opacity: number;
  isWaiting: boolean;
  isFollowUpDue: boolean;
}

type OrbitFilter = 'all' | 'due-this-week' | 'strong-ties';

const MAX_NODES = 30;

const RING_CONFIG: { statuses: PersonStatus[]; label: string; radiusFraction: number }[] = [
  { statuses: ['in-conversation'], label: 'In conversation', radiusFraction: 0.28 },
  { statuses: ['reached-out', 'waiting'], label: 'Reaching out', radiusFraction: 0.55 },
  { statuses: ['not-contacted', 'paused'], label: 'Not yet reached', radiusFraction: 0.85 },
];

function getRing(status: PersonStatus): number {
  for (let i = 0; i < RING_CONFIG.length; i++) {
    if (RING_CONFIG[i].statuses.includes(status)) return i;
  }
  return 2;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function personBelongsInOrbit(person: Person): boolean {
  // Show people as soon as they are added, including not-contacted.
  // Skip truly empty rows to avoid visual noise.
  return Boolean(person.name || person.company || person.role || person.linkedinUrl);
}

function getNodeRadius(person: Person, columns: Column[]): number {
  const strengthCol = columns.find((c) => c.name === 'Strength');
  if (strengthCol) {
    const val = person.customFields['Strength'];
    if (val === 'Strong') return 10;
    if (val === 'Weak') return 5;
  }
  return 7;
}

function getNodeOpacity(ring: number): number {
  if (ring === 0) return 1;
  if (ring === 1) return 0.8;
  return 0.5;
}

function isFollowUpDue(person: Person): boolean {
  const fd = person.customFields['Follow-up date'];
  if (!fd) return false;
  return new Date(fd) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
}

function conversationHint(person: Person): string {
  const days = daysSince(person.lastContacted);
  if (days === Infinity) return 'Not yet contacted';
  if (days <= 3) return 'Recently active';
  if (days <= 14) return 'Still warm';
  if (days <= 30) return 'Getting quiet';
  return 'A gentle nudge could help';
}

export function OrbitView({ people, columns, userName }: OrbitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<OrbitNode, undefined> | null>(null);
  const [nodes, setNodes] = useState<OrbitNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<OrbitNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<OrbitFilter>('all');
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [now] = useState(() => Date.now());
  const isHovering = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hasStrengthCol = columns.some((c) => c.name === 'Strength');
  const hasFollowUpCol = columns.some((c) => c.name === 'Follow-up date');

  const orbitPeople = useMemo(() => {
    let filtered = people.filter(personBelongsInOrbit);

    if (filter === 'due-this-week' && hasFollowUpCol) {
      const weekFromNow = new Date(now + 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((p) => {
        const fd = p.customFields['Follow-up date'];
        return fd && new Date(fd) <= weekFromNow;
      });
    } else if (filter === 'strong-ties' && hasStrengthCol) {
      filtered = filtered.filter((p) => p.customFields['Strength'] === 'Strong');
    }

    return filtered.slice(0, MAX_NODES);
  }, [people, filter, hasStrengthCol, hasFollowUpCol, now]);

  const maxRadius = Math.min(dimensions.width, dimensions.height) / 2 - 50;
  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;

  useEffect(() => {
    const newNodes: OrbitNode[] = orbitPeople.map((person, i) => {
      const ring = getRing(person.status);
      const angle = (2 * Math.PI * i) / Math.max(orbitPeople.length, 1) + Math.random() * 0.3;
      const targetR = maxRadius * RING_CONFIG[ring].radiusFraction;
      return {
        id: person.id,
        person,
        radius: getNodeRadius(person, columns),
        ring,
        opacity: getNodeOpacity(ring),
        isWaiting: person.status === 'waiting',
        isFollowUpDue: isFollowUpDue(person),
        x: cx + targetR * Math.cos(angle),
        y: cy + targetR * Math.sin(angle),
      };
    });

    if (simRef.current) simRef.current.stop();

    function driftForce() {
      const offsets = newNodes.map(() => ({
        phase: Math.random() * Math.PI * 2,
        speed: 0.001 + Math.random() * 0.0015,
        amp: 0.08 + Math.random() * 0.06,
      }));
      let tick = 0;
      return () => {
        if (isHovering.current) return;
        tick++;
        for (let i = 0; i < newNodes.length; i++) {
          const o = offsets[i];
          const t = tick * o.speed + o.phase;
          newNodes[i].vx = (newNodes[i].vx ?? 0) + Math.sin(t) * o.amp;
          newNodes[i].vy = (newNodes[i].vy ?? 0) + Math.cos(t * 0.7) * o.amp;
        }
      };
    }

    const sim = forceSimulation<OrbitNode>(newNodes)
      .force('charge', forceManyBody().strength(-15))
      .force(
        'collide',
        forceCollide<OrbitNode>().radius((d) => d.radius + 20)
      )
      .force(
        'radial',
        forceRadial<OrbitNode>(
          (d) => maxRadius * RING_CONFIG[d.ring].radiusFraction,
          cx,
          cy
        ).strength(0.8)
      )
      .force('drift', driftForce())
      .alphaDecay(0)
      .alphaTarget(0.03)
      .velocityDecay(0.65)
      .on('tick', () => {
        setNodes([...newNodes]);
      });

    if (isHovering.current) {
      sim.alphaTarget(0).stop();
    }

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [orbitPeople, columns, cx, cy, maxRadius]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const filters: { id: OrbitFilter; label: string; show: boolean }[] = [
    { id: 'all', label: 'All', show: true },
    { id: 'due-this-week', label: 'Due this week', show: hasFollowUpCol },
    { id: 'strong-ties', label: 'Strong ties', show: hasStrengthCol },
  ];
  const visibleFilters = filters.filter((f) => f.show);

  const handleCanvasEnter = useCallback(() => {
    isHovering.current = true;
    if (simRef.current) {
      simRef.current.alphaTarget(0);
    }
  }, []);

  const handleCanvasLeave = useCallback(() => {
    isHovering.current = false;
    setHoveredNode(null);
    if (simRef.current) {
      simRef.current.alphaTarget(0.03).restart();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="orbit-canvas"
      onMouseEnter={handleCanvasEnter}
      onMouseLeave={handleCanvasLeave}
    >
      {visibleFilters.length > 1 && (
        <div className="orbit-filters">
          {visibleFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`orbit-filter-btn ${filter === f.id ? 'active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        className="w-full h-full"
      >
        <defs>
          <filter id="orbit-glow-filter">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Orbit rings with labels */}
        {RING_CONFIG.map((ring, i) => {
          const r = maxRadius * ring.radiusFraction;
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="rgba(245, 158, 11, 0.12)"
                strokeWidth={1.5}
                strokeDasharray={i === 2 ? '4 6' : 'none'}
              />
              <text
                x={cx + r * Math.cos(-Math.PI / 4)}
                y={cy + r * Math.sin(-Math.PI / 4)}
                fill="rgba(255, 250, 243, 0.35)"
                fontSize={11}
                fontWeight={600}
                textAnchor="start"
                dy={-8}
              >
                {ring.label}
              </text>
            </g>
          );
        })}

        {/* Center node — the user */}
        <circle cx={cx} cy={cy} r={28} fill="rgba(245, 158, 11, 0.08)" />
        <circle cx={cx} cy={cy} r={16} fill="rgba(245, 158, 11, 0.18)" />
        <circle cx={cx} cy={cy} r={6} fill="#d97706" />
        <text
          x={cx}
          y={cy + 42}
          textAnchor="middle"
          fill="rgba(255, 250, 243, 0.7)"
          fontSize={13}
          fontWeight={600}
        >
          {userName?.split(' ')[0] || 'You'}
        </text>

        {/* People nodes */}
        {nodes.map((node) => {
          const dimmed = hoveredNode && hoveredNode.id !== node.id;
          const nodeX = node.x ?? 0;
          const nodeY = node.y ?? 0;
          const nameRight = nodeX > cx;

          return (
            <g
              key={node.id}
              className="orbit-node"
              transform={`translate(${nodeX}, ${nodeY})`}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
              opacity={dimmed ? node.opacity * 0.3 : node.opacity}
            >
              {/* Follow-up due glow */}
              {node.isFollowUpDue && (
                <circle
                  r={node.radius + 6}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  className="orbit-glow"
                  filter="url(#orbit-glow-filter)"
                />
              )}

              {/* Waiting pulse */}
              {node.isWaiting && (
                <circle
                  r={node.radius + 4}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1}
                  className="orbit-pulse"
                />
              )}

              {/* Main node */}
              <circle r={node.radius} fill="#d97706" />
              <circle r={node.radius * 0.4} fill="rgba(255, 255, 255, 0.15)" />

              {/* Name label */}
              <text
                x={nameRight ? node.radius + 6 : -(node.radius + 6)}
                y={4}
                textAnchor={nameRight ? 'start' : 'end'}
                fill={dimmed ? 'rgba(255, 250, 243, 0.15)' : 'rgba(255, 250, 243, 0.55)'}
                fontSize={11}
                fontWeight={500}
              >
                {node.person.name || node.person.company || '?'}
              </text>
            </g>
          );
        })}
      </svg>

      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            className="orbit-tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            style={{
              left: Math.min(mousePos.x + 12, dimensions.width - 200),
              top: mousePos.y - 10,
            }}
          >
            <div className="orbit-tooltip-name">{hoveredNode.person.name || 'No name'}</div>
            {hoveredNode.person.company && (
              <div className="orbit-tooltip-detail">{hoveredNode.person.company}</div>
            )}
            {hoveredNode.person.role && (
              <div className="orbit-tooltip-detail">{hoveredNode.person.role}</div>
            )}
            <div className="orbit-tooltip-status">
              {STATUS_LABELS[hoveredNode.person.status]}
              {hoveredNode.person.lastContacted ? ` · ${conversationHint(hoveredNode.person)}` : ''}
            </div>
            {hoveredNode.person.customFields['Next action'] && (
              <div className="orbit-tooltip-detail" style={{ marginTop: '0.25rem' }}>
                Next: {hoveredNode.person.customFields['Next action']}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'rgba(255, 250, 243, 0.4)' }}>
            {filter !== 'all'
              ? 'No one matches this filter.'
              : 'People will appear here as you add them.'}
          </p>
        </div>
      )}
    </div>
  );
}
