## ADDED Requirements

### Requirement: Deux modes de scrutin
L'hôte MUST pouvoir choisir le mode de scrutin dans l'onglet Partie : « Rayon libre » (chacun place un rayon sur le
demi-disque) ou « Amphithéâtre » (l'hôte choisit une colonne de sièges, chaque candidat un siège). « Rayon libre »
est le mode par défaut. Comme les autres règles, un changement pendant un placement MUST attendre la fin de ce
placement.

#### Scenario: Passer en Amphithéâtre entre deux tours
- **WHEN** l'hôte choisit « Amphithéâtre » pendant sa phase de mot
- **THEN** le demi-disque est remplacé par l'amphithéâtre pour tous les joueurs

### Requirement: Amphithéâtre de sièges
En mode Amphithéâtre, le demi-disque MUST être dessiné comme un hémicycle de sièges : 7 rangs (le premier au plus
près du centre) et 25 colonnes (la première à l'extrémité gauche), sous lequel restent les deux extrémités.

#### Scenario: Affichage
- **WHEN** un tour en mode Amphithéâtre commence
- **THEN** les joueurs voient 175 sièges en contour, « de gauche » sous la colonne de gauche et « de droite » sous celle de droite

### Requirement: Colonne de l'hôte
En mode Amphithéâtre, l'hôte MUST placer sa réponse en cliquant une colonne : tous les sièges de la colonne prennent
sa couleur. La colonne MUST rester cachée aux candidats jusqu'à la révélation.

#### Scenario: Choisir une colonne
- **WHEN** l'hôte clique sur un siège de la 18e colonne
- **THEN** les 7 sièges de la 18e colonne sont coloriés à sa couleur

### Requirement: Un siège par candidat
En mode Amphithéâtre, chaque candidat MUST choisir puis valider un siège, colorié à sa couleur. Un siège validé
MUST être visible de tous et ne MUST plus pouvoir être pris par un autre candidat ; si deux candidats visent le même
siège, le premier qui valide le garde et l'autre doit en choisir un autre.

#### Scenario: Siège déjà pris
- **WHEN** un candidat clique sur un siège validé par un autre
- **THEN** rien n'est sélectionné

#### Scenario: Siège pris pendant qu'on hésite
- **WHEN** un autre candidat valide le siège qu'un candidat avait sélectionné sans valider
- **THEN** sa sélection est retirée avec le message « Ce siège vient d'être pris. »

### Requirement: Points en colonnes
En mode Amphithéâtre, un candidat assis dans la colonne de l'hôte MUST marquer un perfect ; sinon ses points MUST
décroître avec le nombre de colonnes entre son siège et la colonne de l'hôte (le rang ne compte pas). Barème exact :
brouillon dans design.md.

#### Scenario: Dans la colonne
- **WHEN** un candidat a validé un siège du 3e rang de la colonne de l'hôte
- **THEN** il marque le maximum plus le bonus et le résultat affiche « PERFECT »

#### Scenario: À côté
- **WHEN** un candidat est à 3 colonnes de celle de l'hôte
- **THEN** le résultat affiche « à 3 colonnes » et moins de points qu'à 1 colonne

### Requirement: Colonne lisible à la révélation
À la révélation, la colonne de l'hôte MUST rester reconnaissable même quand des sièges de candidats la recouvrent :
elle est dessinée aussi autour et à l'extérieur des sièges (une bande à sa couleur, des extrémités pleines au-delà du
dernier rang et devant le premier), et les sièges des candidats qui y sont gardent un contour à la couleur de l'hôte.

#### Scenario: Un candidat dans la colonne
- **WHEN** le tour est révélé et un candidat est assis dans la colonne de l'hôte
- **THEN** son siège est à sa couleur, entouré de la couleur de l'hôte, et la colonne dépasse des sièges aux deux bouts
