from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field
import json

class Settings(BaseSettings):
    # App
    app_name: str = Field(default="Doc Automation API", env="APP_NAME")
    app_env: str = Field(default="development", env="APP_ENV")
    debug: bool = Field(default=True, env="DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", env="API_V1_PREFIX")
    
    # Groq API (OpenAI Compatible)
    openai_api_key: str = Field(..., env="OPENAI_API_KEY")  # Required now
    openai_base_url: str = Field(
        default="https://api.groq.com/openai/v1", 
        env="OPENAI_BASE_URL"
    )
    openai_model: str = Field(
        default="llama-3.3-70b-versatile", 
        env="OPENAI_MODEL"
    )
    openai_temperature: float = Field(default=0.0, env="OPENAI_TEMPERATURE")
    
    # Database
    database_url: Optional[str] = Field(default=None, env="DATABASE_URL")
    use_database: bool = Field(default=False, env="USE_DATABASE")
    
    # File Storage
    templates_dir: str = Field(default="./templates", env="TEMPLATES_DIR")
    generated_dir: str = Field(default="./generated_docs", env="GENERATED_DIR")
    max_upload_size: int = Field(default=10485760, env="MAX_UPLOAD_SIZE")
    
    # Security
    allowed_extensions: str = Field(default=".docx", env="ALLOWED_EXTENSIONS")
    cors_origins: str = Field(
        default='["http://localhost:3000", "http://localhost:8000"]', 
        env="CORS_ORIGINS"
    )
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_file: str = Field(default="./logs/app.log", env="LOG_FILE")
    
    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.cors_origins)
    
    @property
    def allowed_extensions_list(self) -> List[str]:
        return [ext.strip() for ext in self.allowed_extensions.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()