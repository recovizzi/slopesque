## ADDED Requirements

### Requirement: Activité Cartes et liste des jeux
L'hôte MUST pouvoir choisir l'activité « Cartes », puis, dans Paramètres → Partie, le **jeu** parmi une liste : le
**Trou du cul** (aussi appelé Président) d'abord, puis le **Tarot**, le **Texas Hold'em** et la **Coinche**, et d'autres
ensuite. Un jeu pas encore prêt MUST apparaître dans la liste, marqué « bientôt », sans pouvoir être choisi. Les
jeux de cartes MUST donner des points au classement du salon, comme le Demi-disque.

#### Scenario: Choisir le jeu
- **WHEN** l'hôte ouvre Paramètres → Partie avec l'activité Cartes
- **THEN** la liste Jeu propose Trou du cul et Tarot, et montre Texas Hold'em et Coinche « (bientôt) », désactivés

### Requirement: Présentation des cartes
Une carte MUST être un petit rectangle aux angles arrondis, dessiné en SVG : en haut, la valeur dans l'angle gauche et
la couleur (emoji ♠️ ♥️ ♦️ ♣️) dans l'angle droit ; en bas, la même chose retournée (miroir haut / bas, lisible dans
les deux sens) ; une grande couleur au centre. La face MUST rester claire dans les deux thèmes, valeurs rouges pour
cœur et carreau, noires pour pique et trèfle.

#### Scenario: Une carte
- **WHEN** le 7 de cœur s'affiche
- **THEN** on lit « 7 » en haut à gauche et ♥️ en haut à droite, et la même chose à l'envers en bas

### Requirement: Main en éventail et animations
La main du joueur MUST tenir entière dans la largeur disponible : les cartes en éventail (chacune tourne autour d'un
même point situé sous la main), l'écart se resserrant avec le nombre de cartes, chaque carte gardant une bande
visible avec sa valeur. Au survol, une carte MUST monter ; sélectionnée, plus haut, avec un contour (voir « Main lisible et cliquable »).
Jouée, elle MUST partir en animation vers la table ; les cartes des autres joueurs MUST arriver depuis leur place. Le
pli qui vient d'être ramassé MUST rester visible (estompé) jusqu'au coup suivant. Une nouvelle donne ou un coup des
autres MUST ne pas faire bouger l'éventail.

#### Scenario: Grande main
- **WHEN** un joueur a 18 cartes dans un panneau de 400 px de large
- **THEN** les 18 cartes tiennent dans la largeur, chacune avec sa valeur visible

#### Scenario: Jouer une carte
- **WHEN** le joueur sélectionne une carte jouable puis clique « Jouer »
- **THEN** la carte vole de sa main jusqu'au pli, et sa main compte une carte de moins

### Requirement: En-tête de partie et règles
En haut de la table, un en-tête MUST montrer le nom du jeu, les informations essentielles (manche, à qui de jouer), le
**temps de jeu** écoulé en haut à droite, et à sa droite un bouton « i » qui ouvre une fenêtre avec les **règles** du
jeu, illustrées d'exemples en SVG (les mêmes cartes), consultable à tout moment et refermée par Échap. Les scores
MUST être dans le classement (tiroir de gauche).

#### Scenario: Revoir les règles
- **WHEN** un joueur clique « i » pendant une manche
- **THEN** les règles s'ouvrent avec des exemples dessinés ; Échap les referme, la partie continue

