## ADDED Requirements

### Requirement: Activité Chat
L'hôte MUST pouvoir choisir l'activité « Chat » dans l'onglet Partie. En activité Chat, la zone de jeu MUST laisser
place au chat seul, qui occupe toute la largeur disponible et s'adapte à l'ouverture et à la fermeture du tiroir
gauche ; le tiroir gauche MUST ne montrer que la liste des joueurs. Il n'y a ni tour ni point. Le Chat MUST être
l'**activité par défaut** : un salon s'ouvre sur le chat, et l'hôte lance un jeu depuis l'onglet Partie.

Les lignes du salon propres à un jeu (une donne, une manche, un tour, un sondage, la roue…) MUST appartenir à la
**session** de l'activité où elles sont dites : visibles pendant celle-ci, plus montrées une fois qu'on passe à une
autre activité ou au Chat (pas d'inondation du chat). Les messages des joueurs, les votes, le crédit social et les
lignes générales (arrivées, hôte, changement d'activité, nouvel emoji) restent toujours.

#### Scenario: Retour au chat après une partie de cartes
- **WHEN** l'hôte repasse au Chat après trois donnes de Tarot
- **THEN** les lignes des donnes ne sont plus affichées ; « bien joué » écrit par Léa pendant la partie reste

#### Scenario: Passer au chat
- **WHEN** l'hôte choisit l'activité « Chat »
- **THEN** le chat remplit la zone de jeu et le tiroir gauche liste les joueurs, sans onglet Chat ni Classement

#### Scenario: Un salon s'ouvre sur le chat
- **WHEN** un joueur entre dans un salon où l'hôte n'a pas encore choisi d'activité
- **THEN** il arrive sur le chat, avec la liste des joueurs à gauche

#### Scenario: Le tiroir gauche s'ouvre
- **WHEN** un joueur ferme puis rouvre le tiroir gauche en activité Chat
- **THEN** le chat s'élargit puis se rétrécit pour occuper la place laissée, sans défilement de la page

### Requirement: Commandes du chat
Un message qui commence par « / » MUST être une **commande**, pas un message envoyé à tous. Taper « / » MUST afficher
la liste des commandes avec ce qu'elles font, au-dessus du champ (flèches et Entrée pour choisir ; une commande écrite
en entier part avec Entrée). Une commande qui ne peut pas aboutir MUST l'expliquer sous le chat, à moi seul. Les
commandes :
- **/activity** : ouvre une fenêtre avec tous les types d'activité, chacun avec une **petite image** simple et claire
  et une ligne d'explication (l'activité en cours marquée). Pour ceux qui en ont, un deuxième choix MUST donner le
  **format exact** : Demi-disque → Rayon libre ou Amphithéâtre ; Cartes → Trou du cul, Tarot (le nombre de joueurs se règle ensuite dans Partie : 3 à 8 au Trou du
  cul, 4 ou 5 au Tarot ; des robots complètent les places libres) (Texas
  Hold'em et Coinche grisés, à venir) ; Jeux web → Low Tide. L'hôte MUST lancer l'activité choisie tout de suite ;
  un autre joueur MUST la proposer au **vote**.
  Écrite avec sa suite, elle MUST agir sans fenêtre : `/activity chat`, `/activity sondage`,
  `/activity cartes tarot` (ou `cartes tarot 5`), `/activity demi-disque amphitheatre` (accents, majuscules et tirets
  indifférents) ; une activité sans son format (`/activity cartes`) ouvre la fenêtre sur ses formats.
- **/hote** : demander le rôle d'hôte (voir « Rôle d'hôte » dans game-session).
- **/credit-social** (ou /credit-score) : changer le crédit social d'un joueur (voir « Crédit social ») ; écrite avec sa
  suite, `/credit-social Léa +100` (ou `+ 100`, `-20`) MUST l'appliquer sans fenêtre, un nom seul ouvre la fenêtre sur
  ce joueur.

