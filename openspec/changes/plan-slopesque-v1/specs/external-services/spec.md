## ADDED Requirements

### Requirement: Repli pour chaque service externe
Chaque service hors du projet MUST avoir un **repli** (fournisseurs de GIF, sites lus pour les aperçus, pages des
intégrations comme Low Tide) : un service absent, sans clé, refusé ou trop lent (5 s) MUST donner un message clair
à l'endroit où il sert, et le reste de l'app MUST continuer de fonctionner. Le serveur MUST démarrer sans aucune clé
externe. Chaque échec MUST être écrit dans le journal du serveur avec le service et la raison (clé absente, clé
refusée, quota, délai, réponse invalide), sans la clé.

| Service | Sans lui |
|---|---|
| GIF (KLIPY, GIPHY) | la fenêtre GIF dit « GIF indisponibles : aucune clé configurée sur le serveur » ou « Le service de GIF ne répond pas » ; images, stickers et emoji marchent |
| Aperçus de lien | le lien reste un lien, sans carte |
| Intégration (Low Tide) | la page « ne répond pas » de la maquette, avec Réessayer |

#### Scenario: Pas de clé de GIF
- **WHEN** le serveur tourne sans clé KLIPY ni GIPHY et qu'un joueur ouvre « + » → GIF
- **THEN** la fenêtre explique que les GIF ne sont pas configurés ; le chat fonctionne

#### Scenario: Clé révoquée
- **WHEN** KLIPY répond 401 à toutes les recherches
- **THEN** le serveur passe à GIPHY s'il a sa clé, sinon dit « Le service de GIF refuse la clé du serveur »

### Requirement: Repli pour les services du projet
Les services internes MUST aussi échouer proprement : **Redis** absent → le serveur fonctionne sans cache (chaque
recherche va au fournisseur, les limites d'essais passent en mémoire) et le signale au démarrage ; **RustFS** absent →
l'envoi d'images, de stickers et de photos répond « Images indisponibles pour le moment » et les images déjà stockées
ne s'affichent pas, le reste fonctionne ; **Postgres** absent → le serveur refuse de démarrer avec la raison (la base
est indispensable). `GET /api/health` MUST dire l'état de chaque service.

#### Scenario: RustFS en panne
- **WHEN** RustFS ne répond plus et qu'un joueur envoie une image
- **THEN** l'aperçu de l'envoi affiche « Images indisponibles pour le moment » ; ses messages texte partent

### Requirement: Cache des requêtes
Les réponses des services externes MUST être gardées dans Redis pour décharger le serveur et les quotas : recherche
de GIF par (fournisseur, texte, page) 1 h, GIF tendance 15 min, aperçu d'un lien 7 jours (une seule lecture du site à
la fois par lien, les autres demandes attendent son résultat). Une réponse en erreur MUST être gardée 5 minutes pour ne
pas marteler un service en panne.

#### Scenario: Le même GIF cherché par dix joueurs
- **WHEN** dix joueurs cherchent « bravo » dans la même heure
- **THEN** le fournisseur ne reçoit qu'une requête
