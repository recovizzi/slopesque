// The Amphithéâtre (openspec: amphitheatre-mode): the tribune, the host's column as a band once the round started,
// the 175 seats (in the player's colour once taken, mine not validated yet dashed). While I may pick, the column
// (host) or the free seat (candidate) under the pointer lights up — or under the keyboard: ← → columns, ↑ ↓ rows,
// Home / End, Enter. The geometry is amphi-model.ts; this component only draws it and turns the pointer into a seat.
import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cls } from '../../design';
import {
  columnBand,
  inColumn,
  isHover,
  pickOf,
  SEAT_PATHS,
  seatAt,
  seatClass,
  seatKey,
  slackOf,
  TRIBUNE,
  type AmphiPick,
  type ColumnMark,
  type SeatMark,
} from './amphi-model';
import { VIEWBOX } from './model';
import { svgPoint } from './svg-point';

export interface AmphiBoardProps {
  /** What I may pick: a column (the host), a free seat (a candidate), nothing. */
  pick: AmphiPick;
  column: ColumnMark | null;
  marks: SeatMark[];
  /** Another board is shown (the half disk). */
  hidden?: boolean;
  onPick: (n: number) => void;
}

const Seat = memo(function Seat(p: { n: number; className: string; color?: string; hc?: string; label?: string }) {
  const style = { ...(p.color && { '--c': p.color }), ...(p.hc && { '--hc': p.hc }) } as CSSProperties;
  return (
    <path d={SEAT_PATHS[p.n]} className={p.className} data-seat={p.n} style={style}>
      {p.label && <title>{p.label}</title>}
    </path>
  );
});

export function AmphiBoard({ pick: mode, column, marks, hidden, onPick }: AmphiBoardProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null); // the seat under the pointer, or the keyboard's
  useEffect(() => {
    if (!mode) setHover(null);
  }, [mode]);
  const taken = new Set(marks.filter(m => m.kind === 'player').map(m => m.seat));
  const bySeat = new Map(marks.map(m => [m.seat, m]));

  const at = (e: { clientX: number; clientY: number }) => {
    const p = svg.current && svgPoint(svg.current, e);
    return p ? seatAt(p.x, p.y, slackOf(mode)) : null; // a column can be picked a bit outside the seats
  };
  const pick = (s: number) => {
    const v = pickOf(mode, s, taken);
    if (v !== null) onPick(v);
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!mode) return;
    const k = seatKey(e.key, mode, hover);
    if (!k) return;
    e.preventDefault();
    if ('pick' in k) pick(k.pick);
    else setHover(k.move);
  };

  const band = column?.style === 'band' ? columnBand(column.col) : null;
  return (
    <svg
      ref={svg}
      viewBox={VIEWBOX}
      className={cls('board amphi', mode && 'is-interactive')}
      role="grid"
      aria-label="Amphithéâtre"
      data-pick={mode ?? ''}
      tabIndex={mode ? 0 : undefined}
      {...(hidden ? { hidden: true } : {})} // the CSS hides a board by its attribute (.board[hidden])
      onPointerMove={e => mode && setHover(at(e))}
      onPointerLeave={() => setHover(null)}
      onClick={e => {
        const s = mode ? at(e) : null;
        if (s !== null) pick(s);
      }}
      onKeyDown={onKeyDown}
    >
      <path d={TRIBUNE} className="tribune" />
      <g className="col-band" style={band ? ({ '--hc': column!.color } as CSSProperties) : undefined}>
        {band && (
          <>
            <path d={band.band} className="band" />
            {band.caps.map((d, i) => (
              <path key={i} d={d} className="cap" />
            ))}
          </>
        )}
      </g>
      <g className="seats">
        {SEAT_PATHS.map((_, i) => {
          const m = bySeat.get(i);
          return (
            <Seat
              key={i}
              n={i}
              className={seatClass(i, column, m, taken.has(i), isHover(mode, hover, i, taken))}
              color={m?.color}
              hc={inColumn(i, column) ? column!.color : undefined}
              label={m?.label}
            />
          );
        })}
      </g>
    </svg>
  );
}
