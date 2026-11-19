## ADDED Requirements

### Requirement: Commandes d'admin en console
L'administration MUST se faire **seulement** par des commandes dans le terminal du serveur (pas de panneau graphique,
pas de route HTTP d'admin) : `pnpm admin <commande>` en développement, `docker compose exec server admin <commande>` en
production. Chaque commande MUST avoir une aide (`--help`), MUST demander confirmation avant une action destructrice
(sauf `--yes`), et MUST écrire une ligne dans un **journal d'admin** en base (date, commande, cible, sans aucun code
utilisateur). Les commandes :

| Commande | Effet |
|---|---|
| `rooms:create [--key XXXX-XXXX] [--name …]` | crée un salon (clé tirée au hasard si absente), affiche sa clé |
| `rooms:list [--search …]` | salons, nombre de joueurs, dernière activité, place occupée |
| `rooms:delete <clé>` | supprime le salon et ses données (voir Purges planifiées) |
| `accounts:find [--name …] [--room <clé>] [--seen-after …]` | comptes correspondants : uuid, pseudo actuel et passés, salons, dates ; jamais de code |
| `accounts:show <uuid>` | le détail d'un compte |
| `accounts:reset-code <uuid>` | un code tiré au hasard, affiché une seule fois ; l'ancien retiré, ses connexions coupées |
| `credit:reset <clé> [--account <uuid>]` | remet à zéro le crédit social d'un joueur ou de tout le salon |
| `messages:delete <id>` | retire un message (modération) : « Message retiré par un admin » |
| `media:delete <id>` | retire une image, un sticker ou un emoji (modération) |
| `media:stats` | place occupée par usage, images qui expirent bientôt |
| `purge:run` | lance la purge planifiée tout de suite |
| `services:check` | état des services externes et des clés (comme `pnpm doctor`) |

#### Scenario: Créer un salon demandé par un joueur
- **WHEN** l'admin lance `rooms:create --key K7QP-M2XD --name "Les pays"`
- **THEN** le salon existe, et le joueur qui l'attendait (« en attente ») peut y entrer

#### Scenario: Rendre un compte perdu
- **WHEN** l'admin lance `accounts:find --name Léa --room K7QP-M2XD`, puis `accounts:reset-code <uuid>` et confirme
- **THEN** la console affiche une fois le nouveau code ; le journal d'admin note la remise à zéro sans le code

#### Scenario: Erreur de frappe
- **WHEN** l'admin lance `rooms:delete K7QP-M2XE`, une clé qui n'existe pas
- **THEN** la commande dit « Aucun salon avec cette clé » et ne supprime rien
