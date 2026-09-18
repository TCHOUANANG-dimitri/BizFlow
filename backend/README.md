# Backend — Korah Business Manager

FastAPI + PostgreSQL. Voir `../CLAUDE.md` pour le contexte et les principes d'architecture.

## Démarrage local

```bash
python -m venv venv
source venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
cp .env.example .env           # puis ajuster DATABASE_URL si besoin
uvicorn app.main:app --reload
```

Docs interactives une fois lancé : http://localhost:8000/docs

## État actuel

- Modèles de données MVP définis (`app/models/`) : Business, User, Product, Sale, MoneyMovement,
  StockMovement, AuditLog, DailyClosing — mappés 1:1 sur les 8 fonctionnalités MVP.
- **Migrations Alembic** : schéma initial généré et appliqué sur une vraie base Postgres locale
  (`korah`). Voir "Lancer les migrations" ci-dessous.
- **Authentification** : `POST /auth/register-business`, `POST /auth/login` (PIN + `business_code`),
  `POST /auth/employees` (propriétaire uniquement). JWT Bearer.
- **Synchronisation** protégée par auth : `POST /sync/push` et `GET /sync/pull`, conformes au
  protocole décrit dans `../documentation/SYNC_DESIGN.md` (idempotence par `client_uuid`, dérivation
  automatique stock+caisse à partir d'une vente, pagination par curseur `(created_at, id)`).
  `business_id`/`user_id` proviennent du token, jamais de la requête.
- **Produits** : `POST/GET/PATCH /products` — prix d'achat masqué aux employés sans permission.
- **Clôture de fin de journée** : `GET /closing/expected-cash` calcule la caisse attendue côté
  serveur (jamais fournie par le client) ; poussée via `/sync/push`.
- **Dashboard patron** : `GET /dashboard/daily` — ventes, caisse attendue, dernière clôture, alertes
  de stock, top produits, activité par employé, en un seul appel.
- Testé : 13 tests (`pytest tests/ -v`), + un scénario complet vérifié à la main contre la vraie base
  Postgres (inscription → vente → sync → nettoyage).
- Pas encore : refresh token, endpoint de consultation du journal d'audit — détail dans
  `../CLAUDE.md` "Prochaines étapes backend".
- Le schéma OpenAPI courant est exporté dans `../packages/shared/openapi.json` — régénéré au fil du
  développement, ne pas éditer ce fichier à la main.

## Lancer les tests

```bash
pip install -r requirements-dev.txt
pytest tests/ -v
```

## Lancer les migrations

```bash
alembic upgrade head    # applique les migrations sur la base pointée par DATABASE_URL (.env)
alembic revision --autogenerate -m "message"   # après une modification de app/models/
```