Pendant qu'une commande s'écrit, la liste au-dessus du champ MUST proposer la suite possible (les activités puis leurs
formats ; les joueurs puis des valeurs) ; Tab ou Entrée prend la proposition, Entrée envoie une commande complète.
- **/kick** (ou /kick Léa) : faire quitter la table au joueur qui la fait attendre (voir card-games).
- **/effet** : un effet visuel chez tous (voir « Effets visuels »).

#### Scenario: Passer au Tarot à 5 sans être l'hôte
- **WHEN** j'écris /activity, je choisis Cartes puis Tarot à 5
- **THEN** la fenêtre se ferme et un vote « Toi propose de passer à Tarot à 5 » s'ouvre dans le chat

#### Scenario: L'hôte change d'activité
- **WHEN** l'hôte écrit /activity et choisit Roulette
- **THEN** la Roulette commence tout de suite, sans vote

#### Scenario: Commande écrite en entier
- **WHEN** l'hôte écrit « /activity carte tarot » puis Entrée
- **THEN** le Tarot commence, sans fenêtre

#### Scenario: Complétion
- **WHEN** j'écris « /credit-social hu »
- **THEN** la liste propose « Hugo » ; je le prends, elle propose +10, +50, +100, -10, -50

### Requirement: Défilement et chargement du chat
Le chat MUST s'ouvrir **en bas** (dernier message visible), à chaque ouverture du panneau ou retour sur le chat, et y
rester quand un message ou une image arrive si on y était. Plus haut, un **bouton** MUST ramener en bas : dans l'angle
en bas à gauche des messages, collé au bord et à la partie écriture, seul son coin haut droit arrondi, avec le nombre
de messages arrivés depuis. Le chat MUST se charger **par morceaux** : le dernier (50 messages) à l'entrée, les
précédents en remontant, jusqu'au début du salon ou à la limite des 30 jours. Ce qui est chargé MUST rester tant que le
panneau vit (pas de déchargement), et l'appareil MUST garder les derniers messages du salon (300) : une entrée ne
demande au serveur que ce qui a suivi (avec une mise à jour des 30 derniers : réactions, votes), pour ne pas tout
recharger à chaque page ni à chaque ouverture.

#### Scenario: Retour en bas
- **WHEN** je remonte lire et que deux messages arrivent
- **THEN** le bouton en bas à gauche affiche 2 ; un clic me ramène au dernier message

#### Scenario: Changer de page
- **WHEN** le panneau reste ouvert et que je change de page
- **THEN** le chat réapparaît en bas, et seuls les messages arrivés entre-temps sont demandés au serveur

### Requirement: Effets visuels (/effet)
La commande **/effet** MUST jouer un effet visuel chez **tous** les joueurs du salon, sur la zone de jeu (ou le chat en
activité Chat), comme réaction ou message direct ; rien n'est gardé (ni message, ni fichier). Les effets :
- **/effet firework** : la zone devient noire (en fondu), une fusée part de chacun des deux angles du bas avec une
  traînée de lumière vers le centre, puis explose ; chaque explosion tire au hasard une forme (pivoine, anneau, double
  anneau, saule, cœur, palmier, étoile, crépitement) et des couleurs parmi une liste.
- **/effet confetti** (ou confeti) : des confettis de toutes les couleurs jaillissent des deux côtés de la zone ;
  **/effet confetti Léa** : tous de la couleur de Léa.
- **/effet hit Léa** : la photo de Léa (ou son rond à sa lettre) apparaît, un poing fermé la frappe, elle est éjectée,
  puis tout disparaît.
- **/effet tomato Léa** : une tomate lancée en cloche s'écrase sur la photo et y laisse une tache rouge qui coule.
- **/effet hammer Léa** : un marteau tombe sur la photo et l'écrase en hauteur, puis elle reprend sa forme.
- **/effet screamer** : l'image, le sticker ou le GIF qui attend au-dessus du champ (voir « Envoyer une image ou un
  sticker »), ou un emoji écrit à la suite (`/effet screamer 😱`), montré **1 s** au premier plan au centre de la zone
  de tous ; sans image qui attend, la commande MUST demander d'en ajouter une. Une image de l'appareil n'est **pas
  gardée** (envoi unique, jamais stockée).
