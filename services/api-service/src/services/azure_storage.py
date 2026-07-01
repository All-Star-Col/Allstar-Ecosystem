from __future__ import annotations

import os
from typing import Any

from src.core.config import settings


class AzureStorageNotConfigured(RuntimeError):
    """Raised when Azure Blob Storage credentials are not configured."""


def _config_value(name: str) -> str:
    value = getattr(settings, name, "") or os.getenv(name) or ""
    return str(value).strip()


def _first_config_value(*names: str) -> str:
    for name in names:
        value = _config_value(name)
        if value:
            return value
    return ""


def get_blob_service_client() -> Any:
    from azure.storage.blob import BlobServiceClient

    connection_string = _first_config_value("AZURE_STORAGE_CONNECTION_STRING")
    if connection_string:
        return BlobServiceClient.from_connection_string(connection_string)

    account_name = _first_config_value(
        "AZURE_STORAGE_ACCOUNT_NAME",
        "AZURE_STORAGE_ACCOUNT",
    )
    account_url = _first_config_value(
        "AZURE_STORAGE_ACCOUNT_URL",
        "AZURE_BLOB_ACCOUNT_URL",
    )
    account_key = _first_config_value(
        "AZURE_STORAGE_ACCOUNT_KEY",
        "AZURE_STORAGE_KEY",
    )
    sas_token = _first_config_value(
        "AZURE_STORAGE_SAS_TOKEN",
        "AZURE_STORAGE_SAS",
    )

    if not account_url and account_name:
        account_url = f"https://{account_name}.blob.core.windows.net"

    credential = account_key or sas_token.lstrip("?")
    if account_url and credential:
        return BlobServiceClient(account_url=account_url, credential=credential)

    raise AzureStorageNotConfigured(
        "Azure Blob Storage no esta configurado. Define "
        "AZURE_STORAGE_CONNECTION_STRING o AZURE_STORAGE_ACCOUNT_NAME + "
        "AZURE_STORAGE_ACCOUNT_KEY."
    )
