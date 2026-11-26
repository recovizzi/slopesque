## Context

Mesures du 2026-11-26 (14 600 lignes de TS/TSX/CSS hors moteurs de test) :

- **Serveur** : `rooms/room-hub.service.ts` 1 465 lignes / 96 Ko — salons en mémoire, présence, chat (images,
  stickers, emoji), activités (Demi-disque, Sondage et sondages du chat, Roulette, intégrations, Palmarès), quatre
  jeux de cartes et leurs robots, effets, avis de la console. `realtime/gateway.ts` 300 lignes / 22 Ko : connexion
  et ~90 intentions dans une seule classe. L'état d'un salon (`RoomRt`) mélange les champs de toutes les activités.
- **Interface** : React + zustand, mais une vingtaine de vues héritées de la maquette restent en HTML texte —
  `lib/holdem-view.ts`, `coinche-view.ts`, `tarot-view.ts`, `cards.ts`, `poll.ts`, `wheel.ts`, `disk.ts`,
  `amphi.ts`, `stats.ts`, `gif.ts` (classe DOM), `emoji.ts`, `icons.ts` (SVG en chaînes), le texte du chat
  (`textHtml`) —, branchées par `LiveHtml` / `Html` (`dangerouslySetInnerHTML`), avec l'échappement manuel `esc()`.
  `ui/Chat.tsx` 498 lignes, `App.tsx` 422 lignes (réglages, profil, pages d'erreur mêlés), `style.css` 1 191
  lignes / 97 Ko d'un seul tenant (sections par fonctionnalité, jetons de couleur déjà présents).
- **Filets** : `pnpm check` (types, lint, tests moteurs et serveur), e2e Playwright (`run.mjs`, `polls.mjs`,
  `cards.mjs`, `holdem.mjs`, `coinche.mjs` ; ~200 vérifications, sélecteurs par classes CSS), captures
  `tests/e2e/shots/`.

Décisions de l'utilisateur (2026-11-26) : modules Nest par activité (« le but est d'avoir du code propre, évolutif
et maintenable ») ; purger dès maintenant tout le HTML texte du frontend pour un code React propre, segmenté et
organisé ; une bibliothèque de composants réutilisés pour un style et un design system cohérents ; des fichiers de
taille cohérente.

## Goals / Non-Goals

**Goals:**
- Un module serveur par activité, sur un contrat commun ; ajouter un jeu ou une activité sans toucher au noyau.
- Zéro HTML texte dans `apps/web` : ni `innerHTML`, ni `dangerouslySetInnerHTML`, ni `esc()` (React échappe).
- Une bibliothèque de composants (`design/`) utilisée par toutes les fonctionnalités ; jetons centralisés.
- Code rangé par fonctionnalité ; règles pures (calculs, géométrie) séparées des composants et testées.
- Fichiers d'environ 300 lignes au plus.
- Rendu identique ou meilleur, mêmes parcours (e2e verts à chaque étape).

