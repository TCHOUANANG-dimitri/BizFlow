# Korah Business Manager (BizFlow) — Instructions pour l'agent OpenCode

Ce fichier t'est destiné. Un autre agent (Claude Code) travaille en parallèle sur ce même projet,
sur un périmètre différent, pour qu'on puisse avancer simultanément sans conflits de fichiers.
Lis ce fichier en entier avant de commencer, et relis-le à chaque nouvelle session : il peut être
mis à jour entre deux sessions.

## État global du projet (2026-09-18) — aucune des 3 apps n'est "terminée"

Les fondations sont solides partout (build/typecheck/tests verts), mais aucune des 3 apps n'est
complète bout en bout. Voici l'état réel, honnête, et tout ce qu'il reste — pour que tu puisses
prendre en charge ce qui est dans ton périmètre (mobile) en connaissance de cause, et voir le reste
en contexte.

| Écran | Web/desktop (Claude Code) | Mobile (toi) |
|---|---|---|
| 01 · Dashboard propriétaire | `/` — fait, sur `GET /dashboard/daily` | Vue résumée dans Jour — fait |
| 02 · Nouvelle transaction | `/sale` — fait | Vendre — fait, priorité respectée |
| 03 · Réconciliation fin de journée | `/closing` — fait, sur `GET /closing/expected-cash` | Jour — fait |
| 04 · Stock | `/stock` — fait (CRUD produits) | Stock — fait |
| 05 · Équipe | `/equipe` — liste + création, **pas d'édition/désactivation** (voir ci-dessous) | Création seule (Jour) — suffisant pour le MVP |
| 06 · Journal | `/journal` — fait, sur `GET /audit-log` | Hors scope mobile, comme prévu |
| Argent (IN/OUT) | `/argent` — fait (ajouté 2026-09-18) | Argent (`MoneyScreen`) — fait |

### Ce qu'il reste — backend (pas encore fait par personne)

- **Édition/désactivation d'un employé.** Aujourd'hui `POST /auth/employees` (créer) et
  `GET /auth/employees` (lister) existent, mais rien ne permet de changer les permissions d'un
  employé après coup ni de le désactiver quand il quitte. Il manque `PATCH /auth/employees/{id}`
  (champs optionnels : `can_view_purchase_prices`, `can_view_owner_dashboard`, `is_active` — jamais
  le rôle, jamais un reset de PIN direct). C'est un vrai trou vis-à-vis de MVP_SPEC.md §5 ("le
  propriétaire... contrôle ce qu'ils peuvent faire" — implique un contrôle continu, pas seulement à
  la création). Bloque l'édition/désactivation côté web (`/equipe`) ET mobile.
- Refresh token (JWT expire à 24h, sans renouvellement) — connu, non bloquant pour le MVP hors-ligne.

### Ce qu'il reste — web/desktop (mon périmètre, pas encore fait)

- Écran Équipe : édition des permissions + désactivation d'un employé — dépend de l'endpoint backend
  ci-dessus.
- Vérification visuelle manuelle dans un vrai navigateur : j'ai validé build statique, typecheck et
  un test d'intégration API complet, mais je n'ai pas pu obtenir de capture d'écran fiable dans cet
  environnement (souci Playwright/Chromium, voir note technique en fin de fichier) — donc personne
  n'a encore *vu* l'app tourner à l'écran.
- Desktop : jamais compilé — pas de toolchain Rust disponible dans cet environnement. Le
  `tauri.conf.json` et les icônes sont prêts, mais `npm run build` (dans `apps/desktop`) n'a jamais
  été exécuté avec succès. Il faut un poste avec Rust installé pour vérifier que ça fonctionne.

### Ce qu'il reste — mobile (ton périmètre)

- **Consommer `can_view_purchase_prices`/`can_view_owner_dashboard`** maintenant présents dans
  `TokenResponse` (voir "Traités" plus bas) — c'est le fix concret du bug de visibilité dashboard
  que tu avais remonté toi-même.
- Jamais lancé sur un émulateur/appareil réel avec interaction — j'ai seulement vérifié que
  `npx expo export --platform android` compile (814 modules, bundle ~1,9 Mo, aucune erreur). C'est
  un bon signal mais ce n'est pas un test d'usage réel.
- Optionnel : liste des employés côté mobile, maintenant possible via `GET /auth/employees` (pas
  obligatoire pour le MVP, la gestion complète reste sur web).

