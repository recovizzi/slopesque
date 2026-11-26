// ?kit: what shows things — Badge, Chip, Avatar, Who, Note, EmptyState, Choice, Timer, Card, RichText.
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Card } from '../Card';
import { Chip } from '../Chip';
import { Choice } from '../Choice';
import { EmptyState, Note } from '../Note';
import { RichText } from '../RichText';
import { Timer } from '../Timer';
import { Who } from '../Who';
import { Section } from './Section';

const DOT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#5b5bd6"/></svg>';
const CUSTOM = [{ name: 'kit', url: `data:image/svg+xml,${encodeURIComponent(DOT)}` }];
const codes = (c: string) => (c === 'rire' ? '😂' : undefined);
const none = () => undefined;

export function KitDisplay() {
  return (
    <>
      <Section title="Badge, Chip, Avatar, Who">
        <div className="kit-row">
          <Badge>Actuel</Badge>
          <Badge tone="wait">En attente</Badge>
          <Badge tone="insecure" icon="lock">
            Connexion non chiffrée
          </Badge>
        </div>
        <ul className="chips">
          <Chip color="hsl(222 58% 50%)">Léa</Chip>
          <Chip color="hsl(12 58% 50%)" done>
            Tom
          </Chip>
          <Chip color="hsl(140 58% 40%)">Zoé</Chip>
        </ul>
        <div className="kit-row">
          <Avatar name="Léa" hue={222} />
          <Avatar name="Tom" hue={12} size="" />
          <Avatar name="Zoé" hue={140} size="lg" />
          <Avatar name="Max" hue={280} size="" onClick={none} label="Profil" />
          <Who name="Léa" hue={222} />
          <Who name="Tom" hue={12} />
        </div>
      </Section>
      <Section title="Note, EmptyState, Choice">
        <div className="kit-col">
          <Note>Une aide, en petit.</Note>
          <Note tone="alert">Une erreur, dite tout de suite.</Note>
          <Note tone="pending">Appliqué à la fin du tour en cours.</Note>
          <Note tone="ok">Serveur joignable ✓</Note>
          <Note tone="danger">L'ancien code ne marchera plus.</Note>
          <EmptyState>Aucun salon : ajoute une clé, ou crée un salon.</EmptyState>
          <Choice title="Renouveler mon code" help="Même compte, nouveau code : tout est gardé." onClick={none} />
        </div>
      </Section>
      <Section title="Timer">
        <div className="kit-col">
          <Timer ratio={0.6}>18 s</Timer>
          <Timer ratio={0.15} urgent>
            4 s
          </Timer>
        </div>
      </Section>
      <Section title="Card">
        <div className="kit-row kit-cards">
          <Card title="Aucun salon">
            <p>Ajoute la clé d'un salon.</p>
            <Button size="big">Choisir un salon</Button>
          </Card>
          <Card title="Serveur injoignable" tone="offline">
            <p>Aucune réponse.</p>
          </Card>
          <Card title="Salon en attente" tone="pending">
            <p>Un admin doit le créer.</p>
          </Card>
        </div>
      </Section>
      <Section title="RichText">
        <p className="msg">
          <RichText text="<b>pas du HTML</b> fr.wikipedia.org/wiki/Tarot :kit: :rire:" custom={CUSTOM} codes={codes} />
        </p>
      </Section>
    </>
  );
}
