## Context

Base de projet posée le 2026-11-13 : monorepo pnpm (apps/web, extension) + uv (apps/server), maquette jouable en
local avec de faux joueurs. Rien n'est encore en réseau. Le format d'extension reprend celui de gitantix (panneau
flottant arrondi injecté dans l'onglet courant), avec un design propre au projet, volontairement simple.

## Goals / Non-Goals

**Goals:**
- Un demi-disque précis et agréable à cliquer, lisible avec plusieurs rayons de couleur.
- Un serveur simple à héberger (un conteneur + Postgres), qui ne grossit jamais (purge à 8 h).
- Une extension installable depuis les releases GitHub, sans store au début.

**Non-Goals:**
- Comptes utilisateurs, authentification forte, historique au-delà d'une journée.
- Publication sur les stores (Chrome Web Store, AMO listé) pour l'instant.

## Decisions

1. **L'app vit dans l'extension**, pas sur un site. Le build de `apps/web` est copié dans l'extension (`app/`) et
   framé par le panneau (`app/index.html?embed`, ressource web-accessible). Les pages d'extension peuvent appeler
   le serveur (fetch + WebSocket ; le serveur autorise les origines `chrome-extension://` / `moz-extension://`).
   Le même build, servi comme site, affiche « installe l'extension » avec le lien de la release.
   *Rejeté* : un site hébergé framé par l'extension — inutile tant que tout tient dans l'extension, et dépend de
   l'hébergement du front.
2. **Panneau flottant** injecté par l'icône (`activeTab` + `scripting`), popup classique en secours sur les pages
   où les extensions ne tournent pas. *Raison* : coins arrondis, ombre, redimensionnable (leçon gitantix).
3. **Position d'un rayon = valeur 0 → 100** (0 = extrémité gauche, 100 = droite ; angle = valeur × 1,8°). Le
   serveur et le barème ne manipulent que cette valeur ; le SVG la convertit.
4. **Front sans framework** (Vite + TypeScript, rendu par chaînes HTML + un composant SVG persistant) pour la
   maquette. À réévaluer quand l'état viendra du serveur (Preact / Svelte si le rendu manuel devient pénible).
5. **Temps réel par WebSocket** (FastAPI natif), une connexion par joueur et par partie ; l'état fait foi côté
   serveur (le timer de 30 s aussi, pour que tout le monde voie la même fin).
6. **Durée de vie** : chaque partie a un `expires_at` = création + 8 h ; tout ce qui s'y rattache est supprimé en
   cascade par une purge toutes les 10 min. Rien d'autre n'est stocké hors d'une partie. *Revu par la décision 21*
   (salons persistants, données de jeu purgées 8 h après la dernière activité).
7. **Clé de salon** (ex-« clé de partie ») : 8 caractères `XXXX-XXXX` sans caractères ambigus (0/O, 1/I/L), saisie insensible à la casse
   et aux tirets.
8. **Fin du tour** (décidé le 2026-11-13) : à la fin du temps de réponse, ou dès que tous les candidats ont validé.
   Le temps de réponse est choisi par l'hôte dans l'onglet Partie : 15, 30 (défaut) ou 60 s.
   **Règles** (décidé le 2026-11-16) : l'hôte change sujet, extrémités, temps et mode de scrutin quand il veut ;
   pendant un placement, le changement attend la fin du placement (un tour en cours garde ses règles), ailleurs il
   s'applique aussitôt. Le tour mémorise son mode, pour que ses résultats restent affichés dans ce mode.
   *Rejeté* : griser les réglages pendant un placement (l'hôte devrait revenir plus tard).
9. **Couleurs** (décidé le 2026-11-13) : une couleur = une teinte (0–359°) à saturation et luminosité fixes, mates
   (`hsl(h 58% 50%)`), lisibles en clair et en sombre. À l'arrivée, une teinte par défaut libre dans la partie ;
   ensuite un curseur sur tout l'arc-en-ciel (le bouton du curseur montre la couleur, des points marquent celles
   des autres). Appliquée après **3 s sans changement** (pas de spam au serveur) ; refusée si elle est à moins de
   12° de celle d'un autre joueur. *Rejeté* : une palette fixe de 8 couleurs (trop peu de choix).
10. **Mise en page responsive** (décidé le 2026-11-13) : la zone de jeu ne défile jamais au-dessus d'une taille
   minimale (disque 220 px de large, zone 340 px de haut) ; le disque prend la place laissée par le titre et les
   actions en gardant ses proportions (container queries CSS). Panneau large et bas (ratio ≥ 1,7, ou ≥ 1,3 sous
   460 px de haut) : disque à gauche, titre + actions à droite.
11. **Barème (brouillon, maquette)** : distance `d` = |candidat − hôte| sur 0..100 ; `d ≤ 3` (± 5,4°, l'épaisseur
   du rayon de l'hôte) → **perfect = 100 + 50** ; sinon `100 × (1 − (d − 3) / 27)`, 0 au-delà de 30 (54°).
   Amphithéâtre : `c` = colonnes d'écart ; `c = 0` → perfect = 100 + 50 ; sinon `100 × (1 − (c − 1) / 7)`, 0 à
   8 colonnes (≈ 58°, proche du mode Rayon libre).
   **Hôte** (décidé le 2026-11-16 : il marque, sans perfect, calcul différent ; valeurs en brouillon) : moyenne sur
   les candidats validés de `100 × (1 − d / 30)` (Rayon libre) ou `100 × (1 − c / 8)` (Amphithéâtre), bornée à 0 ;
   pas de plateau de tolérance, donc 100 seulement si tous visent pile. 0 si personne n'a validé. *Rejeté* : la
   somme (avantagerait les parties nombreuses) ; la meilleure distance (un seul candidat suffirait).
12. **Modes de scrutin** (décidé le 2026-11-16) : « **Rayon libre** » (le mode d'origine, nommé explicitement) et
   « **Amphithéâtre** », choisis par l'hôte. L'amphithéâtre reprend les exemples `temp/hemicycle*.svg` : 7 rangs ×
   25 colonnes de sièges arrondis, généré par `amphi.ts` dans le même viewBox que le disque (même mise en page).
   L'hôte clique une colonne (ses 7 sièges prennent sa couleur) ; chaque candidat valide un siège libre, unique
   (premier validé, premier servi ; le serveur arbitrera). Un clic entre deux sièges vaut le siège le plus proche.
   À la révélation, la colonne de l'hôte devient une bande à sa couleur qui dépasse des sièges (extrémités pleines
   devant le premier rang et après le dernier) et les sièges des candidats dans la colonne gardent un contour à
   la couleur de l'hôte : la colonne reste lisible sous les couleurs des candidats. Réponses : colonne 0..24 pour
   l'hôte, siège `colonne × 7 + rang` pour un candidat. *Rejeté* : réutiliser les chemins des SVG d'exemple tels
   quels (820 × 430, autre géométrie que le disque).

13. **Activités** (décidé le 2026-11-16) : une partie a une activité, « Demi-disque » (avec ses deux modes de
   scrutin), « Sondage », « Roulette » ou « Chat », d'autres viendront peut-être. L'onglet Partie montre d'abord l'activité, puis un séparateur,
   puis les paramètres de cette activité seulement. Le tour mémorise son activité (comme son mode), et les phases
   sont partagées : lobby → phase de l'hôte (mot / préparation) → réponses → résultats.
   *Rejeté* : un onglet par activité (les paramètres d'une activité inactive embrouillent).
14. **Sondage** (décidé le 2026-11-16) : question et type de réponse dans la zone de jeu (pas dans les paramètres,
   ils changent à chaque sondage) ; durée 3 min → 3 h, 5 min par défaut ; fin au temps, quand tous les candidats
   ont répondu, ou par l'hôte. Pas de points. Choix libres regroupés sans casse, accents, espaces ni ponctuation
   finale. Gradient : réponse = un point ; 2 propositions → curseur `[t, 0]`, 3+ → polygone régulier de rayon 1,
   premier coin en haut. **Température** (revue le 2026-11-16) : chaque joueur distribue 100 points entre les
   propositions ; ses parts = ses coordonnées barycentriques dans la forme (Wachspress : 1 sur un coin, linéaires
   sur un bord, égales au centre ; `1 − t` / `t` sur le curseur) élevées au carré puis renormalisées ; température =
   moyenne des parts, en ° (total ≈ 100). Ex. carré, à mi-chemin du centre vers un coin : 80 / 9 / 9 / 1 ; un joueur
   sur le coin A et trois à mi-chemin de B → A 32°, B 61°. *Rejeté* : la moyenne de `1 − d / d_max` (première
   version : chaque joueur ne distribuait pas le même total, un joueur collé à un coin pesait trop face à un groupe
   à mi-distance — B ne gagnait que 64 contre 58) ; les parts barycentriques sans carré (B 42 contre A 39, les
   voisins captaient trop). Couleur des températures relative à la plus chaude, comme la carte de chaleur. Carte de chaleur = somme de gaussiennes
   (canvas → PNG dans le SVG, découpé à la forme). Égalité pour la 1re place : la réponse de l'hôte tranche
   (« Avantage hôte » en bas à gauche), sinon « Égalité ». Résultats nominatifs : une bulle au survol (pas
   `title`, trop lent et invisible au tactile) ; secrets : ni noms ni couleurs.
15. **Barre MAQUETTE** (outil de test, pas du jeu) : ses boutons dépendent de l'activité (phases, modes de scrutin,
   sondages ou roues d'exemple ; en Chat, faux message, fausse image, vider ses stickers) ; elle tient sur une ligne et défile à l'horizontale, barre de défilement masquée (sinon
   elle ajoute de la hauteur et déforme la zone de jeu), molette comprise.
16. **Roulette** (décidé le 2026-11-16) : la roue se construit dans la zone de jeu, visible en direct par tous (le
   brouillon de l'hôte fait partie de l'état diffusé). Poids facultatif par proposition : sans poids → part égale
   de `100 − somme des poids donnés` ; total des poids > 100 → alerte et lancement bloqué ; total < 100 sans
   proposition sans poids → ramené à 100 au lancer. Secteurs dans l'ordre de la liste, depuis le haut, dans le sens
   des aiguilles ; couleur par rang (angle d'or, stable quand on ajoute). Tirage : le serveur tire un angle uniforme
   0–360° (0,1° près) et en déduit le gagnant ; les clients animent l'aiguille (6 s, 6 tours, ralentissement
   quartique) depuis l'heure du tirage et l'angle où le tirage précédent l'a laissée, donc tous voient le même
   mouvement. Pas de minuteur ni de points. La roue reste après un tirage (« Relancer » / « Modifier la roue »).
   *Rejeté* : une roue qui tourne sous un repère fixe (l'utilisateur a demandé une barre qui tourne) ; tirer une
   proposition puis un angle dans son secteur (même loi, mais « un degré tiré au hasard » est plus simple à
   vérifier).
17. **Chat et activités sans points** (décidé le 2026-11-16) : l'activité « Chat » remplace la zone de jeu par le
   chat (largeur max 860 px, suit le tiroir gauche), le tiroir gauche ne garde que la liste des joueurs. Dans toute
   activité sans points (Sondage, Roulette, Chat), « Classement » devient « Joueurs » : hôte en premier, couronne
   pour donner le rôle, pas de scores affichés ; les scores restent tels quels jusqu'à « Réinitialiser la partie ».
   Menu « + » à droite de l'envoi : Fichier, Sticker, Emoji. Fichier choisi ou glissé → aperçu → « Sticker » (ajouté à la bibliothèque **et** envoyé, stocké à 256 px au plus,
   affiché à 96–128 px) ou « Image » (envoyée, réduite à 1600 px au plus, affichée à 300 × 220 dans le tiroir,
   480 × 340 en plein écran) ; proportions toujours gardées ; un GIF assez léger reste animé. Images seulement pour
   l'instant. Bibliothèque de stickers : d'abord sur l'appareil, puis **commune au salon** (décision 21). Images du chat côté serveur : rattachées à la partie, purgées avec elle. Clé de partie :
   un clic la copie (« Copiée ✓ »).
18. **Emoji et réactions** (décidé le 2026-11-16) : une page web ne peut pas ouvrir le sélecteur d'emoji du système
   (Windows + ., Ctrl + Cmd + Espace) ; la fenêtre d'emoji est `emoji-picker-element` (web component sans framework,
   Apache-2.0) avec les données `emoji-picker-element-data` en français (emojibase / CLDR : la liste et les catégories
   Unicode qu'utilisent Google, Apple et Windows ; ~400 Ko, ~67 Ko compressés), livrées dans l'extension, chargées à
   la première ouverture, en cache dans IndexedDB. Les emoji s'affichent avec la police du système (Segoe UI Emoji,
   Noto Color Emoji…). Fenêtre flottante à côté de son bouton (au-dessus s'il y a la place). Emoji personnalisés :
   image 128 px PNG, nom `[a-z0-9_]{2,24}`, gardés dans la partie (pour tous, purgés avec elle), `:nom:` dans le
   texte. **Codes** (revu le 2026-11-16) : `apps/web/scripts/shortcodes.mjs` génère `src/emoji-fr.json` = les données
   françaises du picker + les codes de chaque emoji (alias français courts choisis à la main, puis emojibase anglais,
   GitHub, puis nom CLDR français ; un code → un seul emoji, le premier qui le prend ; 4 703 codes, 1 923 / 1 923
   emoji) : le picker les cherche et les affiche, le chat les propose en tapant `:co` et les remplace à l'envoi (les
   réactions gardent l'emoji tel que dans les données, 👍 avec VS16, pour qu'un clic et un code donnent la même).
   **Patch** `patches/emoji-picker-element@1.29.1.patch` (pnpm) : « Personnalisé » en dernier onglet (la lib le met
   en premier, sans option), ouverture sur les Émoticônes, code dans le titre de chaque emoji. Réactions :
   `emoji → joueurs` par message ; barre au survol du texte seul, en surimpression collée sous le texte, centrée où le
   pointeur est entré (rien ne bouge ; marge fixe en bas du chat pour le dernier message), hors zone de survol et fond ; 4 réactions récentes par joueur (sur l'appareil), la dernière utilisée en
   tête ; double-clic = réaction rapide du Profil (👍 par défaut). Le chat garde
   sa position de défilement quand il se redessine (il ne descend au dernier message que s'il y était, ou quand on
   écrit). Les images ont leur taille avant d'être chargées (ratio et largeur en CSS) : pas de saut. *Rejeté* :
   barre de réaction dans le flux (deuxième version : elle faisait descendre les messages suivants, texte qui saute) ;
   barre en surimpression à droite chevauchant le message (première version) ; afficher le raccourci du
   système (première version, peu propre) ; `emoji-mart` (plus lourd,
   pensé pour React) ; des images d'emoji type Twemoji (100+ Ko d'images, style différent du système).

19. **GIF** (décidé le 2026-11-17) : fenêtre GIF flottante (comme les emoji) avec recherche, Tendances / Résultats,
   Récents (50), Favoris (500), pages de 24 chargées en défilant (deux colonnes, chaque GIF dans la plus courte : rien
   ne bouge quand une page arrive). Message = lien vers le fichier du fournisseur (MP4 / WebP, plus léger qu'un
   .gif) + son identifiant : rien de stocké chez nous, chaque joueur le charge (le fournisseur voit son adresse IP).
   Récents et favoris sur l'appareil (références, pas de fichiers). Recherche après 400 ms sans frappe, 2 caractères
   au moins, réponses périmées ignorées. Côté serveur : interface `GifProvider`, **chaîne de secours** dans l'ordre
   KLIPY sans pub → GIPHY sans pub → KLIPY avec pub (on commence sans pub, on passe au fournisseur suivant quand les
   crédits ou la limite sont atteints, la pub en dernier recours pour toujours avoir des résultats) ; une recherche
   et ses pages restent chez un fournisseur ; **réserve de résultats** en mémoire (clé = fournisseur + requête
   normalisée + page ; ~10 min pour les tendances, ~1 h pour les recherches ; taille bornée, les plus anciennes
   sortent) partagée par tous les joueurs, plus le compte des requêtes par fournisseur pour savoir quand basculer.
   Maquette : `DemoGifs` (SVG animés générés, 350–750 ms de délai, même réserve de pages). Ressources : Tenor fermé
   aux applications externes depuis le 30 juin 2026 ; GIPHY : clé de test 100 appels / h, production payante (prix
   sur demande), « Powered by GIPHY » obligatoire, pas de mélange de fournisseurs dans une grille ; KLIPY : clé de
   test 100 / h, production illimitée, pubs optionnelles (interrupteur par application, paramètres `ad-*` à
   envoyer, résultats `type: "ad"`), marque KLIPY à afficher. Contenu : `rating` au plus `r` chez les deux.
   *Rejeté* : masquer les pubs d'une clé « avec pub » (contraire à leur modèle, clé coupée) ; télécharger les GIF
   chez nous (stockage, droits) ; appeler le fournisseur depuis l'extension (la clé serait publique).

20. **Nom** (décidé le 2026-11-17) : le projet et l'extension s'appellent **Slopesque** (nom d'usage : en-tête,
   onglet, extension, page d'installation, serveur, fichiers de release `slopesque-*`). « Demi-disque » reste le nom
   de l'activité principale. Gardent l'ancien nom, pour ne rien casser : le dépôt GitHub `semicirculardisk` (le
   renommer change ses liens), l'id Firefox `semicirculardisk@recovizzi` (le changer ferait une autre extension pour
   Firefox), les clés de stockage `scd-*` (les changer perdrait les réglages, stickers et favoris des joueurs) et le
   préfixe des paquets `@scd/*`.

21. **Salons** (décidé le 2026-11-17) : on parle de **salon** (plus global que « partie ») ; une clé de salon le
   rejoint. Création **par un admin seulement** : route `POST /api/admin/rooms/{key}` sur le conteneur du serveur
   (jeton `SCD_ADMIN_TOKEN` dans l'environnement, route non exposée publiquement : `docker compose exec server curl
   -X POST -H "Authorization: Bearer $SCD_ADMIN_TOKEN" http://localhost:8000/api/admin/rooms/QKWV-B3M8`) ; elle crée
   le salon et ce qu'il lui faut. La route publique `POST /api/games` disparaît ; `GET /api/rooms/{key}` → 200 / 404.
   Côté extension : **liste des salons** sur l'appareil (`scd-rooms` : clé, nom perso, en attente) dans Paramètres →
   Extension, à la place du champ de clé ; ajouter (fenêtre clé + nom, clé vérifiée par le serveur), rejoindre,
   renommer (un), retirer (plusieurs, après confirmation, la liste seulement), créer (clé générée sur place, salon
   « en attente » en local jusqu'à sa création par un admin). Entrer dans un salon = interroger le serveur : « ok » →
   le salon ; sinon une **page** à la place du jeu : en attente (contacter un admin, clé copiable en un clic, comme
   en haut à droite), inconnu (404), serveur injoignable (pas de réponse) ; « Réessayer » partout. **Suit le joueur**
   (appareil) : profil, réaction au double-clic, réactions récentes, GIF récents et favoris, liste des salons,
   serveur, thème. **Appartient au salon** (serveur, commun à ses joueurs) : jeu, scores, chat, emoji
   personnalisés, stickers. **Durée de vie** (provisoire, question 18) : le salon (clé, emoji perso, stickers) dure
   jusqu'à sa suppression par un admin ; ses données de jeu (joueurs présents, tours, scores, chat, images) sont
   purgées 8 h après sa dernière activité. Maquette : `MockRooms` (seul `http://localhost:8000` répond ; il connaît
   K7QP-M2XD, B4NZ-7WQR, H8TC-3KDM ; bouton MAQUETTE « Admin : créer les salons en attente »), un état de jeu par
   salon en mémoire. *Rejeté* : création libre par n'importe quel joueur (des salons sans fin sur le serveur) ;
   stickers sur l'appareil (ils sont désormais communs au salon).

22. **Images des choix définis** (décidé le 2026-11-17) : une image facultative par choix (`pics`, alignée sur
   `choices`), parmi une image (réduite à 480 px, WebP), un GIF (lien vers le fournisseur, comme dans le chat) ou un
   sticker du salon ; l'emoji va dans le texte. Mêmes outils que le chat (« + », glisser-déposer). Un choix = un
   texte ou une image. Réponses : image au-dessus du texte ; résultats : vignette de 28 px. Côté serveur, les images
   des choix suivent les images du chat (rattachées au salon, purgées avec ses données de jeu).

23. **Intégrations** (décidé le 2026-11-17) : une activité peut afficher une page web externe (`integrations.ts`,
   un registre : nom attendu, adresse par défaut, aide) ; la première, **Low Tide** (la page se déclare « Low
   Tide » : `<title>` et manifeste `name` — la demande disait « Low Tile »). Cadre `sandbox="allow-scripts
   allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals"`, `referrerpolicy="no-referrer"`,
   rechargé seulement quand l'adresse change. L'adresse est une donnée du salon (`webUrls`), changée par l'hôte
   seulement après vérification du **nom déclaré** (manifeste `name` / `short_name`, titre, `application-name`) :
   pas de page inconnue glissée à la place. Lire un autre site depuis l'extension demande une permission
   (`optional_host_permissions` : `https://*/*`, localhost), demandée à l'hôte dans son clic, site par site ; HTML
   analysé par `DOMParser` (scripts jamais exécutés) ; en-tête `ngrok-skip-browser-warning` pour passer
   l'avertissement de ngrok. Avant de cadrer la page : elle répond ? (statut HTTP avec la permission, sinon une
   réponse `no-cors`) ; sinon une carte à la place du cadre (hôte : « Revoir l'adresse » ; autres : attendre l'hôte ;
   « Réessayer »). Dans le vrai jeu, la vérification se fera aussi côté serveur quand l'hôte enregistre l'adresse.
   *Rejeté* : cadrer n'importe quelle adresse (injection d'une page inconnue) ; vérifier seulement l'hôte de
   l'adresse (le jeu change d'adresse, ngrok) ; laisser le navigateur afficher son erreur dans le cadre.

24. **Cartes** (décidé le 2026-11-17) : une activité « Cartes » avec une liste de jeux ; retenus : **Trou du cul**,
   **Tarot**, **Texas Hold'em** (et la **Coinche** ensuite). La maquette montre le Trou du cul (règles les plus
   répandues, `tdc.ts` : 2 le plus fort, combinaisons de même valeur, autant de cartes plus fortes, un 2 ferme le pli,
   rôles Président → Trou du cul, échanges 2 et 1 cartes, le Trou du cul ouvre), avec des robots simplistes pour
   tourner. Rendu (`cards.ts`) : carte SVG 60 × 84 arrondie, valeur en haut à gauche, couleur (emoji) en haut à
   droite, miroir en bas, face claire dans les deux thèmes ; main en **éventail** (pivot commun à 5 hauteurs de
   carte sous la main, écart calculé pour tenir dans la largeur, angles écrits dans le HTML pour que rien ne bouge
   à chaque coup) ; survol = monte et passe devant (toute la face visible) ; carte jouée = vol animé vers le pli
   (Web Animations), cartes des autres depuis leur place ; pli ramassé laissé visible jusqu'au coup suivant. En-tête :
   jeu, manche, à qui de jouer, temps de jeu, « i » → règles illustrées. Points au classement du salon (activité
   « avec points », comme le Demi-disque). V1 : moteurs et robots repris de projets libres, paris, temps par tour,
   vote d'exclusion (décision 32 : après 30 s de tour), partie rallongeable. *Rejeté* : Président seul (le Trou du cul, ses rôles
   et ses échanges, plaisent plus) ; Estimation et Spades (pas retenus) ; images de cartes (lourdes ; SVG + emoji).

