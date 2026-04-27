import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import List
from bitwarden_sdk import BitwardenClient, ClientSettings
from src.core.logging_config import get_logger

logger = get_logger(__name__)

load_dotenv("keys.dev.env", override=False)


class Settings(BaseSettings):
    # --- IDS DE BITWARDEN (Pon tus UUIDs reales aquí) ---

    ID_ALGORITHM: str = "d609a512-df00-486e-a3fd-b3ef013e866f"
    ID_POSTGRES_URL_DATABASE_DEV: str = "c054db7a-ac1b-4fcc-af5d-b410014abd81"
    ID_POSTGRES_URL_DATABASE_PROD: str = "08f813ec-acd6-4a51-9aba-b3ef013db100"
    ID_SQLSERVER_URL_DATABASE: str = "db6447f6-6141-44ff-a0c9-b3f0011f2a07"
    ID_SECRET_KEY: str = "b8ac367c-d5c9-420b-b73e-b3ef013e672b"
    ID_SHEETS_INVENTARIO_ALLSTAR: str = "21fcbb73-0b64-4c23-935d-b3f0012008ed"
    ID_GOOGLE_CREDENTIALS_JSON: str = "b18708c2-aa1e-4a42-91ca-b3f7011ed6e2"

    ENVIRONMENT: str = "prod"

    # --- VARIABLES QUE SE LLENARÁN DESDE LA NUBE ---
    ALGORITHM: str = ""
    POSTGRES_URL_DATABASE: str = ""
    SECRET_KEY: str = ""
    SQLSERVER_URL_DATABASE: str = ""
    SHEETS_INVENTARIO_ALLSTAR: str = ""
    GOOGLE_CREDENTIALS_JSON: str = ""

    # --- CONFIGS LOCALES ---
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 600
    CARPENTRY_DB_SCHEMA: str = "carpentry"

    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://purple-water-03112dc0f.1.azurestaticapps.net",
        "https://myallstarplatform.com",
        "https://api-vm.tail6cef8e.ts.net",
    ]

    # --- CONFIGURACIONES DE GOOGLE SHEETS Y DB EXTERNA ---
    SPREADSHEET_ID: str = ""

    class Config:
        env_file = "keys.dev.env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    def __init__(self, **values):
        super().__init__(**values)
        self.load_secrets_from_bw()

    def _normalize_environment(self) -> str:
        environment = (self.ENVIRONMENT or "prod").strip().lower()
        if environment not in {"dev", "prod"}:
            raise ValueError(
                f"ENVIRONMENT inválido: '{self.ENVIRONMENT}'. Valores permitidos: dev, prod"
            )
        self.ENVIRONMENT = environment
        return environment

    @staticmethod
    def _is_placeholder_secret_id(secret_id: str) -> bool:
        normalized = (secret_id or "").strip()
        if not normalized:
            return True

        upper_value = normalized.upper()
        placeholder_markers = ("REPLACE", "PLACEHOLDER", "TODO", "CHANGE_ME")
        return any(marker in upper_value for marker in placeholder_markers)

    def load_secrets_from_bw(self):
        """Conecta con Bitwarden y descarga los valores reales usando los IDs"""
        try:
            environment = self._normalize_environment()

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

            postgres_secret_id = self.ID_POSTGRES_URL_DATABASE_PROD

            if environment == "dev":
                if self._is_placeholder_secret_id(self.ID_POSTGRES_URL_DATABASE_DEV):
                    raise ValueError(
                        "ENVIRONMENT=dev requiere ID_POSTGRES_URL_DATABASE_DEV válido en config/env"
                    )
                postgres_secret_id = self.ID_POSTGRES_URL_DATABASE_DEV

            # Asignación segura
            self.ALGORITHM = get_secret(self.ID_ALGORITHM, "ALGORITHM")
            self.POSTGRES_URL_DATABASE = get_secret(
                postgres_secret_id, "POSTGRES_URL_DATABASE_PROD"
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
            logger.info("SECRETS LOADED SUCESSFULLY")
        except Exception as e:
            logger.exception(f"Error cargando configuraciones: {e}")
            raise


settings = Settings()
