## Context

La maquette `semicirculardisk` (Vite + TypeScript sans framework, état local dans `mock.ts`, extension MV3, serveur
FastAPI réduit à la création de clés) a validé le concept : activités, chat, compte par code, cartes, crédit social.
La V1 la rend multijoueur dans un nouveau dépôt public `slopesque`. Contraintes : peu de joueurs (amis, quelques
salons), un seul petit serveur (2 vCPU, 4 Go visés), un mainteneur, pas d'interface d'admin, un dépôt copiable sans ses
secrets, du développement testable en local sans aucune clé.

## Goals / Non-Goals

**Goals:**
- Rejouer toute la maquette en vrai multijoueur, avec le serveur qui fait foi.
- Un monorepo où le protocole et les règles sont écrits une fois (TypeScript) et partagés.
- Un serveur léger : une instance, Postgres, RustFS, Redis, des purges régulières.
- Un dépôt public sûr : secrets hors du dépôt, CI sans secrets pour les contributions.
- Tout ce qui dépend d'une action de l'utilisateur est isolé, signalé (`MANQUES.md`, `pnpm doctor`) et ne bloque pas
  le reste.

**Non-Goals:**
- Plusieurs instances du serveur, répartition de charge (pas avant un vrai besoin).
- Interface d'admin graphique, routes HTTP d'admin.
- Application mobile, site web hors extension (au-delà de la page « Installer l'extension »).
- Nouvelles activités ou règles de jeu (elles passent par `define-game-concept` ou un autre change).

## Decisions

1. **React + Vite pour le front, pas Next.js** (décidé avec l'utilisateur le 2026-11-19). Next.js ne convient pas à
   une extension : son export statique écrit un dossier `_next/` (Chrome refuse les noms qui commencent par `_`), des
   scripts inline (interdits par la CSP MV3), et son rendu serveur n'a pas de sens dans un panneau embarqué. Le
   partage de modèles avec NestJS vient du monorepo (`packages/shared`), pas de Next. React remplace le rendu par
   chaînes (`put()`, 1 860 lignes dans `app.ts`) : composants par activité, état du salon dans un store (Zustand)
   alimenté par les événements WebSocket. *Rejeté* : Next.js avec contournements (fragile à chaque version) ; garder
   le TypeScript sans framework (l'état temps réel le rendrait ingérable) ; charger l'app depuis le serveur dans le
   cadre (le stockage d'un cadre tiers est cloisonné par site : le code utilisateur changerait d'une page à l'autre).

2. **NestJS pour le serveur**, Socket.IO pour le temps réel. NestJS donne modules, injection, validation et une
   passerelle WebSocket. Socket.IO apporte les salons (`room` = salon du jeu), la reconnexion, les accusés de
   réception. *Rejeté* : garder FastAPI (deux langages : plus de partage de types ni de moteurs de jeu) ; `ws` brut
   (salons, reconnexion et accusés à réécrire) ; **SSE** en plus du WebSocket (une deuxième voie pour le même besoin :
   le WebSocket envoie déjà du serveur vers le joueur).

3. **Le serveur fait foi, les moteurs sont des fonctions pures** (`packages/engines`). Chaque jeu est un réducteur
   `(état, intention) → (nouvel état, événements)` plus une fonction `vue(état, joueur)` qui retire l'information
   cachée. Les mêmes moteurs servent au serveur (validation) et aux tests ; le front ne les utilise que pour afficher
   (ex. barème du Demi-disque). Les règles de la maquette (`scoring.ts`, `tdc.ts`, `tarot.ts`, robots de `mock.ts`)
   sont portées et testées d'abord. *Rejeté* : la logique dans le front avec un serveur relais (triche, cartes
   visibles).

4. **Une seule instance, état en mémoire, faits durables en base.** Chaque salon actif est un objet en mémoire
   (moteur + minuteurs) ; un message, une fin de tour, un score, un crédit, un résultat de palmarès sont écrits dans
   Postgres quand ils arrivent. Un redémarrage annule le tour en cours (dit dans le chat). *Rejeté* : état complet dans
   Redis à chaque coup (complexité pour un besoin de reprise rare) ; adaptateur Redis de Socket.IO (seulement utile à
   plusieurs instances).

5. **Postgres + Drizzle ORM.** Schéma en TypeScript, types déduits partagés, migrations SQL versionnées
   (`drizzle-kit`), pas de moteur binaire. Tables principales : `accounts` (uuid, `code_hmac` unique, profil, dates),
   `account_names` (pseudos passés), `retired_codes`, `rooms` (clé, nom, dates), `room_members` (salon × compte :
   score, crédit, photo, rôle), `messages` (+ `reactions`), `media` (usage, sha256, clé S3, taille, `expires_at`),
   `media_refs` (qui utilise quel fichier), `stickers`, `custom_emoji`, `trump_art`, `palmares_events`, `admin_log`.
   Toutes les tables de salon en `ON DELETE CASCADE`. *Rejeté* : Prisma (plus lourd, génération de client) ; TypeORM
   (décorateurs, typage plus faible).

6. **RustFS par l'API S3** (`@aws-sdk/client-s3`), images converties par **sharp** (libvips) selon l'usage (table de
   media-storage), clé d'objet = `usage/sha256`. Deux compartiments : `durable` (stickers, emoji, photos, atouts,
   sondages : gardés tant qu'ils servent) et `chat` (7 jours). Les images sont servies par le serveur (`/media/…`,
   en-têtes de cache longs, adresse immuable), pas directement par RustFS. *Rejeté* : MinIO (licence AGPL et projet
   moins ouvert depuis 2025 ; reste un remplaçant possible, comme Garage, grâce à l'API S3) ; stocker les images dans
   Postgres (base lourde, sauvegardes lentes).

7. **Redis pour le cache et les limites**, jamais indispensable : cache des GIF (1 h, tendances 15 min), aperçus de
   lien (7 jours), limites d'essais de codes et d'envois. Redis absent → le serveur continue, cache vide, limites en
   mémoire. *Rejeté* : se passer de Redis (demandé par l'utilisateur pour décharger le serveur ; il coûte ~10 Mo) ;
   Redis indispensable (une panne de cache ne doit pas arrêter les jeux).

8. **Conservation : simple et jetable** (décidé avec l'utilisateur le 2026-11-19) : messages 30 jours (repère « Début
   de la conversation » ou « Les messages de plus de 30 jours ont été supprimés », réponse à un message supprimé dite
   simplement), images du chat 7 jours, stickers et emoji tant qu'ils sont dans la bibliothèque, photo tant qu'elle
   est la photo du joueur ; tout fichier sans usage est supprimé aussitôt, sans récupération. Salons jusqu'à leur
   suppression par un admin, qui efface toute trace (base et fichiers). Comptes sans limite. **Aucune sauvegarde** en
   V1, et c'est dit (README, `doctor`, confirmation de `rooms:delete`). Fin de la purge à 8 h de la maquette.
   *Rejeté* : garder le chat indéfiniment ou 90 jours ; garder le chat 7 jours comme ses images (on ne verrait jamais
   « Image plus disponible ») ; garder les fichiers sans usage tant que le salon existe (la place ne ferait que
   croître) ; des sauvegardes nocturnes (inutiles pour un petit projet jetable).

9. **Commandes d'admin** : un deuxième point d'entrée NestJS (`apps/server/src/admin.ts`, `nest-commander`) qui
   partage les modules du serveur (mêmes services, même base), lancé par `pnpm admin` ou `docker compose exec server
   admin`. Les commandes qui touchent un salon actif (reset de crédit, suppression de message, reset de code) passent
   par une notification Postgres (`LISTEN/NOTIFY`) que le serveur en marche applique et diffuse. *Rejeté* : routes HTTP
   d'admin protégées (surface d'attaque, et l'utilisateur ne veut pas d'interface) ; SQL à la main (pas de garde-fous,
   pas de journal).

10. **Panneau persistant en option, permission demandée à l'activation** (décidé avec l'utilisateur le 2026-11-19).
    Le script de contenu est enregistré dynamiquement (`scripting.registerContentScripts`) seulement après l'accord ;
    l'état ouvert / fermé, la taille et la position vivent dans `chrome.storage.local`. Le raccourci est une commande
    de l'extension (`commands`) : son appui donne `activeTab`, donc il ouvre le panneau sans accès large. Chrome et Edge
    ne laissent pas une extension changer ses raccourcis : on affiche le raccourci et on ouvre la page du navigateur.
    *Rejeté* : `<all_urls>` dès l'installation (avertissement inquiétant, revue plus stricte des boutiques) ; un
    raccourci écouté par le script de contenu (marche seulement sur les pages injectées et entre en conflit avec les
    raccourcis des sites) ; garder la connexion dans le service worker (tué par Chrome à l'inactivité, modèle différent
    sous Firefox : une reconnexion rapide avec 15 s de grâce de présence suffit).

11. **Configuration et secrets.** Un schéma zod de l'environnement dans `packages/shared` ; `.env.example` versionné
    (valeurs de développement marquées `dev-only-…`) ; la production refuse ces valeurs. Secrets de CI dans les
    environnements GitHub `release` et `production` (approbation manuelle). Les workflows de PR n'ont aucun secret ;
    les tests utilisent des services jetables (Postgres, Redis, RustFS en conteneurs de CI). Gitleaks en hook
    (`lefthook`) et en CI ; protection de push et analyse des secrets activées sur GitHub (action utilisateur).

12. **Infra de production** (décidé avec l'utilisateur le 2026-11-19) : la machine fournie par l'utilisateur (Docker
    déjà installé, 50 Go pour Postgres et RustFS), sans nom de domaine : adresse `IP:port`. Un
    `docker-compose.prod.yml` (Caddy, serveur, Postgres, Redis, RustFS) avec **un seul port public** ; les services de
    données restent sur le réseau interne. Le « front » de l'app est dans l'extension ; le serveur sert seulement l'API,
    le WebSocket, les images et la page « Installer l'extension », sur la même origine (pas de CORS entre deux
    services). Image du serveur sur GHCR (publique). Déploiement par `pnpm deploy` lancé par l'utilisateur (SSH, compte
    de déploiement par `sudo -iu`, mot de passe tapé par lui) ; un déploiement par la CI demande une clé SSH dédiée
    (facultatif). Adresse, port SSH et comptes hors du dépôt (`~/.ssh/config`, `.env`). Le même fichier Compose tourne
    en local (`pnpm stack:up`) : le premier « déploiement » se fait sur le Docker de l'utilisateur. *Rejeté* :
    Kubernetes (démesuré) ; un PaaS (coût, dépendance) ; front et serveur sur deux ports (deux origines, CORS).

13. **Tests** : Vitest pour `engines` et `shared` (règles, robots, vues sans info cachée), tests d'intégration du
    serveur contre les vrais services en conteneurs, Playwright pour l'extension contre un serveur local (reprise des
    `shots` de la maquette, avec plusieurs joueurs réels dans des contextes séparés).

