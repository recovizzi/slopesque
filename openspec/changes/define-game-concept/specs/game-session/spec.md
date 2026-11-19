## ADDED Requirements

### Requirement: Salon et clé de salon
Un salon MUST être identifié par une clé `XXXX-XXXX` (sans caractères ambigus : ni I, L, O, 0, 1), saisie
insensible à la casse, aux espaces et aux tirets. Seul un admin MUST pouvoir créer un salon : par une route du
serveur réservée aux admins (`POST /api/admin/rooms/{key}`, protégée par un jeton `SCD_ADMIN_TOKEN`, appelée
directement sur le conteneur du serveur, par exemple `docker compose exec server curl …`), qui vérifie la forme et
l'unicité de la clé puis crée le salon et tout ce dont il a besoin. Aucune route publique ne MUST créer de salon. Une
route publique (`GET /api/rooms/{key}`) MUST dire si un salon existe (200) ou non (404) ; ensuite tout l'échange
passe entre l'extension et le serveur, dans ce salon.

#### Scenario: Un admin crée le salon
- **WHEN** un admin appelle la route d'admin avec la clé `QKWV-B3M8` et le bon jeton
- **THEN** le salon existe, et `GET /api/rooms/QKWV-B3M8` répond 200

#### Scenario: Sans jeton
- **WHEN** quelqu'un appelle la route d'admin sans le jeton ou avec un mauvais
- **THEN** le serveur refuse (401) et ne crée rien

### Requirement: Liste des salons
Dans Paramètres → Extension, à la place d'un champ de clé, le joueur MUST avoir la liste de ses salons, gardée sur
son appareil : pour chacun un nom de son choix (par défaut la clé) et la clé, le salon actuel marqué, les salons en
attente marqués. Il MUST pouvoir :
- **ajouter** un salon dans une fenêtre (clé, nom facultatif) : la clé MUST être vérifiée auprès du serveur avant
  d'être enregistrée ;
- **rejoindre** un autre salon de la liste (naviguer d'un salon à l'autre) ;
- **sélectionner** des salons pour en **renommer** un, ou en **retirer** plusieurs de sa liste (après confirmation ;
  ils ne sont pas supprimés du serveur) ;
- **créer** un salon : une clé est générée, et le salon est ajouté **en attente** à sa liste, en local, jusqu'à ce
  qu'un admin le crée avec cette clé.

#### Scenario: Ajouter un salon
- **WHEN** un joueur ajoute la clé « h8tc3kdm » avec le nom « Le resto du vendredi », et que le serveur connaît ce salon
- **THEN** la liste montre « Le resto du vendredi » avec la clé `H8TC-3KDM`

#### Scenario: Naviguer
- **WHEN** un joueur clique « Rejoindre » sur un autre salon de sa liste
- **THEN** il entre dans ce salon (son activité, son chat, ses joueurs), avec son propre profil

