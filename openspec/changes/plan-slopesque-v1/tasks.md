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

- [x] 7.1 [engines] Trou du cul (règles, places, points au dernier occupant, robots), vue par joueur, tests (licence du moteur repris : décision 16)
- [x] 7.2 [server] Table : places, rejoindre / quitter, robots, exclusion à 30 s, fin de manche, points
- [x] 7.3 [web] Table, main en éventail, Trou du cul, règles
- [x] 7.4 [e2e] Une manche à deux joueurs et deux robots ; aucune main adverse dans le trafic

## 8. Jalon 8 : Tarot

- [x] 8.1 [engines] Tarot à 4 (enchères, écart, plis, décompte), vue par joueur, tests
- [x] 8.2 [engines] Tarot à 5 (Roi appelé, robots honnêtes), tests de non-fuite
- [x] 8.3 [server] Tarot à 4 et 5, réglage des plis visibles, images des atouts du salon
- [x] 8.4 [web] Tarot (enchères, appel, écart, plis, atouts habillés)
- [x] 8.5 [e2e] Une donne à 5 ; l'écart et les mains cachés

## 9. Jalon 9 : intégrations et extension complète

- [x] 9.1 [server] Intégrations : adresse vérifiée par le panneau de l'hôte (nom déclaré, permission du site), enregistrée et diffusée par le serveur (https seulement) — pas de lecture côté serveur (SSRF)
- [x] 9.2 [web] Low Tide dans la zone de jeu (page qui ne répond pas, Réessayer)
- [x] 9.3 [extension] Raccourci clavier (`commands`), affichage et changement (Firefox sur place, Chrome / Edge par la page du navigateur)
- [x] 9.4 [extension] « Rester ouvert sur toutes les pages » : permission à l'activation, scripts de contenu enregistrés, état partagé
- [x] 9.5 [extension] Plusieurs onglets : seul l'onglet visible connecté, coupure après 30 s caché
- [ ] 9.6 [e2e] Captures du panneau (3 tailles, clair / sombre), changement de page avec l'option active

## 10. Jalon 10 : version de production sur le Docker local

- [x] 10.1 [infra] `docker-compose.prod.yml` : serveur (Caddy viendra avec le certificat, 11.3), Postgres, Redis, RustFS ; un seul port public, réseau interne
- [x] 10.2 [server] Image Docker du serveur (multi-étapes, sans privilèges), page « Installer l'extension » servie sur la même origine
- [x] 10.3 [racine] `pnpm stack:up` / `stack:down` : la pile de production sur le Docker local, l'extension réglée sur `http://localhost:<port>`
- [x] 10.4 [e2e] Les tests de bout en bout contre la pile de production locale

## 10 bis. Jalon 10 bis : au niveau de la maquette (avant la première release)

