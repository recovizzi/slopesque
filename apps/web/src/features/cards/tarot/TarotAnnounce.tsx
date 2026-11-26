// The Tarot's announcements over the table (CardsStage shows each a moment): who takes, at 5 the called card turned
// over, a poignée shown, a chelem announced.
import { Tarot as TA } from '@slopesque/engines';
import { CardBack } from '../PlayingCard';
import { MiniCard, TarotCard } from './TarotCard';

const { BIDS, HANDFUL_NAMES, HANDFUL_POINTS } = TA;

export const TakeAnnounce = ({ name, bid }: { name: string; bid: Exclude<TA.Bid, 'pass'> }) => (
  <div className="announce-box take">
    <small>Fin des enchères</small>
    {`${name} prend`}
    <span className="ann-bid">{BIDS[bid].name}</span>
  </div>
);

/** The called card, turned over (`mine`: I hold it — its partner, in secret). */
export const CallAnnounce = ({ name, card, mine }: { name: string; card: TA.TCard; mine: boolean }) => (
  <div className="announce-box call">
    <div className="flip">
      <div className="flip-inner">
        <span className="flip-face back">
          <CardBack />
        </span>
        <span className="flip-face front">
          <TarotCard card={card} />
        </span>
      </div>
    </div>
    {`${name} appelle `}
    <MiniCard card={card} />
    <small>
      {mine
        ? "C'est toi qui l'as : tu es son partenaire (en secret)"
        : 'Son partenaire se révèle en jouant cette carte'}
    </small>
  </div>
);

/** A poignée shown: its trumps, a moment, for everyone. */
export const HandfulAnnounce = ({ name, level, cards }: { name: string; level: 1 | 2 | 3; cards: TA.TCard[] }) => (
  <div className="announce-box handful">
    <small>Poignée</small>
    {`${name} montre une ${HANDFUL_NAMES[level - 1]}`}
    <div className="handful-cards">
      {cards.map(cd => (
        <span key={cd.id} className="pcard">
          <TarotCard card={cd} />
        </span>
      ))}
    </div>
    <small>{`${HANDFUL_POINTS[level - 1]} points pour le camp qui gagnera la donne`}</small>
  </div>
);

export const ChelemAnnounce = ({ name }: { name: string }) => (
  <div className="announce-box take">
    <small>Chelem</small>
    {`${name} annonce un chelem`}
    <span className="ann-bid">tous les plis</span>
  </div>
);
