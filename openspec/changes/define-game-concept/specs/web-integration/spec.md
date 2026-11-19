## ADDED Requirements

### Requirement: Activité intégrée (page web externe)
Une activité intégrée MUST afficher une page web externe dans toute la zone de jeu (un cadre), avec au-dessus une
barre fine : le nom de l'intégration, l'hôte de son adresse, « Recharger » et « Ouvrir dans un onglet ». La première
intégration est **Low Tide** (le jeu web déclaré « Low Tide », adresse par défaut
`https://1ddf-90-85-208-125.ngrok-free.app/`). Une intégration n'a ni tour ni points (la liste des joueurs remplace
le classement). Le cadre MUST limiter la page (pas de navigation de la page de l'extension, pas d'accès à ses API).

#### Scenario: Choisir Low Tide
- **WHEN** l'hôte choisit l'activité « Low Tide »
- **THEN** la page de Low Tide remplit la zone de jeu de tous les joueurs du salon

### Requirement: Adresse vérifiée par l'hôte
Dans Paramètres → Partie, l'hôte MUST pouvoir changer l'adresse d'une intégration (si elle a changé). L'adresse MUST
être vérifiée avant d'être enregistrée pour le salon : en `https://` (ou `http://` sur localhost), la page MUST
répondre et déclarer le nom de l'intégration (le `name` ou `short_name` de son manifeste web, son titre, ou
`<meta name="application-name">`, sans tenir compte de la casse) ; sinon l'adresse MUST être refusée, avec la raison
(autre nom déclaré, aucun nom, page injoignable, adresse invalide, permission refusée). Pour lire la page,
l'extension MUST demander à l'hôte la permission d'accéder à ce site (permission facultative, site par site) ; la
page MUST être lue sans exécuter ses scripts. Les autres joueurs MUST voir l'adresse sans pouvoir la changer.

#### Scenario: Une autre page
- **WHEN** l'hôte saisit l'adresse d'une page qui se déclare « Autre jeu »
- **THEN** l'adresse est refusée (« Cette page se déclare « Autre jeu », pas « Low Tide » ») et rien ne change

#### Scenario: Nouvelle adresse de Low Tide
- **WHEN** l'hôte saisit la nouvelle adresse du jeu, qui se déclare « Low Tide »
- **THEN** elle est enregistrée pour le salon et la page s'affiche depuis cette adresse

### Requirement: Page qui ne répond pas
Avant d'afficher la page dans le cadre, l'extension MUST vérifier qu'elle répond (le statut HTTP quand le joueur a la
permission de lire le site, sinon seulement une réponse du serveur, quelle qu'elle soit). Si elle ne répond pas, une
carte MUST remplacer le cadre (pas de page d'erreur du navigateur, rien ne casse) : « Low Tide ne répond pas », avec
l'adresse ; pour l'hôte, « Revoir l'adresse » (qui ouvre Paramètres → Partie sur ce champ) ; pour les autres, que
l'hôte doit revoir l'adresse ; pour tous, « Réessayer ». Le reste du salon (chat, joueurs) MUST continuer à marcher.

#### Scenario: Le jeu est arrêté
- **WHEN** l'adresse de Low Tide ne répond plus
- **THEN** l'hôte voit « Low Tide ne répond pas » et « Revoir l'adresse », les candidats voient que l'hôte doit la revoir