### Requirement: Trou du cul
Le Trou du cul MUST se jouer avec 52 cartes distribuées entre 3 à 8 joueurs ; ordre des valeurs 3 < 4 < … < 10 <
Valet < Dame < Roi < As < 2 (la couleur ne compte pas). Celui qui ouvre pose 1 à 4 cartes de même valeur ; les suivants
posent autant de cartes de valeur plus forte, ou passent (et ne rejouent pas dans ce pli) ; quand tous les autres ont
passé, ou qu'un 2 est posé, le dernier à avoir posé ramasse le pli et ouvre. L'ordre de sortie MUST donner les rôles
(Président, Vice-président, Neutres, Vice-trou du cul, Trou du cul ; à 3 joueurs, sans vices) et leurs points au
classement (30, 20, 10, 5, 0, provisoire). À la manche suivante, le Trou du cul MUST donner ses 2 meilleures cartes au
Président, qui lui en rend 2 ; le Vice-trou du cul et le Vice-président échangent 1 carte ; le Trou du cul ouvre. La
première manche, celui qui a le 3 de trèfle ouvre.

#### Scenario: Fin de manche
- **WHEN** le dernier joueur garde des cartes alors que tous les autres sont sortis
- **THEN** il est Trou du cul ; le premier sorti est Président ; chacun reçoit les points de son rôle

### Requirement: Tarot
Le Tarot MUST se jouer à 4 ou à 5, au choix de l'hôte dans Paramètres → Partie (à partir de la donne suivante ; 3
pour la V1), avec 78 cartes : 4 couleurs de 14 (1 à 10, Valet, Cavalier,
Dame, Roi), 21 atouts et l'Excuse. Une donne : 18 cartes chacun et un chien de 6 ; les **enchères** une fois chacun,
plus haut ou passe (Prise ×1, Garde ×2, Garde sans ×4, Garde contre ×6 ; tous passent : on redonne) ; pour Prise et
Garde, le chien est montré, le preneur le prend et fait son **écart** de 6 (ni Roi ni bout ; un atout seulement s'il
n'a pas le choix) ; Garde sans : le chien va au preneur sans être vu ; Garde contre : à la défense. Les plis : fournir
la couleur, sinon couper, surcouper si un atout est déjà posé, monter à l'atout demandé ; l'Excuse se joue à tout
moment, ne gagne jamais et reste à son camp. Le compte : 91 points (bout ou Roi 4,5 ; Dame 3,5 ; Cavalier 2,5 ; Valet
1,5 ; autre 0,5) ; à faire selon les bouts du preneur 56 / 51 / 41 / 36 ; marque (25 + l'écart) × le contrat, 3 fois
pour le preneur, une fois pour chaque défenseur, ajoutée au classement. Les cartes qu'on ne peut pas jouer (ou
écarter) MUST être grisées ; celles du chien, tout juste prises, MUST se distinguer ; la main MUST indiquer le nombre
d'atouts et de bouts. Petit au bout, poignées et chelem : V1.

#### Scenario: L'écart
- **WHEN** je prends une Garde
- **THEN** le chien est montré, ses 6 cartes rejoignent ma main (24), Rois et bouts grisés, et j'en écarte 6

#### Scenario: Le compte
- **WHEN** le preneur fait 47 points en Garde avec 2 bouts
- **THEN** (25 + 6) × 2 = 62 : le preneur +186, chaque défenseur −62

### Requirement: Tarot à 5
À 5, chacun MUST recevoir 15 cartes, le chien 3 (donc un écart de 3). Après les enchères et avant le chien, le
preneur MUST **appeler un Roi** (une Dame s'il a les 4 Rois, un Cavalier s'il a aussi les 4 Dames) : celui qui l'a
devient son partenaire, en secret, jusqu'à ce qu'il le joue (alors tous le savent). S'il s'appelle lui-même ou si la
carte est au chien, il joue seul contre 4. Au premier pli, on MUST ne pas entamer dans la couleur appelée, sauf avec
la carte appelée. Les points du preneur comptent ceux de son partenaire ; marques : preneur × 2, partenaire × 1,
chaque défenseur × 1 dans l'autre sens ; seul : × 4.

#### Scenario: Le partenaire se révèle
- **WHEN** je prends et j'appelle le Roi de pique, que Malo joue au troisième pli
- **THEN** l'en-tête indique « avec Malo », sa place porte « Partenaire », et au compte : moi × 2, Malo × 1

### Requirement: Annonces du Tarot
À la fin des enchères, une **annonce animée** MUST apparaître au-dessus de la table : qui prend, et son contrat
(« Léa prend · Garde »). À 5, une seconde annonce MUST montrer la carte appelée **en la retournant** (le dos, puis la
face), avec qui l'appelle ; si c'est moi qui ai la carte, elle MUST me dire que je suis son partenaire (en secret).
Ensuite l'en-tête MUST garder ces informations, la carte appelée en **petite carte** (sa lettre et l'icône de sa
couleur, « R♥ »), plus lisible qu'un texte ; puis « avec Malo » une fois le partenaire révélé. Les robots MUST
attendre la fin d'une annonce.

