// The half disk (openspec: semicircle-disk): its fill, the graduations, the rays (the host's as a wedge as wide as
// its tolerance, the players' as lines ending with a dot, mine on top), the outline and the hub. While I may pick,
// a dashed ray follows the pointer (or the keyboard: ← → , Shift by 5, Home / End, Enter) and a click places mine.
// The geometry is model.ts; this component only draws it and turns the pointer into a value.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cls } from '../../design';
import { CX, CY, drawOrder, OUTLINE, rayKey, rayShape, spoke, TICKS, valueAt, VIEWBOX, wedge, type Ray } from './model';
import { svgPoint } from './svg-point';

export interface DiskBoardProps {
  rays: Ray[];
  /** The target's tolerance, in value units (± around it): its drawn thickness and the « perfect » zone. */
  tolerance: number;
  /** I may place my ray (a click, or the keyboard). */
  interactive: boolean;
  /** Another board is shown (the Amphithéâtre). */
  hidden?: boolean;
  onPick: (value: number) => void;
}

const tint = (color: string) => ({ '--c': color }) as CSSProperties;

export function DiskBoard({ rays, tolerance, interactive, hidden, onPick }: DiskBoardProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [ghost, setGhost] = useState<number | null>(null);
  const current = useRef<number | null>(null); // the keyboard's position: mine, or the last one picked
  const mine = rays.find(r => r.kind === 'mine');
  useEffect(() => {
    if (mine) current.current = mine.value;
  }, [mine?.value]);
  useEffect(() => {
    if (!interactive) setGhost(null);
  }, [interactive]);

  const at = (e: { clientX: number; clientY: number }) => {
    const p = svg.current && svgPoint(svg.current, e);
    return p ? valueAt(p.x, p.y) : null;
  };
  const pick = (v: number) => {
    current.current = v;
    setGhost(null);
    onPick(v);
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const k = rayKey(e.key, e.shiftKey, current.current);
    if (!k) return;
    e.preventDefault();
    if ('pick' in k) return pick(k.pick);
    current.current = k.move;
    setGhost(k.move);
  };

  const { targets, others } = drawOrder(rays);
  return (
    <svg
      ref={svg}
      viewBox={VIEWBOX}
      className={cls('disk board', interactive && 'is-interactive')}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={mine?.value}
      aria-label="Position sur le demi-disque"
      tabIndex={interactive ? 0 : undefined}
      {...(hidden ? { hidden: true } : {})} // the CSS hides a board by its attribute (.board[hidden])
      onPointerMove={e => interactive && setGhost(at(e))}
      onPointerLeave={() => setGhost(null)}
      onClick={e => {
        const v = interactive ? at(e) : null;
        if (v !== null) pick(v);
      }}
      onKeyDown={onKeyDown}
    >
      <path d={OUTLINE} className="disk-fill" />
      <g className="disk-ticks">
        {TICKS.map((t, i) => (
          <line key={i} {...t} />
        ))}
      </g>
      <g className="disk-rays">
        {targets.map((r, i) => (
          <g key={`t${i}`} className="ray ray-target" style={tint(r.color)}>
            <path d={wedge(r.value - tolerance, r.value + tolerance)} />
            <line {...spoke(r.value)} />
          </g>
        ))}
        {others.map(r => {
          const s = rayShape(r);
          return (
            <g key={r.id} className={`ray ray-${r.kind}`} style={tint(r.color)}>
              <line {...s.line} />
              <circle {...s.dot} />
              {r.label && <title>{r.label}</title>}
            </g>
          );
        })}
      </g>
      <g className="disk-ghost">{interactive && ghost !== null && <line {...spoke(ghost)} />}</g>
      <path d={OUTLINE} className="disk-outline" />
      <circle cx={CX} cy={CY} r={3.5} className="disk-hub" />
    </svg>
  );
}
