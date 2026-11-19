## ADDED Requirements

### Requirement: Formats d'image
Les images envoyées au serveur MUST être stockées (RustFS, compatible S3) dans un format choisi selon leur **usage**,
jamais plus grand que ce qu'il affiche. Le serveur MUST refaire la conversion (sans se fier au client) et retirer les
métadonnées (EXIF : lieu, appareil) :

| Usage | Taille | Format |
|---|---|---|
| Emoji personnalisé | 128 px au plus (côté le plus long) | WebP (PNG si transparence non gérée) |
| Sticker | 256 px au plus | WebP, transparence gardée ; GIF animé gardé animé |
| Photo de profil | carré de 256 px, coupé au milieu | WebP |
| Image du chat | 1600 px au plus | WebP qualité 80 ; GIF animé gardé animé |
| Choix de sondage | 480 px au plus | WebP |
| Atout du Tarot | 360 px au plus | WebP |
| Aperçu de lien | 480 px au plus | WebP |

#### Scenario: Une photo de profil
- **WHEN** un joueur choisit une photo de 4000 × 3000
- **THEN** le serveur garde un carré WebP de 256 px, sans ses métadonnées

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