**Non-Goals:**
- Changer une règle de jeu, le protocole (`packages/shared`), les moteurs (`packages/engines`) ou la base.
- Changer de pile (pas de nouveau framework CSS, pas de routeur, pas de bibliothèque d'interface externe).
- Refaire l'apparence : seules les incohérences visibles (deux boutons qui diffèrent pour rien…) sont alignées.
- Les effets plein écran sur canvas (`fx/`) : impératifs par nature, ils restent tels quels (sans HTML texte).

## Decisions

### 1. Serveur : un module Nest par activité, autour d'un noyau de salon
```
apps/server/src/
  rooms/            noyau : RoomRegistry (salons en mémoire, présence, seq, emit, say, saveRules, connected),
                    RoomHub (rejoindre / quitter, état complet, changer d'activité, votes, hôte, crédit),
                    activity.ts (le contrat), rooms.service.ts
  activities/
    disk/  poll/ (sondage + sondages du chat)  wheel/  web/  effects/  palmares/
    cards/  table (places, robots, rythme, exclusion) + tdc/  tarot/  holdem/  coinche/
  chat/             messages, images, stickers, emoji, photo, aperçus de liens
  realtime/         connexion (handshake, hello), exécution validée d'une intention (IntentRunner)
```
Contrat `Activity` (jeton d'injection `ACTIVITIES`, plusieurs fournisseurs) : `key`, `init(room)` (son état depuis
les règles enregistrées), `view(rt, me)` (sa part de `RoomState`), `cancel(rt, to)` (ce qui est perdu quand on
change d'activité), `onLeave(rt, id)`, `restore(rt)` après redémarrage. Chaque activité garde son état dans
`rt.slots[key]` (typé par l'activité) au lieu de champs dans `RoomRt`. Chaque module a sa classe
`@WebSocketGateway()` (Nest réunit les passerelles d'un même espace) qui déclare ses `@SubscribeMessage` via
l'`IntentRunner` commun (validation zod, accusé `{ ok, value | error }`, limites de débit).
Les activités dépendent du `RoomRegistry`, jamais du `RoomHub` : pas de dépendance circulaire.
*Alternative rejetée* : classes simples appelées par le hub (moins standard, pas d'injection : tests et
dépendances à la main) — choix de l'utilisateur.

### 2. Interface : React partout, rangé par fonctionnalité
```
apps/web/src/
  app/        App, Shell (barre, tiroirs), pages d'état (hors ligne, fatale), réglages (onglets), store, net
  design/     la bibliothèque de composants + tokens.css, base.css
  features/   chat/  poll/  wheel/  disk/  cards/ (table commune, carte SVG, main, places) + tarot/ holdem/
              coinche/ tdc/  rooms/  account/  palmares/  credit/  vote/  activity-picker/  web/  effects/
  lib/        fonctions pures sans DOM (device, liens → segments, commandes, caches)
  fx/         effets canvas (inchangés)
```
Une fonctionnalité = ses composants, ses styles (`*.css` à côté), sa logique pure (`model.ts`, testée par Vitest)
et ses hooks. Les vues en chaînes sont réécrites en composants qui produisent **le même DOM** (mêmes classes) :
le rendu reste identique et les e2e restent le filet. Le texte des messages (liens, emoji, codes `:rire:`,
emoji personnalisés) devient une liste de segments rendue par un composant. Les icônes deviennent des composants
(`<Icon name>` sur un registre de tracés SVG). `GifPop` (classe DOM) devient un composant. Le sélecteur d'emoji
reste l'élément `emoji-picker-element` (web component, patché), enveloppé dans un composant.
Les animations de cartes (vol, ramassage) restent impératives mais clonent les nœuds déjà rendus au lieu
d'écrire du HTML.
*Alternative rejetée* : garder les vues en chaînes et ne faire que les ranger (proposé, refusé : « purger le code
pour passer entièrement à un format propre »).

### 3. Bibliothèque de composants (`design/`)
Jetons dans `design/tokens.css` (couleurs claires / sombres, rayons, espacements, ombres, tailles de texte, durées)
— les valeurs actuelles, nommées. Composants : `Button` (variantes primaire / fantôme / danger, tailles), `IconButton`,
`Field` (libellé + aide + erreur), `TextInput`, `Select`, `Checkbox`, `Segmented`, `Tabs`, `Modal`, `Drawer`,
`Menu` / `Popover` (fermés par Échap et clic dehors), `Chip`, `Badge`, `Card`, `Timer`, `Avatar`, `Who`, `Icon`,
`EmptyState`, `Note`. Chaque composant garde les classes CSS actuelles (`btn`, `icon-btn`, `field`, `seg-group`,
`chip`, `modal`…) : le rendu et les sélecteurs e2e ne bougent pas. Une page de démonstration en mode dev
(`?kit`) montre chaque composant clair et sombre.
*Alternatives rejetées* : CSS Modules (classes hachées : casse les sélecteurs e2e et le thème global) ; une
bibliothèque externe (poids dans l'extension, autre apparence).

### 4. Styles à côté des composants
`style.css` est découpé : `design/*.css` (base, jetons, composants) et `features/<x>/<x>.css` importés par leur
composant. Ordre de cascade : jetons → base → composants → fonctionnalités. Aucune valeur de couleur en dur hors des
jetons.
*Alternative rejetée* : une feuille unique rangée en sections (déjà le cas : 97 Ko, introuvable).

### 5. Tailles et lisibilité
Environ 300 lignes au plus par fichier (une exception dit pourquoi en tête) ; lignes ≤ 140 caractères dans le
nouveau code ; un composant par responsabilité. Une règle de lint vérifie la longueur des fichiers.

### 6. Vérification à chaque étape
`pnpm check` et toute la suite e2e verts à chaque commit ; captures avant (référence prise sur `main` avant la
refonte) et après comparées à l'œil, fonctionnalité par fonctionnalité. Le port des e2e devient réglable
(`E2E_PORT`) pour lancer plusieurs suites en parallèle.

### 7. Ordre et parallélisme
1. Fondations : port e2e, captures de référence, `design/` (jetons, composants, page `?kit`), `Icon`, découpe du CSS,
   squelette `app/` et `features/`, segments du texte du chat.
2. En parallèle (branches séparées, fichiers disjoints) : serveur (modules d'activité) ; Sondage + Roulette ;
   Cartes (table commune + Tarot + Trou du cul, puis Hold'em + Coinche) ; Chat (messages, emoji, GIF, liens,
   votes, crédit) ; Demi-disque + Amphithéâtre + Palmarès + salons + compte + choix d'activité + intégrations.
3. Nettoyage : suppression de `LiveHtml`, `Html`, `lib/html.ts`, des `*-view.ts` ; contrôle « zéro HTML texte » ;
   documentation (`ARCHITECTURE.md`, CLAUDE.md).
*Alternative rejetée* : tout d'un bloc (impossible à vérifier, conflits).

## Risks / Trade-offs

- [Régression visuelle ou de parcours] → mêmes classes CSS, e2e à chaque commit, captures comparées.
- [Conflits entre branches parallèles] → propriété des fichiers fixée par branche ; `design/`, `app/` et le noyau
  serveur posés avant ; fusions une à une, e2e après chaque fusion.
- [Contrat d'activité trop rigide] → il ne couvre que le commun (init, vue, annulation, départ, reprise) ; le reste
  reste dans le module.
- [Performance du rendu React des tables de cartes] → composants mémoïsés par place ; animations hors React.
- [Durée] → plusieurs jours de travail ; aucune fonctionnalité nouvelle pendant ce temps, pas de release.

## Migration Plan

Pas de migration de données ni de protocole : un client et un serveur refondus parlent au même protocole que
v0.1.0. Retour arrière : `git revert` du commit fautif (chaque étape est un commit vert).

## Open Questions

- Aucune bloquante. Un écart visuel volontaire (alignement de deux composants qui différaient) est signalé à
  l'utilisateur avec sa capture avant / après.
