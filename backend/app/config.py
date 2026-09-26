from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Architectural Thermal PINN Microservice"
    DEBUG: bool = True
    API_V1_STR: str = "/api"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Firebase Admin Configuration
    FIREBASE_SERVICE_ACCOUNT_KEY_PATH: Optional[str] = None
    FIREBASE_PROJECT_ID: Optional[str] = "mock-app"
    FIREBASE_STORAGE_BUCKET: Optional[str] = "mock-app.appspot.com"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