14. **Nouvelle identité de l'extension** : identifiant Firefox `slopesque@…`, clés de stockage `slp-*`, nom de
    paquets `@slopesque/*`. Le nom hérité (`scd-*`, `semicirculardisk`) disparaît : aucune installation réelle à
    préserver.

15. **Connexion chiffrée sans domaine** : le code utilisateur est le seul secret ; il ne doit pas circuler en clair
    sur Internet. Sans domaine, deux façons d'avoir un certificat valide : un nom `sslip.io` (`a-b-c-d.sslip.io`
    renvoie vers l'IP `a.b.c.d`) avec Let's Encrypt par Caddy, qui demande que le port 80 ou 443 de la machine soit
    joignable pour la validation ; ou un certificat Let's Encrypt d'adresse IP (courte durée, mêmes ports). Si aucun des
    deux ports n'est disponible, le serveur tourne en clair avec `ALLOW_INSECURE=true` et le panneau le dit. Firefox
    applique `upgrade-insecure-requests` par défaut aux pages d'extension MV3 : la CSP de l'extension doit le retirer
    explicitement pour qu'un serveur en clair reste joignable. *Rejeté* : certificat auto-signé (chaque joueur devrait
    l'accepter à la main, et le WebSocket échoue sans message clair) ; chiffrer le code dans l'app (le reste du trafic
    resterait lisible et la session détournable).

