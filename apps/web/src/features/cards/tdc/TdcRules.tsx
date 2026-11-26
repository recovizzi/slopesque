// The rules of the Trou du cul, with examples drawn with the same cards.
import { Tdc as T } from '@slopesque/engines';
import { Modal, Note } from '../../../design';
import type { Suit } from '../model';
import { RuleCards } from '../PlayingCard';
import { RoleBadge } from '../SeatPill';
import { ROLE_WHEN } from './model';
import { TdcCard } from './TdcCard';

const { ROLES } = T;
const C = (r: number, s: Suit): T.Card => ({ id: `${r}${s}`, r, s });
const Row = ({ cards }: { cards: T.Card[] }) => (
  <RuleCards>
    {cards.map(cd => (
      <TdcCard key={cd.id} card={cd} className="small" />
    ))}
  </RuleCards>
);
const Role = ({ r }: { r: T.Role }) => <RoleBadge role={r}>{ROLES[r].name}</RoleBadge>;
const ORDER = [
  C(3, 'C'),
  C(4, 'D'),
  C(5, 'H'),
  C(6, 'S'),
  C(7, 'C'),
  C(8, 'D'),
  C(9, 'H'),
  C(10, 'S'),
  C(11, 'C'),
  C(12, 'D'),
  C(13, 'H'),
  C(14, 'S'),
  C(15, 'C'),
];

export function TdcRules({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Trou du cul — les règles" className="rules" closeButton onClose={onClose}>
      <section>
        <h3>But</h3>
        <p>
          Se débarrasser de toutes ses cartes <b>le premier</b>. L'ordre de sortie donne les rôles de la manche, et des
          points au classement du salon.
        </p>
      </section>
      <section>
        <h3>Valeur des cartes</h3>
        <p>De la plus faible à la plus forte (la couleur ne compte pas) :</p>
        <Row cards={ORDER} />
        <Note>
          Le <b>2</b> est la plus forte : personne ne peut le battre, il ferme le pli.
        </Note>
      </section>
      <section>
        <h3>Jouer</h3>
        <p>
          Celui qui ouvre pose 1 carte, une paire, un brelan ou un carré <b>de même valeur</b>. Chacun à son tour pose{' '}
          <b>autant de cartes, plus fortes</b>, ou passe.
        </p>
        <div className="rule-example">
          <Row cards={[C(7, 'H'), C(7, 'S')]} />
          <span className="rule-arrow ok">battue par</span>
          <Row cards={[C(9, 'C'), C(9, 'D')]} />
        </div>
        <div className="rule-example">
          <Row cards={[C(7, 'H'), C(7, 'S')]} />
          <span className="rule-arrow ko">pas par</span>
          <Row cards={[C(13, 'C')]} />
          <span className="rule-arrow ko">ni par</span>
          <Row cards={[C(5, 'C'), C(5, 'D')]} />
        </div>
      </section>
      <section>
        <h3>Fin du pli</h3>
        <p>
          Quand tous les autres ont passé, le dernier à avoir posé ramasse le pli et rejoue ce qu'il veut. Qui a passé
          ne rejoue pas dans ce pli.
        </p>
      </section>
      <section>
        <h3>Rôles et points</h3>
        <ol className="rule-roles">
          {(Object.keys(ROLES) as T.Role[]).map(r => (
            <li key={r}>
              <Role r={r} />
              <span>{ROLE_WHEN[r]}</span>
              <b>{`+${ROLES[r].points}`}</b>
            </li>
          ))}
        </ol>
        <Note>À 3 joueurs : Président, Neutre, Trou du cul.</Note>
      </section>
      <section>
        <h3>Échanges à la manche suivante</h3>
        <div className="rule-example">
          <Role r="tdc" />
          <span className="rule-arrow">donne ses 2 meilleures</span>
          <Row cards={[C(15, 'S'), C(14, 'H')]} />
          <span className="rule-arrow">au</span>
          <Role r="president" />
        </div>
        <div className="rule-example">
          <Role r="president" />
          <span className="rule-arrow">lui rend 2 cartes</span>
          <Row cards={[C(3, 'D'), C(4, 'C')]} />
        </div>
        <p>
          Le Vice-trou du cul et le Vice-président échangent de même <b>1 carte</b>. Puis le <b>Trou du cul commence</b>
          .
        </p>
      </section>
    </Modal>
  );
}
