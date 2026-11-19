Ordre de travail : des **jalons**, chacun se joue de bout en bout sur le Docker local avant de passer au suivant. Dans
chaque jalon, les tâches sont groupées par partie du monorepo (`[racine]`, `[infra]`, `[shared]`, `[engines]`,
`[server]`, `[web]`, `[extension]`, `[e2e]`, `[ci]`). La maquette `semicirculardisk` sert de référence de comportement
(captures, `shots.mjs`).

## 1. Jalon 1 : le socle tourne en local (rien de jouable)

- [x] 1.1 [racine] Créer `~/projects/slopesque` : pnpm workspaces, Turborepo, `tsconfig` de base, ESLint + Prettier, Node 22, licence MIT (décision 16)
- [x] 1.2 [racine] `.gitignore` (`.env`, `MANQUES.md`, volumes, builds), `.env.example` commenté, lefthook + gitleaks en hook de commit
- [x] 1.3 [racine] Reprendre `openspec/`, écrire `CLAUDE.md` et `README.md` (dont « Exploitation : aucune sauvegarde »), `MANQUES.md` initial
- [x] 1.4 [infra] `infra/docker-compose.yml` : Postgres 17, Redis 7, RustFS (ports locaux seulement), compartiments `durable` et `chat`
- [x] 1.5 [shared] Schéma zod de l'environnement, constantes (alphabet, durées, limites, version du protocole)
- [x] 1.6 [server] NestJS : configuration validée (refus des `dev-only` en production), journaux, `GET /api/health` par service
- [x] 1.7 [server] Drizzle : schéma complet (comptes, salons, membres, messages, réactions, médias, références, stickers, emoji, palmarès, journal d'admin), première migration
- [x] 1.8 [server] Clients Redis et S3 avec repli ; mesure de la place occupée (`STORAGE_QUOTA_GB`)
- [x] 1.9 [racine] `pnpm dev` (services, migrations, serveur et web surveillés) et `pnpm doctor` (services, clés, place, « Sauvegardes : aucune »)
- [x] 1.10 [ci] Workflow PR sans secret : types, lint, tests, services de CI, gitleaks ; Dependabot

## 2. Jalon 2 : entrer dans un salon et discuter (texte)

- [x] 2.1 [engines] Code utilisateur (tirage, forme canonique, solidité) et clés de salon, avec tests
- [x] 2.2 [shared] Protocole WebSocket en zod : connexion, état complet, événements numérotés, erreurs ; messages du chat
- [x] 2.3 [server] Comptes : empreinte HMAC, création au premier code, codes retirés, limite d'essais par IP ; renouveler, reprendre, repartir de zéro
- [x] 2.4 [server] Commandes d'admin : point d'entrée, confirmation, journal ; `rooms:create`, `rooms:list`, `rooms:delete` (efface tout, prévient : aucune sauvegarde)
- [x] 2.5 [server] Passerelle Socket.IO : authentification, version, `ALLOWED_ORIGINS`, `ALLOW_INSECURE`, salon rejoint, état complet, reprise sur trou
- [x] 2.6 [server] Présence (grâce de 15 s, absent, 5 min), plusieurs connexions par compte, limites d'envoi
- [x] 2.7 [server] Chat texte : messages, réponses, réactions, pages de 100, repère de début, réponse à un message supprimé, purge à 30 jours
- [x] 2.8 [web] React + Vite compatible MV3 ; styles, icônes et thème repris de la maquette
- [x] 2.9 [web] Client Socket.IO, store Zustand, reconnexion (« Reconnexion… », « Mets l'extension à jour », « Connexion non chiffrée »)
- [x] 2.10 [web] Coque : en-tête, tiroirs, onglets Profil / Extension / Partie ; liste des salons et pages d'erreur
- [x] 2.11 [web] Premier lancement, Profil → Compte, fenêtre de changement de code (3 choix)
- [x] 2.12 [web] Chat texte : messages, réponses, réactions, emoji standard et codes `:nom:`, liens (sans aperçu), présence
- [x] 2.13 [extension] Coque MV3 reprise (panneau, popup de secours), identifiant `slopesque@…`, clés `slp-*`, permission du serveur, CSP sans `upgrade-insecure-requests`
- [x] 2.14 [e2e] Playwright : deux joueurs (contextes séparés) dans un salon créé par `rooms:create`, messages, réponse, réaction, reconnexion

## 3. Jalon 3 : images, stickers, emoji, photo, GIF, aperçus

- [x] 3.1 [server] Envoi d'image (multipart, 15 Mo), conversion sharp par usage, sans métadonnées, clé `usage/sha256`, références
- [x] 3.2 [server] Service `/media/…` (cache long), purge des images du chat à 7 jours, suppression aussitôt des fichiers sans usage, refus à 98 % de place
- [x] 3.3 [server] Stickers et emoji personnalisés du salon (retirés : supprimés), photo de profil par salon (remplacée : supprimée)
- [x] 3.4 [server] GIF : KLIPY et GIPHY, chaîne de secours, cache Redis, messages de repli (pas de clé, clé refusée, pas de réponse)
- [x] 3.5 [server] Aperçus de lien : Open Graph et oEmbed, protections SSRF, une lecture à la fois par lien, cache 7 jours
- [x] 3.6 [web] Menu « + », envoi d'images, glisser-déposer, stickers, emoji personnalisés, « Image plus disponible »
- [x] 3.7 [web] Fenêtre GIF (avec ses messages de repli), aperçus de lien (carte, vidéo au clic), photo de profil dans tous les ronds
- [x] 3.8 [e2e] Image envoyée deux fois (une copie), photo remplacée (l'ancienne supprimée), GIF sans clé (message clair)

## 4. Jalon 4 : commandes, votes, crédit social

- [x] 4.1 [engines] Votes du chat (quorum, majorité, une à la fois) et crédit social (paliers), avec tests
- [x] 4.2 [server] Minuteurs du serveur et décalage d'horloge ; votes `/activity`, `/hote`, `/kick` ; rôle d'hôte et absence de 5 min
- [x] 4.3 [server] `/credit-social` diffusé ; commandes d'admin `credit:reset`, `accounts:find`, `accounts:show`, `accounts:reset-code`
- [x] 4.4 [server] Admin vers serveur en marche (`LISTEN/NOTIFY`) ; `messages:delete`, `media:delete`, `media:stats`, `purge:run`, `services:check`
- [x] 4.5 [web] Liste des commandes au « / », fenêtre `/activity`, votes Oui / Non, fenêtre du crédit social et hiéroglyphes
- [ ] 4.6 [e2e] Vote à trois joueurs (quorum, majorité, minuteur), crédit social, `/hote` après 5 min d'absence — fait à deux joueurs (vote, crédit, /activity) et côté serveur (vote, annulation au redémarrage) ; reste : trois joueurs, absence de 5 min

## 5. Jalon 5 : Demi-disque et Amphithéâtre

- [x] 5.1 [engines] Demi-disque et Amphithéâtre (barème, colonnes, sièges) portés de la maquette, avec tests
- [x] 5.2 [server] Tours (mot, placement, révélation sans fuite du rayon de l'hôte), scores, palmarès, réglages de l'onglet Partie
- [x] 5.3 [web] Demi-disque et Amphithéâtre (SVG repris de `disk.ts` et `amphi.ts`), classement, podium, palmarès
- [x] 5.4 [e2e] Un tour complet à trois joueurs ; le rayon de l'hôte absent du trafic avant la révélation

## 6. Jalon 6 : Sondage et Roulette

- [x] 6.1 [engines] Sondage (types, résultats, secret) et Roulette (poids, parts, tirage), avec tests
- [x] 6.2 [server] Sondage et Roulette (tirage décidé par le serveur, animé par les clients)
- [x] 6.3 [web] Sondage (préparation, vote, résultats, gradient) et Roulette (éditeur, roue)
- [x] 6.4 [e2e] Un sondage secret (pas de noms dans le trafic) et un tirage vu identique par tous

## 7. Jalon 7 : Cartes, Trou du cul

- [ ] 7.1 [engines] Trou du cul (règles, places, points au dernier occupant, robots), vue par joueur, tests (licence du moteur repris : décision 16)
- [ ] 7.2 [server] Table : places, rejoindre / quitter, robots, exclusion à 30 s, fin de manche, points
- [ ] 7.3 [web] Table, main en éventail, Trou du cul, règles
- [ ] 7.4 [e2e] Une manche à deux joueurs et deux robots ; aucune main adverse dans le trafic

## 8. Jalon 8 : Tarot

- [ ] 8.1 [engines] Tarot à 4 (enchères, écart, plis, décompte), vue par joueur, tests
- [ ] 8.2 [engines] Tarot à 5 (Roi appelé, robots honnêtes), tests de non-fuite
- [ ] 8.3 [server] Tarot à 4 et 5, réglage des plis visibles, images des atouts du salon
- [ ] 8.4 [web] Tarot (enchères, appel, écart, plis, atouts habillés)
- [ ] 8.5 [e2e] Une donne à 5 ; l'écart et les mains cachés

## 9. Jalon 9 : intégrations et extension complète

- [ ] 9.1 [server] Intégrations : adresse vérifiée par le serveur (nom déclaré), diffusée au salon
- [ ] 9.2 [web] Low Tide dans la zone de jeu (page qui ne répond pas, Réessayer)
- [ ] 9.3 [extension] Raccourci clavier (`commands`), affichage et changement (Firefox sur place, Chrome / Edge par la page du navigateur)
- [ ] 9.4 [extension] « Rester ouvert sur toutes les pages » : permission à l'activation, scripts de contenu enregistrés, état partagé
- [ ] 9.5 [extension] Plusieurs onglets : seul l'onglet visible connecté, coupure après 30 s caché
- [ ] 9.6 [e2e] Captures du panneau (3 tailles, clair / sombre), changement de page avec l'option active

## 10. Jalon 10 : version de production sur le Docker local

- [x] 10.1 [infra] `docker-compose.prod.yml` : serveur (Caddy viendra avec le certificat, 11.3), Postgres, Redis, RustFS ; un seul port public, réseau interne
- [x] 10.2 [server] Image Docker du serveur (multi-étapes, sans privilèges), page « Installer l'extension » servie sur la même origine
- [x] 10.3 [racine] `pnpm stack:up` / `stack:down` : la pile de production sur le Docker local, l'extension réglée sur `http://localhost:<port>`
- [x] 10.4 [e2e] Les tests de bout en bout contre la pile de production locale

## 11. Jalon 11 : releases et déploiement

- [ ] 11.1 [ci] Release sur tag (méthode `jethub`) : zip, `.crx` et `.xpi` non listé si leurs secrets existent (sinon sautés avec la raison), notes d'installation
- [ ] 11.1b [ci] Nouvelle clé CRX (jamais celle de `jethub`), secrets `CHROME_CRX_KEY` et Mozilla (valeurs de `jethub`, `MANQUES.md`) dans l'environnement `release`
- [ ] 11.2 [ci] Image du serveur publiée sur GHCR à chaque release
- [ ] 11.3 [infra] Certificat sans domaine (sslip.io ou IP, décision 15) — bloqué jusqu'aux ports de la machine (`MANQUES.md`)
- [ ] 11.4 [racine] `pnpm deploy` : SSH (alias local), compte de déploiement, `docker compose pull && up -d`, contrôle de santé — bloqué jusqu'à l'accès (`MANQUES.md`)
