'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TopologyData, TopologyNode } from '@/hooks/useNetwork';

interface SimNode extends TopologyNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface SimLink {
  source: string;
  target: string;
  type: string;
}

const CANVAS_W = 800;
const CANVAS_H = 600;
const REPULSION = 8000;
const ATTRACTION = 0.005;
const DAMPING = 0.85;
const CENTER_GRAVITY = 0.01;
const MIN_RADIUS = 18;
const MAX_RADIUS = 28;

function getNodeRadius(node: TopologyNode): number {
  if (node.isGateway) return MAX_RADIUS;
  if (node.isLocal) return MAX_RADIUS - 2;
  if (node.hostname) return MIN_RADIUS + 4;
  return MIN_RADIUS;
}

function getNodeColor(node: TopologyNode): string {
  if (node.isGateway) return '#f59e0b';
  if (node.isLocal) return '#3b82f6';
  if (!node.reachable) return '#6b7280';
  if (node.vendor) return '#22d3ee';
  return '#8b5cf6';
}

export function NetworkMap({
  topology,
  onNodeClick,
}: {
  topology: TopologyData | null;
  onNodeClick?: (node: TopologyNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const initSimulation = useCallback(() => {
    if (!topology) return;

    const nodeMap = new Map<string, TopologyNode>();
    topology.nodes.forEach((n) => nodeMap.set(n.id, n));

    const simNodes: SimNode[] = topology.nodes.map((n, i) => {
      const radius = getNodeRadius(n);
      const angle = (2 * Math.PI * i) / topology.nodes.length;
      const dist = 120 + Math.random() * 80;
      return {
        ...n,
        x: CANVAS_W / 2 + Math.cos(angle) * dist,
        y: CANVAS_H / 2 + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius,
      };
    });

    const simLinks: SimLink[] = topology.links.map((l) => ({
      source: l.source,
      target: l.target,
      type: l.type,
    }));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;
  }, [topology]);

  useEffect(() => {
    initSimulation();
  }, [initSimulation]);

  useEffect(() => {
    if (!topology || topology.nodes.length === 0) return;

    let running = true;

    const tick = () => {
      if (!running) return;
      const nodes = nodesRef.current;
      const links = linksRef.current;

      if (nodes.length === 0) {
        animRef.current = requestAnimationFrame(tick);
        return;
      }

      const nodeMap = new Map<string, number>();
      nodes.forEach((n, i) => nodeMap.set(n.id, i));

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          let dx = n.x - m.x;
          let dy = n.y - m.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) dist = 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          n.vx += fx;
          n.vy += fy;
          m.vx -= fx;
          m.vy -= fy;
        }

        const cdx = CANVAS_W / 2 - n.x;
        const cdy = CANVAS_H / 2 - n.y;
        n.vx += cdx * CENTER_GRAVITY;
        n.vy += cdy * CENTER_GRAVITY;
      }

      for (const link of links) {
        const si = nodeMap.get(link.source);
        const ti = nodeMap.get(link.target);
        if (si === undefined || ti === undefined) continue;
        const s = nodes[si];
        const t = nodes[ti];
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) continue;
        const force = (dist - 100) * ATTRACTION;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      for (const n of nodes) {
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(n.radius, Math.min(CANVAS_W - n.radius, n.x));
        n.y = Math.max(n.radius, Math.min(CANVAS_H - n.radius, n.y));
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [topology]);

  const nodeMap = new Map<string, SimNode>();
  nodesRef.current.forEach((n) => nodeMap.set(n.id, n));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        className="w-full h-[500px] rounded-xl"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.15)" />
          </marker>
        </defs>

        {linksRef.current.map((link, i) => {
          const s = nodeMap.get(link.source);
          const t = nodeMap.get(link.target);
          if (!s || !t) return null;
          return (
            <line
              key={`link-${i}`}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={link.type === 'gateway' ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}
              strokeWidth={link.type === 'gateway' ? 2 : 1}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {nodesRef.current.map((node) => {
          const color = getNodeColor(node);
          return (
            <g
              key={node.id}
              onMouseEnter={(e) => {
                setHoveredNode(node);
                setTooltipPos({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onNodeClick?.(node)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill={`${color}22`}
                stroke={color}
                strokeWidth={2}
              />
              <text
                x={node.x}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.9)"
                fontSize={node.radius > 22 ? 10 : 8}
                fontFamily="system-ui"
              >
                {node.ip.split('.').pop()}
              </text>
              <text
                x={node.x}
                y={node.y + node.radius + 14}
                textAnchor="middle"
                fill="rgba(255,255,255,0.5)"
                fontSize={10}
                fontFamily="system-ui"
              >
                {node.label.length > 16 ? node.label.slice(0, 16) + '...' : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredNode && (
        <div
          className="fixed z-50 bg-surface-900/95 backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 shadow-dialog pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
        >
          <p className="text-sm font-medium text-white">{hoveredNode.label}</p>
          <p className="text-xs text-white/50 mt-0.5">IP: {hoveredNode.ip}</p>
          {hoveredNode.mac && <p className="text-xs text-white/50">MAC: {hoveredNode.mac}</p>}
          {hoveredNode.vendor && <p className="text-xs text-white/50">Vendor: {hoveredNode.vendor}</p>}
          {hoveredNode.latencyMs != null && (
            <p className="text-xs text-white/50">Latency: {hoveredNode.latencyMs.toFixed(1)}ms</p>
          )}
          <div className="flex gap-2 mt-1.5">
            {hoveredNode.isGateway && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Gateway</span>}
            {hoveredNode.isLocal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-400">This Device</span>}
          </div>
        </div>
      )}
    </div>
  );
}
