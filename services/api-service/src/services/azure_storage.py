from __future__ import annotations

import os
import re
from typing import Any

from src.core.config import settings


class AzureStorageNotConfigured(RuntimeError):
    """Raised when Azure Blob Storage credentials are not configured."""


def _config_value(name: str) -> str:
    value = getattr(settings, name, "") or os.getenv(name) or ""
    return str(value).strip().strip("\"'")


def _first_config_value(*names: str) -> str:
    for name in names:
        value = _config_value(name)
        if value:
            return value
    return ""


def _clean_connection_string(value: str) -> str:
    text = str(value or "").strip().strip("\"'")
    if not text:
        return ""

    # Secrets are sometimes pasted as dotenv blocks. Keep only the connection string
    # and ignore following AZURE_STORAGE_* assignments.
    if "AZURE_STORAGE_CONNECTION_STRING=" in text:
        text = text.split("AZURE_STORAGE_CONNECTION_STRING=", 1)[1].strip()
    text = text.replace("\r", "\n")
    text = text.split("\n", 1)[0].strip().strip("\"'")

    match = re.search(
        r"(DefaultEndpointsProtocol=.*?EndpointSuffix=[^;\"'\s]+)",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1).strip().strip(";").strip()

    return text.strip().strip(";").strip()


def get_blob_service_client() -> Any:
    from azure.storage.blob import BlobServiceClient

    connection_string = _first_config_value("AZURE_STORAGE_CONNECTION_STRING")
    connection_string = _clean_connection_string(connection_string)
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
