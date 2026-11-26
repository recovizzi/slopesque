// The wheel (openspec: roulette-activity): one sector per proposition, sized by its share, with its name and share
// when it is wide enough; the winner highlighted after a draw. During a draw the needle spins fast, slows down and
// stops on the drawn angle, from where the last draw left it: the same motion for everyone (the start is the server's
// time, whatever this device's clock). The motion is drawn outside React, on the needle's transform, each frame.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cls } from '../../design';
import { C, f, itemColor, needleAt, needleTip, NEEDLE, R, sectors, type Spin, type WheelItem } from './model';

export interface WheelProps {
  items: WheelItem[];
  winner: number | null;
  /** The draw to show; null: the needle stays where it stopped. */
  spin: Spin | null;
  /** The server's time minus this device's (ms). */
  skew: number;
}

export function Wheel({ items, winner, spin, skew }: WheelProps) {
  const svg = useRef<SVGSVGElement>(null),
    needle = useRef<SVGGElement>(null);
  const [spinning, setSpinning] = useState(false);
  const turn = (deg: number) => {
    needle.current?.setAttribute('transform', `rotate(${f(deg)} ${C} ${C})`);
    if (svg.current) svg.current.dataset.angle = f(deg);
  };
  useEffect(() => turn(0), []); // the needle up, until a draw
  // a draw is known by its start, angle and origin: the room's state sent again (a new object of the same draw) doesn't
  // start the motion again
  const draw = spin && `${spin.at}|${spin.angle}|${spin.from}`;
  useEffect(() => {
    if (!spin) return;
    let frame = 0;
    const step = () => {
      const { deg, done } = needleAt(spin, Date.now() + skew);
      turn(deg);
      setSpinning(!done);
      if (!done) frame = requestAnimationFrame(step);
    };
    step();
    return () => {
      cancelAnimationFrame(frame);
      setSpinning(false);
    };
  }, [draw]);

  return (
    <svg
      ref={svg}
      viewBox="-4 -4 208 208"
      className={cls('wheel', winner !== null && 'has-winner', spinning && 'is-spinning')}
      role="img"
      aria-label="Roulette"
    >
      <circle cx={C} cy={C} r={R} className="wheel-bg" />
      <g className="wheel-sectors">
        {sectors(items).map(s => (
          <g
            key={s.i}
            className={cls('sector', s.i === winner && 'is-winner')}
            style={{ '--c': itemColor(s.i) } as CSSProperties}
            data-i={s.i}
          >
            {s.path ? <path d={s.path} /> : <circle cx={C} cy={C} r={R} />}
            {s.label && (
              <>
                <text x={s.label.x} y={s.label.y} className="sector-label">
                  {s.label.text}
                </text>
                <text x={s.label.x} y={s.label.pctY} className="sector-pct">
                  {s.label.pct}
                </text>
              </>
            )}
          </g>
        ))}
      </g>
      <circle cx={C} cy={C} r={R} className="wheel-rim" />
      <g ref={needle} className="wheel-needle">
        <line x1={C} y1={C} x2={C} y2={C - NEEDLE} />
        <path d={needleTip()} className="needle-tip" />
        <circle cx={C} cy={C} r={7} className="hub" />
      </g>
    </svg>
  );
}
