## Why

Poser par écrit le concept du jeu (première définition donnée le 2026-11-13) pour l'affiner ensemble avant de coder
le multijoueur. La maquette (apps/web, mode `MAQUETTE`) sert à valider la compréhension du design ; ce change en est
la référence écrite et liste ce qui reste à décider.

## What Changes

- Une activité **Cartes** avec une liste de jeux : le **Trou du cul** et le **Tarot** (maquette : cartes SVG, main
  en éventail, coups animés, règles illustrées ; atouts habillables par l'hôte avec ses images), puis **Texas
  Hold'em** et **Coinche** ; des points au
  classement, et pour la V1 des robots, des paris et un vote contre les absents.
- Un **palmarès** dans le tiroir de gauche : tous ceux qui ont joué, parties gagnées et taux de victoire, par jeu,
  mesure et période, gardé même après une réinitialisation des scores. Le Tarot se joue à 4 ou à 5 (Roi appelé),
  des robots complètent les tables.
- Des **intégrations** : une page web externe dans la zone de jeu, d'abord le jeu **Low Tide** ; l'hôte peut changer
  son adresse, vérifiée par le nom que la page déclare ; une carte remplace le cadre quand la page ne répond pas.
- Le projet et l'extension s'appellent **Slopesque** (« Demi-disque » reste le nom de l'activité principale).

- Un jeu en réseau joué depuis une **extension de navigateur** : une page avec le **sujet** du tour, un **demi-disque**
  SVG dessiné en contour, et sous lui les **deux extrémités** (gauche / droite).
- Un **hôte** choisit le sujet et les extrémités, écrit un **mot** et clique dans le demi-disque pour placer **son
  rayon** (le degré du mot entre les deux extrémités).
- Les **candidats** (ceux qui ont cliqué « Participer ») voient le mot et placent leur rayon dans le **temps de
  réponse** choisi par l'hôte (**15, 30 ou 60 s**, 30 par défaut) ; chaque rayon validé devient visible de tous ; le
  tour se termine à la fin du temps **ou dès que tous les candidats ont validé** ; des **points** selon la distance au
  rayon de l'hôte, avec un **bonus perfect** (le rayon de l'hôte a une épaisseur).
- Deux **modes de scrutin** choisis par l'hôte : « **Rayon libre** » (ci-dessus) et « **Amphithéâtre** » (l'hôte
  choisit une **colonne** de sièges, chaque candidat un **siège unique** ; perfect dans la colonne, sinon points selon
  le nombre de colonnes d'écart). L'**hôte marque aussi** des points selon la proximité des candidats (sans perfect).
  Les **règles** changées pendant un placement s'appliquent à sa fin.
- Une deuxième **activité**, le **Sondage** : l'hôte écrit une question dans la zone de jeu, en **choix définis**,
  **choix libre** ou **gradient** (curseur entre 2 propositions, forme 2D au-delà) ; ouvert 3 min à 3 h (5 min par
  défaut) ; résultats en barres, réponses regroupées avec pastille « ×n », ou carte de chaleur et températures ;
  l'hôte répond aussi et départage une égalité (« Avantage hôte ») ; résultats secrets ou nominatifs.
- Une troisième activité, la **Roulette** : l'hôte construit sous les yeux de tous une roue de propositions avec un
  **poids** facultatif (sans poids : part égale du reste sur 100 ; alerte au-dessus de 100 ; total sous 100 ramené à
  100), puis la lance ; une aiguille tourne, ralentit et s'arrête sur un angle tiré au hasard, qui désigne le résultat.
- Une activité **Chat** : le chat seul en plein écran, la liste des joueurs à gauche. Hors Demi-disque, le classement
  devient une **liste des joueurs** (scores gardés jusqu'à une réinitialisation). Le chat gagne un menu **+**
  (fichier, sticker, emoji), une **fenêtre d'emoji** complète par catégories, des **emoji personnalisés** pour toute la
  partie, des **réactions** aux messages, des **GIF** (recherche, récents, favoris, chargement en défilant ; liens vers un
  fournisseur — KLIPY / GIPHY en chaîne de secours derrière notre serveur, avec une réserve de résultats), le **glisser-déposer**, l'envoi d'**images** et une **bibliothèque de
  stickers**. Un clic
  sur la clé de salon la **copie**.
- Chaque joueur a une **couleur** (attribuée par défaut, puis choisie sur un dégradé arc-en-ciel mat) ; un
  **classement** avec **podium**.
- Le jeu **s'adapte à la taille du panneau** sans défiler : disque redimensionné, disposition horizontale quand le
  panneau est large mais bas.
- Un **tiroir gauche** repliable (onglets Chat / Classement) et un **tiroir droit** (icône joueur, onglets Profil /
  Extension / Partie) ; l'hôte y change sujet et extrémités, réinitialise la partie, et peut **donner son rôle** depuis
  le classement ; s'il part, le **joueur le plus ancien** devient hôte.
- Un **serveur** FastAPI + Postgres. Des **salons**, rejoints avec leur **clé**, créés par un **admin** (route
  réservée sur le conteneur) ; chaque joueur garde une **liste de salons** (nom perso) pour passer de l'un à
  l'autre, peut en « créer » un qui reste **en attente** jusqu'à l'admin, et voit une erreur distincte pour un
  salon inconnu ou un serveur injoignable. Les données de jeu d'un salon sont purgées **8 h** après sa dernière
  activité (le salon reste).
- Un **code utilisateur** remplace compte et mot de passe : tiré au hasard au premier lancement, changeable à tout
  moment (reprendre un compte existant ou repartir de zéro, confirmé), il relie la sauvegarde du joueur sur plusieurs
  appareils. Une **photo de profil** par salon. Les **liens** du chat sont cliquables, avec un **aperçu** lu par le
  serveur quand le site en donne un. Les images sont stockées dans un format par usage, une seule fois par empreinte,
  et celles du chat sont gardées **une semaine**.

## Capabilities

### New Capabilities
- `semicircle-disk`: le demi-disque SVG, ses extrémités, la sélection d'un rayon, l'affichage des rayons colorés
- `round-flow`: déroulé d'un tour (mot de l'hôte, placement en 30 s, révélation), règles, barème et classement
- `poll-activity`: l'activité Sondage (préparation, réponses, durée, résultats par type, avantage hôte, secret)
- `leaderboard`: le palmarès (conservation, filtres et mesures par jeu)
- `card-games`: l'activité Cartes, la présentation des cartes et de la main, le Trou du cul, la V1 (robots, paris, absents)
- `web-integration`: une page web externe dans la zone de jeu (Low Tide), son adresse vérifiée, la page qui ne répond pas
- `chat-activity`: l'activité Chat, la liste des joueurs hors jeu, le menu « + », images et stickers
- `roulette-activity`: l'activité Roulette (construction de la roue, poids et parts, tirage animé)
- `amphitheatre-mode`: le mode de scrutin Amphithéâtre (colonne de l'hôte, siège unique par candidat, points en colonnes)
- `game-session`: salons (clé, création par un admin, liste, salon en attente, erreurs), lobby, rôle d'hôte et sa transmission, durée de vie des données
- `game-panels`: tiroir gauche (chat, classement) et tiroir droit (profil, extension, partie)
- `extension-shell`: l'extension (panneau flottant, popup de secours), la page « installe l'extension », les releases
- `player-account`: le code utilisateur (identité sans mot de passe, premier lancement, changement, authentification,
  sauvegarde liée), la photo de profil par salon
- `media-storage`: les images sur le serveur (format par usage, une seule copie par empreinte et usage, images du chat
  gardées une semaine)

### Modified Capabilities
(aucune : premier change)

## Impact

- `apps/web` : maquette actuelle → vraie app connectée au serveur (WebSocket).
- `apps/server` : aujourd'hui `POST /api/games`, `GET /api/games/{key}`, purge des parties expirées ; à venir :
  joueurs, tours, chat, WebSocket.
- `extension` : build, icônes, workflows CI / release.
