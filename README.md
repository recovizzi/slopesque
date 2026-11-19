# Slopesque

Des jeux entre amis dans un panneau flottant du navigateur. Un salon s'ouvre sur le **Chat** ; on y lance le
**Demi-disque** (placer un mot entre deux extrémités), un **Sondage**, une **Roulette**, des **Cartes** (Trou du cul,
Tarot) ou une page web intégrée. Pas de compte ni de mot de passe : un **code utilisateur** relie la sauvegarde d'un
joueur sur ses appareils.

> Statut : **V1 en développement.** Le concept et ses décisions sont dans [`openspec/`](openspec/) ; la maquette de
> référence vit dans le dépôt `semicirculardisk`.

## Monorepo

| Dossier | Contenu | Stack |
|---|---|---|
| [`apps/server`](apps/server) | API, temps réel, tâches planifiées, commandes d'admin | NestJS, Socket.IO, Drizzle |
| [`apps/web`](apps/web) | L'app du panneau, construite dans l'extension | React, Vite, Zustand |
| [`apps/extension`](apps/extension) | Extension MV3 Chrome / Edge / Firefox | esbuild, web-ext |
| [`packages/shared`](packages/shared) | Types, constantes, schémas du protocole et de la configuration | zod |
| [`packages/engines`](packages/engines) | Règles des jeux et robots, sans entrée-sortie | TypeScript |
| [`infra`](infra) | Docker Compose (développement, production) | Postgres, Redis, RustFS |

## Développer

Prérequis : Node 22+, pnpm 10, Docker.

```sh
pnpm install
pnpm dev        # services Docker + serveur (http://localhost:3100) + app (http://localhost:5173)
pnpm doctor     # ce qui marche, ce qui est en mode dégradé, ce qu'il faut faire
pnpm check      # types, lint, tests
pnpm build
```

Sans `.env`, tout tourne avec les valeurs de développement de [`.env.example`](.env.example). Les clés externes
(GIF) sont facultatives : sans elles, la fenêtre GIF dit pourquoi elle est vide.

## La version de production sur ta machine

```sh
pnpm stack:up                                   # construit et lance la pile (port 8080), écrit infra/.env avec des secrets tirés au hasard
pnpm stack:admin rooms:create --name "Mon salon"   # crée un salon, affiche sa clé
pnpm stack:logs                                 # journaux du serveur
pnpm stack:down
```

Dans l'extension (chargée depuis `apps/extension/dist/extension`) : onglet **Extension** → **Serveur** →
`http://localhost:8080`, puis « + Ajouter » avec la clé du salon. Seul le port du serveur est exposé ; Postgres, Redis
et RustFS restent sur le réseau interne de Docker.

## Exploitation

- **Aucune sauvegarde.** Une base, un disque ou un salon supprimés ne se récupèrent pas : le projet est volontairement
  jetable. Une sauvegarde éventuelle se fait à la main, hors du projet.
- Conservation : messages du chat 30 jours, images du chat 7 jours, stickers, emoji et photos tant qu'ils servent.
- Administration : seulement en console sur le serveur (`pnpm admin <commande>`), pas de panneau d'admin.

## Licence

[MIT](LICENSE).
