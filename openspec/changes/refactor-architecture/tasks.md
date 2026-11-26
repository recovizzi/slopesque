## 1. Fondations

- [ ] 1.1 [e2e] Port réglable (`E2E_PORT`) ; captures de référence prises sur `main` avant la refonte
- [ ] 1.2 [web] `design/tokens.css` et `design/base.css` tirés de `style.css` (valeurs actuelles, nommées)
- [ ] 1.3 [web] Composants de base dans `design/` (Button, IconButton, Field, TextInput, Select, Checkbox, Segmented, Tabs, Modal, Drawer, Menu/Popover, Chip, Badge, Card, Timer, Avatar, Who, Icon, EmptyState, Note), mêmes classes CSS, page `?kit`
- [ ] 1.4 [web] `Icon` sur un registre de tracés SVG (fin des icônes en chaînes)
- [ ] 1.5 [web] Texte des messages en segments (liens, emoji, codes, emoji personnalisés) rendu par un composant, testé
- [ ] 1.6 [web] Squelette `app/` et `features/`, `style.css` découpé par fonctionnalité ; contrôles de lint « zéro HTML texte » (liste d'exceptions provisoire) et « 300 lignes »

## 2. Serveur : modules d'activité

- [ ] 2.1 [server] Noyau `RoomRegistry` (salons en mémoire, présence, émission, `say`, `saveRules`) et contrat `Activity` (jeton `ACTIVITIES`), `IntentRunner` commun
- [ ] 2.2 [server] Modules Demi-disque, Sondage (+ sondages du chat), Roulette, intégrations, effets, Palmarès, avec leurs passerelles
- [ ] 2.3 [server] Module Cartes : table commune (places, robots, rythme, exclusion, habillage des atouts) et modules Trou du cul, Tarot, Texas Hold'em, Coinche
- [ ] 2.4 [server] Chat (messages, images, stickers, emoji, photo) et `RoomHub` réduit à l'aiguillage (rejoindre, état, activité, votes, hôte, crédit, avis de la console)

## 3. Interface : fonctionnalités en React

- [ ] 3.1 [web] Sondage (composition, réponse, gradient SVG, résultats, carte du chat) et Roulette (roue, éditeur, tirage)
- [ ] 3.2 [web] Cartes : carte SVG, main en éventail, places, table commune, règles ; Trou du cul et Tarot (habillage des atouts)
- [ ] 3.3 [web] Cartes : Texas Hold'em (jetons, mises, annonce de la main) et Coinche (enchères, plis, décompte)
- [ ] 3.4 [web] Chat (liste, message, réponse, réactions, pièces jointes, aperçus de liens, menu +), fenêtre GIF en composant, emoji, votes, crédit social
- [ ] 3.5 [web] Demi-disque et Amphithéâtre, Palmarès, salons, compte et code, choix d'activité, intégrations
- [ ] 3.6 [web] `App` découpé (`app/` : coquille, réglages par onglet, pages d'état)

## 4. Nettoyage et documentation

- [ ] 4.1 [web] Retrait de `LiveHtml`, `Html`, `lib/html.ts`, des `*-view.ts` ; exceptions du lint vidées
- [ ] 4.2 [all] `ARCHITECTURE.md` (couches, contrat d'activité, bibliothèque de composants, où ranger quoi), CLAUDE.md et README à jour
- [ ] 4.3 [all] Revue finale : e2e complets, captures comparées à la référence, tailles de fichiers