### Requirement: Erreurs de salon
Quand le serveur répond qu'aucun salon n'a la clé (404), l'extension MUST le dire (« Salon inconnu ») ; quand le
serveur ne répond pas du tout (adresse fausse, serveur arrêté, réseau), elle MUST le dire autrement (« Serveur
injoignable », avec l'adresse essayée et où la corriger). Ces messages MUST apparaître dans la fenêtre d'ajout (le
salon n'est alors pas ajouté) et à l'entrée dans un salon.

#### Scenario: Clé inconnue
- **WHEN** un joueur ajoute la clé `ZZZZ-ZZZZ` que le serveur ne connaît pas
- **THEN** la fenêtre affiche « Salon inconnu » et la liste ne change pas

#### Scenario: Serveur injoignable
- **WHEN** l'adresse du serveur est fausse et le joueur ajoute ou rejoint un salon
- **THEN** il voit « Serveur injoignable » avec l'adresse essayée, pas « Salon inconnu »

### Requirement: Page d'un salon qu'on ne peut pas ouvrir
Tant que le salon actuel n'est pas accessible, l'extension MUST afficher à la place du jeu (sans chat ni tiroir de
gauche) une page qui dit pourquoi : **en attente** (salon créé depuis la liste mais pas encore par un admin : elle
demande de contacter un admin et montre la clé, copiable en un clic, au même format que celle de l'en-tête),
**inconnu**, ou **serveur injoignable**. La page MUST avoir un bouton « Réessayer » qui interroge de nouveau le
serveur (et entre dans le salon s'il existe désormais) et un bouton pour choisir un autre salon. Dans la liste, le
salon actuel bloqué MUST aussi proposer « Réessayer ».

#### Scenario: En attente puis créé
- **WHEN** un joueur crée « Mon salon », envoie sa clé à un admin, puis clique « Réessayer » une fois le salon créé
- **THEN** il entre dans le salon ; avant la création, « Réessayer » laisse la page avec « Toujours pas créé »

### Requirement: Ce qui suit le joueur, ce qui appartient au salon
D'un salon à l'autre, le joueur MUST garder son profil (pseudo, couleur), sa réaction au double-clic, ses GIF favoris
et sa liste de salons : ils sont liés à son **code utilisateur** et gardés par le serveur (voir Sauvegarde liée au
code), avec une copie sur l'appareil. Restent sur l'appareil seulement : le code, l'adresse du serveur, le thème, les
réactions et GIF récents. Le reste MUST appartenir au salon : le jeu (activité, règles, scores), le chat, les emoji
personnalisés, la bibliothèque de stickers, et la photo de profil de chaque joueur (une par salon).

#### Scenario: Changer de salon
- **WHEN** un joueur passe de « Les pays » à « Les copains du jeudi »
- **THEN** il garde son pseudo, sa couleur et ses GIF favoris, mais voit le chat, les emoji personnalisés et les
  stickers de « Les copains du jeudi », et sa photo de ce salon (ou sa lettre s'il n'en a pas mis)

### Requirement: Lobby et bouton Participer
Toute personne qui ouvre l'extension sur un salon MUST voir son jeu ; un bouton « Participer » sous le demi-disque
MUST l'ajouter au lobby comme candidat.

#### Scenario: Rejoindre comme candidat
- **WHEN** un spectateur clique « Participer »
- **THEN** il apparaît dans le classement et peut placer des rayons

### Requirement: Rôle d'hôte
Un salon MUST avoir exactement un hôte. L'hôte MUST pouvoir donner son rôle à un autre joueur depuis le classement
(ou la liste des joueurs). Un autre joueur MUST pouvoir demander le rôle avec la commande **/hote** du chat :
- si l'hôte est **absent depuis 5 min ou plus**, le rôle MUST passer au demandeur tout de suite, sans vote ;
- sinon, un **vote** MUST s'ouvrir dans le chat (voir « Votes dans le chat ») ; accepté, le demandeur devient hôte.

Le rôle ne MUST jamais changer de main tout seul : cela remplace la reprise automatique par le plus ancien joueur,
jugée peu claire.

#### Scenario: Donner le rôle
- **WHEN** l'hôte clique la couronne à côté d'un joueur dans le classement
- **THEN** ce joueur devient hôte et l'ancien hôte devient candidat

#### Scenario: L'hôte est absent depuis 6 min
- **WHEN** Léa, l'hôte, a fermé sa fenêtre il y a 6 min et j'écris /hote
- **THEN** je deviens l'hôte tout de suite, et le chat dit « Toi devient l'hôte : Léa n'était plus là depuis 6 min »

#### Scenario: L'hôte est là
- **WHEN** Léa, l'hôte, est connectée et j'écris /hote
- **THEN** un vote s'ouvre dans le chat ; s'il est accepté, je deviens l'hôte

### Requirement: Présence des joueurs
Un joueur dont la fenêtre ou l'extension est fermée MUST être marqué **absent** dans la liste des joueurs et le
classement, avec une icône (une lune) à côté de son nom. À partir de **5 min** d'absence, l'icône MUST changer (une
lune avec un « z », orange) : c'est le seuil qui permet de prendre le rôle de l'hôte sans vote. Le survol de l'icône
MUST dire depuis combien de temps. Les absents MUST ne pas compter dans les joueurs connectés d'un vote.

#### Scenario: Malo a fermé sa fenêtre
- **WHEN** Malo ferme sa fenêtre depuis 2 min
- **THEN** une lune apparaît à côté de son nom ; à 5 min, elle devient la lune avec un « z »

### Requirement: Durée de vie des données
Un salon MUST durer, avec ce qui lui appartient (clé, joueurs, scores, crédit social, palmarès, emoji personnalisés,
stickers, photos de profil), jusqu'à sa suppression par un admin, sans purge pour inactivité. Les messages du chat
MUST être supprimés **30 jours** après leur envoi, les images du chat **7 jours** après (voir Conservation des images
du chat). Hors d'un salon, seuls les **comptes** (voir Code utilisateur) MUST être stockés. Le détail (où, combien de
temps, sauvegardes) est dans `data-retention` (change `plan-slopesque-v1`). La purge « 8 h après la dernière
activité » des premières versions est abandonnée.

#### Scenario: Revenir après deux mois
- **WHEN** un joueur revient dans un salon resté sans activité pendant deux mois
- **THEN** il retrouve scores, crédit social, palmarès, stickers et emoji ; le chat est vide (messages de plus de 30
  jours supprimés)
