"""Régénère packages/shared/openapi.json depuis l'app FastAPI.

Le schéma publié est la source de vérité partagée par web/mobile/desktop
(voir packages/shared/README.md). À lancer après chaque modification des routes.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402

TARGET = Path(__file__).resolve().parents[2] / "packages" / "shared" / "openapi.json"

TARGET.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False), encoding="utf-8")
print(f"OK -> {TARGET}")