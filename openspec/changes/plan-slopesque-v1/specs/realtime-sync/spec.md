## ADDED Requirements

### Requirement: Une connexion par panneau
Le panneau MUST ouvrir **une** connexion WebSocket (Socket.IO, `wss://` en production) vers l'adresse du serveur
réglée dans l'onglet Extension, et s'authentifier par le **code utilisateur** dans le premier message (jamais dans
l'adresse). Le serveur MUST refuser la connexion avec une raison lisible : code retiré, trop d'essais, version du
protocole trop ancienne (« Mets l'extension à jour »). Le chat, les jeux, la présence, les votes et le crédit MUST
passer par cette connexion ; HTTP MUST servir seulement à envoyer une image, chercher des GIF et vérifier la santé du
serveur. Le projet MUST ne pas utiliser de SSE.

#### Scenario: Extension trop ancienne
- **WHEN** une extension en protocole 3 se connecte à un serveur en protocole 4
- **THEN** le panneau affiche « Mets l'extension à jour » au lieu du salon

### Requirement: Connexion chiffrée
Le code utilisateur étant le seul secret d'un compte, la connexion au serveur de production MUST être chiffrée (HTTPS
et `wss://`, certificat valide). Sans nom de domaine, le certificat MUST venir d'un nom qui pointe sur l'adresse IP
(`<ip-avec-des-tirets>.sslip.io`, Let's Encrypt par Caddy) ou d'un certificat Let's Encrypt d'adresse IP, selon les ports
ouverts sur la machine (question ouverte de design.md). Une connexion non chiffrée MUST rester possible seulement
vers `localhost`, `127.0.0.1` et le réseau local, ou si le serveur l'autorise explicitement (`ALLOW_INSECURE=true`) ;
le panneau MUST alors montrer « Connexion non chiffrée » dans l'en-tête et dans l'onglet Extension.

#### Scenario: Serveur de développement
- **WHEN** l'extension se connecte à `http://localhost:3000`
- **THEN** la connexion se fait, sans avertissement

#### Scenario: Serveur distant sans chiffrement
- **WHEN** l'extension se connecte à `http://<IP>:<port>` d'un serveur qui a `ALLOW_INSECURE=true`
- **THEN** la connexion se fait, et l'en-tête montre « Connexion non chiffrée »

### Requirement: État complet à l'arrivée
En rejoignant un salon (ou en se reconnectant), le client MUST recevoir d'un seul message l'**état complet** qui le
concerne : joueurs et présence, activité et phase, ce que sa place lui permet de voir, minuteurs (heure de fin
calculée par le serveur), votes ouverts, les 100 derniers messages du chat ; puis des **événements** incrémentaux
numérotés. Un client qui voit un trou dans la numérotation MUST redemander l'état complet. Les messages plus anciens
MUST se charger en remontant le chat, par pages de 100.

#### Scenario: Reconnexion après une coupure
- **WHEN** le réseau d'un joueur coupe 20 secondes pendant un vote
- **THEN** à la reconnexion il retrouve le vote avec le bon temps restant, et les messages arrivés entre-temps

### Requirement: Reconnexion et présence
La connexion MUST se rétablir seule (attente croissante, de 0,5 s à 10 s) et dire « Reconnexion… » dans l'en-tête
pendant la coupure. Un joueur MUST être compté **absent** seulement après **15 secondes** sans aucune connexion, pour
qu'un changement de page ou de site ne fasse pas clignoter sa présence ; il passe « absent depuis 5 min » selon la
règle de la maquette (Présence des joueurs).

#### Scenario: Changer de page avec le panneau ouvert
- **WHEN** un joueur passe d'une page à une autre et que le panneau se reconnecte en 2 s
- **THEN** les autres ne le voient jamais absent

### Requirement: Plusieurs connexions d'un même compte
Un compte MUST pouvoir être connecté plusieurs fois (deux appareils, deux onglets) : il compte comme **un** joueur,
présent tant qu'une connexion l'est ; ses actions MUST être acceptées depuis n'importe laquelle et son état (main,
brouillon de vote) MUST être le même partout.

#### Scenario: Ordinateur et portable
- **WHEN** un joueur est connecté au même salon sur son ordinateur et son portable
- **THEN** la liste des joueurs le montre une seule fois, et un message écrit sur l'un apparaît sur l'autre

### Requirement: Minuteurs du serveur
Le serveur MUST décompter chaque durée (temps de réponse d'un tour, vote de 2 min, tour de cartes de 30 s avant
l'exclusion, absence de 5 min de l'hôte, durée d'un sondage, tirage de la roue) ; le client MUST seulement afficher le
temps restant d'après l'heure de fin envoyée et l'écart d'horloge mesuré à la connexion.

#### Scenario: Horloge du joueur fausse
- **WHEN** l'horloge de l'ordinateur d'un joueur avance de 3 minutes
- **THEN** le vote se termine pour lui au même moment que pour les autres

### Requirement: Limites d'envoi
Le serveur MUST limiter par compte les messages (10 par 10 s), les réactions (20 par 10 s), les commandes de vote (une
à la fois par salon, déjà dans la spec du chat) et les envois d'images (10 par minute), et répondre au-delà par un
message au seul joueur concerné (« Doucement : trop de messages »), sans le déconnecter.

#### Scenario: Message envoyé en boucle
- **WHEN** un joueur envoie 30 messages en 5 secondes
- **THEN** les 10 premiers passent et il lit « Doucement : trop de messages »
