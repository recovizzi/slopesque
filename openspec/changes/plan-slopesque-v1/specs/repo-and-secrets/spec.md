## ADDED Requirements

### Requirement: Aucun secret dans le dépôt
Le dépôt étant **public**, aucun secret ne MUST y entrer : `.env` et `MANQUES.md` MUST être ignorés par git ;
`.env.example` MUST lister chaque variable avec son rôle, sans valeur secrète (des valeurs de développement local
seulement, marquées comme telles). Un contrôle de secrets (gitleaks) MUST tourner en hook de commit et en CI.
L'extension et le front ne MUST contenir aucune clé (clés de GIF, secrets du serveur) : tout appel qui en demande une
passe par le serveur.

#### Scenario: Clé collée par erreur
- **WHEN** un développeur commite un fichier qui contient une clé KLIPY
- **THEN** le hook refuse le commit et la CI échouerait de même

### Requirement: Configuration validée au démarrage
Le serveur MUST lire sa configuration dans l'environnement, la valider (schéma zod de `packages/shared`) et refuser de
démarrer avec un message par variable fautive. En production (`NODE_ENV=production`), il MUST refuser les valeurs de
développement de `.env.example` (secret HMAC des codes, mots de passe de Postgres et RustFS) et un `ALLOWED_ORIGINS`
vide. Les clés externes (GIF) MUST être facultatives (voir Repli pour chaque service externe).

#### Scenario: Production avec le secret d'exemple
- **WHEN** le serveur démarre en production avec `CODE_HMAC_SECRET=dev-only-change-me`
- **THEN** il s'arrête : « CODE_HMAC_SECRET : valeur de développement interdite en production »

### Requirement: Développement local sans rien demander
`pnpm dev` MUST lancer Postgres, Redis et RustFS (Docker Compose, données dans des volumes locaux), appliquer les
migrations, créer le compartiment RustFS, puis lancer le serveur et l'app web en mode surveillé, avec les valeurs de
`.env.example` si `.env` manque. Une commande MUST remplir la base de démonstration (les salons, joueurs et messages de
la maquette). `pnpm doctor` MUST dire, service par service et clé par clé, ce qui marche, ce qui est en mode dégradé et
ce qu'il faut faire.

#### Scenario: Premier clone
- **WHEN** quelqu'un clone le dépôt et lance `pnpm install && pnpm dev`
- **THEN** l'app fonctionne en local, sans GIF ; `pnpm doctor` dit qu'il manque une clé de GIF et où la mettre

### Requirement: CI sans secret pour les contributions
Le workflow des pull requests MUST tourner sans aucun secret (types, lint, tests unitaires, tests du serveur avec
Postgres, Redis et RustFS en services de CI, tests de bout en bout de l'extension contre un serveur local), y compris
pour une pull request venue d'un fork ; aucun workflow ne MUST exécuter le code d'une pull request avec des secrets
(`pull_request_target` interdit avec un checkout de la PR).

#### Scenario: Pull request d'un fork
- **WHEN** quelqu'un propose une pull request depuis son fork
- **THEN** tous les contrôles tournent, sans accès à aucun secret du dépôt

### Requirement: Releases de l'extension sur GitHub
L'extension MUST être distribuée **seulement** par les releases GitHub du dépôt (pas de Chrome Web Store ni de fiche
publique sur addons.mozilla.org), selon la méthode du projet `jethub` : un workflow manuel sur un tag `vX.Y.Z` (le tag
et la version de `package.json` MUST correspondre) publie le zip (Chrome, Edge, Brave : « Charger l'extension non
empaquetée », tous systèmes), le `.crx` signé par la clé `CHROME_CRX_KEY` (glissé sur `chrome://extensions` sous Linux ;
la clé fixe l'identifiant de l'extension) et le `.xpi` signé par Mozilla sur le canal **non listé** (installation
permanente dans Firefox, sans fiche publique). La page de release MUST expliquer l'installation sur chaque navigateur.
Ces secrets MUST vivre dans l'environnement GitHub `release` ; un secret absent MUST sauter le paquet qui en dépend
avec la raison dans le résumé du workflow (« .xpi non signé : MOZILLA_API_KEY absent »), sans faire échouer les autres.

#### Scenario: Release sans clés Mozilla
- **WHEN** la release d'un tag tourne sans `MOZILLA_API_KEY`
- **THEN** la page contient le zip et le .crx, et le résumé dit que le .xpi signé a été sauté et pourquoi

#### Scenario: Copie du projet
- **WHEN** quelqu'un forke le dépôt et lance la release sans configurer de secrets
- **THEN** il obtient le zip de l'extension et l'image du serveur ; le .crx et le .xpi signé sont sautés, avec la raison

### Requirement: Déploiement sur le serveur du projet
Le serveur, sa base, son stockage et son cache MUST tourner ensemble sur **une seule machine** (Docker Compose), avec
**un seul port public** : celui du serveur, qui sert l'API, le WebSocket, les images (`/media/…`) et la page
« Installer l'extension ». Postgres, Redis et RustFS MUST rester sur le réseau interne de Compose, jamais exposés. Sans
nom de domaine, l'adresse du serveur MUST être `IP:port`, réglée dans l'onglet Extension. L'image du serveur MUST être
publiée sur GHCR (publique, sans secret) ; la machine reçoit ses secrets par son propre `.env`, jamais par le dépôt.
L'adresse de la machine, son port SSH et ses comptes ne MUST jamais apparaître dans le dépôt : ils vivent dans la
configuration SSH locale et dans `.env`. Le déploiement MUST se faire par une commande locale (`pnpm deploy`) qui se
connecte en SSH, passe sur le compte de déploiement et lance `docker compose pull && docker compose up -d` ; un
déploiement par la CI (environnement `production`) n'est possible qu'avec une clé SSH dédiée au compte de déploiement.
Le même `docker-compose.prod.yml` MUST pouvoir tourner sur le Docker local (`pnpm stack:up`) pour tester la version de
production avant de la déployer.

#### Scenario: Tester la production en local
- **WHEN** le développeur lance `pnpm stack:up`
- **THEN** la pile de production tourne sur sa machine, et l'extension réglée sur `http://localhost:<port>` y joue

#### Scenario: Ports du serveur
- **WHEN** quelqu'un scanne les ports de la machine de production
- **THEN** il ne trouve que le port SSH et le port de Slopesque ; ni Postgres, ni Redis, ni RustFS

### Requirement: Fichier des manques
Un fichier `MANQUES.md` à la racine (non versionné) MUST lister les actions qui attendent l'utilisateur pour finir un
développement bloqué : pour chacune, ce qu'il faut faire (pas à pas), pourquoi, où mettre le résultat (variable de
`.env`, secret d'un environnement GitHub), et ce que ça débloque. Il MUST être tenu à jour pendant le développement :
une action faite est cochée, une nouvelle est ajoutée quand un développement bloque.

#### Scenario: Clé de GIF fournie
- **WHEN** l'utilisateur met `KLIPY_API_KEY` dans `.env` comme indiqué dans `MANQUES.md`
- **THEN** `pnpm doctor` voit les GIF actifs et l'entrée peut être cochée