#### Scenario: Le Roi appelé
- **WHEN** à 5, Léa prend une Garde et appelle le Roi de cœur
- **THEN** « Léa prend · Garde » s'affiche, puis une carte se retourne sur le Roi de cœur, et l'en-tête montre
  « appelle R♥ »

### Requirement: Plis gagnés et leur consultation
Un pli complet MUST rester visible un instant (« Hugo remporte le pli »), puis ses cartes MUST se rassembler et partir
vers leur gagnant : vers **mon tas**, en bas à droite de la table, ou vers la **pastille** d'un adversaire (où elles
disparaissent ; la pastille compte ses plis). Vide, mon tas MUST être un emplacement au format d'une carte, plus
petit, sans fond, au contour vert foncé, comme imprimé sur le tapis. En **survolant** la pastille d'un joueur qui a
des plis, ou mon tas, la table MUST s'assombrir et montrer ses plis gagnés pendant la donne, chaque pli en petit
éventail, les plis en grille adaptée à la place ; MUST disparaître dès que le pointeur s'en va. Au Tarot, l'hôte MUST
pouvoir désactiver cette consultation (Partie → « Revoir les plis gagnés », coché par défaut) pour une partie plus
dure : les pastilles et mon tas MUST encore compter les plis, mais le survol MUST ne plus rien montrer.

#### Scenario: Revoir les plis d'un adversaire
- **WHEN** Hugo a gagné 3 plis et je survole sa pastille
- **THEN** la table s'assombrit et montre ses 3 plis en petits éventails ; je m'en vais, ils disparaissent

#### Scenario: Plis cachés
- **WHEN** l'hôte décoche « Revoir les plis gagnés » et je survole la pastille de Hugo (3 plis)
- **THEN** elle affiche toujours « 3 plis », mais rien ne s'ouvre : il faut retenir les cartes tombées

### Requirement: Faire quitter la table un joueur qui la fait attendre
Quand le tour d'un joueur dure depuis **30 s**, sa place MUST le signaler (bord rouge) avec un bouton « Exclure ? ».
Ce bouton, comme la commande **/kick** dans le chat, MUST lancer un **vote** dans le chat (voir « Votes dans le
chat »), auquel le joueur visé ne vote pas. Si le vote est accepté, le joueur MUST quitter la table comme s'il était
parti lui-même : un robot joue sa place, son nom reste avec l'icône robot jusqu'à la fin de la manche. Un seul vote à
la fois ; pendant le vote, sa place affiche « vote en cours ».

#### Scenario: Léa ne joue plus
- **WHEN** le tour de Léa dure depuis 32 s et je clique « Exclure ? » sur sa place
- **THEN** un vote « Toi propose d'exclure Léa de la table » s'ouvre dans le chat ; accepté, un robot joue sa place

### Requirement: Robots pour les places libres
Un jeu de cartes MUST commencer même s'il manque des joueurs : des **robots** (« Robot 1 »…) MUST prendre les places
libres (par exemple un Tarot à 5 avec 4 joueurs) et jouer à leur tour. Les robots MUST ne pas entrer au classement ni
au palmarès. Dans la V1, un robot MUST aussi reprendre la place d'un joueur retiré pour absence.

