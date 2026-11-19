## 1. Concept (à faire ensemble)

- [ ] 1.1 Trancher les questions ouvertes de design.md
- [ ] 1.2 Valider le design de la maquette (demi-disque, tiroirs, couleurs) dans l'extension
- [ ] 1.3 Mettre à jour les specs de ce change avec les décisions, puis l'archiver

## 2. Serveur (apps/server)

- [ ] 2.0 Salons (décision 21) : modèle `rooms` (clé, créé le, dernière activité) à la place de `games`, route
      d'admin `POST /api/admin/rooms/{key}` (jeton `SCD_ADMIN_TOKEN`, non exposée), `GET /api/rooms/{key}`, retrait
      de la route publique de création, purge des données de jeu 8 h après la dernière activité (question 18)
- [ ] 2.1 Modèles joueurs, tours, rayons, messages, emoji perso, stickers (ON DELETE CASCADE depuis rooms)
- [ ] 2.2 WebSocket `/ws/{key}` : rejoindre, état de la partie diffusé à chaque changement
- [ ] 2.3 Déroulé d'un tour côté serveur (timer de 30 s, barème, classement)
- [ ] 2.4 Rôle d'hôte : transmission, `/hote` (direct après 5 min d'absence de l'hôte, sinon vote) ; présence des
      joueurs (fenêtre ou extension fermée, depuis quand) ; votes du chat (2 min, quorum, majorité) côté serveur
- [ ] 2.5 Migrations Alembic à la place de `create_all`
- [ ] 2.8 Crédit social : table par salon et joueur (hors purge des données de jeu), changements diffusés dans le
      chat (jamais à soi-même, 1 à 1000), commande console d'admin pour le remettre à zéro (un joueur ou tout le salon)
- [ ] 2.9 Comptes : table `accounts` (empreinte HMAC-SHA-256 du code, profil, pseudos passés, dates, salons,
      favoris), données du joueur par salon rattachées au compte, limite d'essais par IP ; renouvellement du code
      (empreintes retirées pour toujours, appareils déconnectés) ; commandes console d'admin : chercher un compte
      (pseudo, salon, dates), lui donner un code tiré au hasard (affiché une fois, journalisé sans le code)
- [ ] 2.10 Images : RustFS (S3), conversion par usage (Pillow / libvips), clé usage + SHA-256, compte des usages,
      purge horaire des images du chat de plus d'une semaine
- [ ] 2.11 Aperçus de lien : lecture Open Graph / oEmbed côté serveur (protections SSRF, 3 s, 1 Mo), cache d'une
      semaine, image en usage « aperçu »
- [ ] 2.6 GIF : comparer KLIPY sans pub, KLIPY avec pub et GIPHY sans pub (question ouverte 17), créer les clés
- [ ] 2.7 GIF : interface `GifProvider`, fournisseurs KLIPY et GIPHY, chaîne de secours, réserve de résultats en
      mémoire, compte des requêtes par fournisseur, routes `/api/gifs/search` et `/api/gifs/trending`

## 3. Front (apps/web)

- [ ] 3.1 Client WebSocket et état venant du serveur (remplace mock.ts)
- [ ] 3.2 Code utilisateur branché sur le serveur (remplace `MockAccounts`) : envoi à la connexion, sauvegarde du
      profil, de la liste des salons et des favoris sous le compte ; copie sur l'appareil
- [ ] 3.10 Photo de profil, aperçus de lien et images expirées venant du serveur (remplacent `storedPicture`, la
      table `DEMO` de `links.ts` et le calcul local d'expiration)
- [ ] 3.3 Design définitif (palette, typo, animations des rayons)
- [ ] 3.6 Intégrations : vérification de l'adresse aussi côté serveur (le nom déclaré), adresse diffusée par le
      salon ; tester Low Tide dans le cadre (ngrok, threads), puis voir son `localStorage` (question ouverte 19)
- [ ] 3.8 Tarot V1 : Petit au bout, poignées, chelem, échange de l'Excuse, Tarot à 3, robots honnêtes à 5 (le partenaire charge quand le pli est sûr, sans gourmandise : « Robots honnêtes au Tarot à 5 »), images des
      atouts stockées avec le salon
- [ ] 3.9 Palmarès côté serveur : table des résultats rattachée au salon (hors purge des données de jeu), agrégats par
      jeu, mesure et période (`GET /api/rooms/{key}/palmares?game=&sort=&period=`)
- [ ] 4.4 Après la V1 : paris des spectateurs sur un joueur ; réactions à effet visuel (à re-spécifier)
- [ ] 3.7 Cartes V1 : moteurs et robots repris de projets libres (Trou du cul, Tarot, Texas Hold'em, Coinche),
      paris, temps par tour, vote d'exclusion (tour de 30 s, /kick), partie rallongeable (question ouverte 20) ;
      places à table côté serveur pour tous les jeux (rejoindre, quitter, points au dernier occupant, table complète)
- [ ] 3.5 Salons : remplacer `MockRooms` par le serveur (`GET /api/rooms/{key}` ; « injoignable » = pas de réponse),
      un état par salon venant du serveur
- [ ] 3.4 GIF : remplacer `DemoGifs` par la source serveur (`GifSource`), afficher le fournisseur qui a répondu

## 4. Extension et livraison

- [ ] 4.1 Clé CRX (`CHROME_CRX_KEY`) et secrets Mozilla dans le dépôt GitHub
- [ ] 4.2 Première release v0.1.0
- [ ] 4.3 Hébergement du serveur (conteneur + Postgres) et URL par défaut dans les paramètres
