## ADDED Requirements

### Requirement: Activité Sondage
L'hôte MUST pouvoir choisir l'activité de la partie, « Demi-disque » ou « Sondage », dans l'onglet Partie. Comme les
autres règles, un changement d'activité pendant un tour en cours MUST attendre la fin de ce tour. Un sondage ne
MUST pas rapporter de points.

#### Scenario: Passer au sondage
- **WHEN** l'hôte choisit « Sondage » pendant sa phase de mot
- **THEN** la zone de jeu affiche la préparation du sondage à la place du demi-disque

### Requirement: Préparation du sondage dans la zone de jeu
En activité Sondage, l'hôte MUST écrire la question et choisir le type de réponse directement dans la zone de jeu :
« Choix définis » (au moins 2 choix, il peut en ajouter et en retirer), « Choix libre » (chacun écrit sa réponse) ou
« Gradient » (au moins 2 propositions). Il MUST ne pouvoir publier qu'une question et des choix remplis. Pendant ce
temps, les candidats voient que l'hôte prépare un sondage.

#### Scenario: Ajouter un choix
- **WHEN** l'hôte a 4 choix et clique « + Ajouter un choix »
- **THEN** un 5e champ apparaît, chaque champ au-delà de 2 pouvant être retiré

#### Scenario: Gradient à plus de deux propositions
- **WHEN** l'hôte choisit « Gradient » avec 4 propositions
- **THEN** l'aperçu montre une forme à 4 coins (2D), une proposition par coin ; avec 2 propositions, un curseur entre les deux

### Requirement: Temps de réponse du sondage
Une fois le sondage publié, tous les participants MUST disposer du temps de réponse choisi dans l'onglet Partie :
3 min, 5 min (défaut), 15 min, 30 min, 1 h ou 3 h. Tant que tous les candidats n'ont pas répondu, le minuteur MUST
continuer, et un joueur qui rejoint pendant ce temps MUST pouvoir répondre. Le sondage MUST se fermer à la fin du
temps, dès que tous les candidats ont répondu, ou quand l'hôte clique « Terminer le sondage » (à tout moment).

#### Scenario: Rejoindre en cours
- **WHEN** un spectateur clique « Participer » pendant un sondage ouvert
- **THEN** il peut répondre au sondage

#### Scenario: L'hôte termine
- **WHEN** l'hôte clique « Terminer le sondage » alors que des candidats n'ont pas répondu
- **THEN** le sondage se ferme et les résultats s'affichent

### Requirement: Réponses
En choix définis, chaque participant MUST choisir un des choix ; en choix libre, écrire une réponse ; en gradient,
placer un point sur le curseur (2 propositions) ou dans la forme (3 ou plus). Une réponse validée ne MUST plus
changer. L'hôte MUST pouvoir répondre comme un candidat une fois le sondage publié.

#### Scenario: L'hôte répond
- **WHEN** l'hôte coche « Islande » et valide pendant son sondage
- **THEN** sa réponse compte comme celle d'un candidat

### Requirement: Résultats selon le type
À la fermeture, les résultats MUST s'afficher selon le type : en choix définis, une barre par choix, classées, avec
le pourcentage et le nombre de réponses ; en choix libre, toutes les réponses, les réponses identiques (sans tenir
compte de la casse, des accents et des espaces) regroupées avec une pastille multiplicatrice « ×n » dans leur coin
haut droit ; en gradient, une carte de chaleur des points sur le curseur ou la forme, et les propositions classées
par température.

#### Scenario: Gradient 2D
- **WHEN** un sondage gradient à 4 propositions est fermé
- **THEN** la forme montre la chaleur des points des joueurs et les 4 propositions sont classées de la plus chaude à la plus froide

### Requirement: Température répartie à parts égales
En gradient, chaque joueur MUST distribuer le même total de points (100) entre les propositions, d'autant plus à une
proposition que son point est proche de son coin : tout sur une proposition s'il est sur son coin, à parts égales
au centre de la forme. La température d'une proposition MUST être la moyenne de ce que les joueurs lui donnent (les
températures font environ 100° au total), pour qu'un groupe de joueurs à mi-distance d'une proposition pèse plus
qu'un joueur seul collé au coin d'une autre.

#### Scenario: Une masse contre un coin
- **WHEN** un joueur est sur le coin « Plage » et trois joueurs à mi-chemin entre le centre et le coin « Montagne »
- **THEN** « Montagne » est plus chaude que « Plage »

#### Scenario: Centre
- **WHEN** l'unique joueur place son point au centre d'une forme à 4 coins
- **THEN** chaque proposition est à 25°

#### Scenario: Réponses répétées
- **WHEN** deux joueurs ont répondu « Chocolat » et « chocolat »
- **THEN** une seule réponse « Chocolat » s'affiche, avec la pastille « ×2 »

### Requirement: Égalité départagée par l'hôte
Quand plusieurs résultats sont à égalité pour la première place, la réponse de l'hôte MUST les départager (en
gradient : la proposition à égalité la plus proche de son point), et le texte « Avantage hôte » MUST s'afficher en
bas à gauche de la zone de jeu. Si l'hôte n'a pas répondu ou n'a pas choisi l'un des ex æquo, « Égalité » s'affiche.

#### Scenario: Avantage hôte
- **WHEN** « Japon » et « Islande » ont 2 réponses chacun et que l'hôte a répondu « Japon »
- **THEN** « Japon » est numéro 1 et « Avantage hôte » s'affiche en bas à gauche

### Requirement: Résultats secrets ou nominatifs
L'hôte MUST pouvoir choisir dans l'onglet Partie si les résultats sont secrets. S'ils ne le sont pas, survoler un
résultat (barre, réponse libre, point du gradient) MUST montrer le nom des joueurs qui l'ont donné ; s'ils le sont,
aucun nom ni couleur de joueur n'apparaît dans les résultats.

#### Scenario: Survol
- **WHEN** les résultats ne sont pas secrets et qu'un joueur survole la barre « Japon »
- **THEN** une bulle affiche « Toi, Léa »

### Requirement: Image d'un choix défini
En « Choix définis », l'hôte MUST pouvoir donner à chaque choix une image, facultative : un choix peut en avoir une
sans que les autres en aient. Un « + » sur la ligne du choix MUST proposer Image (l'explorateur de fichiers), GIF (la
fenêtre GIF), Sticker (les stickers du salon, ou un message s'il n'y en a pas) et Emoji (écrit dans le texte du choix,
là où est le curseur) ; glisser une image sur la ligne MUST la lui donner. Un choix MUST avoir un texte ou une image
(un choix sans texte s'affiche « Choix n »). L'image MUST pouvoir être retirée, et MUST s'afficher au-dessus du texte
dans les réponses et en vignette dans les barres de résultats (les lignes sans image restent alignées).

#### Scenario: Un choix sur quatre avec une image
- **WHEN** l'hôte glisse une photo sur la ligne « Canada » et publie le sondage
- **THEN** le choix « Canada » montre la photo au-dessus de son texte, les autres choix restent sans image

#### Scenario: Un GIF sur un choix
- **WHEN** l'hôte clique le « + » du choix « Brésil » puis « GIF » et choisit un GIF
- **THEN** le GIF devient l'image du choix « Brésil » (et passe dans ses GIF récents)