16. **Licence libre** (décidé avec l'utilisateur le 2026-11-19) : MIT par défaut ; si un moteur de cartes repris est
    sous une licence libre à réciprocité (GPL, AGPL), le dépôt prend cette licence. Choix fait au moment d'importer
    le premier moteur, avant de publier.

17. **Distribution par les releases GitHub** (décidé avec l'utilisateur le 2026-11-19), méthode de `jethub` : zip,
    `.crx` signé par une clé du dépôt, `.xpi` signé par Mozilla sur le canal non listé. Pas de Chrome Web Store ni de
    fiche AMO publique. Limites : sous Windows et macOS, Chrome n'accepte que le zip en mode développeur (sans mise à
    jour automatique) ; Firefox n'installe durablement qu'un `.xpi` signé, ce qui demande des clés d'API AMO (compte
    Mozilla gratuit, sans publication) ; sans elles, le `.xpi` n'est installable que temporairement. CI comme `jethub` :
    runners hébergés par GitHub (`ubuntu-26.04`), workflows `ci.yml` et `release.yml` repris. **Clés Mozilla** :
    celles de Slopesque, créées pour lui sur le Developer Hub d'AMO (décidé le 2026-11-20 : plus de dépendance à
    `jethub` ; méthode dans `MANQUES.md`). **Clé CRX : une nouvelle**, jamais celle de `jethub` : la clé fixe
    l'identifiant de l'extension, deux extensions avec la même clé auraient le même identifiant et ne pourraient pas
    être installées ensemble. Générée en local (`openssl`), gardée dans `.env` et dans le secret `CHROME_CRX_KEY`.


