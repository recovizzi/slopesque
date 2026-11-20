# Slopesque

Jeux entre amis dans un panneau flottant (extension MV3). V1 en développement : plan, specs et décisions dans
`openspec/changes/plan-slopesque-v1` (tâches en jalons, `tasks.md`) et `openspec/changes/define-game-concept` (le
concept, les règles des jeux). La maquette de référence (comportements, captures) est le dépôt voisin
`~/projects/semicirculardisk` (`apps/web/src/*.ts`, `extension/tools/shots.mjs`). Lire les specs avant de coder.

## Layout

| Dossier | Contenu |
|---|---|
| `apps/server` | NestJS 12 (ESM, TypeScript 6). `src/rooms/room-hub.service.ts` = les salons en mémoire (présence, votes, crédit, Demi-disque, Sondage, Roulette, cartes, Low Tide, palmarès), `src/realtime/gateway.ts` = les intentions Socket.IO, `src/chat`, `src/media` (images par usage, `/media/:id`), `src/external` (GIF, aperçus de lien, `safeFetch`), `src/accounts`, `src/admin.ts` (console), `src/db/schema.ts` (Drizzle, migrations dans `drizzle/`). Tests : `test/*.test.ts` lancent le vrai serveur (`dist/`) |
| `apps/web` | React + Vite, construit dans l'extension. `src/App.tsx` (coque, onglets), `src/ui/*` (chat, compte, salons, Demi-disque, Sondage / Roulette, cartes, palmarès, Low Tide), `src/lib/*` (vues HTML reprises de la maquette : disque, amphi, sondage, roue, cartes, tarot, palmarès, emoji, liens), `src/net.ts` (Socket.IO, état complet + événements numérotés), `src/store.ts` (Zustand) |
| `apps/extension` | MV3 : `src/panel-core.js` (panneau), `panel.js` (icône, raccourci), `panel-auto.js` (« toutes les pages »), `background.js`, `tools/build.mjs`. `public-key.txt` fixe l'identifiant Chrome (la clé privée : `slopesque-crx.pem`, non versionnée) |
| `packages/shared` | constantes, schéma de l'environnement, protocole (zod + types) |
| `packages/engines` | règles pures testées : code, clés, couleurs, liens, votes, crédit, Demi-disque, Sondage, Roulette, Trou du cul, places à table, Tarot (vues par place) |
| `tests/e2e` | Playwright : deux joueurs avec la vraie extension contre le serveur (`E2E_STACK=1` : contre la pile de production locale) |
| `infra` | `docker-compose.yml` (dev, 127.0.0.1 : Postgres 23432, Redis 23379, RustFS 23900), `docker-compose.prod.yml` (un seul port public) |
| `tools` | `dev.mjs`, `doctor.mjs`, `stack.mjs`, `deploy.mjs`, `scan-secrets.mjs` |

## Commandes

```sh
pnpm dev                 # services Docker, paquets, serveur :23100, web :5173 (surveillés)
pnpm doctor              # état des services et des clés
pnpm check               # typecheck + lint + tests (turbo ; les tests serveur ont besoin de `pnpm services:up`)
pnpm build && pnpm --filter @slopesque/e2e e2e   # bout en bout (deux navigateurs)
pnpm stack:up / stack:admin <cmd> / stack:logs / stack:down   # la pile de production sur le Docker local (:23180)
pnpm prod:admin <cmd>    # une commande d'admin sur la machine du projet (alias SSH et compte dans .env ; voir ADMIN.md)
pnpm admin <cmd>         # console d'admin (dev)
pnpm db:generate         # nouvelle migration après un changement de src/db/schema.ts
pnpm deploy:prod         # déploiement (lancé par l'utilisateur : SSH + sudo)
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
