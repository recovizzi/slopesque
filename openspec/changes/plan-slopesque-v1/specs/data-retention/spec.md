## ADDED Requirements

### Requirement: Durées de conservation
Les données MUST être gardées ainsi, sans politique de récupération (tout est « jetable ») :

| Donnée | Où | Combien de temps |
|---|---|---|
| Comptes (profil, pseudos passés, liste des salons, favoris), codes retirés | Postgres | sans limite |
| Salons, leurs joueurs (scores, crédit social, places), palmarès | Postgres | jusqu'à la suppression du salon par un admin |
| Messages du chat (texte, réactions, votes, changements de crédit) | Postgres | **30 jours** après l'envoi |
| Images du chat | RustFS | **7 jours** après le dernier envoi (voir Conservation des images du chat) |
| Stickers et emoji personnalisés | Postgres + RustFS | tant qu'ils sont dans la bibliothèque du salon ; retirés : supprimés aussitôt |
| Photo de profil | Postgres + RustFS | tant qu'elle est la photo du joueur ; remplacée ou retirée : supprimée aussitôt |
| Images des atouts, des choix de sondage | RustFS | tant qu'elles servent ; remplacées ou retirées : supprimées aussitôt |
| Aperçus de lien, résultats de recherche de GIF | Redis | 7 jours (aperçus), 1 h (GIF) |
| Tour, donne ou vote en cours | mémoire du serveur | jusqu'à sa fin (annulé par un redémarrage) |

Un fichier RustFS MUST être supprimé dès que plus rien ne l'utilise (une même image peut servir à plusieurs salons,
voir Une image envoyée deux fois est stockée une fois). Un salon n'est jamais purgé pour inactivité. La règle « purge
8 h après la dernière activité » de la maquette MUST disparaître.

#### Scenario: Changer de photo
- **WHEN** un joueur remplace sa photo de profil
- **THEN** l'ancienne est supprimée de la base et de RustFS ; elle ne se récupère pas

#### Scenario: Retirer un sticker
- **WHEN** un joueur retire un sticker de la bibliothèque du salon
- **THEN** le sticker est supprimé ; les messages qui l'avaient envoyé disent « Image plus disponible »

#### Scenario: Revenir dans un salon après six mois
- **WHEN** un joueur revient dans un salon après six mois sans activité
- **THEN** il retrouve son crédit social, le palmarès, les stickers et les emoji ; le chat ne contient plus que le
  repère « Les messages de plus de 30 jours ont été supprimés »

### Requirement: Le chat limité à 30 jours
En haut du chat, un **repère** MUST dire où commence ce qui est gardé : « Début de la conversation » si le salon a
moins de 30 jours, sinon « Les messages de plus de 30 jours ont été supprimés ». Une **réponse** à un message supprimé
MUST montrer, à la place de la citation, « Message de plus de 30 jours, supprimé » (sans lien pour y aller). Un message
qui citait un emoji personnalisé supprimé MUST montrer son code (`:nom:`) en texte.

#### Scenario: Remonter le chat d'un vieux salon
- **WHEN** un joueur remonte tout le chat d'un salon créé il y a deux mois
- **THEN** il arrive au repère « Les messages de plus de 30 jours ont été supprimés »

#### Scenario: Salon récent
- **WHEN** un joueur remonte tout le chat d'un salon créé il y a dix jours
- **THEN** il arrive au repère « Début de la conversation »

#### Scenario: Réponse à un message supprimé
- **WHEN** un message d'il y a 29 jours répond à un message d'il y a 35 jours
- **THEN** sa citation dit « Message de plus de 30 jours, supprimé »

### Requirement: Purges planifiées
Le serveur MUST lancer une purge **chaque heure** : messages de plus de 30 jours, images du chat expirées, fichiers
RustFS sans usage ; et MUST écrire dans son journal ce qu'il a supprimé (nombre, place libérée). Une purge interrompue
MUST pouvoir reprendre sans erreur (suppression idempotente). Supprimer un salon MUST effacer **toute trace** du salon :
ses données Postgres en cascade et, dans RustFS, tous ses fichiers qui ne servent à aucun autre salon.

#### Scenario: Supprimer un salon
- **WHEN** un admin supprime un salon dont un sticker sert aussi dans un autre salon
- **THEN** il ne reste rien du salon ; le sticker reste dans RustFS pour l'autre salon seulement

### Requirement: Pas de sauvegarde
La V1 MUST ne faire **aucune sauvegarde** : un salon supprimé, une base ou un disque perdus, et tout disparaît. Ce
choix MUST être dit clairement : dans le README (section Exploitation), dans `pnpm doctor` et `services:check`
(« Sauvegardes : aucune »), et dans la confirmation de `rooms:delete` (« Suppression définitive : aucune sauvegarde »).
Une sauvegarde éventuelle se fait à la main, hors du projet.

#### Scenario: Supprimer un salon par erreur
- **WHEN** l'admin confirme la suppression d'un salon
- **THEN** la commande a prévenu que rien ne se récupère, et le salon a disparu pour de bon

### Requirement: Place disponible
Le serveur MUST connaître la place qui lui est réservée (`STORAGE_QUOTA_GB`, 50 Go sur le serveur prévu) et la place
occupée par Postgres et RustFS. À 90 % : `pnpm doctor`, `services:check` et le journal du serveur MUST prévenir ; à
98 %, les nouveaux envois d'images, de stickers, d'emoji et de photos MUST être refusés avec « Stockage du serveur
plein », le chat texte et les jeux continuant.

#### Scenario: Stockage presque plein
- **WHEN** Postgres et RustFS occupent 49,2 Go sur 50
- **THEN** un joueur qui envoie une image lit « Stockage du serveur plein » ; ses messages texte partent