Sur une photo : au centre de la zone, en grand ; si l'activité est un jeu de cartes et que la personne visée est à
table, l'effet MUST se jouer en petit **sur sa place**, en suivant sa position (fenêtre redimensionnée). Feux
d'artifice et confettis : jusqu'à **3 à la fois** chacun (plusieurs joueurs en même temps), le fond restant noir tant
qu'un feu d'artifice est en cours (pas de clignotement) ; les effets sur une photo et le screamer : **un à la fois**.
Ce qui ne peut pas se jouer MUST l'expliquer sous le chat, à moi seul. Avec « animations réduites » demandé par le
système, l'effet MUST se résumer à son emoji, sans mouvement.

#### Scenario: Deux feux d'artifice
- **WHEN** Léa puis Hugo écrivent /effet firework à une seconde d'écart
- **THEN** quatre fusées partent, le fond reste noir jusqu'à la fin de la dernière explosion

#### Scenario: Tomate à table
- **WHEN** pendant une donne de Tarot, j'écris /effet tomato Hugo et Hugo est à table
- **THEN** la tomate s'écrase sur sa place à la table, chez tous

### Requirement: Crédit social
Chaque joueur d'un salon MUST avoir un **crédit social** : une valeur à part, sans rapport avec les scores des jeux et
**sans effet** pour l'instant (0 au départ). Il MUST être visible **seulement dans l'activité Chat**, à côté du nom
dans la liste des joueurs (vert au-dessus de 0, rouge en dessous). Il MUST pouvoir être changé depuis n'importe quelle
activité avec la commande **/credit-social**. Elle ouvre une fenêtre avec :
- la liste des joueurs du salon et leur crédit actuel, dans laquelle on en choisit un ;
- en bas, un bouton **−**, un champ pour la valeur (un nombre entier de 1 à 1000) et un bouton **+**.

On ne MUST pas pouvoir se donner (ni se retirer) du crédit soi-même. Chaque changement MUST s'afficher dans le chat,
pour tous :
- qui le fait et à qui, avec **entre les deux un hiéroglyphe** et la valeur, rouge pour une sanction, vert pour une
  récompense ;
- puis la phrase (« Léa retire 20 crédits sociaux à Hugo · mise aux fers »).

Le hiéroglyphe MUST dépendre de la valeur, par paliers 5, 10, 20 et 100, coupés à mi-chemin :

| Valeur | Retiré | Accordé |
|---|---|---|
| 1 à 7 (palier 5) | 𓀝 avertissement | 𓀠 encouragement |
| 8 à 14 (palier 10) | 𓀓 humiliation | 𓀤 danse |
| 15 à 59 (palier 20) | 𓀏 mise aux fers | 𓁏 liesse |
| 60 et plus (palier 100) | 𓀒 mise à terre | 𓀭 divinisation |

Le crédit MUST appartenir au salon et rester même quand les données de jeu sont purgées, comme le palmarès. Ni
l'hôte ni un joueur ne MUST pouvoir le remettre à zéro (une réinitialisation des scores n'y touche pas). Dans la V1,
seul un admin MUST pouvoir le remettre à zéro, par une **commande console** sur le serveur, pour un joueur ou tout le
salon.

#### Scenario: Retirer 10 à Hugo
- **WHEN** j'écris /credit-social, je choisis Hugo (−35), j'entre 10 et je clique −
- **THEN** la fenêtre se ferme, le chat affiche « Toi 𓀓 −10 Hugo » puis « Toi retire 10 crédits sociaux à Hugo ·
  humiliation », et Hugo passe à −45

