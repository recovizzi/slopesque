## ADDED Requirements

### Requirement: Un monorepo
Le projet MUST tenir dans un seul dépôt `slopesque` (pnpm workspaces + Turborepo), avec :

| Dossier | Contenu |
|---|---|
| `apps/server` | NestJS : API HTTP, passerelle WebSocket, tâches planifiées, commandes d'admin |
| `apps/web` | React + Vite : l'app du panneau, construite dans l'extension |
| `apps/extension` | MV3 Chrome / Edge / Firefox : panneau flottant, popup de secours, raccourci |
| `packages/shared` | Types, constantes et schémas zod du protocole (messages WebSocket, routes HTTP, `.env`) |
| `packages/engines` | Règles des jeux et robots en TypeScript pur, sans entrée-sortie (Demi-disque, Amphithéâtre, Sondage, Roulette, Trou du cul, Tarot, votes, crédit social, solidité d'un code) |
| `infra` | Docker Compose (dev, prod), Caddy, scripts de sauvegarde |
| `openspec` | Specs et changes (repris de la maquette) |

Une seule commande à la racine MUST installer (`pnpm install`), lancer (`pnpm dev`), vérifier (`pnpm check` : types,
lint, tests) et construire (`pnpm build`) l'ensemble. Le serveur et le front MUST importer les mêmes types et schémas
depuis `packages/shared` : un changement du protocole qui casse l'un casse la compilation de l'autre.

#### Scenario: Changer un message du protocole
- **WHEN** un champ d'un message WebSocket change dans `packages/shared`
- **THEN** `pnpm check` signale chaque endroit du serveur et du front à corriger

### Requirement: Le serveur fait foi
L'état d'un salon (activité, phase, minuteurs, mains de cartes, votes, crédit, scores) MUST vivre sur le serveur ; les
clients MUST seulement envoyer des intentions (« je place mon rayon à 63 », « je joue ces cartes ») que le serveur
valide avec `packages/engines`, puis diffuse. Les robots MUST jouer sur le serveur. Un client ne MUST jamais recevoir
une information cachée qui ne lui revient pas (main d'un autre joueur, écart du preneur, rayon de l'hôte avant la
révélation, réponses d'un sondage secret).

#### Scenario: Tricher depuis la console du navigateur
- **WHEN** un joueur envoie à la main « je joue le Roi de cœur » sans l'avoir
- **THEN** le serveur refuse le coup et rien ne change pour les autres

#### Scenario: Pas de main visible dans le trafic
- **WHEN** un joueur lit les messages WebSocket reçus pendant une donne de Tarot
- **THEN** il n'y trouve que sa propre main

### Requirement: Une seule instance
La V1 MUST fonctionner avec **un seul processus serveur** : l'état des salons actifs vit en mémoire de ce processus,
écrit dans Postgres à chaque fait durable (message, fin de tour, score, crédit, palmarès). Un redémarrage MUST garder
le chat, les scores, le crédit social, le palmarès et les comptes ; un tour, une donne ou un vote en cours MUST être
annulé et dit dans le chat (« Le serveur a redémarré : tour annulé »).

#### Scenario: Redémarrage pendant une donne
- **WHEN** le serveur redémarre pendant une donne de Trou du cul
- **THEN** les joueurs se reconnectent, retrouvent le chat et les scores, et lisent que la donne a été annulée

### Requirement: Un front sans rendu serveur
L'app du panneau MUST être une application React construite par Vite en fichiers statiques, embarquée dans le paquet
de l'extension (aucun code chargé depuis le serveur), compatible avec la CSP des extensions MV3 (ni script inline, ni
`eval`, aucun fichier ni dossier commençant par `_`, chemins relatifs). Hors extension, la même app MUST afficher
« Installer l'extension ».

#### Scenario: Chargement de l'extension
- **WHEN** `apps/extension/dist` est chargé dans Chrome comme extension non empaquetée
- **THEN** Chrome l'accepte sans erreur et le panneau s'affiche
