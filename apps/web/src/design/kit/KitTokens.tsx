// ?kit: the tokens (design/tokens.css) — colours, radii, shadows, text sizes — and every icon.
import { Icon } from '../Icon';
import { ICONS, type IconName } from '../icons';
import { Section } from './Section';

const COLORS = [
  '--bg',
  '--surface',
  '--surface-2',
  '--text',
  '--muted',
  '--border',
  '--accent',
  '--accent-text',
  '--danger',
];
const FIXED = [
  '--disk-fill',
  '--on-color',
  '--paper',
  '--ink',
  '--ok',
  '--ok-text',
  '--warn',
  '--wait',
  '--crown',
  '--star',
  '--backdrop',
];
const RADII = [
  '--radius-xs',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius',
  '--radius-xl',
  '--radius-2xl',
  '--radius-pill',
];
const SHADOWS = ['--shadow-sm', '--shadow-pop', '--shadow'];
const TEXT = [
  '--text-2xs',
  '--text-xs',
  '--text-sm',
  '--text-md',
  '--text-base',
  '--text-lg',
  '--text-xl',
  '--text-2xl',
];

const Swatch = ({ name }: { name: string }) => (
  <span className="kit-swatch">
    <span style={{ background: `var(${name})` }} />
    {name}
  </span>
);

export function KitTokens() {
  return (
    <>
      <Section title="Couleurs">
        <div className="kit-row">
          {COLORS.map(c => (
            <Swatch key={c} name={c} />
          ))}
        </div>
        <div className="kit-row">
          {FIXED.map(c => (
            <Swatch key={c} name={c} />
          ))}
        </div>
      </Section>
      <Section title="Rayons, ombres, textes">
        <div className="kit-row">
          {RADII.map(r => (
            <span key={r} className="kit-box" style={{ borderRadius: `var(${r})` }}>
              {r.slice(9) || 'radius'}
            </span>
          ))}
        </div>
        <div className="kit-row">
          {SHADOWS.map(s => (
            <span key={s} className="kit-box" style={{ boxShadow: `var(${s})` }}>
              {s.slice(9) || 'shadow'}
            </span>
          ))}
        </div>
        <div className="kit-row">
          {TEXT.map(t => (
            <span key={t} style={{ fontSize: `var(${t})` }}>
              {t.slice(7)} Aa
            </span>
          ))}
        </div>
      </Section>
      <Section title="Icon">
        <div className="kit-icons">
          {(Object.keys(ICONS) as IconName[]).map(n => (
            <div key={n}>
              <Icon name={n} />
              {n}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
