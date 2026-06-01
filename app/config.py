from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field
import json
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # App
    app_name: str = Field(default="Doc Automation API", env="APP_NAME")
    app_env: str = Field(default="development", env="APP_ENV")
    debug: bool = Field(default=True, env="DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", env="API_V1_PREFIX")
    
    # Groq API
    openai_api_key: str = Field(default="", env="OPENAI_API_KEY")
    openai_base_url: str = Field(default="https://api.groq.com/openai/v1", env="OPENAI_BASE_URL")
    openai_model: str = Field(default="llama-3.3-70b-versatile", env="OPENAI_MODEL")
    openai_temperature: float = Field(default=0.0, env="OPENAI_TEMPERATURE")
    
    # Database
    use_database: bool = Field(default=True, env="USE_DATABASE")
    database_url: str = Field(
        default="postgresql+psycopg2://postgres:admin@localhost:5432/doc_automation",
        env="DATABASE_URL"
    )
    
    # File Storage
    templates_dir: str = Field(default="./templates", env="TEMPLATES_DIR")
    generated_dir: str = Field(default="./generated_docs", env="GENERATED_DIR")
    max_upload_size: int = Field(default=10485760, env="MAX_UPLOAD_SIZE")
    
    # Security
    allowed_extensions: str = Field(default=".docx", env="ALLOWED_EXTENSIONS")
    cors_origins: str = Field(default='["http://localhost:4200", "http://localhost:80", "http://frontend:80"]', env="CORS_ORIGINS")
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_file: str = Field(default="./logs/app.log", env="LOG_FILE")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # ✅ Allows extra fields in .env without error

settings = Settings()
print(f"✅ Config loaded")