## Why

Le code a grandi jeu par jeu depuis la maquette : un `RoomHub` de 1 465 lignes (96 Ko) porte toutes les activités,
le `Gateway` toutes les intentions, et l'interface dessine encore une vingtaine de vues en HTML texte
(`lib/*-view.ts`, `LiveHtml`, icônes et messages en chaînes) à côté de React, avec une feuille de style unique de
97 Ko. Chaque nouveauté (mentions, notifications, applications personnelles) toucherait ces fichiers fourre-tout :
l'utilisateur demande (2026-11-26) de refondre maintenant l'architecture, en largeur, pour un projet propre,
évolutif et maintenable, avant les prochaines fonctionnalités.

## What Changes

- **Serveur** : un module Nest par activité (Demi-disque, Sondage, Roulette, intégrations, Cartes et chacun de
  ses jeux, effets), sur un même contrat d'activité ; un noyau de salon (présence, événements, sauvegarde) dont
  elles dépendent ; le hub ne fait plus qu'aiguiller (rejoindre, changer d'activité, votes, hôte). Chaque module
  déclare ses propres intentions WebSocket.
- **Interface** : plus aucune vue en HTML texte. Toutes les vues deviennent des composants React (`LiveHtml`,
  `Html`, `lib/*-view.ts`, `lib/html.ts` retirés ; icônes en composants ; texte du chat découpé en segments
  React). Le code est rangé par fonctionnalité (`features/<activité>/`), les règles pures séparées des vues.
- **Bibliothèque de composants** (design system) : jetons (couleurs, rayons, espacements, ombres, typographie),
  composants de base réutilisés partout (bouton, champ, liste déroulante, case, segments, onglets, fenêtre,
  tiroir, menu, pastille, badge, carte, minuteur, avatar…), styles rangés à côté de leur composant.
- **Tailles** : fichiers d'environ 300 lignes au plus (exception justifiée en tête de fichier), un composant par
  responsabilité.
- **Rendu** : identique ou meilleur ; aucun changement de règle de jeu, de protocole ou de données.

## Capabilities

### New Capabilities
- `code-architecture` : l'organisation du code exigée (modules d'activité côté serveur, vues React sans HTML
  texte, bibliothèque de composants, tailles de fichiers, vérification par les e2e et les captures).

### Modified Capabilities
<!-- aucune : les règles de jeu, le protocole et les données ne changent pas -->

## Impact

- `apps/server/src/rooms`, `apps/server/src/realtime` (découpés en `apps/server/src/activities/*`), `app.module.ts`.
- `apps/web/src` presque entier (`ui/`, `lib/*-view.ts`, `lib/poll.ts`, `lib/wheel.ts`, `lib/gif.ts`, `style.css`
  → `design/`, `features/`, `app/`).
- `tests/e2e` : mêmes scénarios (sélecteurs gardés), port réglable pour lancer plusieurs suites ; captures
  comparées avant / après.
- Aucun changement de `packages/shared` (protocole) ni de `packages/engines` (règles), ni de base de données.
- Pas de release pendant la refonte (décision de l'utilisateur du 2026-11-26).
