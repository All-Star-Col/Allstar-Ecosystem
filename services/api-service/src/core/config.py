import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import List
from bitwarden_sdk import BitwardenClient, ClientSettings
from src.core.logging_config import get_logger

logger = get_logger(__name__)

# Carga el BW_ACCESS_TOKEN de tu archivo local


class Settings(BaseSettings):
    # --- IDS DE BITWARDEN (Pon tus UUIDs reales aquí) ---

    ID_ALGORITHM: str = "d609a512-df00-486e-a3fd-b3ef013e866f"
    ID_POSTGRES_URL_DATABASE: str = "08f813ec-acd6-4a51-9aba-b3ef013db100"
    ID_SECRET_KEY: str = "b8ac367c-d5c9-420b-b73e-b3ef013e672b"
    ID_SQLSERVER_URL_DATABASE: str = "db6447f6-6141-44ff-a0c9-b3f0011f2a07"
    ID_SHEETS_INVENTARIO_ALLSTAR: str = "21fcbb73-0b64-4c23-935d-b3f0012008ed"
    ID_GOOGLE_CREDENTIALS_JSON: str = "b18708c2-aa1e-4a42-91ca-b3f7011ed6e2"

    # --- VARIABLES QUE SE LLENARÁN DESDE LA NUBE ---
    ALGORITHM: str = ""
    POSTGRES_URL_DATABASE: str = ""
    SECRET_KEY: str = ""
    SQLSERVER_URL_DATABASE: str = ""
    SHEETS_INVENTARIO_ALLSTAR: str = ""
    GOOGLE_CREDENTIALS_JSON: str = ""

    # --- CONFIGS LOCALES ---
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 600


    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # --- CONFIGURACIONES DE GOOGLE SHEETS Y DB EXTERNA ---
    SPREADSHEET_ID: str = ""

    class Config:
        env_file = "keys.env"
        env_file_encoding = "utf-8"


    def __init__(self, **values):
        super().__init__(**values)
        self.load_secrets_from_bw()

    def load_secrets_from_bw(self):
        """Conecta con Bitwarden y descarga los valores reales usando los IDs"""
        try:
            client = BitwardenClient(
                ClientSettings(
                    identity_url="https://identity.bitwarden.com",
                    api_url="https://api.bitwarden.com",
                )
            )

            access_token = os.getenv("BW_ACCESS_TOKEN")
            if not access_token:
                raise ValueError("BW_ACCESS_TOKEN no está definido en el entorno")

            client.auth().login_access_token(access_token)

            def get_secret(secret_id: str, name: str) -> str:
                secret = client.secrets().get(secret_id)
                if not secret or not secret.data:
                    raise ValueError(f"No se pudo obtener el secreto {name}")
                return secret.data.value

            # Asignación segura
            self.ALGORITHM = get_secret(self.ID_ALGORITHM, "ALGORITHM")
            self.POSTGRES_URL_DATABASE = get_secret(
                self.ID_POSTGRES_URL_DATABASE, "POSTGRES_URL_DATABASE"
            )
            self.SECRET_KEY = get_secret(self.ID_SECRET_KEY, "SECRET_KEY")
            self.SQLSERVER_URL_DATABASE = get_secret(
                self.ID_SQLSERVER_URL_DATABASE, "SQLSERVER_URL_DATABASE"
            )
            self.SHEETS_INVENTARIO_ALLSTAR = get_secret(
                self.ID_SHEETS_INVENTARIO_ALLSTAR, "SHEETS_INVENTARIO_ALLSTAR"
            )
            self.GOOGLE_CREDENTIALS_JSON = get_secret(
                self.ID_GOOGLE_CREDENTIALS_JSON, "GOOGLE_CREDENTIALS_JSON"
            )

            logger.info("Secretos cargados exitosamente")

        except Exception as e:
            logger.exception(f"Error cargando configuraciones: {e}")
            raise
settings = Settings()


