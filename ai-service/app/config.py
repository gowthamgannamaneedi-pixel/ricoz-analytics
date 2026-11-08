import os
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file from ai-service or server fallback
load_dotenv()
server_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "server", ".env")
if os.path.exists(server_env):
    load_dotenv(server_env, override=False)

class Settings(BaseModel):
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Database
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "ricoz_analytics")
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "postgres")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Security
    AI_SERVICE_SECRET: str = os.getenv("AI_SERVICE_SECRET", "ricoz_ai_service_secure_key_production_2026")
    
    # Guardrails
    STATEMENT_TIMEOUT_MS: int = int(os.getenv("STATEMENT_TIMEOUT_MS", "5000"))
    MAX_RESULT_ROWS: int = int(os.getenv("MAX_RESULT_ROWS", "1000"))
    MAX_TOOL_CALLS: int = int(os.getenv("MAX_TOOL_CALLS_PER_QUERY", "10"))

    # LLM Settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    def get_db_dsn(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

settings = Settings()