25. **Tarot** (décidé le 2026-11-18) : règles FFT à 4 (`tarot.ts`, d'après regles-du-jeu.net et le règlement FFT),
   simplifiées pour la maquette (pas de Petit au bout, poignées, chelem ; l'Excuse reste à son camp sans échange de
   demi-point) ; robots simplistes (enchère selon atouts, bouts et Rois ; écart des couleurs courtes ; carte la plus
   basse qui gagne, sinon la plus basse). Aucun moteur JavaScript prêt à l'emploi trouvé (TarotClub en C++, webtarot
   en Rust) : choix du moteur pour la V1 (question 20). Rendu (`tarot-view.ts`) : atout = carte blanche bordée d'or,
   bordure blanche intérieure, image (défaut : dégradé + emoji), numéro sur un cartouche blanc (`path` : angle libre
   arrondi, raccords concaves à la bordure), miroir en bas ; Excuse ★. Images des atouts : données du salon
   (`trumpArt`, WebP 360 px). Main : survol et sélection montent la carte **sans** la passer devant (sinon elle
   cachait la bande cliquable des voisines) ; éventail aplati (pivot à 8 hauteurs de carte, descente ≤ 34 px, écart
   ≤ 0,06 rad) pour les 24 cartes de l'écart. *Rejeté* : passer la carte survolée devant (première version : dans
   une grande main, on sautait 2 ou 3 cartes en glissant la souris).

