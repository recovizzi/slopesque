# Architecture de Slopesque

Où ranger quoi, et pourquoi. Décisions et contexte : `openspec/changes/refactor-architecture/` (refonte du
2026-11-26). Règles de jeu : `openspec/changes/define-game-concept/`.

## Vue d'ensemble

```
packages/shared    le protocole (intentions zod, événements, vues), constantes, schéma de l'environnement
packages/engines   les règles pures et testées (Demi-disque, Sondage, Roulette, cartes, robots…) : aucun I/O
apps/server        NestJS : salons en mémoire + Postgres, une activité = un module
apps/web           React : une fonctionnalité = un dossier, sur une bibliothèque de composants
apps/extension     MV3 : le panneau qui affiche apps/web
tests/e2e          Playwright : deux navigateurs avec la vraie extension contre le vrai serveur
```

Une règle de jeu vit dans `packages/engines` (pure, testée) ; le serveur l'applique et diffuse ; l'interface
l'affiche. Le protocole ne bouge qu'avec `packages/shared`, des deux côtés à la fois.

## Serveur (`apps/server/src`)

```
rooms/        le noyau des salons
  room-registry.ts   salons en mémoire, présence (grâce de 15 s), événements numérotés, emit, say, saveRules
  room-hub.service.ts rejoindre / quitter, état complet, changer d'activité, hôte, crédit, avis de la console
  activity.ts        le contrat Activity et le jeton ACTIVITIES
  votes.service.ts   les votes (chaque sorte de vote dit ce qui arrive quand il passe : votes.on)
  room-rt.ts         RoomRt et ses emplacements typés (RoomSlots)
activities/   une activité = un module : <nom>.service.ts (l'Activity) + <nom>.gateway.ts (ses intentions)
  disk/ poll/ wheel/ web/ effects/ palmares/
  cards/      la table commune (places, robots, rythme, exclusion, habillage des atouts) + tdc/ tarot/ holdem/ coinche/
chat/         messages, images, stickers, emoji, photo, aperçus de liens
realtime/     connexion (handshake, hello), IntentRunner (validation zod, accusé { ok, value | error }, débit)
accounts/ media/ external/ db/ config/ cache/ storage/ health/
```

**Le contrat d'activité** (`rooms/activity.ts`) : `init` (son état depuis les règles enregistrées), `restore` /
`forget` (après un redémarrage : ce qui est perdu), `view` (sa part de l'état complet), `cancel` (au changement
d'activité : annulé, ou continué ailleurs — un sondage ouvert passe dans le chat), `choose` / `chosen`, `reset`,
`left`. Chaque activité garde son état dans `rt.slots.<clé>`, déclaré par son propre module
(`declare module '../../rooms/room-rt.js'`).

**Ajouter une activité** : un dossier `activities/<nom>/` avec son service (`implements Activity`), sa passerelle
(`@WebSocketGateway()` + `@SubscribeMessage` via `IntentRunner.inRoom`) et son module ; une ligne dans
`activities/activities.module.ts`. **Ajouter un jeu de cartes** : un `CardGame` dans `activities/cards/<jeu>/`, qui
s'inscrit auprès de la table (`table.register(this)`). Le noyau ne change pas.

Dépendances : les activités dépendent du `RoomRegistry`, jamais du `RoomHub`. Une activité qui doit changer
d'activité passe par `RoomRegistry.enter()`.

## Interface (`apps/web/src`)

```
app/        la coque : App (état partagé de la coque), Header, LeftDrawer, Stage, hooks, store (zustand), net
            (Socket.IO : état complet puis événements numérotés), settings/ (onglets), pages/ (hors ligne, fatale,
            avis), styles.ts (LA liste ordonnée des feuilles de style)
design/     la bibliothèque de composants : Button, IconButton, Field, TextInput, Select, Checkbox, Segmented,
            Tabs, Modal, Drawer, Popover / Menu, Chip, Badge, Card, Timer, Avatar, Who, Icon (+ icons.tsx),
            Note, EmptyState, Choice, RichText ; tokens.css (les jetons), base.css ; kit/ (la page ?kit)
features/   une fonctionnalité = ses composants + ses styles + sa logique pure (model.ts, testée)
            chat/ (messages/ composer/ gifs/ emoji/)  poll/  wheel/  disk/  cards/ (+ tarot/ tdc/ holdem/ coinche/)
            rooms/  account/  palmares/  credit/  vote/  activity-picker/  web/
lib/        fonctions sans DOM partagées : texte en segments (rich-text.ts), liens, emoji, appareil, caches, géométrie
fx/         effets plein écran (canvas, éléments construits par le DOM)
```

Règles (vérifiées par `pnpm --filter @slopesque/web lint`, `scripts/check-source.mjs`) :

- **Jamais de HTML texte** : ni `innerHTML`, ni `insertAdjacentHTML`, ni `dangerouslySetInnerHTML`. React échappe le
  texte des joueurs ; un message passe par `<RichText>` (liens, emoji, codes `:rire:`, emoji du salon).
- **Les pièces de `design/`** plutôt qu'une classe `btn`, `field`, `modal`… refaite à la main. Un nouveau composant
  générique va dans `design/` (avec sa démonstration dans `kit/`) ; une variante propre à un jeu reste dans sa
  fonctionnalité.
- **Couleurs** : un jeton de `tokens.css`, ou une propriété nommée en tête de la feuille de la fonctionnalité
  (`--cg-*`, `--hd-*`, `--co-*`, `--tarot-*`). Aucune couleur en dur dans une règle.
- **Styles** : une feuille par composant ou fonctionnalité, à côté de son code, ajoutée à `app/styles.ts` à son
  niveau (jetons → base → design → app → features → fx → infobulle) ; jamais d'`import` CSS dans un composant.
- **Taille** : 300 lignes au plus par fichier (sinon un commentaire `size-exception:` dit pourquoi en tête).
- **Logique pure à part** : calculs, géométrie, tris et libellés dans `model.ts` (testés par Vitest) ; les
  composants affichent. Un rayon du Demi-disque est une valeur 0 → 100 ; seul le composant du disque parle en
  coordonnées SVG.
- **Animations** (cartes, jetons) : impératives, hors React, en clonant les nœuds déjà rendus.

**Ajouter une fonctionnalité** : `features/<nom>/` (composants, `<nom>.css`, `model.ts` + tests), la feuille
ajoutée à `app/styles.ts`, la scène branchée dans `app/Stage.tsx`, ses réglages dans `app/settings/`.

## Vérifier

```sh
pnpm check                                   # types, lint (dont les contrôles de source), tests
pnpm build && pnpm --filter @slopesque/e2e e2e   # bout en bout ; E2E_PORT=… pour un autre port, E2E_DOM=<dir> pour
                                             # garder le DOM de chaque capture (comparer avant / après)
```

Les captures de `tests/e2e/shots/` se comparent à la référence locale `tests/e2e/.baseline/` (non versionnée).
