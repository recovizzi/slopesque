## ADDED Requirements

### Requirement: Activités en modules serveur
Le serveur SHALL porter chaque activité (Demi-disque, Sondage, Roulette, intégrations, effets, Palmarès, Cartes et
chacun de ses jeux) dans son propre module Nest, sur un contrat d'activité commun (état initial, vue, annulation au
changement d'activité, départ d'un joueur, reprise après redémarrage), avec ses propres intentions WebSocket. Le
noyau de salon (présence, événements numérotés, sauvegarde des règles) MUST ne dépendre d'aucune activité.

#### Scenario: Ajouter une activité
- **WHEN** un développeur ajoute une activité
- **THEN** il crée un module qui implémente le contrat et l'enregistre, sans modifier le noyau ni les autres activités

#### Scenario: Changement d'activité
- **WHEN** l'hôte change d'activité pendant une partie
- **THEN** chaque activité dit elle-même ce qui est annulé ou continué (le sondage ouvert continue dans le chat), comme avant la refonte

### Requirement: Interface sans HTML texte
L'interface SHALL rendre toutes ses vues par des composants React. Elle MUST NOT construire de HTML en chaîne
(`innerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`), hors du contenu d'éléments tiers déjà isolés (le
sélecteur d'emoji). Le texte venant d'un joueur MUST être rendu comme texte par React.

#### Scenario: Un message avec un lien et un emoji
- **WHEN** un joueur envoie « <b>salut</b> example.com :rire: »
- **THEN** le message montre le texte « <b>salut</b> » tel quel, un lien et l'emoji, sans HTML interprété

#### Scenario: Contrôle automatique
- **WHEN** `pnpm check` tourne
- **THEN** il échoue si un fichier de `apps/web/src` contient `innerHTML`, `insertAdjacentHTML` ou `dangerouslySetInnerHTML` hors des exceptions listées

### Requirement: Bibliothèque de composants
L'interface SHALL utiliser une bibliothèque de composants commune (boutons, champs, listes, cases, segments,
onglets, fenêtres, tiroirs, menus, pastilles, badges, cartes, minuteurs, avatars, icônes) et des jetons de style
(couleurs claires et sombres, rayons, espacements, ombres, typographie). Une fonctionnalité MUST NOT redéfinir un
composant de base ni une couleur en dur hors des jetons.

#### Scenario: Un bouton dans une nouvelle fonctionnalité
- **WHEN** une fonctionnalité a besoin d'un bouton
- **THEN** elle utilise le `Button` commun, qui a la même apparence partout, en clair comme en sombre

#### Scenario: Page de démonstration
- **WHEN** l'application de développement est ouverte avec `?kit`
- **THEN** chaque composant de la bibliothèque s'affiche, avec ses variantes, en thème clair et sombre

### Requirement: Code rangé et fichiers de taille raisonnable
Le code SHALL être rangé par fonctionnalité (composants, styles, logique pure et tests ensemble) ; la logique pure
(calculs, géométrie, règles d'affichage) MUST être séparée des composants et testée. Un fichier source MUST NOT
dépasser environ 300 lignes, sauf exception justifiée en tête du fichier.

#### Scenario: Contrôle de taille
- **WHEN** `pnpm check` tourne
- **THEN** il signale tout fichier source de plus de 300 lignes qui n'a pas d'exception justifiée

### Requirement: Refonte sans régression
La refonte SHALL garder les règles, le protocole, les données et les parcours ; chaque étape MUST laisser
`pnpm check` et toute la suite e2e au vert, et ses captures comparées à celles d'avant.

#### Scenario: Une étape de la refonte
- **WHEN** une étape est commitée
- **THEN** les e2e passent et les captures de ses écrans sont identiques ou meilleures que la référence
