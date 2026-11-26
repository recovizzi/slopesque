// The gradient (openspec: poll-activity): the slider between 2 propositions (1D), or the polygon whose corners are 3
// or more (2D), with the answers' dots and, once revealed, the heatmap of the answers. With `onPick`, a click places
// a point (`data-gradient`, focusable).
import type { CSSProperties, MouseEvent } from 'react';
import { Poll } from '@slopesque/engines';
import { cls } from '../../design';
import { heatmapUrl } from './heatmap';
import {
  dotRadius,
  fx,
  labelPlaces,
  LINE,
  polygonPoints,
  propositionName,
  SHAPE,
  short,
  toSvg,
  type Point,
} from './model';

export interface Dot {
  at: Point;
  color: string;
  kind: 'player' | 'mine' | 'pending';
  /** Who gave it, on hover (results that aren't secret). */
  names?: string;
}
export interface GradientProps {
  choices: string[];
  dots?: Dot[];
  /** The answers whose heatmap is drawn (the results). */
  heat?: Point[];
  onPick?: (p: Point) => void;
}

export function Gradient({ choices, dots = [], heat, onPick }: GradientProps) {
  const n = choices.length,
    one = n === 2;
  // the heatmap's clip, named by its shape: several gradients on a page (polls in the chat) each find theirs (an id is
  // page-wide: a shared « g-clip » clipped a triangle's heat by the slider of a poll above it)
  const clip = `g-clip-${n}`;
  const heatUrl = heat ? heatmapUrl(n, heat) : null;
  const pick = (e: MouseEvent<SVGSVGElement>) => {
    const m = e.currentTarget.getScreenCTM();
    if (!m || !onPick) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const at = Poll.fromSvg(n, p.x, p.y);
    if (at) onPick(at);
  };
  const labels = labelPlaces(n).map((l, i) => (
    <text key={`label-${i}`} className="g-label" x={fx(l.x)} y={fx(l.y)} textAnchor={l.anchor} data-label={i}>
      {short(propositionName(choices, i))}
      <title>{choices[i]}</title>
    </text>
  ));
  const marks = dots.map((d, k) => {
    const [x, y] = toSvg(n, d.at);
    return (
      <circle
        key={`dot-${k}`}
        className={`g-dot is-${d.kind}`}
        cx={fx(x)}
        cy={fx(y)}
        r={dotRadius(n)}
        style={{ '--c': d.color } as CSSProperties}
        data-names={d.names}
      />
    );
  });
  const svg = {
    className: cls('gradient', one ? 'g1' : 'g2', onPick && 'is-pick'),
    viewBox: one ? '0 0 300 50' : '0 0 300 190',
    ...(onPick ? { 'data-gradient': '', tabIndex: 0, onClick: pick } : {}),
    role: 'img',
    'aria-label': `Gradient entre ${choices.join(', ')}`,
  };

  if (one) {
    const band = { x: LINE.x0, y: LINE.y - 7, width: LINE.x1 - LINE.x0, height: 14 };
    return (
      <svg {...svg}>
        <defs>
          <clipPath id={clip}>
            <rect {...band} rx={7} />
          </clipPath>
        </defs>
        <rect className="g-track" {...band} rx={7} />
        {heatUrl && <image href={heatUrl} {...band} preserveAspectRatio="none" clipPath={`url(#${clip})`} />}
        <line className="g-mid" x1={150} y1={LINE.y - 10} x2={150} y2={LINE.y + 10} />
        {labels}
        {marks}
      </svg>
    );
  }
  const pts = polygonPoints(n),
    corners = Poll.corners(n).map(p => toSvg(n, p));
  const box = { x: SHAPE.cx - SHAPE.r, y: SHAPE.cy - SHAPE.r, width: 2 * SHAPE.r, height: 2 * SHAPE.r };
  return (
    <svg {...svg}>
      <defs>
        <clipPath id={clip}>
          <polygon points={pts} />
        </clipPath>
      </defs>
      <polygon className="g-shape" points={pts} />
      {corners.map(([x, y], i) => (
        <line key={`spoke-${i}`} className="g-spoke" x1={SHAPE.cx} y1={SHAPE.cy} x2={fx(x)} y2={fx(y)} />
      ))}
      {heatUrl && <image href={heatUrl} {...box} preserveAspectRatio="none" clipPath={`url(#${clip})`} />}
      <polygon className="g-outline" points={pts} />
      {corners.map(([x, y], i) => (
        <circle key={`corner-${i}`} className="g-corner" cx={fx(x)} cy={fx(y)} r={2.5} />
      ))}
      {labels}
      {marks}
    </svg>
  );
}