#### Scenario: Quatre joueurs pour un Tarot à 5
- **WHEN** le salon n'a que 4 joueurs et l'hôte a choisi le Tarot à 5
- **THEN** « Robot 1 » prend la cinquième place

### Requirement: Regarder, rejoindre ou quitter une table
Une table de cartes MUST avoir un **nombre de places** fixé par le jeu (Tarot : 4 ou 5, le réglage de l'hôte ;
Trou du cul : les joueurs de la première manche). Une place MUST être tenue soit par un joueur, soit par un robot.
Un joueur du salon sans place MUST **regarder** la partie (spectateur) :
- **Rejoindre** : il MUST pouvoir prendre une place tenue par un robot, d'abord la sienne si un robot la joue
  encore pour lui (« Reprendre ma place »), sinon une autre (« Prendre la place de Pépin »). Il MUST jouer la main
  en cours tout de suite, rôles et échanges de la place compris.
- **Table complète** : quand toutes les places sont tenues par des joueurs, rejoindre MUST échouer avec un message
  d'erreur **sur le bouton** (« Table complète (5/5) », un instant).
- **Quitter** : un joueur à table MUST pouvoir la quitter (« Quitter la table »). Un robot MUST alors jouer sa place.
  Jusqu'à la fin de la manche, la place MUST garder **le nom du joueur, avec l'icône robot**.
- **Fin de manche** : la place MUST prendre un **nom de robot tiré au hasard**. Cela montre que le joueur ne gagne
  ni ne perd plus de points.

Les points d'une place (gains et pertes de la manche) MUST aller au **dernier joueur qui l'a occupée** pendant la
manche, même s'il l'a quittée depuis ou s'il l'a prise à un robot en cours de manche. Une place jouée par un robot
du début à la fin MUST ne rapporter de points à personne : au compte, elle s'affiche avec « — ». Les spectateurs
MUST pouvoir participer plus tard par des **paris** et des **réactions à effet visuel** (après la V1, voir « Pour la
V1 des jeux de cartes »).

#### Scenario: Je quitte la table en pleine manche
- **WHEN** je quitte la table au milieu d'une manche de Trou du cul
- **THEN** un robot joue ma main, ma place affiche « Toi » et l'icône robot, et je vois « Reprendre ma place »
- **AND** à la fin de la manche, ses points sont les miens, puis la place prend un nom de robot (« Pépin »)

#### Scenario: Je prends la place d'un robot
- **WHEN** je regarde la partie et je clique « Prendre la place de Pépin »
- **THEN** je joue sa main (tout de suite, ou à la manche suivante si celle-ci est finie), et ses points deviennent
  les miens

#### Scenario: Table complète
- **WHEN** Zoé a pris la dernière place tenue par un robot, puis je clique « Rejoindre »
- **THEN** le bouton devient rouge et affiche « Table complète (5/5) », et je reste spectateur

