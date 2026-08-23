'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
const RESIZE_DEBOUNCE_MS = 150;

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
  // Last known position of every node, so a rebuild (new person, status change, resize)
  // doesn't teleport the ones that were already on screen.
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const [nodes, setNodes] = useState<OrbitNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<OrbitNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<OrbitFilter>('all');
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [now] = useState(() => Date.now());
  const isHovering = useRef(false);
  const reducedMotion = useReducedMotion();

  // Track the canvas size, debounced so a window drag doesn't rebuild the simulation per frame.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: number | undefined;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width <= 0 || height <= 0) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setDimensions({ width, height }), RESIZE_DEBOUNCE_MS);
    });
    obs.observe(el);
    return () => {
      window.clearTimeout(timer);
      obs.disconnect();
    };
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

  // Fresh person data for labels and tooltips. Nodes are only rebuilt when the layout changes
  // (layoutKey below), so an edited name, company or "Next action" must not wait for that.
  const personById = useMemo(() => new Map(orbitPeople.map((p) => [p.id, p])), [orbitPeople]);
  const livePerson = (node: OrbitNode): Person => personById.get(node.id) ?? node.person;

  const maxRadius = Math.min(dimensions.width, dimensions.height) / 2 - 50;
  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;

  // What the simulation actually depends on: who is shown and which ring/size they get.
  // `people` changes identity on every router.refresh(); this key only changes when that matters.
  const layoutKey = useMemo(
    () =>
      orbitPeople
        .map(
          (p) =>
            `${p.id}:${getRing(p.status)}:${getNodeRadius(p, columns)}:${p.status === 'waiting' ? 1 : 0}:${isFollowUpDue(p) ? 1 : 0}`
        )
        .join('|'),
    [orbitPeople, columns]
  );
  const peopleRef = useRef(orbitPeople);
  useEffect(() => {
    peopleRef.current = orbitPeople;
  }, [orbitPeople]);
  const columnsRef = useRef(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    const people = peopleRef.current;
    const cols = columnsRef.current;
    const newNodes: OrbitNode[] = people.map((person, i) => {
      const ring = getRing(person.status);
      const angle = (2 * Math.PI * i) / Math.max(people.length, 1) + Math.random() * 0.3;
      const targetR = maxRadius * RING_CONFIG[ring].radiusFraction;
      const previous = positionsRef.current.get(person.id);
      return {
        id: person.id,
        person,
        radius: getNodeRadius(person, cols),
        ring,
        opacity: getNodeOpacity(ring),
        isWaiting: person.status === 'waiting',
        isFollowUpDue: isFollowUpDue(person),
        x: previous?.x ?? cx + targetR * Math.cos(angle),
        y: previous?.y ?? cy + targetR * Math.sin(angle),
      };
    });

    if (simRef.current) simRef.current.stop();

    // A little organic drift while the simulation is still warm; it stops with the simulation.
    function driftForce() {
      const offsets = newNodes.map(() => ({
        phase: Math.random() * Math.PI * 2,
        speed: 0.001 + Math.random() * 0.0015,
        amp: 0.08 + Math.random() * 0.06,
      }));
      let tick = 0;
      return () => {
        tick++;
        for (let i = 0; i < newNodes.length; i++) {
          const o = offsets[i];
          const t = tick * o.speed + o.phase;
          newNodes[i].vx = (newNodes[i].vx ?? 0) + Math.sin(t) * o.amp;
          newNodes[i].vy = (newNodes[i].vy ?? 0) + Math.cos(t * 0.7) * o.amp;
        }
      };
    }

    // Default alphaDecay, so the layout settles and the simulation stops ticking (alphaMin)
    // instead of re-rendering ~60×/s for as long as the view is mounted.
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
      .force('drift', reducedMotion ? null : driftForce())
      .velocityDecay(0.65);

    // Remember positions (for the next rebuild) and hand the nodes to React.
    const publish = () => {
      for (const node of newNodes) {
        if (node.x !== undefined && node.y !== undefined) {
          positionsRef.current.set(node.id, { x: node.x, y: node.y });
        }
      }
      setNodes([...newNodes]);
    };
    sim.on('tick', publish);

    if (reducedMotion) {
      // Settle synchronously and render the final layout once.
      sim.stop();
      sim.tick(300);
    } else if (isHovering.current) {
      sim.stop();
    }
    // Render the seeded layout right away — the first animation frame can be a while off
    // (background tab, lazy mount), and an empty canvas reads as "no people".
    publish();

    simRef.current = sim;

    return () => {
      sim.stop();
    };
    // layoutKey captures every input the layout depends on (see above).
  }, [layoutKey, cx, cy, maxRadius, reducedMotion]);

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

  // Hovering freezes the layout so nodes hold still under the cursor; leaving lets it
  // settle again briefly and stop.
  const handleCanvasEnter = useCallback(() => {
    isHovering.current = true;
    simRef.current?.stop();
  }, []);

  const handleCanvasLeave = useCallback(() => {
    isHovering.current = false;
    setHoveredNode(null);
    if (!reducedMotion) simRef.current?.alphaTarget(0).alpha(0.15).restart();
  }, [reducedMotion]);

  const focusNode = useCallback((node: OrbitNode) => {
    setHoveredNode(node);
    setMousePos({ x: (node.x ?? 0) + 12, y: (node.y ?? 0) - 10 });
  }, []);

  const hoveredPerson = hoveredNode ? livePerson(hoveredNode) : null;

  return (
    <div
      ref={containerRef}
      className="orbit-canvas"
      onMouseEnter={handleCanvasEnter}
      onMouseLeave={handleCanvasLeave}
    >
      {visibleFilters.length > 1 && (
        <div className="orbit-filters" role="group" aria-label="Filter people">
          {visibleFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
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
        role="img"
        aria-label={`Orbit view: ${nodes.length} ${nodes.length === 1 ? 'person' : 'people'} arranged by how close the conversation is`}
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
          const person = livePerson(node);
          const label = person.name || person.company || '?';

          return (
            <g
              key={node.id}
              className="orbit-node"
              transform={`translate(${nodeX}, ${nodeY})`}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              onFocus={() => focusNode(node)}
              onBlur={() => setHoveredNode(null)}
              tabIndex={0}
              role="button"
              aria-label={`${label} — ${STATUS_LABELS[person.status]}`}
              style={{ cursor: 'pointer', outline: 'none' }}
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
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <AnimatePresence>
        {hoveredNode && hoveredPerson && (
          <motion.div
            className="orbit-tooltip"
            role="tooltip"
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 4 }}
            style={{
              left: Math.min(mousePos.x + 12, dimensions.width - 200),
              top: mousePos.y - 10,
            }}
          >
            <div className="orbit-tooltip-name">{hoveredPerson.name || 'No name'}</div>
            {hoveredPerson.company && (
              <div className="orbit-tooltip-detail">{hoveredPerson.company}</div>
            )}
            {hoveredPerson.role && <div className="orbit-tooltip-detail">{hoveredPerson.role}</div>}
            <div className="orbit-tooltip-status">
              {STATUS_LABELS[hoveredPerson.status]}
              {hoveredPerson.lastContacted ? ` · ${conversationHint(hoveredPerson)}` : ''}
            </div>
            {hoveredPerson.customFields['Next action'] && (
              <div className="orbit-tooltip-detail" style={{ marginTop: '0.25rem' }}>
                Next: {hoveredPerson.customFields['Next action']}
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
              : people.length > 0
                ? 'No one matches your search.'
                : 'People will appear here as you add them.'}
          </p>
        </div>
      )}
    </div>
  );
}
