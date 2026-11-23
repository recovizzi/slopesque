# Administrer Slopesque

Tout se fait en console, dans le conteneur du serveur (pas de page d'admin). Chaque commande qui change quelque chose
est notée dans le journal d'admin (`admin_log` : la commande, sa cible, jamais un code ni un message). Aucune
sauvegarde n'existe : ce qui est effacé l'est pour de bon.

## Lancer une commande

| Où tourne le serveur | Commande |
|---|---|
| **La machine du projet** (depuis ton ordinateur) | `pnpm prod:admin <commande> [options]` |
| La pile Docker locale (`pnpm stack:up`) | `pnpm stack:admin <commande> [options]` |
| Le serveur de dev (`pnpm dev`) | `pnpm admin <commande> [options]` |

`pnpm prod:admin` lit dans ton `.env` (non versionné) l'alias SSH de la machine (`DEPLOY_SSH_HOST`, défini dans ton
`~/.ssh/config`), le compte de déploiement (`DEPLOY_USER`) et son dossier (`DEPLOY_DIR`, `slopesque` par défaut). Il se
connecte en SSH, passe sur le compte de déploiement (`sudo` : tu tapes son mot de passe) et lance la commande dans le
conteneur `server`. `pnpm prod:admin help` liste les commandes.

**À la main**, si besoin (même chose, en trois étapes) :

```sh
ssh <ton alias>                                    # la machine
sudo -iu <compte de déploiement>                   # le compte qui fait tourner la pile
cd ~/slopesque/infra && docker compose -f docker-compose.prod.yml --env-file .env exec server admin <commande>
```

Les commandes qui effacent demandent de taper « oui » ; `--yes` le saute (scripts). Une option avec des espaces se met
entre guillemets : `pnpm prod:admin rooms:create --name "Le salon du jeudi"`.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `rooms:create [--key XXXX-XXXX] [--name …]` | Crée un salon (clé tirée au hasard sans `--key`) et affiche sa clé, à donner aux joueurs |
| `rooms:validate <clé> [--name …]` | Valide un salon qu'un joueur a « créé » depuis l'extension (il est en attente) |
| `rooms:list [--search …]` | Les salons : joueurs, dernière activité |
| `rooms:delete <clé>` | Supprime un salon et tout ce qu'il contient |
| `accounts:find [--name …] [--room XXXX-XXXX] [--seen-after AAAA-MM-JJ]` | Retrouve des comptes (uuid, pseudos, salons, dates) ; jamais de code |
| `accounts:show <uuid>` | Le détail d'un compte |
| `accounts:reset-code <uuid>` | Donne au compte un nouveau code, affiché une seule fois ; l'ancien ne marche plus |
| `accounts:delete <uuid>` ou `accounts:delete --code XXXX-XXXX-XXXX-XXXX` | Efface un joueur et tout ce qui le concerne : compte, places dans les salons, messages, palmarès |
| `credit:reset <clé> [--account <uuid>]` | Remet à zéro le crédit social d'un joueur, ou de tout le salon |
| `messages:delete <id>` | Retire un message (modération) : « Message retiré par un admin » |
| `media:delete <id>` | Retire une image, un sticker ou un emoji, partout où il sert |
| `media:stats` | La place prise par usage, les images du chat qui expirent dans les 24 h |
| `purge:run` | La purge planifiée tout de suite (messages de plus de 30 jours, images expirées) |
| `services:check` | L'état de Postgres, Redis, RustFS, des clés externes, et la place (alerte dès 90 %) |

## Les cas courants

**Un joueur a perdu son code.** Il te dit son pseudo et un salon où il joue :

```sh
pnpm prod:admin accounts:find --name Léa --room 4S3W-F2W2   # son uuid
pnpm prod:admin accounts:reset-code <uuid>                 # son nouveau code, à lui transmettre
```

**Faire disparaître un joueur** (il le demande, ou après un abus). Avec son code si tu l'as, sinon son uuid :

```sh
pnpm prod:admin accounts:delete --code XXXX-XXXX-XXXX-XXXX
```

Son compte, ses places dans les salons, ses messages et ses résultats du palmarès sont effacés ; ses panneaux ouverts
sont déconnectés. Les stickers et emoji qu'il a ajoutés restent au salon.

**Un salon « créé » depuis l'extension attend.** Le joueur te donne sa clé : `pnpm prod:admin rooms:validate <clé>`.

**La place se remplit.** Le serveur l'écrit dans son journal dès 90 % (`docker compose … logs server`), et refuse les
nouvelles images à 98 %. Voir ce qui prend la place, puis faire du ménage :

```sh
pnpm prod:admin media:stats
pnpm prod:admin purge:run           # ce qui a expiré, tout de suite
pnpm prod:admin media:delete <id>   # une image précise
```

**Vérifier que tout va bien** : `pnpm prod:admin services:check`, ou `curl https://<ton domaine>/api/health`.

## Le journal d'admin

Il garde ce qu'un admin a fait (création et suppression de salon, nouveau code, effacement d'un joueur, modération) et
les changements de code faits par les joueurs eux-mêmes, pour suivre un problème. Il ne garde ni les parties, ni les
messages, ni aucun code.
