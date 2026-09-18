# Synchronisation multi-appareils — contrat technique

> Ce document est **contraignant** pour les deux agents : le backend (Claude Code) doit l'implémenter
> exactement ainsi, et web/mobile/desktop (OpenCode) doivent s'y conformer côté client. Toute
> divergence casse la cohérence des données entre appareils.

## Pourquoi ce design

Un même commerce a plusieurs appareils actifs en même temps : le téléphone d'un employé (souvent
hors-ligne), le web/desktop du patron, éventuellement plusieurs employés. Le mode hors-ligne est une
exigence MVP non négociable (`MVP_SPEC.md` §5.8) : la saisie ne doit **jamais** être bloquée par
l'absence de réseau, et tout doit se recaler proprement au retour du réseau, sans doublon ni perte.

## Principe : les événements sont des faits, pas des états

Une vente, un mouvement d'argent manuel, un mouvement de stock manuel, une clôture de journée sont
des **faits immuables, jamais modifiés a posteriori**. On ne synchronise donc jamais un "diff" sur un
enregistrement existant pour ces objets — seulement de nouveaux faits. Cela élimine la quasi-totalité
des conflits d'édition concurrente. Seules deux entités sont mutables (`Product`, `User`) et suivent
une règle plus simple (voir §5).

## 1. Identité côté client = clé d'idempotence

Chaque événement créé sur un appareil reçoit un **UUID généré côté client** (`client_uuid`) au moment
de la saisie, avant même de savoir si le réseau est disponible. C'est cet UUID — pas un ID serveur —
qui identifie l'événement de façon unique et permet de rejouer un envoi sans jamais créer de doublon.

## 2. Push (appareil → serveur) : `POST /sync/push`

Le client n'envoie que les événements "de premier niveau" saisis manuellement :

- `sales` (une vente = produit, quantité, prix unitaire, mode de paiement)
- `money_movements` (uniquement les mouvements manuels : income/expense/withdrawal — **jamais**
  les mouvements de type `sale`, qui sont dérivés côté serveur, voir §4)
- `stock_movements` (uniquement restock/adjustment manuels — **jamais** de type `sale`)
- `daily_closings`

Chaque item porte : `client_uuid`, `business_id`, `user_id`, les champs métier, et l'horodatage de
saisie sur l'appareil (`occurred_at`, informatif — l'horodatage de vérité reste `created_at` fixé côté
serveur à l'insertion, pour garder un ordre total cohérent malgré des horloges clients désynchronisées).

Le serveur traite chaque item **par `client_uuid`** :
- s'il existe déjà → aucune écriture, renvoyé comme `duplicate` (l'envoi est donc rejouable à l'infini
  sans risque, ce qui est indispensable quand une requête réussit côté serveur mais que la réponse
  n'arrive jamais au client à cause d'une coupure réseau).
- sinon → insertion + effets dérivés (voir §4), renvoyé comme `accepted`.

Le client retire de sa file d'attente locale ("outbox") tout item `accepted` ou `duplicate`. Un item
`rejected` (erreur de validation) reste visible pour l'utilisateur avec le motif, il n'est jamais
supprimé silencieusement.

## 3. Pull (serveur → appareil) : `GET /sync/pull`

Pagination par curseur, pas par page numérotée (un removal/insert concurrent ne doit jamais décaler
la pagination). Curseur = `(created_at, id)` par type d'entité — stable même si deux événements
partagent le même timestamp à la microseconde près.

Requête : `GET /sync/pull?business_id=...&since_sales=...&since_money_movements=...&...`
Réponse : pour chaque type d'entité, la liste des faits créés par **tout appareil** (y compris le
sien, pour rester simple — le client ignore ce qu'il a déjà par `client_uuid`) depuis le curseur
fourni, plus le nouveau curseur à conserver pour le prochain pull.

Le client applique les faits reçus à sa base locale (upsert par `client_uuid`, ignore si déjà présent)
et reconstruit ses totaux (caisse, stock) par recalcul simple, jamais par état muté à la main.

## 4. Dérivation automatique — le cœur de l'architecture événementielle

Quand le serveur reçoit une `Sale`, il crée **dans la même transaction** :
1. la ligne `Sale`,
2. une `StockMovement` liée (`type=sale`, `quantity_delta=-quantity`, `sale_id=...`),
3. une `MoneyMovement` liée (`type=sale`, `amount=+total_amount`, `sale_id=...`),
4. une `AuditLog`.

Le client ne doit **jamais** construire lui-même ces trois écritures séparément et les pousser une
par une : il envoie un seul événement `Sale`, le serveur fait le reste. C'est exactement le principe
"une vente = un événement" du document produit — il doit être vrai aussi au niveau du protocole de
synchronisation, pas seulement dans l'UI.

Côté client hors-ligne, l'app peut bien sûr calculer un total de caisse/stock *optimiste* localement
pour l'affichage immédiat, mais ce total est provisoire et doit être réconcilié avec les
`StockMovement`/`MoneyMovement` dérivés reçus au prochain `pull`.

## 5. Entités mutables (`Product`, `User`) : dernière écriture gagne

Contrairement aux événements, `Product` (prix, nom, seuil) et `User` (permissions) peuvent être
modifiés. Ce sont des changements rares et faits uniquement par le patron : le risque de conflit réel
est faible. Règle MVP : **dernière écriture gagne**, arbitrée par `updated_at` côté serveur. Pas de
fusion de champs, pas de merge UI dans le MVP — si ça devient un vrai problème en usage réel, on
traitera ça après le MVP.

## 6. Stock négatif : ne jamais bloquer une vente pour ça

Deux employés hors-ligne peuvent vendre la dernière unité d'un produit avant d'avoir pu se
synchroniser. Décision produit assumée : **la vente n'est jamais bloquée** pour une raison de stock
insuffisant (bloquer irait contre l'exigence "ne jamais bloquer la saisie faute de réseau"). Le stock
peut donc temporairement passer sous zéro ; il redevient correct après synchronisation et remonte
comme une alerte visible pour le patron plutôt que comme une erreur silencieuse.

## 7. Authentification hors-ligne (implémentée)

Un employé s'authentifie une fois en ligne via `POST /auth/login` (`business_code` + PIN). Le JWT
obtenu est mis en cache sur l'appareil et reste valable pour l'usage hors-ligne (24h) ; `/sync/push`
et `/sync/pull` dérivent `business_id`/`user_id` du token — ils ne les acceptent plus en paramètre
direct. Toute écriture est donc associée à l'utilisateur réellement authentifié, pas à une valeur
que le client pourrait falsifier. La révocation/expiration ne peut être vérifiée qu'au retour en
ligne — acceptable pour un MVP où le risque principal (vol du téléphone) est mitigé par le PIN
local, pas par le réseau. Pas encore de refresh token : à 24h, l'employé doit se reconnecter en
ligne (voir `CLAUDE.md` "Prochaines étapes backend" si ça devient gênant en usage réel).

## 8. Déclenchement de la synchronisation (côté client, OpenCode)

- Au retour réseau (listener de connectivité).
- À l'ouverture/mise au premier plan de l'app.
- Périodiquement en tâche de fond si l'app reste ouverte (ex. toutes les 2-3 minutes).
- Push en premier (vider l'outbox), puis pull. Retry avec backoff exponentiel en cas d'échec réseau,
  jamais de boucle de retry agressive qui viderait la batterie.
