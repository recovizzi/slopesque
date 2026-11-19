## Why

La maquette (`define-game-concept`) est complète : chaque activité, le chat, le compte par code et les cartes y sont
jouables avec de faux joueurs. Il faut maintenant la rendre **fonctionnelle**, en vrai multijoueur, dans un nouveau
projet propre par construction (`slopesque`), public sur GitHub, qu'on puisse copier sans jamais copier ses secrets, et
léger pour un serveur à la taille d'un nombre modéré de joueurs.

## What Changes

- **Nouveau dépôt `slopesque`** (dossier `~/projects/slopesque`, public) : un monorepo pnpm + Turborepo qui réunit
  front, serveur, extension, paquets partagés et infra. Le dépôt `semicirculardisk` reste la maquette de référence ;
  ses specs (`openspec/`) sont reprises telles quelles.
- **Stack** : serveur **NestJS** (TypeScript), front **React + Vite** embarqué dans l'extension (Next.js écarté :
  incompatible avec une extension MV3, voir design), **Postgres** (données), **RustFS** (images, API S3), **Redis**
  (cache des requêtes externes, limites d'essais). Un paquet `shared` (types, schémas zod du protocole) et un paquet
  `engines` (règles des jeux et robots, en TypeScript pur) servent au serveur et au front.
- **Temps réel** : une connexion **WebSocket** par panneau (Socket.IO) pour le chat et les jeux ; le serveur fait foi
  (état, minuteurs, robots, cartes cachées). HTTP seulement pour l'envoi d'images, les GIF et la santé. Pas de SSE.
- **Conservation simple et jetable** : messages du chat **30 jours** ; images du chat **7 jours** ; stickers, emoji et
  photos tant qu'ils servent (remplacés ou retirés : supprimés aussitôt) ; un salon supprimé ne laisse aucune trace ;
  **aucune sauvegarde**, et c'est dit. **BREAKING** (par rapport à la maquette) : fin de la purge « 8 h après la
  dernière activité ».
- **Commandes d'admin en console** sur le serveur, sans interface graphique : salons (créer avec sa clé, lister,
  supprimer), comptes (chercher, remettre un code à zéro par son uuid), crédit social, modération, médias.
- **Services externes avec repli** : GIF, aperçus de lien, stockage, cache, intégrations ; une clé absente ou refusée
  donne un message clair à l'endroit concerné, jamais une panne de l'ensemble.
- **Dépôt public et secrets** : `.env.example` versionné, `.env` jamais ; secrets de CI et de déploiement dans les
  environnements GitHub ; un serveur de production refuse de démarrer avec les secrets de développement ; un fichier
  **`MANQUES.md`** non versionné, à la racine, liste les actions qui attendent l'utilisateur (clés, hébergement…).
- **Développement local d'abord** : `pnpm dev` lance tout (Postgres, Redis, RustFS en conteneurs) sans aucune clé ;
  `pnpm doctor` dit ce qui manque et ce qui fonctionne en mode dégradé.
- **Extension** : même panneau flottant ; en option, le panneau **reste ouvert d'une page à l'autre** (permission
  demandée à l'activation) ; un **raccourci clavier** ouvre et ferme le panneau, réglable depuis l'onglet Extension.

## Capabilities

### New Capabilities
- `platform-architecture`: le monorepo (dossiers, paquets partagés), la stack, le serveur qui fait foi, une seule
  instance
- `realtime-sync`: la connexion temps réel (authentification par code, salon, état complet à la connexion,
  reconnexion, présence, plusieurs connexions, vues par joueur, minuteurs côté serveur)
- `data-retention`: ce qui est gardé, combien de temps, où (Postgres, RustFS, Redis), les purges et les sauvegardes
- `admin-console`: les commandes d'admin dans le terminal du serveur
- `external-services`: les services hors projet (GIF, aperçus de lien, stockage, cache, intégrations) et leurs replis
- `repo-and-secrets`: dépôt public, configuration, secrets, CI, déploiement, `MANQUES.md`, `pnpm doctor`
- `panel-persistence`: le panneau qui reste ouvert d'une page à l'autre (option), le raccourci clavier, plusieurs onglets

### Modified Capabilities
(aucune : les specs de `define-game-concept` ne sont pas encore archivées ; ce change corrige directement leur règle
de durée de vie, voir Impact)

## Impact

- **Nouveau dépôt** `slopesque` ; `semicirculardisk` est gelé comme maquette (plus de nouvelles fonctions).
- `define-game-concept` : « Durée de vie des données » (game-session) passe de la purge à 8 h aux durées de
  `data-retention` ; « Formats d'image » et « Conservation des images du chat » (media-storage) restent valables ; les
  photos, stickers et emoji sont gardés tant que leur salon existe. La question ouverte 18 est en partie tranchée.
- `apps/server` (FastAPI) est abandonné au profit de NestJS ; rien n'est en production, aucune donnée à migrer.
- Identité de l'extension : nouvel identifiant Firefox (`slopesque@…`), clés de stockage `slp-*` : les installations de
  la maquette ne gardent pas leurs réglages.
- Hébergement : la machine fournie par l'utilisateur (Docker, 50 Go), adresse `IP:port` sans domaine, un seul port
  public ; distribution de l'extension par les releases GitHub seulement.
- Actions qui attendent l'utilisateur (dans `MANQUES.md`) : clés KLIPY / GIPHY, accord pour créer le dépôt GitHub
  public, ports de la machine, secrets de release (clé CRX, clés d'API AMO), alias SSH local.
