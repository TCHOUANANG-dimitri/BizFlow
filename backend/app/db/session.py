import os

from sqlalchemy.pool import NullPool
from sqlmodel import Session, create_engine

from app.core.config import settings

# Sur Vercel (variable VERCEL posée automatiquement par leur runtime), chaque
# invocation peut démarrer une instance de fonction fraîche : un pool de
# connexions applicatif n'a pas le temps de vivre entre deux requêtes, et le
# pooler Supabase (Supavisor, mode transaction) gère déjà le pooling côté
# base. Empiler un deuxième pool ici épuiserait vite la limite de connexions.
engine = (
    create_engine(settings.database_url, echo=False, poolclass=NullPool)
    if os.environ.get("VERCEL")
    else create_engine(settings.database_url, echo=False)
)


def get_session():
    with Session(engine) as session:
        yield session