#### Scenario: Pas à soi-même
- **WHEN** j'ouvre /credit-social
- **THEN** ma ligne est grisée : je ne peux pas la choisir

#### Scenario: Ailleurs que dans le Chat
- **WHEN** le salon joue à la Roulette
- **THEN** les crédits ne sont pas affichés, mais /credit-social marche et le changement est dit dans le chat

### Requirement: Votes dans le chat
Un vote (lancé par /activity, /hote ou /kick) MUST s'afficher dans le chat comme une carte : qui le lance et ce qu'il
propose, le **temps restant** (2 min), une barre et le compte (oui, non, votes nécessaires), un bouton **vert Oui** et
un bouton **rouge Non**. Celui qui le lance MUST voter oui d'office ; chacun MUST pouvoir changer d'avis jusqu'à la
fin. Les votants MUST être les joueurs **connectés** au lancement (pas le joueur visé par /kick). Le vote MUST se
terminer au bout de **2 min**, ou dès que tous ont voté. Il ne MUST compter que si **la moitié au moins des joueurs
connectés** a voté (sinon « Pas assez de votes ») ; alors la **majorité** l'emporte (égalité : refusé). Un seul vote
à la fois. Quand un vote s'ouvre hors de l'activité Chat, le tiroir gauche MUST s'ouvrir sur le chat.

#### Scenario: Trop peu de votes
- **WHEN** je propose une activité, 4 joueurs sont connectés et personne d'autre ne vote en 2 min
- **THEN** la carte affiche « Pas assez de votes : 1 sur 2 » et rien ne change

#### Scenario: Vote accepté
- **WHEN** les autres votent Oui
- **THEN** la carte affiche « Accepté » et la proposition s'applique tout de suite

### Requirement: Répondre à un message
La barre de réaction d'un message MUST avoir, à droite du « + », un bouton **Répondre**. Il MUST afficher, au-dessus
du champ, le message auquel je réponds (son auteur et le début de son texte) avec un ✕ pour ne plus répondre (Échap
aussi). Le message envoyé MUST montrer au-dessus de lui une **flèche**, le nom de l'auteur cité et sa citation sur une
ligne : entière si elle est courte, son début sinon. Un clic sur la citation MUST faire défiler le chat jusqu'au
message cité, qui clignote. Le **survol** de la citation MUST montrer le message cité en entier, dans une bulle au
format d'un message. Un message cité qui n'existe plus MUST l'indiquer.

#### Scenario: Répondre à Hugo
- **WHEN** je survole « salut tout le monde 👋 » de Hugo, je clique Répondre, j'écris « coucou Hugo » et j'envoie
- **THEN** mon message s'affiche avec, au-dessus, « ↪ Hugo salut tout le monde 👋 »

#### Scenario: Une longue citation
- **WHEN** je réponds à un long message de Léa
- **THEN** ma réponse montre le début de sa citation sur une ligne ; au survol, la bulle montre tout son message ; au
  clic, le chat remonte jusqu'à lui

