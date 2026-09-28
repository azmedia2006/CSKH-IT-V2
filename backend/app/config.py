from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "IT Service Desk"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT Authentication
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # AI Engine
    AI_PROVIDER: str = "openai"
    OPENAI_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None
    AI_MODEL_NAME: str = "gpt-4o-mini"
    AI_TIMEOUT_SECONDS: int = 4
    AI_FALLBACK_CATEGORY: str = "Uncategorized"
    AI_FALLBACK_PRIORITY: str = "P3"
    AI_CONFIDENCE_THRESHOLD: float = 0.4

    # SMTP Mail (Gmail)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_FROM_NAME: str = "IT Service Desk"
    SMTP_TLS: bool = True

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # SLA Default Times (minutes)
    SLA_P1_RESPONSE: int = 15
    SLA_P1_RESOLVE: int = 60
    SLA_P2_RESPONSE: int = 30
    SLA_P2_RESOLVE: int = 240
    SLA_P3_RESPONSE: int = 120
    SLA_P3_RESOLVE: int = 1440
    SLA_P4_RESPONSE: int = 480
    SLA_P4_RESOLVE: int = 4320

    # Customer Timeout (hours)
    CUSTOMER_REMINDER_HOURS: int = 48
    CUSTOMER_AUTO_CLOSE_HOURS: int = 72

    # GitHub Integration
    GITHUB_TOKEN: str | None = None
    GITHUB_DEFAULT_REPO: str = "azmedia2006/CSKH-IT"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
