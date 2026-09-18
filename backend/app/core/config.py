from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Korah Business Manager API"
    environment: str = "development"

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/korah"

    jwt_secret_key: str = "change-me-in-.env"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24

    # Origines autorisées pour le web (dev : localhost:3000) et le desktop
    # Tauri (webview : tauri.localhost). Activable via CORS_ALLOW_ORIGINS en .env.
    cors_allow_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://tauri.localhost",
        "tauri://localhost",
        "https://biz-flow-theta.vercel.app",
    ]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
