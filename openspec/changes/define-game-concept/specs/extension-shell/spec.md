## ADDED Requirements

### Requirement: Panneau flottant
Un clic sur l'icône de l'extension MUST ouvrir le jeu dans un panneau flottant de l'onglet courant (coins arrondis,
ombre, redimensionnable par les coins bas) ; un second clic, ✕ ou Échap MUST le fermer. Là où l'injection est
impossible, la popup classique MUST s'ouvrir à la place.

#### Scenario: Page ordinaire
- **WHEN** le joueur clique l'icône sur une page web
- **THEN** le jeu s'ouvre en panneau flottant au-dessus de la page

#### Scenario: Page interne du navigateur
- **WHEN** le joueur clique l'icône sur une page `chrome://`
- **THEN** le jeu s'ouvre dans la popup classique

### Requirement: Icône de l'application
L'icône de l'extension et le logo de l'en-tête MUST représenter une application tout-en-un centrée sur le chat, sans
référence au demi-disque d'origine : une **bulle de chat** blanche sur un carré arrondi violet (la couleur d'accent),
qui contient **quatre tuiles de couleur** (les activités du salon : jeux, sondages, roulette, pages web). L'icône
MUST rester lisible à 16 px.

#### Scenario: Dans la barre du navigateur
- **WHEN** le joueur regarde l'icône épinglée dans la barre d'outils (16 px)
- **THEN** il reconnaît une bulle avec quatre points de couleur

### Requirement: Page hors extension
Ouverte comme simple page web, l'app MUST afficher qu'il faut installer l'extension, avec un lien vers la dernière
release.

#### Scenario: Ouverture dans un onglet
- **WHEN** quelqu'un ouvre l'app hébergée sans passer par l'extension
- **THEN** il voit « Installer l'extension » et le lien vers la release

### Requirement: Versions de l'extension et du serveur
L'onglet Extension MUST montrer, en bas, la version de l'extension dans une bulle (et celle du serveur une fois
connecté). Le serveur MUST dire la plus ancienne version d'extension qu'il accepte et où télécharger la dernière ; une
extension plus ancienne MUST être refusée par une page bloquante « Mets l'extension à jour », avec ce lien.

#### Scenario: Extension trop ancienne
- **WHEN** le serveur accepte la 0.3.0 au plus ancien et que mon extension est la 0.2.1
- **THEN** le panneau affiche « Mets l'extension à jour » et le bouton mène à la dernière release

### Requirement: Releases
L'extension MUST être publiée sur les releases GitHub du dépôt : zip (Chrome « Load unpacked »), .crx (Linux) et
.xpi signé (Firefox, canal unlisted).

#### Scenario: Release d'une version
- **WHEN** un tag `vX.Y.Z` est poussé et le workflow Release lancé
- **THEN** la release contient les paquets de l'extension de cette version
