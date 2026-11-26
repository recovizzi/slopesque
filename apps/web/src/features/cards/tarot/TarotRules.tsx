// The rules of the Tarot, with the cards drawn (the trumps with the room's pictures).
import type { ReactNode } from 'react';
import { Tarot as TA } from '@slopesque/engines';
import { Modal, Note } from '../../../design';
import { RuleCards } from '../PlayingCard';
import { RoleBadge } from '../SeatPill';
import { suitCard as S, trumpCard as T } from './model';
import { TarotCard } from './TarotCard';

const { HANDFUL_POINTS, NEED, handfulSizes } = TA;
const Row = ({ cards }: { cards: TA.TCard[] }) => (
  <RuleCards>
    {cards.map(cd => (
      <TarotCard key={cd.id} card={cd} className="small" />
    ))}
  </RuleCards>
);
/** A line of the rules' lists: what, why (or nothing), how much. */
const Line = ({ what, why, much }: { what: ReactNode; why?: string; much: string }) => (
  <li>
    {typeof what === 'string' ? <span>{what}</span> : what}
    <span>{why}</span>
    <b>{much}</b>
  </li>
);

export function TarotRules({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Tarot — les règles" className="rules" closeButton onClose={onClose}>
      <section>
        <h3>But</h3>
        <p>
          À 4 joueurs, celui qui prend (le <b>preneur</b>) joue seul contre les trois autres (la <b>défense</b>) ; à 5,
          avec un partenaire qu'il appelle. Il doit faire assez de points dans ses plis, selon son contrat et ses bouts.
          Des robots prennent les places libres.
        </p>
      </section>
      <section>
        <h3>Les 78 cartes</h3>
        <p>
          4 couleurs de 14 cartes (1 à 10, Valet, Cavalier, Dame, Roi), <b>21 atouts</b> — numérotés dans les coins, sur
          leur image — et l'<b>Excuse</b> (★).
        </p>
        <Row cards={[S('H', 1), S('S', 10), S('D', 11), S('C', 12), S('H', 13), S('S', 14)]} />
        <Row cards={[T(2), T(7), T(13), T(19)]} />
        <p>
          Les trois <b>bouts</b> : le Petit (1), le 21 et l'Excuse.
        </p>
        <Row cards={[T(1), T(21), T(0)]} />
        <Note>
          Distribution (réglage de l'hôte) : <b>aléatoire</b>, le paquet mélangé à chaque donne ; ou <b>à l'ancienne</b>
          , comme à table : les plis et l'écart ramassés, coupés, distribués 3 par 3 avec le chien carte par carte —
          plus de mains déséquilibrées.
        </Note>
      </section>
      <section>
        <h3>Valeur des cartes (91 en tout)</h3>
        <ol className="rule-roles">
          <Line what="Bout ou Roi" much="4,5" />
          <Line what="Dame" much="3,5" />
          <Line what="Cavalier" much="2,5" />
          <Line what="Valet" much="1,5" />
          <Line what="Autre carte" much="0,5" />
        </ol>
      </section>
      <section>
        <h3>Enchères</h3>
        <p>Chacun parle une fois, plus haut que le précédent, ou passe. Si tous passent, on redonne.</p>
        <ol className="rule-roles">
          <Line
            what={<RoleBadge>Prise</RoleBadge>}
            why="le chien est montré, le preneur le prend et écarte 6 cartes"
            much="× 1"
          />
          <Line what={<RoleBadge>Garde</RoleBadge>} why="pareil" much="× 2" />
          <Line what={<RoleBadge>Garde sans</RoleBadge>} why="le chien va au preneur sans être vu" much="× 4" />
          <Line what={<RoleBadge>Garde contre</RoleBadge>} why="le chien va à la défense" much="× 6" />
        </ol>
        <Note>Écart : ni Roi ni bout ; un atout seulement si on ne peut pas faire autrement.</Note>
      </section>
      <section>
        <h3>Les plis</h3>
        <p>
          Il faut <b>fournir</b> la couleur demandée ; sinon <b>couper</b> (jouer un atout), et <b>surcouper</b> si un
          atout est déjà posé ; à l'atout demandé, <b>monter</b> si on peut. Sans la couleur ni d'atout, on défausse ce
          qu'on veut.
        </p>
        <div className="rule-example">
          <Row cards={[S('H', 7)]} />
          <span className="rule-arrow">sans cœur :</span>
          <Row cards={[T(5)]} />
          <span className="rule-arrow">le suivant surcoupe</span>
          <Row cards={[T(12)]} />
        </div>
        <p>
          L'<b>Excuse</b> se joue à tout moment, ne gagne jamais le pli et reste à son camp.
        </p>
      </section>
      <section>
        <h3>À 5 joueurs</h3>
        <p>
          15 cartes chacun, un chien de 3 (donc un écart de 3). Après les enchères, le preneur <b>appelle un Roi</b>{' '}
          (une Dame s'il a les 4 Rois, un Cavalier s'il a aussi les 4 Dames) : celui qui l'a devient son partenaire, en
          secret, jusqu'à ce qu'il le joue. Au premier pli, on n'entame pas dans la couleur appelée, sauf avec le Roi
          lui-même.
        </p>
        <div className="rule-example">
          <span className="rule-arrow">« J'appelle le Roi de cœur »</span>
          <Row cards={[S('H', 14)]} />
        </div>
        <p>
          Marques : le preneur × 2, son partenaire × 1, chaque défenseur × 1 dans l'autre sens. S'il s'est appelé
          lui-même ou si le Roi est au chien, il joue seul contre 4 : × 4.
        </p>
      </section>
      <section>
        <h3>Le compte</h3>
        <p>
          Points à faire selon les bouts du preneur : 0 bout <b>{NEED[0]}</b>, 1 bout <b>{NEED[1]}</b>, 2 bouts{' '}
          <b>{NEED[2]}</b>, 3 bouts <b>{NEED[3]}</b>. Marque = (25 + l'écart) × le contrat ; le preneur la gagne 3 fois
          (ou la perd), chaque défenseur la perd une fois (ou la gagne).
        </p>
        <Note>{`Exemple : Garde, 2 bouts, 47 points faits pour ${NEED[2]} → (25 + 6) × 2 = 62 : le preneur +186, chaque défenseur −62.`}</Note>
      </section>
      <section>
        <h3>Les primes</h3>
        <p>
          <b>Petit au bout</b> : le Petit dans le dernier pli rapporte 10 × le contrat au camp qui gagne ce pli, que la
          donne soit gagnée ou non.
        </p>
        <p>
          <b>Poignée</b>
          {` : avant ta première carte, montre ${handfulSizes(4).join(', ')} atouts à 4 (${handfulSizes(5).join(', ')} à 5) : simple, double ou triple poignée, ${HANDFUL_POINTS.join(', ')} points (non multipliés) pour le camp qui `}
          <b>gagne</b> la donne. L'Excuse compte pour un atout si c'est le dernier.
        </p>
        <p>
          <b>Chelem</b> : faire tous les plis. Annoncé par le preneur avant la première carte (il entame) : +400 réussi,
          −200 manqué ; réussi sans annonce : +200. Dans un chelem, l'Excuse menée au dernier pli le gagne.
        </p>
        <Note>Marque = ((25 + l'écart) ± Petit au bout) × le contrat ± poignées ± chelem.</Note>
      </section>
    </Modal>
  );
}
