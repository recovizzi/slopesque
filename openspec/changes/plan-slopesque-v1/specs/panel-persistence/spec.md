## ADDED Requirements

### Requirement: Rester ouvert sur toutes les pages
L'onglet Extension MUST proposer l'option **« Rester ouvert sur toutes les pages »**, désactivée par défaut. L'activer
MUST demander au navigateur la permission d'accès à tous les sites (`optional_host_permissions`) ; refusée, l'option
reste désactivée avec la raison. Activée : le panneau MUST se rouvrir de lui-même sur chaque page chargée dans
n'importe quel onglet, à la même taille et au même endroit, tant que le joueur ne l'a pas fermé ; le fermer (✕, Échap,
icône, raccourci) MUST le fermer sur toutes les pages, et l'ouvrir MUST l'ouvrir partout. Désactivée : le comportement
de la maquette (le panneau vit dans l'onglet où il a été ouvert, jusqu'au changement de page). À l'installation,
l'extension MUST ne demander aucun accès à tous les sites.

#### Scenario: Changer de site
- **WHEN** l'option est activée, le panneau ouvert, et le joueur suit un lien vers un autre site
- **THEN** le panneau réapparaît sur la nouvelle page, connecté au même salon, le chat au même endroit

#### Scenario: Fermer partout
- **WHEN** le joueur ferme le panneau dans un onglet
- **THEN** il est fermé dans tous les onglets et ne se rouvre pas au prochain chargement de page

#### Scenario: Permission refusée
- **WHEN** le joueur active l'option puis refuse la permission du navigateur
- **THEN** l'option reste désactivée et l'onglet Extension dit pourquoi

### Requirement: Plusieurs onglets
Quand le panneau est ouvert dans plusieurs onglets, seul l'onglet **visible** MUST garder sa connexion ; un onglet
caché depuis plus de 30 secondes MUST se déconnecter et se reconnecter (état complet) quand il redevient visible. La
présence suit la règle « absent seulement après 15 secondes sans aucune connexion ».

#### Scenario: Dix onglets ouverts
- **WHEN** l'option est activée et le joueur a dix onglets
- **THEN** le serveur ne voit qu'une ou deux connexions de ce joueur, jamais dix

### Requirement: Pages où le panneau ne peut pas s'ouvrir
L'icône et le raccourci MUST ouvrir la popup de secours sur les pages où l'extension ne peut pas s'injecter (pages
internes `chrome://`, `about:`, boutique d'extensions, lecteur PDF, page refusant le cadre), quand le navigateur le
permet ; avec l'option active, ces pages n'ont simplement pas de panneau.

#### Scenario: Nouvel onglet
- **WHEN** le joueur ouvre un nouvel onglet (page interne) avec l'option activée
- **THEN** aucun panneau n'apparaît ; le raccourci y ouvre la popup

### Requirement: Raccourci clavier
Un **raccourci clavier** MUST ouvrir et fermer le panneau sur la page courante (commande de l'extension, par défaut
`Alt+Maj+S`), même sans l'option « toutes les pages » (le raccourci donne l'accès à l'onglet courant). L'onglet
Extension MUST afficher le raccourci actuel (« aucun » si le navigateur ne l'a pas attribué, par conflit) et permettre
de le changer : directement dans l'onglet sous Firefox (`commands.update`) ; sous Chrome et Edge, qui ne le permettent
pas à une extension, un bouton MUST ouvrir la page des raccourcis du navigateur, avec la marche à suivre. Le
raccourci MUST fonctionner quand le focus est dans le panneau (il le ferme).

#### Scenario: Ouvrir et fermer au clavier
- **WHEN** le joueur appuie sur Alt+Maj+S sur une page, puis encore
- **THEN** le panneau s'ouvre, puis se ferme

#### Scenario: Changer le raccourci sous Chrome
- **WHEN** le joueur clique « Changer le raccourci » dans l'onglet Extension sous Chrome
- **THEN** la page `chrome://extensions/shortcuts` s'ouvre, et l'onglet Extension affiche le nouveau raccourci au retour
