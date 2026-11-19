## ADDED Requirements

### Requirement: Code utilisateur
Chaque joueur MUST avoir un **code utilisateur** : son identité, sans compte, mot de passe ni double authentification.
Au **premier lancement**, avant d'entrer dans un salon, l'app MUST tirer un code au hasard et l'afficher sur une page
d'accueil, avec ce qu'il fait (il relie pseudo, couleur, photos et résultats ; le noter permet de retrouver son compte
sur un autre appareil ; qui le connaît prend le compte ; il se change dans Profil → Compte) et trois choix :
« Continuer avec ce code », « J'ai déjà un code » (reprendre un compte), « Choisir mon code ». Le code tiré MUST
compter 16 signes de l'alphabet des clés de salon (sans I, L, O, 0 ni 1), en 4 groupes : `XXXX-XXXX-XXXX-XXXX`
(environ 79 bits). Le code MUST être gardé sur l'appareil (stockage local de l'extension, jamais synchronisé ailleurs).
Deux codes MUST être le même s'ils ne diffèrent que par la casse, les tirets ou les espaces.

#### Scenario: Premier lancement
- **WHEN** un joueur ouvre l'extension pour la première fois
- **THEN** il voit son code, par exemple `YXFP-BS6W-6WVW-YTMA`, avant tout salon, et entre dans le salon après
  « Continuer avec ce code »

#### Scenario: Une autre écriture du même code
- **WHEN** un joueur tape `prune galop 4827 zest` pour reprendre le compte `PRUNE-GALOP-4827-ZEST`
- **THEN** le serveur trouve ce compte

### Requirement: Un code assez difficile à deviner
Un code choisi à la main MUST être refusé s'il est **trop simple**, avec la raison sous le champ et une jauge en trois
niveaux (trop simple, correct, solide) qui suit la frappe : moins de 12 lettres ou chiffres (tirets non comptés), plus
de 32, un autre signe que lettres sans accent, chiffres et tirets, moins de 6 signes différents, un signe répété 4 fois
de suite (`AAAA`), une suite de 4 (`1234`, `ABCD`, `DCBA`), un mot trop connu (`AZERTY`, `PASSWORD`, `SLOPESQUE`…), ou
moins de 60 bits estimés (longueur × log2 du nombre de signes possibles : 26 lettres, 10 chiffres, 36 mêlés). De 60 à
74 bits le code est « correct », à partir de 75 « solide ». Un bouton MUST tirer un code au hasard à la place.

#### Scenario: Trop simple
- **WHEN** un joueur choisit `lapin-1234-rouge`
- **THEN** « Pas de suite comme 1234 » s'affiche et le bouton « Continuer » reste grisé

#### Scenario: Correct
- **WHEN** un joueur choisit `jardin pluie 7` (12 signes mêlés, environ 62 bits)
- **THEN** la jauge montre « correct » et le code peut être choisi

### Requirement: Changer de code utilisateur
Profil → **Compte** MUST montrer le code, masqué par défaut (un œil l'affiche, un bouton le copie), puis un **bouton
rouge** « Changer de code utilisateur » avec sa description : renouveler son code en gardant son compte, reprendre un
compte existant, ou repartir de zéro (le compte quitté n'est pas effacé, seul son code permet d'y revenir). Le
changement MUST se faire en trois temps :
1. le choix : **Renouveler mon code**, **Reprendre un compte existant** ou **Repartir de zéro** ;
2. le code : reprendre MUST demander le code d'un compte qui existe (sinon « Aucun compte avec ce code ») ; repartir de
   zéro et renouveler MUST proposer un code tiré au hasard, modifiable (même contrôle que « Un code assez difficile à
   deviner »), et refuser un code déjà pris ou retiré (« Ce code est déjà pris ») ; le code actuel MUST être refusé
   (« C'est déjà ton code ») ;
3. la **confirmation**, en rouge : ce qui va se passer (reprendre : le compte nommé par son pseudo remplace le mien ;
   repartir : pseudo, couleur, photos, crédit social et palmarès repartent de zéro), le code actuel à noter, une case
   « J'ai noté mon code actuel » à cocher avant le bouton rouge « Reprendre ce compte » / « Créer ce compte » ;
   renouveler : tout est gardé, l'ancien code ne marchera plus sur aucun appareil, le nouveau code à noter, une case
   « J'ai noté mon nouveau code » avant le bouton rouge « Renouveler mon code ». Après un renouvellement, Profil →
   Compte MUST montrer le nouveau code (non masqué).
Au premier lancement, « J'ai déjà un code » et « Choisir mon code » MUST passer par les mêmes étapes, sans code actuel à
noter. Le code MUST pouvoir être changé à tout moment, autant de fois que voulu.

#### Scenario: Reprendre un compte sur un deuxième appareil
- **WHEN** un joueur tape sur son portable le code affiché sur son ordinateur, puis confirme
- **THEN** son portable joue avec le même compte : même pseudo, même couleur, mêmes photos, mêmes résultats

#### Scenario: Renouveler un code trop simple
- **WHEN** un joueur parti avec un code faible le renouvelle en `LAPIN-ROUGE-VOLE-26` et confirme
- **THEN** il garde pseudo, couleur, photos, crédit social et palmarès ; l'ancien code n'ouvre plus aucun compte

#### Scenario: Confirmation obligatoire
- **WHEN** un joueur arrive à la confirmation sans cocher « J'ai noté mon code actuel »
- **THEN** le bouton rouge reste grisé

#### Scenario: Repartir de zéro
- **WHEN** un joueur confirme « Créer ce compte » avec un nouveau code
- **THEN** son pseudo redevient « Toi », sans photo ; son ancien compte reste sur le serveur

### Requirement: Ancien code hors service
Un code remplacé (renouvelé par le joueur, ou par un admin) MUST devenir inutilisable aussitôt : le serveur MUST
**déconnecter** les appareils encore connectés avec lui et garder son empreinte comme **retirée**, pour toujours. Un
code retiré MUST être refusé à la connexion avec « Ce code a été remplacé : tape le nouveau (Profil → Compte sur ton
autre appareil) », sans créer de compte vide, et ne MUST jamais redevenir le code d'un compte. L'app MUST alors
proposer « J'ai déjà un code » (le nouveau) ou « Repartir de zéro ».

#### Scenario: L'autre appareil
- **WHEN** un joueur renouvelle son code sur son ordinateur alors que son portable est connecté avec l'ancien
- **THEN** le portable est déconnecté et demande le nouveau code ; il ne crée pas de compte vide

### Requirement: Rendre son compte à un joueur qui a perdu son code
Il n'y a pas d'admin dans l'interface : un admin MUST pouvoir, par une **commande console** sur le serveur seulement,
(1) retrouver un compte d'après ce que la base sait du joueur (pseudo actuel ou passé, salons fréquentés, date de la
dernière connexion, date de création), la commande listant les comptes qui correspondent avec leur identifiant
interne, sans jamais afficher de code ; puis (2) remplacer le code de ce compte par un **code tiré au hasard**, affiché
une seule fois dans la console pour être transmis au joueur. L'ancien code MUST être retiré (voir Ancien code hors
service). Chaque remise à zéro MUST être notée dans un journal (date, compte, admin) sans le code.

