from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.audit import router as audit_router
from app.api.closing import router as closing_router
from app.api.dashboard import router as dashboard_router
from app.api.health import router as health_router
from app.api.products import router as products_router
from app.api.sync import router as sync_router
from app.core.config import settings

app = FastAPI(title=settings.app_name)

# Le web (Next, port 3000) et le desktop (Tauri) tournent sur un autre origine
# que l'API : sans CORS, les appels navigateur sont bloqués (préflight OPTIONS 405).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(closing_router)
app.include_router(dashboard_router)
app.include_router(audit_router)
app.include_router(sync_router)
