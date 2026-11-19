# Slopesque

Jeux entre amis dans un panneau flottant (extension MV3). V1 en développement : plan, specs et décisions dans
`openspec/changes/plan-slopesque-v1` (tâches en jalons, `tasks.md`) et `openspec/changes/define-game-concept` (le
concept, les règles des jeux). La maquette de référence (comportements, captures) est le dépôt voisin
`~/projects/semicirculardisk` (`apps/web/src/*.ts`, `extension/tools/shots.mjs`). Lire les specs avant de coder.

## Layout

| Dossier | Contenu |
|---|---|
| `apps/server` | NestJS 12 (ESM, TypeScript 6). `src/config` (env validé), `src/db` (schéma Drizzle, migrations dans `drizzle/`), `src/cache` (Redis facultatif), `src/storage` (RustFS / S3 facultatif), `src/health` |
| `apps/web` | React + Vite, construit dans l'extension (noms de fichiers sans `_`, pas de script inline) |
| `apps/extension` | MV3 (jalon 2) |
| `packages/shared` | constantes, schéma de l'environnement, protocole (zod) |
| `packages/engines` | règles pures (code utilisateur, clés, jeux), testées avec Vitest |
| `infra` | `docker-compose.yml` (dev, ports 127.0.0.1 : Postgres 55432, Redis 56379, RustFS 59000) |
| `tools` | `dev.mjs`, `doctor.mjs`, `scan-secrets.mjs` |

## Commandes

```sh
pnpm dev                 # services Docker, paquets, serveur :3100, web :5173 (surveillés)
pnpm doctor              # état des services et des clés
pnpm check               # typecheck + lint + tests (turbo)
pnpm db:generate         # nouvelle migration après un changement de src/db/schema.ts
pnpm services:up / services:down
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
