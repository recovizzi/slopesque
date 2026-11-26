# Slopesque

Jeux entre amis dans un panneau flottant (extension MV3). V1 en développement : plan, specs et décisions dans
`openspec/changes/plan-slopesque-v1` (tâches en jalons, `tasks.md`) et `openspec/changes/define-game-concept` (le
concept, les règles des jeux). La maquette de référence (comportements, captures) est le dépôt voisin
`~/projects/semicirculardisk` (`apps/web/src/*.ts`, `extension/tools/shots.mjs`). Lire les specs avant de coder.

## Layout

| Dossier | Contenu |
|---|---|
| `apps/server` | NestJS 12 (ESM, TypeScript 6). `src/rooms` = le noyau des salons (`room-registry.ts` : salons en mémoire, présence, événements ; `room-hub.service.ts` : rejoindre, état, changer d'activité, hôte, crédit ; `activity.ts` : le contrat d'activité, jeton `ACTIVITIES` ; votes), `src/activities/<activité>` = un module Nest par activité avec sa passerelle (Demi-disque, Sondage, Roulette, Low Tide, effets, palmarès, `cards/` : table commune + un module par jeu), `src/realtime` (connexion, `IntentRunner` commun aux passerelles), `src/chat` (messages, images, stickers, emoji, photos), `src/media` (images par usage, `/media/:id`), `src/external` (GIF, aperçus de lien, `safeFetch`), `src/accounts`, `src/admin.ts` (console), `src/db/schema.ts` (Drizzle, migrations dans `drizzle/`). Tests : `test/*.test.ts` lancent le vrai serveur (`dist/`) |
| `apps/web` | React + Vite, construit dans l'extension (refonte en cours : `openspec/changes/refactor-architecture`). `src/app/` (coque `App.tsx`, `store.ts` Zustand, `net.ts` Socket.IO, `styles.ts` = la liste ordonnée de toutes les feuilles de style), `src/design/` (la bibliothèque de composants — `Button`, `Field`, `Modal`, `Tabs`, `Icon`, `RichText`… — sur les jetons de `tokens.css` ; `pnpm dev` puis `?kit` les montre en clair et en sombre), `src/features/<fonctionnalité>/` (chat, poll, wheel, disk, cards + tarot/holdem/coinche, rooms, account, palmares, credit, vote, activity-picker, web : composants, styles, logique), `src/lib/*` (fonctions sans DOM : liens, texte en segments `rich-text.ts`, commandes, appareil, caches), `src/legacy/` (`LiveHtml`, `Html`, `esc`, icônes en chaînes : en sursis, supprimés à la tâche 4.1), `src/fx/` (effets canvas). `pnpm --filter @slopesque/web lint` vérifie aussi : pas de HTML texte, fichiers ≤ 300 lignes, pas de couleur en dur (`scripts/check-source.mjs`, exceptions provisoires et leur propriétaire dans `scripts/source-allowlist.mjs`) |
| `apps/extension` | MV3 : `src/panel-core.js` (panneau), `panel.js` (icône, raccourci), `panel-auto.js` (« toutes les pages »), `background.js`, `tools/build.mjs`. `public-key.txt` fixe l'identifiant Chrome (la clé privée : `slopesque-crx.pem`, non versionnée) |
| `packages/shared` | constantes, schéma de l'environnement, protocole (zod + types) |
| `packages/engines` | règles pures testées : code, clés, couleurs, liens, votes, crédit, Demi-disque, Sondage, Roulette, Trou du cul, places à table, Tarot, Texas Hold'em et Coinche (vues par place, robots par niveau ; `pnpm tarot:duel`, `pnpm holdem:duel`, `pnpm coinche:duel` les mesurent) |
| `tests/e2e` | Playwright : deux joueurs avec la vraie extension contre le serveur (`E2E_STACK=1` : contre la pile de production locale) |
| `infra` | `docker-compose.yml` (dev, 127.0.0.1 : Postgres 23432, Redis 23379, RustFS 23900), `docker-compose.prod.yml` (un seul port public) |
| `tools` | `dev.mjs`, `doctor.mjs`, `stack.mjs`, `deploy.mjs`, `scan-secrets.mjs` |

## Commandes

```sh
pnpm dev                 # services Docker, paquets, serveur :23100, web :5173 (surveillés)
pnpm doctor              # état des services et des clés
pnpm check               # typecheck + lint + tests (turbo ; les tests serveur ont besoin de `pnpm services:up`)
pnpm build && pnpm --filter @slopesque/e2e e2e   # bout en bout (deux navigateurs) ; build = « Slopesque (dev) », SLOPESQUE_RELEASE=1 = la publiée
pnpm stack:up / stack:admin <cmd> / stack:logs / stack:down   # la pile de production sur le Docker local (:23180)
pnpm prod:admin <cmd>    # une commande d'admin sur la machine du projet (alias SSH et compte dans .env ; voir ADMIN.md)
pnpm release [patch|minor|major] [--only extension|server] [--min-extension] [--dry-run]   # une version : tag → CI Release (voir RELEASE.md)
pnpm admin <cmd>         # console d'admin (dev)
pnpm db:generate         # nouvelle migration après un changement de src/db/schema.ts
pnpm deploy:prod         # déploiement (--check, --init la 1re fois, --dry-run ; dans un terminal ; voir RELEASE.md)
```

## Règles

1. **Specs d'abord** : une règle ou une décision passe par `openspec/` ; ne pas trancher seul une question ouverte.
2. **Langues** : UI, specs et docs en français ; code, commentaires et noms en anglais.
3. **Dépôt public** : aucun secret, aucune adresse de serveur, aucun compte dans le dépôt. Secrets dans `.env` (ignoré)
   ou dans les environnements GitHub ; actions en attente de l'utilisateur dans `MANQUES.md` (ignoré, à tenir à jour).
4. **Le serveur fait foi** : le client envoie des intentions, le serveur valide avec `packages/engines` et ne diffuse
   jamais une information cachée (mains, rayon de l'hôte avant la révélation…).
5. **Repli** : tout service externe ou facultatif (GIF, Redis, RustFS) peut manquer sans tout casser ; message clair.
6. **ESM partout** : imports relatifs avec l'extension `.js` dans les paquets et le serveur.
7. **Jetable** : pas de sauvegarde, fichiers sans usage supprimés aussitôt, et c'est dit.
8. Conventional commits (`feat:`, `fix:`, `chore:`…), en anglais.
9. **Interface** : les pièces de `design/` (jamais une classe `btn`, `field`, `modal`… refaite à la main), le texte d'un
   joueur rendu par React (`RichText`), jamais de HTML texte. Une feuille de style vit à côté de sa fonctionnalité et
   s'ajoute à la liste de `app/styles.ts` (pas d'`import` CSS dans un composant) ; couleurs : un jeton, ou une propriété
   nommée en tête de la feuille de la fonctionnalité.

## Méthode de travail personnelle

Si présent, `CLAUDE.perso.md` (local, non versionné) définit la méthode de travail du poste (backlog local `.ai-docs/`) :

@CLAUDE.perso.md