### Requirement: Liens dans les messages
Dans un message, une adresse MUST devenir un **lien** cliquable, d'un style propre (couleur d'accent, souligné), qui
s'ouvre dans un nouvel onglet (`noopener`, `noreferrer`, `nofollow`). Est une adresse : un texte qui commence par
`http://` ou `https://`, ou un texte suivi d'un point et d'une **extension de domaine connue** (`exemple.fr`,
`fr.wikipedia.org/wiki/Tarot` ; liste de l'IANA en V1), avec son chemin éventuel. Sans `http`, le lien MUST pointer
vers `https://`. La ponctuation qui suit (point, virgule, parenthèse fermante non ouverte dans le lien…) MUST rester
hors du lien. Un nom de fichier (`photo.png`), un nom (`M.Dupont`) ou une adresse e-mail ne MUST pas devenir un lien.

#### Scenario: Une adresse sans http
- **WHEN** un joueur écrit « va sur example.com/page, merci »
- **THEN** « example.com/page » est un lien vers `https://example.com/page`, la virgule reste du texte

#### Scenario: Pas un lien
- **WHEN** un joueur écrit « j'ai envoyé photo.png à M.Dupont »
- **THEN** le message n'a aucun lien

### Requirement: Aperçu des liens
Sous un message, le **premier lien** MUST avoir un **aperçu** quand son site en donne un, en plus du lien : une carte
(nom du site, titre en lien, description sur 3 lignes au plus, petite image) ou, pour une vidéo, sa vignette avec un
bouton de lecture ; un clic MUST lancer le lecteur **dans le message** (YouTube par `youtube-nocookie.com`), jamais
avant ce clic. Sans aperçu, le lien reste un lien. L'aperçu MUST être lu par le **serveur** (balises Open Graph, cartes
Twitter, oEmbed pour une liste de sites : YouTube, Twitch, Vimeo, Spotify, SoundCloud…) au premier envoi du lien,
gardé une semaine avec son image (voir Conservation des images du chat), et le même pour tous les joueurs : aucun
joueur ne contacte le site avant de cliquer. La lecture côté serveur MUST être sûre : `http`/`https` seulement, pas
d'adresse interne (IP privée, `localhost`, après chaque redirection), 3 s et 1 Mo au plus, 3 redirections au plus.

#### Scenario: Une page avec aperçu
- **WHEN** un joueur envoie « fr.wikipedia.org/wiki/Tarot »
- **THEN** une carte Wikipédia apparaît sous le message, avec titre, description et image

#### Scenario: Une vidéo
- **WHEN** un joueur envoie un lien YouTube et un autre clique sur la vignette
- **THEN** la vidéo se lit dans le message, pour lui seul

#### Scenario: Un site sans aperçu
- **WHEN** un joueur envoie « example.org/regles »
- **THEN** le message montre le lien, sans carte

### Requirement: Liste des joueurs hors jeu
Dans une activité sans points (Sondage, Roulette, Chat), l'onglet Classement MUST devenir une liste des joueurs
(« Joueurs ») : chaque joueur avec sa couleur, l'hôte en premier avec sa couronne, et pour l'hôte un bouton pour
donner son rôle. Le classement et le podium MUST ne pas s'afficher. Les scores MUST rester tels quels et ne MUST être
remis à zéro que lorsque l'hôte clique explicitement « Réinitialiser la partie » dans l'onglet Partie.

#### Scenario: Retour au Demi-disque
- **WHEN** l'hôte passe du Demi-disque au Sondage puis revient au Demi-disque
- **THEN** le classement réapparaît avec les mêmes scores qu'avant

### Requirement: Menu « + » du chat
À droite du bouton d'envoi, un bouton « + » MUST ouvrir un petit menu avec trois choix : « Fichier » (ouvre
l'explorateur de fichiers de l'appareil), « Sticker » (ouvre la liste des stickers récents du joueur, ou un message
d'erreur s'il n'en a pas encore) et « Emoji » (ouvre la fenêtre d'emoji). Un clic ailleurs ou Échap MUST refermer le
menu.

#### Scenario: Aucun sticker
- **WHEN** un joueur sans sticker choisit « + » puis « Sticker »
- **THEN** un message d'erreur indique qu'il n'a pas encore de sticker et comment en ajouter un

### Requirement: Fenêtre d'emoji
« Emoji » MUST ouvrir une fenêtre avec la liste complète des emoji Unicode, classés par catégorie comme dans les
sélecteurs des systèmes (Émoticônes, Corps et métiers, Animaux et nature, Nourriture et boissons, Voyages et lieux,
Activités, Objets, Symboles, Drapeaux), avec une recherche par mot en français, les emoji fréquemment utilisés, les
couleurs de peau, et une catégorie « Personnalisé » pour les emoji ajoutés à la partie, en dernier après les
Drapeaux. La fenêtre MUST s'ouvrir sur les Émoticônes, et le survol d'un emoji MUST montrer son nom et son code
(« visage riant aux larmes :rire: »). Choisir un emoji MUST l'écrire
là où est le curseur dans le message, la fenêtre restant ouverte ; un clic ailleurs ou Échap MUST la fermer. Les
données des emoji MUST être livrées avec l'extension (aucun appel à un CDN).

