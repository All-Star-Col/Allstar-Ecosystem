from __future__ import annotations

import hashlib
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from azure.storage.blob import ContentSettings

from src.core.config import settings
from src.services.azure_storage import get_blob_service_client as get_configured_blob_service_client


# ============================================================
# CARGA MANUAL DEL .ENV
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"


def _read_env_file_manually(env_path: Path) -> dict[str, str]:
    if not env_path.exists():
        return {}

    encodings = ["utf-8-sig", "utf-8", "cp1252", "latin1"]

    content = None

    for encoding in encodings:
        try:
            content = env_path.read_text(encoding=encoding)
            break
        except UnicodeDecodeError:
            continue

    if content is None:
        return {}

    data: dict[str, str] = {}

    for raw_line in content.splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)

        key = key.strip()
        value = value.strip()

        if len(value) >= 2:
            if (value.startswith('"') and value.endswith('"')) or (
                value.startswith("'") and value.endswith("'")
            ):
                value = value[1:-1]

        data[key] = value

    return data


_MANUAL_ENV: dict[str, str] = {}


# ============================================================
# CONFIGURACIÓN AZURE BLOB
# ============================================================

AZURE_STORAGE_CONTAINER_ACTAS = (
    os.getenv("AZURE_STORAGE_CONTAINER_ACTAS")
    or settings.AZURE_STORAGE_CONTAINER_ACTAS
    or "actas-cliente-instalacion"
)


def get_blob_service_client():
    return get_configured_blob_service_client()


def calcular_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def limpiar_nombre_archivo(nombre_archivo: str) -> str:
    nombre = nombre_archivo.strip()

    caracteres_invalidos = ['\\', '/', ':', '*', '?', '"', '<', '>', '|']

    for caracter in caracteres_invalidos:
        nombre = nombre.replace(caracter, "_")

    if not nombre.lower().endswith(".pdf"):
        nombre += ".pdf"

    return nombre


def subir_acta_pdf_a_blob(
    pdf_bytes: bytes,
    nombre_archivo: str,
    lote_proceso_id: int,
    lote_id: int | None,
) -> dict[str, Any]:
    if not pdf_bytes:
        raise ValueError("El PDF está vacío.")

    nombre_archivo_limpio = limpiar_nombre_archivo(nombre_archivo)

    blob_service_client = get_blob_service_client()

    container_name = AZURE_STORAGE_CONTAINER_ACTAS
    container_client = blob_service_client.get_container_client(container_name)

    try:
        container_client.create_container()
    except Exception:
        # Si el contenedor ya existe, Azure lanza error.
        # Lo ignoramos para permitir cargas repetidas.
        pass

    fecha = datetime.now()

    lote_folder = f"lote_{lote_id}" if lote_id is not None else "sin_lote"

    blob_name = (
        f"actas_cliente_instalacion/"
        f"{fecha.year}/"
        f"{fecha.month:02d}/"
        f"lote_proceso_{lote_proceso_id}/"
        f"{lote_folder}/"
        f"{nombre_archivo_limpio}"
    )

    blob_client = container_client.get_blob_client(blob_name)

    blob_client.upload_blob(
        pdf_bytes,
        overwrite=True,
        content_settings=ContentSettings(
            content_type="application/pdf"
        ),
    )

    return {
        "container": container_name,
        "blob_name": blob_name,
        "blob_url": blob_client.url,
        "hash_sha256": calcular_sha256(pdf_bytes),
    }

def descargar_blob_bytes(blob_name: str) -> bytes:
    if not blob_name:
        raise ValueError("El nombre del blob está vacío.")

    blob_service_client = get_blob_service_client()

    container_client = blob_service_client.get_container_client(
        AZURE_STORAGE_CONTAINER_ACTAS
    )

    blob_client = container_client.get_blob_client(blob_name)

    return blob_client.download_blob().readall()
