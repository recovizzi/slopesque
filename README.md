# Slopesque

Des jeux entre amis dans un panneau flottant du navigateur. Un salon s'ouvre sur le **Chat** ; on y lance le
**Demi-disque** (placer un mot entre deux extrémités), un **Sondage**, une **Roulette**, des **Cartes** (Trou du cul,
Tarot, Texas Hold'em, Coinche) ou une page web intégrée. Pas de compte ni de mot de passe : un **code utilisateur** relie la sauvegarde d'un
joueur sur ses appareils.

> Statut : **V1 jouable en local** (chat, Demi-disque, Sondage, Roulette, Trou du cul, Tarot à 4 et 5, Texas Hold'em de 2 à 8, Coinche, Low Tide, palmarès). Le concept et ses décisions sont dans [`openspec/`](openspec/) ; la maquette de
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
pnpm dev        # services Docker + serveur (http://localhost:23100) + app (http://localhost:5173)
pnpm doctor     # ce qui marche, ce qui est en mode dégradé, ce qu'il faut faire
pnpm check      # types, lint, tests (les tests du serveur utilisent les services Docker)
pnpm build
pnpm --filter @slopesque/e2e e2e   # bout en bout : deux joueurs avec la vraie extension
```

Sans `.env`, tout tourne avec les valeurs de développement de [`.env.example`](.env.example). Les clés externes
(GIF) sont facultatives : sans elles, la fenêtre GIF dit pourquoi elle est vide.

## Deux façons de lancer Slopesque en local

| | `pnpm dev` (développement) | `pnpm stack:up` (la version de production, sur Docker) |
|---|---|---|
| Serveur | sur ta machine, **http://localhost:23100**, relancé à chaque modification | dans Docker, **http://localhost:23180** |
| Données | conteneurs `slopesque-dev-*` (Postgres, Redis, RustFS) | conteneurs `slopesque-*`, base et images à part |
| Console d'admin | `pnpm admin <commande>` | `pnpm stack:admin <commande>` |

Ce sont **deux serveurs différents, avec deux bases** : un salon créé avec `pnpm stack:admin` n'existe que sur
`:23180`, un salon créé avec `pnpm admin` que sur `:23100`. Dans l'extension, l'adresse du serveur (premier lancement,
ou onglet Extension) doit être celle du serveur où le salon a été créé.

Valider un salon qu'un joueur a « créé » (il attend, avec sa clé) : `pnpm admin rooms:validate ABCD-EFGH --name "Son nom"`
(ou `pnpm stack:admin rooms:validate …`). Le joueur clique ensuite « Réessayer ».

## Deux extensions côte à côte : la publiée et « Slopesque (dev) »

`pnpm build` construit **« Slopesque (dev) »** (icône orange marquée « DEV ») dans `apps/extension/dist/extension` :
une autre extension que celle de la release, avec son propre stockage, son propre compte et son serveur
(`http://localhost:23100` proposé au premier lancement). Les deux s'installent ensemble, sans rien changer :

- **Slopesque** : la release (Chrome : le `.crx` ou le zip ; Firefox : le `.xpi`), sur le serveur public ;
- **Slopesque (dev)** : Chrome → `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » →
  `apps/extension/dist/extension` (son identifiant vient du dossier : garde-le au même endroit) ; Firefox →
  `about:debugging` → « Charger un module temporaire » → `apps/extension/dist/extension-firefox/manifest.json`.

Seule la CI de release construit la version publiée (`SLOPESQUE_RELEASE=1 pnpm build` la reproduit en local).
Les deux raccourcis valent Alt+Maj+S par défaut : Chrome n'en garde qu'un, à changer dans `chrome://extensions/shortcuts`.

## La version de production sur ta machine

```sh
pnpm stack:up                                   # construit et lance la pile (port 23180), écrit infra/.env avec des secrets tirés au hasard
pnpm stack:admin rooms:create --name "Mon salon"   # crée un salon, affiche sa clé
pnpm stack:logs                                 # journaux du serveur
pnpm stack:down
```

Dans « Slopesque (dev) » (chargée depuis `apps/extension/dist/extension`) : onglet **Extension** → **Serveur** →
`http://localhost:23180`, puis « + Ajouter » avec la clé du salon. Seul le port du serveur est exposé ; Postgres, Redis
et RustFS restent sur le réseau interne de Docker.

## Exploitation

- **Aucune sauvegarde.** Une base, un disque ou un salon supprimés ne se récupèrent pas : le projet est volontairement
  jetable. Une sauvegarde éventuelle se fait à la main, hors du projet.
- Conservation : messages du chat 30 jours, images du chat 7 jours, stickers, emoji et photos tant qu'ils servent.
- Administration : seulement en console sur le serveur (`pnpm admin <commande>`), pas de panneau d'admin.

## Licence

[MIT](LICENSE).

## Administrer le serveur

Voir [ADMIN.md](ADMIN.md) : les commandes d'admin (salons, comptes, modération, place), et `pnpm prod:admin <commande>`
pour les lancer sur la machine du projet depuis ton ordinateur.

## Publier une version

Voir [RELEASE.md](RELEASE.md) : `pnpm release` (patch, minor, major ; tout, l'extension ou le serveur) crée le tag,
GitHub publie l'extension, l'image du serveur, et déploie après ton approbation.