#### Scenario: Chercher un emoji
- **WHEN** un joueur ouvre « + » → « Emoji » et tape « chat »
- **THEN** les emoji de chat s'affichent, et un clic en écrit un dans son message

#### Scenario: Ordre des onglets
- **WHEN** la partie a un emoji personnalisé et un joueur ouvre la fenêtre d'emoji
- **THEN** elle s'ouvre sur les Émoticônes, et « Personnalisé » est le dernier onglet, après les Drapeaux

### Requirement: Codes d'emoji
Chaque emoji MUST avoir au moins un code `:code:` (minuscules, chiffres, `_`, `+`, `-`) : des codes courts en français
pour les plus courants (`:rire:` 😂, `:pouce:` 👍, `:coeur:` ❤️…), les codes anglais usuels (`:yes:` 👍, `:joy:` 😂,
`:+1:`…) et le nom CLDR français de chaque emoji (`:visage_riant_aux_larmes:`) ; un code désigne un seul emoji. En
tapant `:` suivi d'au moins deux caractères, le chat MUST proposer jusqu'à 6 emoji dont le code correspond (les
personnalisés de la partie d'abord), à choisir avec ↑ ↓ puis Entrée ou Tab, ou à la souris. À l'envoi, chaque code
d'un emoji standard MUST devenir l'emoji ; un code personnalisé reste `:nom:` (affiché comme son image) ; un code
inconnu reste tel quel.

#### Scenario: Autocomplétion
- **WHEN** un joueur tape « :rir » dans le chat
- **THEN** 😂 `:rire:` est proposé en premier, et Entrée remplace « :rir » par 😂

#### Scenario: Codes à l'envoi
- **WHEN** un joueur envoie « ok :yes: :inconnu: »
- **THEN** le message affiché est « ok 👍 :inconnu: »

### Requirement: Réaction rapide au double-clic
Un double-clic sur le texte d'un message MUST y ajouter (ou en retirer) la réaction rapide du joueur, sans
sélectionner de mot. Cette réaction MUST se régler dans l'onglet Profil (« Réaction au double-clic », un emoji
standard choisi dans la fenêtre d'emoji) et MUST valoir 👍 (`:yes:`) par défaut.

#### Scenario: Double-clic
- **WHEN** un joueur qui n'a rien réglé double-clique sur un message
- **THEN** 👍 apparaît sous le message, à son nom

### Requirement: Emoji personnalisés
Un fichier choisi ou glissé MUST pouvoir devenir un emoji de la partie (« Emoji » à côté de « Sticker » et « Image ») :
le joueur lui donne un nom (2 à 24 minuscules sans accent, chiffres ou `_`, proposé à partir du nom du fichier,
unique dans la partie). L'emoji MUST alors être disponible pour tous les joueurs de la partie, dans la catégorie
« Personnalisé » de la fenêtre d'emoji et en réaction ; `:nom:` dans un message MUST s'afficher comme son image. Son
ajout MUST être annoncé dans le chat. Il appartient au salon (commun à ses joueurs, gardé avec lui).

#### Scenario: Ajouter un emoji
- **WHEN** un joueur glisse « Étoile filante.png », choisit « Emoji » et garde le nom proposé
- **THEN** `:etoile_filante:` est ajouté pour tous, annoncé dans le chat, et visible dans « Personnalisé »

### Requirement: Réactions aux messages
Au survol du texte d'un message (pas des messages système), une barre de réaction MUST apparaître juste en dessous,
avec les 4 dernières réactions utilisées par le joueur (par défaut 👍 😂 😢 😡) puis un « + » qui ouvre la fenêtre
d'emoji. Une réaction utilisée MUST passer en première position de ces 4, la plus ancienne sortant de la liste. La
barre MUST apparaître en surimpression, collée sous le texte, centrée à l'endroit où le pointeur est entré dans le
message, sans déplacer le message, ses réactions ni les messages suivants (pas de saut de texte). Elle ne fait partie
ni de la zone de survol ni du fond assombri, qui ne couvrent que le texte ; elle MUST rester affichée quand le
pointeur passe du texte à la barre, et tant que la fenêtre d'emoji est ouverte pour ce message. Le chat MUST garder
assez de marge en bas pour la barre du dernier message. Sous le message, chaque réaction MUST
s'afficher avec son nombre à partir de 2 (seule, juste son emoji, plus étroit et plus lisible) ; celle du joueur MUST être mise en évidence et un clic MUST l'ajouter ou la retirer ; le
survol MUST montrer qui a réagi.

#### Scenario: Réagir avec un autre emoji
- **WHEN** un joueur survole un message, clique « + » et choisit 🚀
- **THEN** 🚀 apparaît sous le message (sans nombre : seule réaction) et ses réactions récentes deviennent 🚀 👍 😂 😢

#### Scenario: Pas de saut
- **WHEN** le pointeur entre dans un message à 160 px de son bord gauche
- **THEN** la barre apparaît sous le texte, centrée à 160 px, et le message suivant ne bouge pas

#### Scenario: Aller du message à la barre
- **WHEN** le pointeur descend du texte du message jusqu'à la barre de réaction
- **THEN** la barre reste affichée et ses boutons sont cliquables

### Requirement: Envoyer une image ou un sticker
Une image, un sticker ou un GIF choisi (menu +, glisser-déposer, fenêtre des stickers ou des GIF) MUST d'abord
**attendre au-dessus du champ** (aperçu, type, ✕ pour le retirer) sans partir : Entrée l'envoie **avec le texte écrit**
(dans le même message, le texte sous l'image) ou seul ; une image de l'appareil n'est envoyée au serveur qu'à ce
moment.

#### Scenario: Une image et son texte
- **WHEN** je choisis une image, écris « la vue depuis le refuge » puis Entrée
- **THEN** un seul message part : l'image, et ce texte dessous

Un fichier choisi dans l'explorateur ou glissé sur le chat MUST afficher un aperçu de son contenu, avec en dessous le
choix « Sticker », « Image » ou « Emoji » (voir Emoji personnalisés). Pendant le glisser, le chat MUST indiquer où déposer le fichier. « Sticker » MUST
ajouter l'image à la bibliothèque de stickers du salon et l'envoyer en petit format (128 px au plus), ses proportions
gardées. « Image » MUST l'envoyer tout de suite en grand format, ses proportions gardées, dans une taille maximale qui
ne déforme pas le chat. Un fichier qui n'est pas une image MUST afficher une erreur dans l'aperçu.

#### Scenario: Image glissée
- **WHEN** un joueur glisse une photo de 1400 × 900 sur le chat et choisit « Image »
- **THEN** la photo apparaît dans le chat, réduite à la taille maximale avec ses proportions

#### Scenario: Réutiliser un sticker
- **WHEN** un joueur a ajouté un sticker puis ouvre « + » → « Sticker » et clique dessus
- **THEN** le sticker est envoyé de nouveau, en petit format

### Requirement: Bibliothèque de stickers
La bibliothèque de stickers MUST appartenir au salon et être commune à ses joueurs (gardée par le serveur avec le
salon), du plus récent au plus ancien, sans doublon, 60 au plus ; un joueur MUST pouvoir en retirer un. Dans un
autre salon, le joueur voit la bibliothèque de cet autre salon.

#### Scenario: Retirer un sticker
- **WHEN** un joueur survole un sticker de la bibliothèque du salon et clique sa croix
- **THEN** le sticker disparaît de la liste, sans toucher aux messages déjà envoyés

### Requirement: GIF dans le chat
Le menu « + » MUST proposer « GIF », qui ouvre une fenêtre avec une barre de recherche, puis trois onglets :
« Tendances » (« Résultats » pendant une recherche), « Récents » et « Favoris ». Elle MUST s'ouvrir sur « Récents »
si le joueur a déjà envoyé des GIF, sinon sur « Tendances ». La recherche MUST attendre 400 ms sans frappe (ou
Entrée) et au moins 2 caractères avant d'envoyer une requête. Les résultats MUST arriver par pages (24) : en
approchant du bas de la liste (300 px), la page suivante MUST être demandée, sans déplacer les GIF déjà affichés.
Un clic MUST envoyer le GIF ; une étoile MUST l'ajouter aux Favoris ou l'en retirer. Le message MUST contenir un
lien vers le fichier du fournisseur (et son identifiant), pas le fichier : chaque joueur le charge depuis le
fournisseur et le MUST garder sur son appareil (le serveur ne stocke ni ne redistribue aucun GIF). Récents (50 au plus, le dernier envoyé en tête) et Favoris (500 au plus) MUST être gardés sur
l'appareil du joueur. Un GIF dans le chat, envoyé par n'importe quel joueur, MUST montrer au survol une étoile
pour l'ajouter à ses propres Favoris ou l'en retirer (allumée quand il y est). La fenêtre MUST indiquer le
fournisseur (attribution demandée par KLIPY et GIPHY).

#### Scenario: Charger plus en défilant
- **WHEN** un joueur fait défiler les 24 premiers GIF jusqu'en bas
- **THEN** les 24 suivants s'ajoutent sous les premiers, qui ne bougent pas

#### Scenario: Pas de requête par touche
- **WHEN** un joueur tape « chat » lettre par lettre
- **THEN** une seule requête part, 400 ms après la dernière lettre

#### Scenario: Favori depuis le chat
- **WHEN** un joueur survole le GIF envoyé par Léa et clique son étoile
- **THEN** l'étoile s'allume et ce GIF est en tête de ses Favoris

#### Scenario: Récents
- **WHEN** un joueur a envoyé un GIF et rouvre la fenêtre
- **THEN** elle s'ouvre sur « Récents », ce GIF en tête

### Requirement: Fournisseurs de GIF
Le serveur MUST interroger les fournisseurs de GIF pour l'extension (`/api/gifs/search`, `/api/gifs/trending`),
derrière une interface commune `GifProvider` (`search(q, page)`, `trending(page)` → GIF normalisés : fournisseur,
identifiant, URL du fichier MP4 / WebP, taille, titre), sans jamais donner ses clés à l'extension. Plusieurs
fournisseurs MUST pouvoir être branchés en chaîne de secours : si l'un n'a plus de crédit, répond une erreur ou
une limite (429), le suivant prend le relais, pour toujours avoir des résultats ; une recherche (et ses pages
suivantes) MUST rester chez un seul fournisseur (pas de mélange dans une même grille, exigé par GIPHY). Les pubs
MUST ne jamais être demandées à un fournisseur qui n'est pas configuré « avec pub », et les résultats de type
publicité MUST être retirés dans ce cas. Pour économiser les crédits, le serveur MUST garder une réserve des
résultats déjà obtenus (même requête normalisée, même page, même fournisseur) pendant une durée limitée, partagée
par tous les joueurs ; cette réserve vit en mémoire, hors base (règle des 8 h).

#### Scenario: Secours
- **WHEN** le premier fournisseur de la chaîne répond « limite atteinte »
- **THEN** la recherche est servie par le suivant, et la fenêtre indique ce fournisseur

#### Scenario: Réserve de résultats
- **WHEN** deux joueurs cherchent « Chat » puis « chat » dans l'heure
- **THEN** le fournisseur n'est interrogé qu'une fois