### Ce qu'il reste — transverse

- **Aucun commit git n'a jamais été fait sur ce projet**, malgré tout ce volume de travail. À
  soulever avec le fondateur avant de perdre quoi que ce soit.
- Personne n'a fait le parcours complet à la main de bout en bout (inscription → vente → clôture →
  vérification dashboard) sur un vrai appareil/navigateur, tous les tests étant automatisés
  jusqu'ici.

## Contexte produit — à lire d'abord

Le document de référence produit est `documentation/MVP_SPEC.md`. Lis-le intégralement avant de
coder quoi que ce soit. Résumé ultra-court : c'est un "Business Manager" pour petites entreprises
physiques au Cameroun — une vente/un mouvement d'argent/un mouvement de stock est un **événement
métier unique** qui met à jour automatiquement caisse, ventes et stock. Objectif : que le patron
puisse répondre chaque jour à « qu'est-ce qui s'est passé aujourd'hui, et est-ce que l'argent/le
stock que j'ai correspond à ce qu'il devrait y avoir ? ».

**Les deux exigences non négociables : l'app doit être ultra simple à utiliser (un employé peu
formé enregistre une vente en quelques secondes) et ultra efficace pour résoudre le problème
(le patron voit tout, sans effort).** Juge chaque choix d'implémentation à cette aune. N'ajoute
aucune fonctionnalité hors du périmètre MVP listé dans `MVP_SPEC.md` section 5 sans validation
explicite du fondateur.

## Ton périmètre (ne touche qu'à ça)

Mise à jour (2026-09-17) : le périmètre a changé maintenant que la phase interfaces démarre.

- `apps/mobile/` — application mobile React Native. **C'est ton seul périmètre de code
  maintenant.** Priorité : saisie rapide employé (vente, argent IN/OUT), ultra légère.

`apps/web/` et `apps/desktop/` sont désormais construits par Claude Code (Next.js + Tauri), pas par
toi — ne les touche plus si tu y avais déjà commencé quelque chose ; laisse ça à l'autre agent pour
éviter les doublons.

**Ne modifie jamais** `backend/`, `documentation/`, `packages/shared/` (lecture seule pour toi —
contrat API, tokens design et assets de marque, tous générés/maintenus par le backend), `apps/web/`,
`apps/desktop/`, ni `CLAUDE.md`. Si tu penses qu'un changement y est nécessaire, note-le dans ce
fichier (section "Points ouverts" plus bas) plutôt que de le faire toi-même — l'autre agent le
traitera.

## Design system — implémentation mobile

Référence contraignante : `documentation/DESIGN_SYSTEM.md` (digitalisation du design system BizFlow
fourni par le fondateur) + `packages/shared/design-tokens.json` (tokens machine-readable — **importer
ce fichier, ne jamais retranscrire un hex à la main**, il est partagé avec le web pour que les deux
apps rendent la même identité) + `packages/shared/brand/` (logo : `bizflow-logo-full.png` pour
écran de connexion/splash, `bizflow-icon.png` pour l'icône d'app). **Zéro emoji dans l'UI, nulle
part** — uniquement des icônes SVG de la bibliothèque retenue (voir plus bas). C'est une exigence
explicite du fondateur, pas une préférence de style.

Décisions d'implémentation pour React Native :
- **Polices** : Manrope (titres, chiffres KPI) + Inter (corps, micro-labels) — charger via
  `expo-font` / `@expo-google-fonts/manrope` + `@expo-google-fonts/inter`. Jamais Aptos
  (substitution assumée, documentée dans DESIGN_SYSTEM.md §3, précisément pour que web et mobile
  rendent pareil).
- **Icônes** : `lucide-react-native`, style outline, 20-24px. Ne pas mélanger avec `react-native-vector-icons`
  ou une autre bibliothèque — un seul jeu visuel sur toute l'app, cohérent avec le web.
