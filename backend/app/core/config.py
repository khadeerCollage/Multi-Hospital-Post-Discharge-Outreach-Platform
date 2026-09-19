import os
from dotenv import load_dotenv

# Load .env FIRST and override any system env vars
load_dotenv(override=True)

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    DATABASE_URL: str
    UPSTASH_REDIS_URL: str
    UPSTASH_REDIS_TOKEN: str
    GEMINI_API_KEY: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    CORS_ORIGINS: str = "http://localhost:3000"
    APP_NAME: str = "Multi-Hospital Post-Discharge Outreach Platform"
    DEBUG: bool = False

    # AI Observability (Langfuse / LangSmith)
    LANGFUSE_PUBLIC_KEY: str | None = None
    LANGFUSE_SECRET_KEY: str | None = None
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"
    LANGSMITH_API_KEY: str | None = None
    LANGSMITH_PROJECT: str = "outreach-platform"
    LANGSMITH_TRACING: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
