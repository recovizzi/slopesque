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

### Requirement: Releases
L'extension MUST être publiée sur les releases GitHub du dépôt : zip (Chrome « Load unpacked »), .crx (Linux) et
.xpi signé (Firefox, canal unlisted).

#### Scenario: Release d'une version
- **WHEN** un tag `vX.Y.Z` est poussé et le workflow Release lancé
- **THEN** la release contient les paquets de l'extension de cette version