### Requirement: Robots honnêtes au Tarot à 5 (V1)
Dans la V1, un robot MUST jouer **uniquement avec ce qu'un joueur humain sait** : sa main, les cartes déjà jouées,
les enchères, la carte appelée et le partenaire une fois révélé. (Dans la maquette, les robots connaissent le
partenaire caché : c'est à corriger.)

Un robot qui a la **carte appelée** MUST se savoir partenaire du preneur et jouer pour son camp :
- **charger** : quand le pli est **sûr** pour son camp, il MUST y donner des points (Roi, Dame, Cavalier, Valet,
  plutôt qu'une petite carte). Le pli est sûr quand il joue en dernier et que son camp le gagne, ou quand la carte
  qui gagne le pli ne peut plus être battue par les joueurs qui restent à jouer. Pour le savoir, il compte les
  atouts et les honneurs déjà tombés.
- **ne pas être gourmand** : quand le pli n'est pas sûr, il MUST garder ses points et jouer petit. Il MUST ne pas
  risquer un bout (le Petit, le 21) pour charger.
- **sauver le Petit** : il MUST jouer le Petit dans un pli que son camp gagne à coup sûr, plutôt que de le perdre
  à la fin.

En défense, un robot MUST charger de la même façon quand le pli est sûr pour la défense. Avant que le partenaire
soit révélé, il MUST déduire qui est probablement le partenaire à partir des cartes jouées, sans le savoir.

#### Scenario: Le partenaire charge sans risque
- **WHEN** à 5, Robot 2 a le Roi de cœur appelé par Léa, joue en dernier, et Léa gagne le pli avec le 19
- **THEN** Robot 2 met sa Dame de pique (des points pour le camp du preneur) plutôt qu'un 3 de trèfle

#### Scenario: Pas de charge sur un pli incertain
- **WHEN** Léa gagne le pli avec le 12, mais deux défenseurs jouent encore après Robot 2 et le 13 n'est pas tombé
- **THEN** Robot 2 joue sa plus petite carte et garde sa Dame

### Requirement: Les atouts du Tarot et leur habillage
Les atouts MUST se distinguer des cartes de couleur : une carte blanche bordée d'or, une **bordure blanche intérieure**,
une image dans le fond, et le numéro (★ pour l'Excuse) dans les coins haut-gauche et bas-droit (retourné), sur un
**cartouche blanc** dont l'angle libre est arrondi et dont les bords rejoignent la bordure par de petites courbes
creuses, pour un rendu propre et fluide. Par défaut, l'image est un fond coloré avec un **emoji** par atout. Dans
Paramètres → Partie, l'hôte MUST pouvoir donner à chaque atout (et à l'Excuse) une **image**, pour tout le salon : une
par une, ou plusieurs fichiers d'un coup (rangés d'après le numéro dans leur nom, sinon dans l'ordre), en retirer une,
ou revenir à l'habillage par défaut. Les images MUST être réduites comme celles du chat.

#### Scenario: Un jeu d'atouts personnalisé
- **WHEN** l'hôte importe « atout-1.png » à « atout-21.png » et « excuse.png »
- **THEN** chaque atout montre son image, son numéro toujours lisible dans ses cartouches blancs

### Requirement: Main lisible et cliquable
Survolée, une carte de la main MUST monter sans passer devant ses voisines, et une carte sélectionnée MUST rester à sa
place dans l'ordre : la bande visible de chaque carte reste cliquable, même avec 24 cartes. L'éventail MUST rester à
plat (les cartes du bord ne descendent pas sur les boutons).

#### Scenario: Écart dans une main de 24
- **WHEN** je sélectionne 6 cartes à la suite dans une main de 24
- **THEN** chacune se clique sur sa bande visible, sans qu'une carte déjà choisie la recouvre

### Requirement: Pour la V1 des jeux de cartes
La version complète MUST reprendre des implémentations existantes de ces jeux grand public (règles, variantes, robots)
plutôt que les réécrire, à licence compatible. Elle MUST ajouter : des **robots** pour compléter les places et
reprendre celle d'un absent ; des **paris** sur ses gains (une part de ses points de salon misée sur soi ou son
équipe, plafonnée, points fictifs) ; après la V1, les joueurs **sans place** (spectateurs d'une table pleine) MUST
pouvoir **parier leurs points sur un joueur** de la table pour en gagner (à spécifier : cotes, plafond, moment des
mises) ; un **temps par tour** (dépassé : le robot joue) ; le **vote** pour faire quitter la table au joueur qui la
fait attendre (« Faire quitter la table un joueur qui la fait attendre », côté serveur) ; la possibilité de **rallonger** la
partie (manches ou objectif, à la fin de la manche en cours) ; le Tarot, le Texas Hold'em et la Coinche.

#### Scenario: Joueur absent
- **WHEN** le tour d'un joueur dure depuis 30 s
- **THEN** un autre joueur peut lancer le vote (/kick) ; s'il passe, un robot joue à sa place