26. **Tarot à 5 et robots** (décidé le 2026-11-18) : réglage « Joueurs : 4 / 5 » (Partie, à partir de la donne
   suivante). À 5 : 15 cartes, chien de 3, écart de 3 ; le preneur appelle un **Roi** — la demande disait « une
   Dame », mais la règle officielle (FFT, regles-du-jeu.net) appelle un Roi, une Dame seulement s'il a les 4 Rois, un
   Cavalier s'il a aussi les 4 Dames ; partenaire secret jusqu'à ce que la carte soit jouée ; seul (appel de soi, carte
   au chien) × 4 ; sinon preneur × 2, partenaire × 1, défenseurs −1 (les marques font 0) ; pas d'entame dans la
   couleur appelée au premier pli. Les places libres sont prises par des **robots** (`robot:n`, hors classement et
   palmarès). Correction : un robot plantait quand l'Excuse était entamée (le pli « seule l'Excuse » n'avait pas de
   gagnant provisoire), la donne restait bloquée.
27. **Palmarès** (décidé le 2026-11-18) : un 3ᵉ onglet du tiroir de gauche (l'actif avec son nom, les autres en
   icônes). Chaque résultat (`StatEvent` : salon, jeu, joueur, nom et couleur du moment, gagné, date, mesures du jeu)
   est gardé à part des scores, **jamais remis à zéro** ni purgé avec les données de jeu (il vit avec le salon) ;
   joueurs partis compris, robots exclus. Victoire : Demi-disque = meilleur score du tour ; Trou du cul = Président ;
   Tarot = camp gagnant. Filtres : jeu, mesure propre au jeu (`SORTS`), période (toujours, 30 j, 7 j) ; taux classés
   à partir de 5 parties (3 prises). Ouvert sur le jeu en cours. Maquette : 60 jours d'historique générés (graine
   fixe), dont Zoé partie il y a 25 jours.
