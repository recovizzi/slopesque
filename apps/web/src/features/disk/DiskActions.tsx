// Under the board, what my role does in each phase of a round (openspec: round-flow): the host writes his word and
// launches the round once his answer is placed; a candidate validates his ray or seat; a spectator may join; then
// everyone sees the results (the host's points: the candidates' average).
import { useState, type CSSProperties } from 'react';
import { hueColor } from '@slopesque/engines';
import type { DiskView, MemberView } from '@slopesque/shared';
import { Button, Chip, Dot, Icon, TextInput, Who } from '../../design';
import { gapText, rankedResults, type Mode, type Role } from './round-model';

/** An intent of the Demi-disque, its error shown under the actions; true when accepted. */
export type Send = (name: 'disk:start' | 'disk:guess' | 'disk:join' | 'disk:next', body?: object) => Promise<boolean>;

interface Props {
  d: DiskView;
  role: Role;
  me: string;
  mode: Mode;
  pick: number | null;
  host?: MemberView;
  members: MemberView[];
  send: Send;
}

export function DiskActions(p: Props) {
  if (p.d.phase === 'lobby' || p.d.phase === 'writing')
    return p.role === 'host' ? <HostWord {...p} /> : <Waiting {...p} />;
  if (p.d.phase === 'guessing') return <Guessing {...p} />;
  return <Results {...p} />;
}

const Join = ({ send }: { send: Send }) => (
  <Button size="big" onClick={() => void send('disk:join')}>
    Participer
  </Button>
);

/** The host's word, launched once his ray (or column) is placed on the board. */
function HostWord({ mode, pick, send }: Props) {
  const [word, setWord] = useState('');
  return (
    <form
      className="actions"
      onSubmit={async e => {
        e.preventDefault();
        if (pick === null || !word.trim()) return;
        if (await send('disk:start', { word: word.trim(), target: pick })) setWord('');
      }}
    >
      <div className="word-row">
        <TextInput
          className="word-input"
          name="word"
          placeholder="Ton mot"
          maxLength={40}
          autoComplete="off"
          value={word}
          onChange={e => setWord(e.target.value)}
        />
        <Button type="submit" disabled={!word.trim() || pick === null}>
          Lancer le tour
        </Button>
      </div>
      <p className="hint">
        {mode === 'amphi'
          ? 'Écris un mot, puis clique sur une colonne de sièges pour placer ta réponse.'
          : 'Écris un mot, puis clique dans le demi-disque pour placer ton rayon.'}
      </p>
    </form>
  );
}

function Waiting({ role, host, send }: Props) {
  return (
    <div className="actions">
      <p className="hint">
        {host ? (
          <>
            <Who name={host.name} hue={host.hue} /> choisit un mot…
          </>
        ) : (
          "En attente d'un hôte…"
        )}
      </p>
      {role === 'spectator' && <Join send={send} />}
    </div>
  );
}

/** Who has validated, among the candidates. */
function Chips({ d, members, host }: Props) {
  return (
    <ul className="chips">
      {members
        .filter(m => m.playing && m.id !== host?.id)
        .map(m => (
          <Chip key={m.id} color={hueColor(m.hue)} done={m.id in d.guesses}>
            {m.name}
          </Chip>
        ))}
    </ul>
  );
}

function Guessing(p: Props) {
  const { d, role, me, mode, pick, send } = p;
  const thing = mode === 'amphi' ? 'siège' : 'rayon';
  const word = <div className="word">« {d.word} »</div>;
  if (role !== 'candidate')
    return (
      <div className="actions">
        {word}
        <p className="hint">Les candidats choisissent leur {thing}…</p>
        <Chips {...p} />
        {role === 'spectator' && <Join send={send} />}
      </div>
    );
  return (
    <div className="actions">
      {word}
      {me in d.guesses ? (
        <p className="hint">{mode === 'amphi' ? 'Siège validé' : 'Rayon validé'}. En attente des autres…</p>
      ) : (
        <>
          <Button size="big" disabled={pick === null} onClick={() => void send('disk:guess', { value: pick })}>
            Valider mon {thing}
          </Button>
          <p className="hint">
            {mode === 'amphi'
              ? 'Clique sur un siège libre : où places-tu ce mot ?'
              : 'Clique dans le demi-disque : où places-tu ce mot ?'}
          </p>
        </>
      )}
      <Chips {...p} />
    </div>
  );
}

const tint = (hue: number) => ({ '--c': hueColor(hue) }) as CSSProperties;

/** The reveal: each candidate's points (best first), the host's, then the next round. */
function Results({ d, role, me, mode, host, members, send }: Props) {
  const rows = rankedResults(d);
  return (
    <div className="actions">
      <div className="word">« {d.word} »</div>
      <ul className="results">
        {rows.length ? (
          rows.map(([id, r]) => {
            const m = members.find(x => x.id === id);
            return (
              <li key={id} className="result" style={tint(m?.hue ?? 0)}>
                <Dot color={hueColor(m?.hue ?? 0)} />
                <span>{id === me ? 'Toi' : (m?.name ?? '?')}</span>
                <small>{gapText(mode, r.distance)}</small>
                {r.perfect && <span className="perfect">PERFECT</span>}
                <b>+{r.points}</b>
              </li>
            );
          })
        ) : (
          <li className="hint">Personne n'a validé.</li>
        )}
        {host && (
          <li className="result result-host" style={tint(host.hue)}>
            <Dot color={hueColor(host.hue)} />
            <span>
              {host.name}{' '}
              <span className="crown">
                <Icon name="crown" />
              </span>
            </span>
            <small>moyenne des candidats</small>
            <b>+{d.hostPoints ?? 0}</b>
          </li>
        )}
      </ul>
      {role === 'host' ? (
        <Button size="big" onClick={() => void send('disk:next')}>
          Tour suivant
        </Button>
      ) : (
        <p className="hint">{host?.name ?? "L'hôte"} prépare le tour suivant…</p>
      )}
    </div>
  );
}