#### Scenario: Code perdu
- **WHEN** Léa a perdu son code, et l'admin cherche « Léa » dans le salon K7QP-M2XD puis remet son code à zéro
- **THEN** la console affiche une fois un nouveau code, que l'admin donne à Léa ; elle retrouve son compte avec

### Requirement: Authentification par le code
Le code MUST être la seule authentification : l'extension MUST l'envoyer au serveur à la connexion (HTTPS, WebSocket
sécurisé), jamais dans une adresse. Le serveur MUST garder une **empreinte** du code (HMAC-SHA-256 de la forme
canonique avec un secret du serveur), jamais le code en clair, et retrouver le compte par cette empreinte. Le premier
code inconnu reçu MUST créer un compte vide (jamais un code retiré). Le serveur MUST limiter les essais de codes inconnus (par adresse IP :
10 par minute, puis attente croissante) pour empêcher de les deviner en masse. Un compte appartient à un serveur : le
même code sur un autre serveur est un autre compte. Un code perdu ne se retrouve pas par e-mail : seul un admin le
remplace (voir Rendre son compte à un joueur qui a perdu son code).

#### Scenario: Deviner des codes
- **WHEN** une même adresse envoie 50 codes inconnus en une minute
- **THEN** le serveur refuse les essais au-delà de 10 et fait attendre de plus en plus

### Requirement: Sauvegarde liée au code
Le compte MUST relier, côté serveur : le profil (pseudo, couleur, réaction au double-clic), la liste des salons et
leurs noms personnels, les GIF favoris, et, dans chaque salon, ce qui est au joueur (photo de profil, scores, palmarès,
crédit social, place à table). Le serveur MUST aussi garder, pour la commande d'admin, les pseudos passés du compte,
ses dates de création et de dernière connexion. L'appareil MUST en garder une copie pour s'afficher sans attendre ; le serveur fait foi.
Restent sur l'appareil seulement : le code, l'adresse du serveur, le thème, les réactions et GIF récents. Le pseudo et
la couleur MUST pouvoir changer à tout moment, autant que voulu : c'est le code, pas le pseudo, qui identifie le joueur.

#### Scenario: Changer de pseudo
- **WHEN** un joueur passe de « Léa » à « Léa la Terrible »
- **THEN** son palmarès, son crédit social et sa photo restent les siens

### Requirement: Photo de profil
Un joueur MUST pouvoir mettre une **photo de profil** dans Profil (« Ajouter une photo », « Changer de photo »). La
photo MUST être **propre au salon** : chaque salon a la sienne, rattachée au joueur dans ce salon. Elle MUST être coupée
en carré au milieu de l'image et réduite à 256 px (voir Formats d'image), puis montrée partout où apparaît le rond du
joueur (en-tête, liste des joueurs, podium, places à table, fenêtre du crédit social). Une **petite croix** sur la photo
MUST la retirer : le rond redevient la première lettre du pseudo sur sa couleur. Un fichier qui n'est pas une image
MUST afficher une erreur sous la photo.

#### Scenario: Une photo par salon
- **WHEN** un joueur met une photo dans « Les pays », puis entre dans « Les copains du jeudi »
- **THEN** il y garde sa lettre sur sa couleur ; de retour dans « Les pays », sa photo est là

#### Scenario: Retirer sa photo
- **WHEN** un joueur clique sur la petite croix de sa photo
- **THEN** son rond montre de nouveau sa lettre sur sa couleur, partout dans le salon
