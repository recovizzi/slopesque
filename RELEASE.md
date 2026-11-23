# Publier une version de Slopesque

Une seule commande, depuis ton ordinateur, dépôt propre :

```sh
pnpm release              # demande tout : la version, ce qu'il faut publier
pnpm release minor        # une nouveauté (patch : un correctif, major : un changement incompatible, ou X.Y.Z)
pnpm release patch --only extension   # un petit changement de l'extension seulement (visuel…) : le serveur ne bouge pas
pnpm release patch --only server      # le serveur seulement : son image et son déploiement
pnpm release major --min-extension    # le serveur refusera les extensions plus anciennes (« Mets l'extension à jour »)
pnpm release minor --dry-run          # les vérifications et le plan, sans rien changer
```

## Ce que fait la commande

1. **Vérifie.**
   - Aucun fichier modifié non commité.
   - Bascule sur `main` et le met à jour depuis GitHub.
   - La **CI est verte** sur son dernier commit ; sinon elle s'arrête et dit pourquoi.
2. **Montre** la version actuelle et les commits depuis la dernière version, pour choisir en connaissance de cause.
3. **Demande** ce qui manque :
   - le type de version : patch, minor, major, ou une version précise ;
   - ce qu'il faut publier : tout, l'extension, ou le serveur ;
   - pour une majeure qui touche le serveur : s'il doit refuser les anciennes extensions.
4. **Affiche le plan** et attend **une** confirmation.
5. **Publie** :
   - une seule version pour tout le projet : tous les `package.json` à `X.Y.Z` ;
   - le commit `chore(release): vX.Y.Z` ;
   - le tag annoté `vX.Y.Z`, dont le message porte la portée (`portée : tout | extension | serveur`) ;
   - le tout poussé sur GitHub.

## Ce que le tag déclenche sur GitHub (Actions → Release)

```
vX.Y.Z ──▶ plan ──┬─▶ extension   zip Chrome, .crx Linux, .xpi signé par Mozilla       (portée tout / extension)
                  ├─▶ serveur     image ghcr.io/recovizzi/slopesque-server:X.Y.Z        (portée tout / serveur)
                  │      └─▶ déploiement   attend TON approbation, puis la machine passe à cette image
                  └─▶ page de release      avec ce qui a été fait
```

- **plan** vérifie que le tag et les versions des `package.json` concordent, puis lit la portée.
- **Le déploiement attend ton feu vert** (environnement `production`, toi comme relecteur obligatoire). Dans la
  page de l'exécution, **Review deployments → production → Approve**. Il :
  1. copie le compose sur la machine ;
  2. tire **l'image exacte de cette version** (jamais reconstruite), redémarre la pile et vérifie la santé ;
  3. ne garde que les 3 dernières images.
- Sans les secrets de déploiement, le job est sauté avec la raison ; `pnpm deploy:prod` reste possible à la main.
- Les secrets ne servent qu'aux tags `v*` (et à `main` pour relancer à la main) : une pull request n'y a jamais accès.

## Choisir la version

- **patch** : un correctif, rien ne change pour les joueurs.
- **minor** : une nouveauté, compatible avec les extensions déjà installées.
- **major** : un changement incompatible. Avec `--min-extension`, le serveur refuse les extensions plus anciennes
  (page bloquante avec le lien de la dernière release) : à faire quand le protocole change.

## Déployer à la main : `pnpm deploy:prod`

Depuis ton poste, en SSH avec le compte de déploiement (ta clé dans son `authorized_keys`, comme la CI). La machine
n'est nommée que dans ton `.env` (non versionné) : `DEPLOY_SSH_HOST` (un alias de `~/.ssh/config`), `DEPLOY_USER`,
`DEPLOY_DIR`, `PROD_PUBLIC_URL`, `DEPLOY_CADDY_*`.

```sh
pnpm deploy:prod --init          # la première fois : le infra/.env de la machine (secrets tirés au hasard, https,
                                 # TRUST_PROXY, port local seulement) et le site du reverse proxy (infra/Caddyfile.template)
pnpm deploy:prod                 # l'image du serveur construite ici, envoyée par SSH, démarrée, santé vérifiée
pnpm deploy:prod --image 0.2.0   # une version publiée : son image tirée de GHCR (ce que fait le workflow Release)
```

Le serveur écoute sur `127.0.0.1:23180` ; le reverse proxy (Caddy) sert le domaine en https et lui passe tout,
WebSocket compris. L'extension propose ce domaine au premier lancement : la variable `PUBLIC_URL` du dépôt, lue au
build de la release.

## Relancer, vérifier, revenir en arrière

- **Relancer** un tag déjà poussé (un job échoué) : Actions → Release → Run workflow, avec le tag. Mozilla n'accepte
  chaque version qu'une fois : un `.xpi` déjà signé ne se re-signe pas, il faut une nouvelle version.
- **Vérifier** la production : `pnpm prod:admin services:check`, ou `curl https://<ton domaine>/api/health`.
- **Revenir à la version précédente** : relancer le workflow Release sur l'ancien tag et approuver son déploiement
  (l'image de chaque version reste sur GHCR).
