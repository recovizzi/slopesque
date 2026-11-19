## ADDED Requirements

### Requirement: Formats d'image
Les images envoyées au serveur MUST être acceptées **quelle que soit leur taille** (pas de limite pour le joueur ; le
serveur refuse seulement ce qui n'est pas une image, ou un fichier de plus de 200 Mo) et stockées (RustFS, compatible
S3) dans un format choisi selon leur **usage**, avec un **poids visé** : le serveur MUST recompresser l'image reçue
(qualité d'abord, jusqu'à 40, puis la taille, par paliers de 80 %) jusqu'à tenir dans ce poids, sans se fier au
client, et retirer les métadonnées (EXIF : lieu, appareil). Les petits usages sont légers, l'image du chat garde une
compression plus douce :

| Usage | Taille | Poids visé | Format |
|---|---|---|---|
| Emoji personnalisé | 128 px au plus (côté le plus long) | 24 Ko | WebP, animation gardée |
| Photo de profil | carré de 256 px, coupé au milieu | 32 Ko | WebP |
| Sticker | 320 px au plus | 90 Ko | WebP, transparence et animation gardées |
| Choix de sondage | 480 px au plus | 100 Ko | WebP |
| Atout du Tarot | 360 px au plus | 80 Ko | WebP |
| Aperçu de lien | 480 px au plus | 60 Ko | WebP |
| Image du chat | 1600 px au plus | 450 Ko | WebP, animation gardée |

#### Scenario: Une photo de profil
- **WHEN** un joueur choisit une photo de 4000 × 3000 (12 Mo)
- **THEN** le serveur garde un carré WebP de 256 px de moins de 32 Ko, sans ses métadonnées

### Requirement: Une image envoyée deux fois est stockée une fois
Le serveur MUST calculer l'**empreinte** (SHA-256) du fichier reçu et chercher une image stockée avec la même empreinte
**et le même usage** : si elle existe, il MUST la réutiliser (même adresse) au lieu d'en stocker une copie. Une image
d'un usage ne MUST jamais servir à un autre (l'emoji de 128 px n'est pas réutilisé pour une image du chat de 1600 px).
Une image MUST compter ses usages (messages, stickers, emoji, photos) et n'être supprimée que lorsqu'aucun ne la garde.

#### Scenario: Le même mème reposté
- **WHEN** trois joueurs envoient la même image en « Image » dans la journée
- **THEN** les trois messages montrent la même image stockée une seule fois

#### Scenario: Même fichier, autre usage
- **WHEN** un joueur ajoute en emoji une image déjà envoyée en « Image »
- **THEN** le serveur stocke la version emoji à part, en 128 px

### Requirement: Conservation des images du chat
Une image envoyée dans le chat (usage « Image du chat ») MUST être gardée **une semaine** après son envoi, puis
supprimée du stockage par une purge régulière (au moins une fois par heure), pour libérer la place de RustFS. Une même
image renvoyée MUST repousser sa suppression à une semaine après le dernier envoi ; chaque message, lui, ne la montre
qu'une semaine après son propre envoi. Les stickers, emoji personnalisés et photos de profil MUST être gardés tant
qu'ils servent (dans la bibliothèque du salon, sur un profil) et supprimés aussitôt quand ils ne servent plus ; les GIF ne sont pas stockés (liens vers le fournisseur).
Les aperçus de lien MUST suivre la même règle d'une semaine.

#### Scenario: Image plus disponible
- **WHEN** un joueur remonte le chat jusqu'à une image envoyée il y a 8 jours
- **THEN** le message reste, avec à la place de l'image « Image plus disponible — Les images du chat sont gardées une
  semaine »

#### Scenario: Citer une image expirée
- **WHEN** un joueur répond à un message dont l'image a expiré
- **THEN** la citation dit « Image expirée »