- [x] 10b.1 [web] Animations des cartes (Trou du cul, Tarot) : cartes qui volent de la place ou de la main vers le tapis, pli du Tarot montré puis envoyé à son gagnant, annonces (preneur, Roi appelé) ; le serveur laisse aux tables le temps de les montrer (`ROBOT_DELAY_MS` × 1,6 à 3,4) ; e2e `tests/e2e/cards.mjs`
- [x] 10b.2 [engines] Tarot : le chien montré à tous pendant l'écart (Prise, Garde)
- [x] 10b.3 [infra] Ports peu utilisés (bande 23xxx, sous les ports éphémères) : serveur de dev 23100, pile et machine 23180, Postgres 23432, Redis 23379, RustFS 23900, tests 23192–23199
- [x] 10b.4 [server] GIF : chaîne KLIPY → GIPHY → KLIPY avec pub (`KLIPY_API_KEY_WITH_AD`, paramètres `ad-*`) ; format KLIPY vérifié avec une vraie clé ; taille `sm`
- [x] 10b.5 [web] GIF gardés sur l'appareil de chaque joueur (Cache API, 300 au plus), jamais par le serveur
- [x] 10b.6 [web] Chat : bulle de citation au survol, info-bulle des noms (réactions, résultats du Sondage), emoji inséré au curseur, Échap / clic dehors ferment le menu +, les stickers, l'envoi d'image ; le chat s'ouvre quand un vote commence ; code `:nom:` et refus expliqué dans le champ des réactions rapides
- [x] 10b.7 [web] Échap global dans l'ordre de la maquette (code, /activity, /credit-social, réponse, fenêtres des salons, règles, fenêtres, menus du Sondage, panneaux du chat, tiroir) ; copie de clé de secours (`execCommand`)
- [x] 10b.8 [web] Joueurs : onglet « Joueurs » (sans points) avec sa note, icônes d'absence dans le classement ; Low Tide : l'onglet montre les joueurs, pas le chat (le rôle d'hôte reste proposé à tous : décidé)
- [x] 10b.9 [web+server] Amphithéâtre : « Ce siège vient d'être pris. » dès qu'il l'est (le lobby du Demi-disque : non, décidé)
- [x] 10b.10 [web+server] Sondage : déposer une image sur un choix, Entrée valide la réponse libre, note des résultats secrets selon le réglage, Échap / clic dehors ; GIF (lien) et emoji (dans le texte) des choix
- [x] 10b.11 [web+server] Roulette : numéro du tirage (pas de « Participer » : seul l'hôte agit sur la roue tant qu'il n'y a pas de réactions en direct)
- [x] 10b.12 [web+server] Partie : titre et aide de l'activité, description du jeu de cartes, note sur le tour en cours ; un classement par jeu, « Réinitialiser la partie » dans chaque activité à classement (ce jeu seulement, palmarès gardé) ; résumé en lecture seule pour qui n'est pas l'hôte
- [x] 10b.13 [web] Palmarès : ouvert sur le jeu de cartes choisi, rafraîchi après une donne de Tarot
- [x] 10b.14 [web+server] Tarot : images des atouts du salon, comme la maquette (22 cases, import de plusieurs d'après leur nom, retrait, habillage par défaut ; table, annonce du Roi, règles, Partie en lecture seule)
- [x] 10b.16 [web+server] Palmarès aussi en activité Chat ; pubs KLIPY cachées quand elles sont marquées, pages complétées
- [x] 10b.17 [web+server] Partie en lecture seule : une ligne par réglage (le réglage et ce qu'il fait, le choix de l'hôte) ; le format choisi avec /activity (Amphithéâtre) appliqué au mode de scrutin ; Entrée envoie une commande déjà complète
- [x] 10b.15 [web+server] Retours du 2026-11-19 : pseudo affiché dès l'ouverture du Profil ; la table montrée à tous quand on prend ou quitte une place avant la donne ; `/activity cartes tarot`, `/credit-social Léa +100` et leur complétion ; chat ouvert en bas, bouton pour y revenir, chargement par morceaux gardé sur l'appareil (seuls les nouveaux messages demandés)

## 10 ter. Réactions en direct : /effet

- [x] 10t.1 [web+server] Lignes de jeu du salon rattachées à la session de l'activité (colonne `scope`), cachées une fois l'activité quittée ; messages des joueurs, votes, crédit et lignes générales gardés ; anciennes lignes système effacées par la migration
- [x] 10t.2 [web] Absence : seulement le temps exact au survol
- [x] 10t.3 [server] `/effet` : canal `fx` hors des événements numérotés, rien de gardé ; 3 feux d'artifice et 3 salves de confettis à la fois, un effet sur une photo et un screamer à la fois ; image du screamer relayée une fois (data URL ≤ 700 ko), sticker du salon, GIF KLIPY / GIPHY, emoji
- [x] 10t.4 [web] Couche d'effets `src/fx/` (au-dessus de la zone de jeu, fond sombre compté, un seul canvas de particules, une place de photo qui suit la table) : firework (8 formes, 9 palettes), confetti (aux couleurs d'un joueur), hit, tomato, hammer, screamer ; « animations réduites » : l'emoji seul ; complétion de /effet
- [x] 10t.6 [web+server] Une image, un sticker ou un GIF attend au-dessus du champ et part avec le texte écrit (ou seul) ; /effet screamer prend cette image (sinon il en demande une), plus de fenêtre dédiée
- [x] 10t.7 [server+web] « Reprendre un compte » : 3 codes inconnus d'une adresse, puis 5 min d'attente (même le bon code) ; essais restants affichés ; tests `code-lock.test.ts` et e2e
- [x] 10t.5 [e2e] Effets vus par l'autre joueur, limites, screamer, effet sur la place à table ; tests serveur `effects.test.ts`

## 10 quater. Revue des specs (2026-11-20)

- [x] 10q.1 [server+web] Les correctifs de la revue : images d'un sondage gardées pendant le sondage, favoris GIF 200, verrou sans Redis, « Repartir de zéro » après un code remplacé, aperçu de lien sans image après 7 jours, « Image expirée » citée, roulette à l'heure du serveur, écritures des règles du salon sans course
- [x] 10q.2 [server+web] Changer d'activité pendant un tour l'annule ; un redémarrage pendant une partie l'annule et le dit dans une fenêtre « Partie perdue »
- [x] 10q.3 [server] `accounts:delete`, `ADMIN.md`, `pnpm prod:admin` ; journal d'admin (actions d'admin, changements de code) ; alerte de place à 90 %
- [x] 10q.4 [server+web] Versions : extension trop ancienne refusée avec le lien de la dernière release, version dans l'onglet Extension
- [x] 10q.5 [engines+server+web] Tarot complet : Petit au bout, poignées, chelem (règles FFT), et l'écart du preneur caché en Garde sans / contre
- [x] 10q.6 [engines] Robots du Tarot : nouvelle IA (mémoire des cartes, camp et partenaire deviné, charger / ne pas charger, sauver le Petit, 21, Excuse, poignée, chelem), niveaux Facile / Moyen / Fort (simulation Monte-Carlo), réglés par l'hôte ; `pnpm tarot:duel` mesure les niveaux
- [x] 10q.8 [engines+server+web] Texas Hold'em : moteur No Limit (TDA), tournoi, robots Facile / Moyen / Fort (Chen, Monte-Carlo, cote du pot), table, règles illustrées, réglages, classement et palmarès ; `pnpm holdem:duel`
- [x] 10q.9 [engines+server+web] Coinche : moteur (enchères, coinche, surcoinche, capot, belote, décompte), robots Facile / Moyen / Fort, table, règles illustrées, réglages, classement et palmarès ; `pnpm coinche:duel`
- [x] 10q.10 [server+web] Un sondage ouvert au changement d'activité continue dans le chat (message `poll`, réponses gardées, minuteur réarmé au chargement), on y répond, ses résultats s'y affichent ; tirage des cartes vérifié (200 000 donnes contre les probabilités exactes)
- [x] 10q.7 [repo] La machine nommée seulement dans le `.env` de l'utilisateur (aucun alias ni compte dans le dépôt)

## 11. Jalon 11 : releases et déploiement

- [x] 11.1 [ci] Release sur tag (méthode `jethub`) : zip, `.crx` et `.xpi` non listé si leurs secrets existent (sinon sautés avec la raison), notes d'installation
- [x] 11.1b [ci] Nouvelle clé CRX (jamais celle de `jethub`), secrets `CHROME_CRX_KEY` et Mozilla (valeurs de `jethub`, `MANQUES.md`) dans l'environnement `release`
- [x] 11.2 [ci] Image du serveur publiée sur GHCR à chaque release
- [ ] 11.3 [infra] Certificat sans domaine (sslip.io ou IP, décision 15) — bloqué jusqu'aux ports de la machine (`MANQUES.md`)
- [ ] 11.4 [racine] `pnpm deploy:prod` (`pnpm deploy` est une commande de pnpm) : SSH (alias local), compte de déploiement, `docker compose pull && up -d`, contrôle de santé — écrit, pas encore essayé : il attend l'accès, la première image GHCR et `infra/.env` sur la machine (`MANQUES.md`)