18. **Revue des specs du 2026-11-20** (décidé avec l'utilisateur) :
    - Images d'un sondage gardées le temps du sondage + 1 h (jamais effacées avant sa fin) ; favoris GIF : 200.
    - « Reprendre un compte » sans Redis : 3 min d'attente après chaque code inconnu (au lieu de 3 essais puis 5 min).
    - Changer d'activité pendant un tour l'**annule** (dit dans le chat) ; un redémarrage du serveur pendant une partie
      l'annule aussi, la remet à son début et le dit dans une fenêtre « Partie perdue ».
    - Roulette : le résultat est celui du serveur ; l'animation part à l'heure du serveur (décalage d'horloge corrigé).
    - Deux joueurs peuvent avoir la même couleur (leur choix) ; un joueur ne quitte jamais un salon (il est absent) :
      le palmarès le garde ; seul un admin efface un joueur (`accounts:delete`, `ADMIN.md`).
    - Aperçu de lien : au-delà de 7 jours, son texte reste, son image non.
    - Journal d'admin : les actions d'un admin et les changements de code (jamais les parties, les messages, un code).
    - Alerte dans le journal du serveur dès 90 % de place ; refus des images à 98 %.
    - Cartes : pas de Tarot à 3 (des robots complètent) ; pas de paris pour l'instant ; le temps par tour, c'est /kick
      (un robot prend la place) ; Tarot complet (Petit au bout, poignées, chelem) et robots de niveau réglable.
    - Versions : le serveur refuse une extension plus ancienne que `MIN_EXTENSION_VERSION`, avec le lien de la
      dernière release (`EXTENSION_DOWNLOAD_URL`) ; la version de l'extension est montrée dans l'onglet Extension.
    - Le dépôt ne nomme jamais la machine : alias SSH et compte de déploiement dans le `.env` de l'utilisateur.

## Risks / Trade-offs

- [Reconnexion à chaque changement de page avec l'option persistante] → état complet en un message, grâce de 15 s
  pour la présence, connexion seulement dans l'onglet visible.
- [Pas de sauvegarde] → assumé : tout est jetable ; dit dans le README, `doctor` et `rooms:delete`.
- [50 Go pour Postgres et RustFS] → formats réduits par usage, une copie par empreinte, fichiers sans usage supprimés
  aussitôt, images du chat 7 jours, alerte à 90 %, envois refusés à 98 %.
- [Machine partagée] (compte de déploiement, autres services) → un seul port public, services de données internes,
  conteneurs sans privilèges, ports choisis pour ne rien gêner (question 1).
- [RustFS jeune] → accès uniquement par l'API S3, remplaçable par MinIO ou Garage sans changer le code.
- [Une seule instance] → assumé (peu de joueurs) ; un redémarrage annule les tours en cours, le reste est en base.
- [Extensions hors boutique] → sous Windows et macOS, Chrome n'a ni mise à jour automatique ni installation en un
  clic ; le panneau dit « Mets l'extension à jour » quand le protocole change (realtime-sync).
- [Moteurs repris de projets libres] → la licence du dépôt suit la leur (décision 16).
- [Origine variable sous Firefox] (`moz-extension://<uuid par installation>`) → impossible d'épingler l'origine
  WebSocket de Firefox ; l'authentification repose sur le code, `ALLOWED_ORIGINS` filtre seulement Chrome et Edge.
- [Aperçus de lien] → le serveur lit des pages au nom des joueurs : protections SSRF de la spec du chat.
- [Données personnelles, dépôt public, serveur ouvert] → codes en empreinte, pas d'e-mail, pas d'adresse IP gardée
  au-delà des limites d'essais ; suppression de compte à trancher (question 21 de `define-game-concept`).

## Migration Plan

1. Créer `~/projects/slopesque` (git local), y reprendre `openspec/` de la maquette, le `CLAUDE.md` adapté et les
   icônes ; le dépôt GitHub public `recovizzi/slopesque` est créé avec l'accord de l'utilisateur, puis poussé.
2. Construire par jalons (tasks.md) : chaque jalon se joue de bout en bout sur le Docker local.
3. `semicirculardisk` reste la maquette de référence (captures, comportements attendus) ; plus de nouvelles fonctions.
4. Premier déploiement : `pnpm stack:up` sur le Docker local ; puis sur la machine fournie avec `pnpm deploy`. Retour
   arrière : l'image précédente sur GHCR (les données ne reviennent pas : pas de sauvegarde).

## Open Questions

1. **Certificat** (bloque seulement le chiffrement en production) : la V1 démarre en clair (`ALLOW_INSECURE=true`, le
   panneau le dit) ; le choix sslip.io / certificat d'IP se fera quand l'utilisateur aura tranché (ports 80 / 443).
2. ~~Clés AMO~~ → décidé : des clés propres à Slopesque (décision 17, revue le 2026-11-20).
3. ~~Accès de déploiement~~ → décidé : `pnpm deploy:prod` lancé par l'utilisateur (alias SSH et compte dans son `.env`, jamais dans le dépôt) ; CI sur les runners GitHub, comme
   `jethub` (décision 17).
4. Les questions de règles de jeu de `define-game-concept` (1, 2, 5, 6, 8, 9, 12, 14 à 20) et la question 21 (compte)
   restent ouvertes ; elles ne bloquent pas le socle, et les choix provisoires de la maquette s'appliquent en attendant.