- **Couleurs/espacement/rayons** : lire directement `packages/shared/design-tokens.json` (via un
  petit module de thème qui l'importe) plutôt que redéfinir les valeurs en dur dans le code RN.
- **Logo** : afficher `bizflow-logo-full.png` sur l'écran de connexion, `bizflow-icon.png` comme
  icône d'app (`app.json` → `icon`, `splash.image`).
- **Écran prioritaire** (voir DESIGN_SYSTEM.md §6) : 02 · Nouvelle transaction (vente rapide, en
  quelques secondes) — c'est l'écran à haute fréquence d'usage, à soigner en premier. Le dashboard
  patron complet, la réconciliation, le stock et l'équipe sont construits côté web/desktop par
  Claude Code ; sur mobile, une vue simplifiée suffit si le patron en a besoin en déplacement — ne
  pas dupliquer tout le web sur mobile, ce n'est pas l'usage prioritaire ici.

## Stack technique confirmée (fondateur)

- **Web** : Next.js + TypeScript. C'est un outil interne authentifié, pas un site public — n'investis
  pas dans du SSR/SEO. Le SSR de Next reste disponible pour le déploiement web hébergé si utile, mais
  **le build utilisé pour le desktop doit être un export statique** (`output: 'export'` dans
  `next.config.js`, build sans API routes/server actions/ISR côté pages packagées dans Tauri) : toute
  la logique métier vit dans le backend FastAPI, appelé en REST, donc rien n'est perdu.
- **Mobile** : React Native. Vise la légèreté : évite les libs lourdes, préfère les composants natifs
  simples, attention à la taille du bundle et au temps de démarrage à froid.
- **Desktop** : Tauri, qui encapsule l'export statique de `apps/web/`. Ne pas utiliser Electron (trop
  lourd, contraire à l'exigence "ultra léger"). Le desktop n'est pas un projet séparé à maintenir en
  double : c'est une coquille légère autour du même code web.
- **Offline-first (obligatoire, pas optionnel)** : stockage local (SQLite sur mobile, IndexedDB/SQLite
  via WASM côté web/desktop) avec file d'attente d'événements ("outbox"). Le protocole exact de
  synchronisation (ce que le client pousse, ce qu'il reçoit, comment il applique les événements reçus,
  comment gérer le stock négatif) est spécifié **de façon contraignante** dans
  `documentation/SYNC_DESIGN.md` — lis-le entièrement avant d'implémenter quoi que ce soit côté
  saisie/sync. Ne réinvente pas un protocole différent. Points clés à retenir :
  - un événement créé localement porte un `client_uuid` généré sur l'appareil — c'est la clé
    d'idempotence, à conserver et renvoyer telle quelle lors du sync ;
  - pour une vente, le client envoie **un seul événement `Sale`** (jamais les mouvements de caisse/
    stock dérivés séparément — le serveur les calcule et te les renvoie au `pull`) ;
  - l'app doit rester pleinement utilisable pour vente et mouvement d'argent sans connexion, sans
    aucun blocage, y compris si le stock local semble insuffisant (voir §6 de SYNC_DESIGN.md).
- **Contrat API** : ne pas deviner les routes. Le schéma OpenAPI du backend est publié dans
  `packages/shared/openapi.json` (déjà disponible, inclut désormais `/sync/push` et `/sync/pull`).
  Tant qu'un endpoint dont tu as besoin n'existe pas encore, travaille avec un mock/fixture local
  clairement marqué comme temporaire, note-le dans "Points ouverts" ci-dessous, et adapte dès qu'il
  est publié.
- **Authentification (disponible dès maintenant)** :
  - `POST /auth/register-business` : `{ business_name, sector?, owner_full_name, owner_phone?, pin }`
    → crée l'entreprise + le compte propriétaire, renvoie `{ access_token, business_id,
    business_code, role, user_id, full_name }`. `business_code` est un code court (ex. `KRH4X2`) à
    afficher au patron pour qu'il le partage à ses employés — ce n'est pas l'UUID interne.
  - `POST /auth/login` : `{ business_code, pin }` → même forme de réponse. Utilisé par le
    propriétaire ET les employés (le rôle est dans la réponse et dans le token).
  - `POST /auth/employees` (propriétaire uniquement, header `Authorization: Bearer <token>`) :
    `{ full_name, phone?, pin, can_view_purchase_prices?, can_view_owner_dashboard? }`.
  - Toutes les routes `/sync/*` exigent désormais `Authorization: Bearer <token>` — plus besoin (et
    plus possible) de passer `business_id`/`user_id` toi-même, ils viennent du token.
  - Persiste le token localement (SecureStore sur mobile, storage sécurisé équivalent sur
    web/desktop) pour permettre l'usage hors-ligne décrit dans `SYNC_DESIGN.md` §7 : l'employé se
    connecte une fois en ligne, le token reste valable ensuite sans réseau.
  - Le token expire après 24h, sans refresh pour l'instant — si ça devient gênant en usage réel,
    remonte-le en "Points ouverts" plutôt que de contourner côté client.

- **Produits (disponible)** :
  - `POST /products` (propriétaire uniquement), `GET /products`, `GET /products/{id}`,
    `PATCH /products/{id}` (propriétaire uniquement).
  - `GET /products` renvoie `purchase_price` uniquement si l'utilisateur a la permission (le
    propriétaire l'a toujours) — un employé sans cette permission reçoit un objet qui ne contient
    tout simplement pas ce champ. Ne construis pas d'UI qui suppose sa présence pour tous les rôles.

- **Clôture de fin de journée (disponible)** :
  - `GET /closing/expected-cash?closing_date=YYYY-MM-DD` : appelle ça pour afficher la caisse
    attendue à l'employé/patron avant qu'il ne compte et saisisse la caisse réelle. Ne calcule
    jamais ce montant toi-même côté client pour l'affichage officiel de clôture — uniquement pour un
    éventuel total optimiste hors-ligne (voir SYNC_DESIGN.md §4), à réconcilier ensuite avec cette
    réponse serveur.
  - La clôture elle-même se pousse via `/sync/push` → `daily_closings: [{ client_uuid, closing_date,
    actual_cash, note? }]` — **pas de champ `expected_cash` à envoyer**, le serveur le calcule et te
    le renvoie via `/sync/pull`.

- **Dashboard patron (disponible)** :
  - `GET /dashboard/daily?day=YYYY-MM-DD` (nécessite la permission `can_view_owner_dashboard`) :
    totaux du jour, caisse attendue, dernière clôture, alertes de stock, top 5 produits, activité
    par employé — tout ce qu'il faut pour l'écran patron (fonctionnalité MVP #6), en un seul appel.

## Règles de coordination

1. Ne touche jamais aux fichiers hors de `apps/mobile/` (ni `apps/web/`, ni `apps/desktop/`, ni
   `backend/`, ni `documentation/`, ni `packages/shared/`).
2. Si tu as besoin d'un endpoint/champ qui n'existe pas encore côté backend, ne l'invente pas
   silencieusement : note-le dans la section "Points ouverts" ci-dessous avec la date, pour que
   l'autre agent le voie.
3. Respecte strictement le périmètre MVP (`documentation/MVP_SPEC.md` section 5). Toute idée hors
   scope va dans la section 9 de ce même document, pas dans le code.

## Ordre de construction suggéré

1. Écran de vente rapide (fonctionnalité #1) et argent IN/OUT (#2) — c'est l'usage quotidien à plus
   haute fréquence et la contrainte "ultra léger" y est la plus forte.
2. Authentification (login PIN + `business_code`, voir plus haut) et persistance du token pour
   l'usage hors-ligne.
3. Une vue simplifiée optionnelle (stock disponible, dernières ventes) si le temps le permet — pas
   de dashboard complet côté mobile, ça reste le rôle du web/desktop.

`apps/web/` et `apps/desktop/` ne sont plus dans ton périmètre (voir plus haut) — ignore toute
ancienne instruction qui t'en aurait attribué la construction.

## Points ouverts (à compléter au fil de l'eau)

### Traités (2026-09-17, côté mobile)

- Auth réelle câblée sur `apps/mobile/` : login/register PIN + `business_code`, token JWT en
  SecureStore. Les anciens `DEMO.business_id`/`DEMO.user_id` et le catalogue fixtures
  (`src/fixtures.ts`) ont été **supprimés** — le catalogue vient de `GET /products` et l'identité
  du token.
- Clôture mobile : la caisse attendue vient de `GET /closing/expected-cash` (jamais calculée côté
  client) ; `daily_closings` poussé sans `expected_cash`, conformément au contrat.
- Vue patron mobile : `GET /dashboard/daily` (résumé ; le web reste la vue complète).
- Création d'employé sur mobile (`POST /auth/employees`, zone propriétaire, carte « Équipe » dans
  l'onglet Jour). La liste des employés reste impossible côté mobile (pas d'endpoint de liste).

### Validation d'intégration (2026-09-18)

- Smoke test de bout en bout passé contre le backend en cours d'exécution : register → produits →
  création employé → login employé (produits sans `purchase_price`) → push vente (accepté + rejeu
  idempotent) → pull (sale + mouvements dérivés + curseurs) → push dépense/restock → expected-cash →
  dashboard patron → push clôture sans `expected_cash` → `latest_closing` visible, dashboard employé
  doit renvoyer 403. Tout est conforme aux interfaces types de `apps/mobile/src/api/*`.

### Traités (2026-09-18, côté backend — Claude Code)

- **`TokenResponse` expose maintenant les permissions.** `POST /auth/login` et
  `POST /auth/register-business` renvoient désormais `can_view_purchase_prices` et
  `can_view_owner_dashboard` en plus de `role`. `packages/shared/openapi.json` régénéré. **Action
  pour toi** : mets à jour le type de session mobile (`src/auth/session.ts` ou équivalent) pour
  stocker ces deux booléens, et fais dépendre l'affichage de la « Vue patron » de
  `can_view_owner_dashboard` plutôt que de `role === 'owner'` — c'est exactement le bug que tu avais
  remonté, il est corrigé côté contrat, il reste à le consommer côté mobile.
- **`GET /products` a maintenant un schéma de réponse déclaré** (`ProductOut` ou
  `ProductOutRestricted` selon la permission) au lieu de `schema: {}`. Tu peux régénérer tes types
  mobile à partir du contrat au lieu de les maintenir à la main si tu le souhaites — pas obligatoire,
  juste possible maintenant.
- **`GET /auth/employees` existe désormais** (réservé au propriétaire, renvoie la liste des comptes
  actifs sans le PIN). Ta note du 2026-09-17 disait que ce n'était pas encore exposé — c'est corrigé.
  Reste optionnel pour le mobile (le MVP ne demande qu'une création rapide côté mobile, la gestion
  complète de l'équipe est sur web), à toi de voir si ça vaut le coup d'afficher une vraie liste.

### Traités (2026-09-18, côté mobile — agent OpenCode)

- **Permissions consommées : `can_view_purchase_prices` / `can_view_owner_dashboard`.** La session
  mobile (`src/auth/session.ts`) stocke désormais ces deux booléens (renvoyés par
  `TokenResponse`), `src/api/authApi.ts` a été aligné sur le contrat, et l'identité locale
  (`saveCurrentUser`) enregistre les vraies permissions plutôt que `role === 'owner'`. La « Vue
  patron » de l'écran Jour s'affiche maintenant sur `can_view_owner_dashboard` — c'était le bug de
  visibilité dashboard remonté, il est consommé. La carte « Équipe » (création d'employé) reste,
  elle, réservée au **rôle** propriétaire : `POST /auth/employees` est strictement owner côté
  backend (`require_owner`), il ne faut pas la montrer au seul employé doté de la permission.
  Typecheck (`tsc --noEmit`) et bundle Expo Android OK. `loadSession` rétablit les permissions par
  défaut (= propriétaire) pour les sessions persistées avant ce changement.

### Connu, non bloquant

- **Token sans refresh (24h).** Le mobile affiche « Session expirée ou accès refusé. Reconnecte-toi. »
  sur 401/403 — comportement correct pour le MVP hors-ligne (voir SYNC_DESIGN.md §7).
- Le calcul de caisse attendue est par jour civil (pas de solde cumulé entre jours) — limite MVP
  assumée des deux côtés (web et mobile suivent déjà `GET /closing/expected-cash`).

### Note technique — vérification visuelle web (2026-09-18)

En essayant de valider `apps/web` par capture d'écran automatisée (Playwright), le rendu restait
vide (aucun contenu monté dans le DOM) alors que : le build de production passe, le typecheck passe,
et un test d'intégration complet contre le vrai backend passe. Le même blocage touche même une page
Next.js par défaut (page 404 interne), en dev server **et** sur l'export statique servi tel quel —
donc ce n'est pas un bug de code de l'app, c'est un souci propre à la combinaison Chromium 153 /
Playwright 1.63 sur cette machine (à confirmer). Si tu rencontres le même problème en testant le
mobile via un outil de capture automatisé, ce n'est probablement pas non plus un bug de ton code —
vérifie build/typecheck/tests d'abord. La vérification visuelle fiable pour `apps/web` reste
d'ouvrir `http://localhost:3000` dans un vrai navigateur.