28. **Mis de côté, à spécifier plus tard** : les **paris des spectateurs** sur un joueur d'une table pleine (après la
   V1 des cartes) ; les **réactions à effet visuel** (animations à l'écran à partir d'une réaction : à re-spécifier
   avant d'être conçues).

29. **Lisibilité du Tarot** (décidé le 2026-11-18) : annonces dans une couche au-dessus de la table (`announce-layer`,
   hors du rendu de la table pour que l'animation ne recommence pas) : « X prend · contrat » (2 s), puis à 5 la carte
   appelée retournée en 3D (`rotateY`, 2,8 s) ; les robots attendent. En-tête : `mini-card` (lettre + emoji de
   couleur). Plis : `tricks[joueur]` garde chaque pli tel que joué ; un pli complet reste 0,7 s, puis ses cartes se
   rassemblent au centre et volent vers le gagnant (mon tas en bas à droite, ou la pastille d'un adversaire, en
   s'effaçant). Consultation au survol (pastille ou tas, `data-won`) : voile sombre sur la table, plis en petits
   éventails (cartes 30 × 42, tournées autour d'un point bas), grille `auto-fill` (92 px, 70 px en étroit) ; la vue ne
   capte pas le pointeur (les pastilles restent survolables au-dessus). *Rejeté* : une « tour » de plis empilés (peu
   lisible, ne tient pas) ; laisser le dernier pli estompé sur la table (on ne voyait pas qui l'emportait).

30. **Chat par défaut et nouvelle icône** (décidé le 2026-11-18) : un salon s'ouvre sur l'activité Chat (le
   Demi-disque n'est plus qu'un jeu parmi d'autres). Icône (`extension/icons/logo.svg`, PNG par `pnpm icons`) et logo
   de l'en-tête : une bulle de chat blanche sur un carré arrondi violet dégradé, avec quatre tuiles jaune, rose,
   vert, bleu ciel (les activités). Proposition à affiner. *Rejeté* : garder le demi-disque (il renvoie au projet
   d'origine, plus au concept d'app tout-en-un).

31. **Places à table** (décidé le 2026-11-18) : le moteur joue des **places** (`s0`, `s1`…), pas des joueurs. Une
   place (`CardSeat`) a un occupant (`user`, `null` = un robot), un bénéficiaire des points de la manche (`credit`,
   le dernier joueur assis pendant la manche) et un nom de robot. Le rôle du Trou du cul reste attaché à la place
   (celui qui s'y assoit fait l'échange). Le joueur qui part reste affiché avec l'icône robot jusqu'à la fin de la
   manche, puis la place prend un nom de robot tiré au hasard (Boulon, Pépin, Tic-Tac…). Rejoindre une table pleine :
   l'erreur s'affiche sur le bouton pendant 2,6 s (le serveur peut refuser entre deux affichages). Maquette sur le
   Trou du cul seulement ; le Tarot garde ses robots `robot:n` jusqu'à la V1. *Rejeté* : retirer le nom du joueur
   dès son départ (on ne verrait plus à qui vont les points de la manche).

32. **Commandes, votes, réponses, présence** (décidé le 2026-11-18, retours sur la maquette) : commandes du chat
   `/activity`, `/hote`, `/kick` (liste au « / », comme les codes d'emoji). Fenêtre `/activity` (`activity-pick.ts`) :
   6 tuiles avec une image SVG (Demi-disque, Sondage, Roulette, Chat, Cartes, Jeux web), puis le format. Votes
   (`Vote` dans `chat.ts`) : 2 min, votants = connectés au lancement (le visé d'un /kick à part), compte si au moins
   la moitié a voté (arrondi au-dessus), majorité, égalité = refusé, un vote à la fois, le lanceur vote oui. Hôte :
   plus de reprise automatique par le plus ancien ; `/hote` direct si l'hôte est absent depuis 5 min (`presence()` :
   `here`, `away`, `gone` ≥ 5 min), sinon vote. Exclusion : tour de 30 s (`turnSince`), bouton sur la place ou
   `/kick`, accepté = `leaveTable` (décision 31). Réponses : `replyTo` sur le message, citation sur une ligne (coupée
   en CSS), clic = défilement et clignotement, survol = bulle. Tarot : réglage `tarotTricks` (revoir les plis
   gagnés). La demande parlait de « lecture de la défausse » : compris comme les plis gagnés (appelés « défausses »
   dans la demande précédente), pas l'écart du preneur, que personne ne voit. *Rejeté* : un vote d'exclusion après
   2 min d'absence (trop long à une table) ; voter avec des réactions 👍/👎 (pas de compte ni de durée clairs).

33. **Crédit social** (décidé le 2026-11-19) : `credits` par salon (0 par défaut), à part des scores, sans effet.
   Affiché dans la liste des joueurs de l'activité Chat seulement ; `/credit-social` ouvre une fenêtre (`credit.ts`) :
   joueurs et crédits, − / valeur / +, de 1 à 1000 par changement, jamais à soi-même. Chaque changement est un
   message du chat (`credit` : qui, à qui, valeur), avec un hiéroglyphe par palier : 5, 10, 20, 100, coupés à
   mi-chemin (≤ 7, ≤ 14, ≤ 59, ≥ 60). Retiré : U+1301D (menace, le signe donné par la demande), U+13013 (courbé),
   U+1300F (prisonnier lié), U+13012 (à terre). Accordé : U+13020 (bras levés), U+13024 (danse), U+1304F (liesse),
   U+1302D (dieu). Peu de systèmes ont une police pour ces signes : ils sont dessinés une fois en PNG
   (`extension/tools/hieroglyphs.mjs`, police Noto Sans Egyptian Hieroglyphs, OFL), affichés en masque CSS
   (couleur du thème). Remise à zéro : commande console d'admin seulement (V1). *Rejeté* : intégrer la police
   entière (1 Mo pour 8 signes) ; compter sur la police du système (carrés vides sous Linux et ChromeOS).

34. **Code utilisateur** (décidé le 2026-11-19) : l'identité est un code, sans compte ni mot de passe ni 2FA. Tiré au
   hasard au premier lancement (`account.ts` : 16 signes de l'alphabet des clés, `XXXX-XXXX-XXXX-XXXX`, ~79 bits),
   montré avant tout salon (page d'accueil), gardé dans `chrome.storage.local` (`scd-account`). Trois changements :
   « renouveler mon code » (même compte, nouveau code ; l'ancien est retiré : appareils déconnectés, refusé pour
   toujours, jamais réattribué), « reprendre un compte existant » (le code doit exister) ou « repartir de zéro » (code
   tiré, modifiable, refusé s'il est pris ou retiré), puis confirmation rouge avec le code à noter et une case à cocher.
   Code perdu : pas d'interface d'admin ; une commande console cherche le compte d'après la base (pseudos passés,
   salons, dates) et lui donne un code tiré au hasard, affiché une fois (décidé le 2026-11-19, après la maquette).
   Code choisi à la main : 12 à 32 lettres ou chiffres, 6 signes différents, ni répétition ni suite de 4, ni mot connu,
   60 bits estimés au moins. Comparaison sans casse, tirets ni espaces. Serveur : empreinte HMAC-SHA-256 (secret du
   serveur) pour retrouver le compte, jamais le code en clair ; essais limités par IP. Le compte garde le profil, la
   liste des salons, les favoris et les données du joueur dans chaque salon (règle 4 de CLAUDE.md revue : ce qui suit
   le joueur est gardé par le serveur sous son code, l'appareil en garde une copie). Maquette : `MockAccounts` dans
   `localStorage`, un compte connu `PRUNE-GALOP-4827-ZEST` (Camille) ; seuls le pseudo, la couleur et les photos
   suivent. *Rejeté* : un compte e-mail + mot de passe (refusé par la demande) ; un identifiant caché que le joueur ne
   voit pas (impossible de changer d'appareil) ; un argon2 par code (le serveur ne pourrait pas retrouver le compte
   par son code sans les essayer tous ; un HMAC avec un secret et un code d'au moins 60 bits suffisent).

35. **Photo de profil par salon** (décidé le 2026-11-19) : `Player.photo` dans l'état du salon, pas dans le profil du
   compte. Coupée en carré au milieu, 256 px, WebP (`toPhoto` dans `chat.ts`) ; une croix la retire (la lettre sur la
   couleur revient). Le rond (`avatarHtml` dans `html.ts`) la montre partout : en-tête, joueurs, podium, places à
   table, crédit social.

36. **Images sur le serveur** (décidé le 2026-11-19) : RustFS (S3), un format par usage (emoji 128 px, sticker 256 px,
   photo 256 px carrée, image du chat 1600 px, sondage 480 px, atout 360 px, aperçu 480 px), converti par le serveur.
   Clé de stockage = usage + SHA-256 du fichier reçu : une image renvoyée garde la même adresse, sans copie ; jamais
   d'un usage à l'autre. Images du chat gardées une semaine (purge horaire), le message dit « Image plus disponible ».
   Maquette : `storedPicture` (images et photos), `IMAGE_TTL` et un message d'image vieux de 8 jours. *Rejeté* :
   empreinte de l'image convertie (il faudrait convertir avant de savoir si elle existe) ; garder les images aussi
   longtemps que le chat (la place de RustFS).

37. **Liens et aperçus** (décidé le 2026-11-19) : `links.ts`. Un lien = `http(s)://…` ou un texte suivi d'une
   extension de domaine connue (liste courte dans la maquette, liste IANA en V1) ; la ponctuation finale en est exclue.
   Aperçu du premier lien d'un message, lu par le serveur (Open Graph, oEmbed), gardé une semaine, identique pour tous :
   les joueurs ne contactent pas le site (leur adresse IP reste privée). Vidéo : vignette, lecteur chargé au clic
   seulement (`youtube-nocookie.com`). Maquette : un tableau local (Wikipédia) et une règle pour YouTube (la vignette
   vient de `i.ytimg.com`). *Rejeté* : lire l'aperçu depuis l'extension de chaque joueur (CORS, et chaque joueur
   contacterait le site) ; un lecteur chargé dès l'affichage (vie privée, poids).

## Open Questions

À trancher ensemble (la maquette fait un choix provisoire, indiqué entre crochets) :

1. **Sujet et extrémités** : fixés pour toute la partie, ou changés à chaque tour ? [par partie, modifiables par l'hôte]
2. **Rotation de l'hôte** : l'hôte garde-t-il la main tous les tours, ou passe-t-elle au joueur suivant ? [il la garde]
3. ~~Points de l'hôte~~ → décidé (décision 11) ; les valeurs restent à ajuster.
4. ~~Fin du tour~~ → décidé (décision 8).
5. **Pas validé à la fin du temps** : 0 point, ou le rayon placé mais non validé compte ? [0 point]
6. **Barème** : tolérance ± 3, 0 point au-delà de 30, bonus perfect + 50 — à ajuster en jouant.
7. ~~Durée de vie 8 h~~ → revue avec les salons : question 18.
8. **Rejoindre en cours de tour** : spectateur jusqu'au tour suivant ? [peut jouer tout de suite]
9. **Fin de partie** : nombre de tours, score cible, ou partie infinie jusqu'au reset ? [infinie]
10. ~~Identité~~ → décidé : le code utilisateur (décision 34).
11. ~~Création de partie~~ → un admin seulement, par une route du serveur (décision 21).
12. **Amphithéâtre** : 7 × 25 sièges fixes, ou selon le nombre de joueurs / la taille du panneau (les sièges du
    premier rang font ~9 px de large dans le panneau par défaut) ? Un candidat peut-il changer de siège avant de
    valider si quelqu'un le prend (oui, actuel) ? [7 × 25 fixe]
13. ~~Deuxième nouvelle activité~~ → la Roulette (décision 16) ; d'autres modes peut-être ensuite.
14. **Sondage** : faut-il attendre la réponse de l'hôte avant de fermer quand tous les candidats ont répondu
    (sinon il peut perdre son avantage) ? Les réponses validées sont-elles visibles pendant le sondage (comme les
    rayons) ou seulement aux résultats ? Le sondage peut-il avoir un titre/sujet en plus de sa question ?
    [n'attend pas l'hôte ; visibles seulement aux résultats ; question seule]
15. **Roulette** : au-dessus de 100, bloquer le lancer (actuel) ou ramener aussi à 100 ? La roue a-t-elle un titre
    ou une question ? Retirer la proposition tirée pour le tirage suivant (option) ? Garder un historique des tirages
    ailleurs que dans le chat ? Durée du tirage fixe ou réglable ? [bloqué ; « Roulette » sans titre ; non ; chat ;
    6 s fixe]
16. **Chat** : « Sticker » doit-il aussi envoyer le sticker tout de suite (actuel) ou seulement l'ajouter à la
    bibliothèque ? Qui peut retirer un emoji personnalisé (son auteur, l'hôte) ? Une limite d'emoji par partie ? Autres fichiers que les images (PDF, texte…) : refusés (actuel) ou envoyés en pièce jointe ?
    Taille max des images côté serveur (poids d'une partie de 8 h) ? Les bibliothèques de stickers se partagent-elles
    entre joueurs (envoyer un sticker reçu dans ses stickers) ? [envoyé ; refusés ; à fixer ; non ; personne ;
    pas de limite]
    (Bibliothèques de stickers : désormais communes au salon, décision 21.)
17. **Fournisseurs de GIF** : comparer KLIPY sans pub, KLIPY avec pub et GIPHY sans pub pour le projet (prix réel
    de la clé de production GIPHY, conditions de KLIPY sans pub, qualité des résultats en français, délais), puis
    fixer la chaîne de secours et sa configuration (quels fournisseurs, dans quel ordre, quand basculer, durée de la
    réserve). Niveau de contenu : `r` (le plus permissif chez les deux) ? [KLIPY sans pub → GIPHY sans pub → KLIPY
    avec pub ; `r` ; maquette : fournisseur local]
18. ~~Durée de vie~~ → en partie décidé (`plan-slopesque-v1`, décision 8) : plus de purge à 8 h ; messages 30 jours,
    images du chat 7 jours, le reste tant que le salon existe. Restent ouvertes ci-dessous les limites de stickers et
    d'emoji, qui en retire, et la limite du palmarès. Texte d'origine : **Salons persistants** : un salon dure-t-il jusqu'à sa suppression par un admin, et quelles données suivent la
    règle des 8 h (depuis la création ou la dernière activité ; joueurs, tours, scores, chat, images) ? Les scores
    survivent-ils à la purge ? Qui supprime un salon (route d'admin `DELETE`) ? Faut-il une limite de stickers et
    d'emoji par salon, et qui peut en retirer ? Le premier joueur entré dans un salon neuf devient-il l'hôte ? La
    route d'admin doit-elle aussi lister les salons ? [le salon reste ; tout le reste purgé 8 h après la dernière
    activité ; scores purgés ; admin seulement ; 60 stickers, emoji sans limite, tout joueur retire un sticker ; oui ;
    oui, `GET /api/admin/rooms`] Le palmarès (décision 27) vit avec le salon, hors purge : faut-il une limite (ancienneté,
    nombre de résultats) ?
19. **Intégrations** : ngrok gratuit montre un avertissement (« Visit Site ») dans le cadre à la première visite de
    chaque joueur, et une adresse ngrok change à chaque redémarrage : héberger Low Tide ailleurs (domaine fixe) ? Un
    tunnel ngrok arrêté répond quand même (sa page d'erreur) : les joueurs sans permission ne voient pas la panne,
    seulement l'hôte. Si Low Tide utilise des threads (`SharedArrayBuffer`), il demande l'isolation cross-origin
    (COOP/COEP), impossible dans notre cadre : export sans threads ? Lire son `localStorage` depuis l'extension
    (scores, progression) : avec quelle permission et quel accord du jeu (un message `postMessage` de Low Tide serait
    plus propre) ? [avertissement accepté ; à tester ; à voir après le test]
20. **Cartes** : variantes du Trou du cul (même valeur « ou rien », carré magique, révolution, jokers, 2 qui ferme
    ou non) ? Points par rôle (30/20/10/5/0) et à 3 joueurs ? Paris : plafond, avant la donne ou la partie, sur soi
    ou son équipe ? Vote d'exclusion : majorité simple, un absent peut-il revenir ? Quelles implémentations libres
    reprendre (licence compatible) pour le Tarot, le Hold'em, la Coinche et les robots ? Tarot : marques négatives au
    classement du salon (une chute coûte des points) ? À 3 joueurs ? Le partenaire à 5 : les robots « savent » (maquette),
    à rendre honnête en V1 ? Images des atouts : par salon
    (actuel) ou par joueur ? [variantes de base ; 30/20/10/5/0 ; à décider ; majorité ; à chercher ; marques telles
    quelles ; V1 ; par salon]

21. **Compte** : ~~code perdu~~ → décidé (décision 34 : commande console d'admin). Faut-il pouvoir supprimer son
    compte et ses données (RGPD) ? Un compte sans activité depuis longtemps est-il purgé ? Les photos de profil
    passent-elles par une modération ? Le palmarès d'un ancien compte (après « repartir de zéro ») reste-t-il visible
    sous son dernier pseudo ? Aperçus de lien : quels sites en oEmbed, et faut-il pouvoir retirer l'aperçu de son
    message ? [à décider ; non ; non ; oui ; la liste de la spec ; non]

## Risks / Trade-offs

- [Clé de partie devinable / partagée] → 31⁸ combinaisons, durée de vie 8 h ; pas de données sensibles stockées.
- [Code utilisateur deviné ou volé] → 79 bits tirés au hasard, 60 au moins choisis à la main, essais limités par IP ;
  le code n'est jamais montré sans clic (masqué dans Profil) ; un joueur qui pense son code connu le **renouvelle** :
  l'ancien est retiré aussitôt, les appareils qui l'utilisent sont déconnectés.
- [Aperçus de lien] → le serveur lit des pages au nom des joueurs : protections contre les adresses internes (SSRF),
  taille et durée limitées.
- [Extension hors store] → installation manuelle (zip « Load unpacked », .xpi signé unlisted), comme gitantix.
- [Front sans framework] → rendu manuel plus verbeux ; acceptable pour la taille du jeu, réévalué plus tard.
