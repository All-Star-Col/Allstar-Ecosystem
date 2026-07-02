from __future__ import annotations

import hashlib
import mimetypes
import os
import re
import uuid
from typing import Any

from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.logging_config import get_logger
from src.services.azure_storage import AzureStorageNotConfigured, get_blob_service_client
from src.services.carpentry.common import AppError, clean, execute, fetch_all, fetch_one, int_or_none

logger = get_logger(__name__)

DOCUMENTS_TABLE = "documentos_proyecto"
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
RECEPTION_STAGE_WORDS = ("acta", "recepcion")
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".xlsx",
    ".xls",
    ".csv",
    ".doc",
    ".docx",
    ".png",
    ".jpg",
    ".jpeg",
}


def _normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    replacements = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ñ": "n",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return re.sub(r"\s+", " ", text)


def _is_reception_stage(stage_name: Any) -> bool:
    normalized = _normalize_text(stage_name)
    return all(word in normalized for word in RECEPTION_STAGE_WORDS)


def _safe_filename(filename: str | None) -> str:
    clean_name = (filename or "documento").strip()
    for char in ('\\', '/', ':', '*', '?', '"', '<', '>', '|'):
        clean_name = clean_name.replace(char, "_")
    clean_name = re.sub(r"\s+", "_", clean_name)
    return clean_name[:180] or "documento"


def _safe_blob_segment(value: Any, fallback: str) -> str:
    text = _normalize_text(value).replace(" ", "_")
    text = re.sub(r"[^a-z0-9_.-]+", "_", text).strip("._-")
    return text[:80] or fallback


def _file_extension(filename: str | None) -> str:
    _, extension = os.path.splitext(filename or "")
    return extension.lower()


def _content_type(filename: str, provided: str | None) -> str:
    if provided and provided.strip():
        return provided.strip()
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _container_name() -> str:
    return (
        settings.AZURE_STORAGE_CONTAINER_CARPENTRY_DOCS
        or os.getenv("AZURE_STORAGE_CONTAINER_CARPENTRY_DOCS")
        or "carpentry-docs"
    )


def _azure_blob_service_client():
    try:
        return get_blob_service_client()
    except AzureStorageNotConfigured as exc:
        raise AppError(
            str(exc),
            503,
            "AZURE_STORAGE_NOT_CONFIGURED",
        ) from exc


def _upload_document_sync(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    proyecto_id: int,
    etapa_nombre: str,
) -> dict[str, str]:
    from azure.storage.blob import ContentSettings

    container_name = _container_name()
    etapa_segment = _safe_blob_segment(etapa_nombre, "etapa")
    blob_name = (
        f"proyectos/proyecto_{proyecto_id}/"
        f"{etapa_segment}/"
        f"{uuid.uuid4().hex}_{filename}"
    )

    service_client = _azure_blob_service_client()
    container_client = service_client.get_container_client(container_name)
    try:
        container_client.create_container()
    except Exception:
        pass

    blob_client = container_client.get_blob_client(blob_name)
    blob_client.upload_blob(
        file_bytes,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )
    return {
        "container": container_name,
        "blob_name": blob_name,
        "blob_url": blob_client.url,
    }


def _download_blob_bytes_sync(*, container_name: str, blob_name: str) -> bytes:
    service_client = _azure_blob_service_client()
    blob_client = service_client.get_blob_client(container=container_name, blob=blob_name)
    return blob_client.download_blob().readall()


async def _table_exists(db: AsyncSession, table_name: str) -> bool:
    row = await fetch_one(db, "SELECT to_regclass($1) AS table_ref", [table_name])
    return bool(row and row.get("table_ref"))


async def ensure_document_table(db: AsyncSession) -> None:
    await execute(
        db,
        f"""
        CREATE TABLE IF NOT EXISTS {DOCUMENTS_TABLE} (
            id BIGSERIAL PRIMARY KEY,
            proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
            proyecto_etapa_id INTEGER REFERENCES proyecto_etapas(id) ON DELETE SET NULL,
            etapa_id INTEGER REFERENCES etapas_catalogo(id) ON DELETE SET NULL,
            etapa_nombre TEXT NOT NULL,
            titulo TEXT NOT NULL,
            descripcion TEXT,
            nombre_archivo TEXT NOT NULL,
            tipo_archivo TEXT,
            tamano_bytes BIGINT,
            azure_container TEXT NOT NULL,
            azure_blob_name TEXT NOT NULL,
            azure_blob_url TEXT,
            hash_sha256 TEXT,
            subido_por TEXT,
            aprobado BOOLEAN NOT NULL DEFAULT FALSE,
            aprobado_at TIMESTAMPTZ,
            aprobado_por TEXT,
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
    )
    schema_repairs = [
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS proyecto_id INTEGER",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS proyecto_etapa_id INTEGER",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS etapa_id INTEGER",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS etapa_nombre TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS titulo TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS descripcion TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS nombre_archivo TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS tipo_archivo TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS tamano_bytes BIGINT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS azure_container TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS azure_blob_name TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS azure_blob_url TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS hash_sha256 TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS subido_por TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS aprobado BOOLEAN DEFAULT FALSE",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS aprobado_at TIMESTAMPTZ",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS aprobado_por TEXT",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
        f"ALTER TABLE {DOCUMENTS_TABLE} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
        f"ALTER TABLE {DOCUMENTS_TABLE} ALTER COLUMN aprobado SET DEFAULT FALSE",
        f"ALTER TABLE {DOCUMENTS_TABLE} ALTER COLUMN activo SET DEFAULT TRUE",
        f"ALTER TABLE {DOCUMENTS_TABLE} ALTER COLUMN created_at SET DEFAULT NOW()",
        f"ALTER TABLE {DOCUMENTS_TABLE} ALTER COLUMN updated_at SET DEFAULT NOW()",
        f"UPDATE {DOCUMENTS_TABLE} SET aprobado = FALSE WHERE aprobado IS NULL",
        f"UPDATE {DOCUMENTS_TABLE} SET activo = TRUE WHERE activo IS NULL",
        f"UPDATE {DOCUMENTS_TABLE} SET created_at = NOW() WHERE created_at IS NULL",
        f"UPDATE {DOCUMENTS_TABLE} SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL",
    ]
    for statement in schema_repairs:
        await execute(db, statement)
    await execute(
        db,
        f"""
        CREATE INDEX IF NOT EXISTS idx_{DOCUMENTS_TABLE}_proyecto_etapa
        ON {DOCUMENTS_TABLE} (proyecto_id, etapa_id, activo)
        """,
    )
    await execute(
        db,
        f"""
        CREATE INDEX IF NOT EXISTS idx_{DOCUMENTS_TABLE}_created_at
        ON {DOCUMENTS_TABLE} (created_at DESC)
        """,
    )
    await db.commit()


async def _get_project(db: AsyncSession, proyecto_id: int) -> dict[str, Any]:
    proyecto = await fetch_one(
        db,
        """SELECT id, nombre, cliente, estado, fecha_compromiso
           FROM proyectos
           WHERE id = $1""",
        [proyecto_id],
    )
    if not proyecto:
        raise AppError("Proyecto no encontrado.", 404, "NOT_FOUND")
    return proyecto


async def _get_project_stage(
    db: AsyncSession,
    *,
    proyecto_id: int,
    proyecto_etapa_id: int | None,
    etapa_id: int | None,
) -> dict[str, Any]:
    if proyecto_etapa_id:
        stage = await fetch_one(
            db,
            """SELECT pe.id AS proyecto_etapa_id, pe.etapa_id,
                      ec.nombre AS etapa, ec.orden
               FROM proyecto_etapas pe
               JOIN etapas_catalogo ec ON ec.id = pe.etapa_id
               WHERE pe.id = $1
                 AND pe.proyecto_id = $2""",
            [proyecto_etapa_id, proyecto_id],
        )
    elif etapa_id:
        stage = await fetch_one(
            db,
            """SELECT pe.id AS proyecto_etapa_id, pe.etapa_id,
                      ec.nombre AS etapa, ec.orden
               FROM proyecto_etapas pe
               JOIN etapas_catalogo ec ON ec.id = pe.etapa_id
               WHERE pe.etapa_id = $1
                 AND pe.proyecto_id = $2
               LIMIT 1""",
            [etapa_id, proyecto_id],
        )
    else:
        stage = None

    if not stage:
        raise AppError("Etapa administrativa no encontrada para el proyecto.", 404, "STAGE_NOT_FOUND")
    return stage


async def _list_project_stages(db: AsyncSession, proyecto_id: int) -> list[dict[str, Any]]:
    return await fetch_all(
        db,
        """SELECT pe.id AS proyecto_etapa_id, pe.etapa_id,
                  ec.nombre AS etapa, ec.orden,
                  pe.estado, pe.fecha_programada, pe.fecha_real
           FROM proyecto_etapas pe
           JOIN etapas_catalogo ec ON ec.id = pe.etapa_id
           WHERE pe.proyecto_id = $1
           ORDER BY ec.orden ASC, ec.nombre ASC""",
        [proyecto_id],
    )


async def _list_uploaded_documents(db: AsyncSession, proyecto_id: int) -> list[dict[str, Any]]:
    if not await _table_exists(db, DOCUMENTS_TABLE):
        return []
    return await fetch_all(
        db,
        f"""SELECT id, proyecto_id, proyecto_etapa_id, etapa_id, etapa_nombre,
                  titulo, descripcion, nombre_archivo, tipo_archivo, tamano_bytes,
                  azure_container, azure_blob_name, azure_blob_url, hash_sha256,
                  subido_por, aprobado, aprobado_at, aprobado_por, created_at, updated_at
           FROM {DOCUMENTS_TABLE}
           WHERE proyecto_id = $1
             AND activo = TRUE
           ORDER BY created_at DESC, id DESC""",
        [proyecto_id],
    )


async def _list_reception_acts(db: AsyncSession, proyecto_id: int) -> list[dict[str, Any]]:
    if not await _table_exists(db, "actas_cliente_instalacion"):
        return []

    return await fetch_all(
        db,
        """SELECT a.id, a.lote_id, COALESCE(a.lote_nombre, l.nombre) AS lote_nombre,
                  a.cliente, a.apartamentos, a.nombre_archivo, a.tipo_archivo,
                  a.azure_container, a.azure_blob_name, a.azure_blob_url,
                  a.hash_sha256, a.comentario, a.fecha_firma, a.created_at
           FROM actas_cliente_instalacion a
           LEFT JOIN lotes l ON l.id = a.lote_id
           WHERE l.proyecto_id = $1
           ORDER BY COALESCE(a.created_at, a.fecha_firma) DESC, a.id DESC""",
        [proyecto_id],
    )


def _group_documents_by_stage(
    stages: list[dict[str, Any]],
    documents: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    grouped: dict[int, list[dict[str, Any]]] = {}
    for document in documents:
        key = int(document.get("proyecto_etapa_id") or 0)
        grouped.setdefault(key, []).append(document)

    result = []
    for stage in stages:
        stage_id = int(stage["proyecto_etapa_id"])
        result.append(
            {
                **stage,
                "permite_carga": not _is_reception_stage(stage.get("etapa")),
                "documentos": grouped.get(stage_id, []),
            }
        )
    return result


async def listar_documentos(db: AsyncSession, payload: dict | None = None) -> dict[str, Any]:
    payload = payload or {}
    proyecto_id = int_or_none(payload.get("proyecto_id"))
    if not proyecto_id:
        raise AppError("Debe seleccionar un proyecto.", 400, "VALIDATION")

    await ensure_document_table(db)
    proyecto = await _get_project(db, proyecto_id)
    stages = await _list_project_stages(db, proyecto_id)
    documents = await _list_uploaded_documents(db, proyecto_id)
    reception_acts = await _list_reception_acts(db, proyecto_id)
    approved_quote = next(
        (
            document
            for document in documents
            if document.get("aprobado") and "cotiz" in _normalize_text(document.get("etapa_nombre"))
        ),
        None,
    )

    return {
        "proyecto": proyecto,
        "etapas": _group_documents_by_stage(stages, documents),
        "documentos": documents,
        "actas_recepcion": reception_acts,
        "cotizacion_aprobada": approved_quote,
        "containers": {
            "documentos": _container_name(),
            "actas_recepcion": settings.AZURE_STORAGE_CONTAINER_ACTAS,
        },
    }


async def subir_documento(
    db: AsyncSession,
    *,
    proyecto_id: int,
    proyecto_etapa_id: int | None,
    etapa_id: int | None,
    titulo: str | None,
    descripcion: str | None,
    filename: str,
    content_type: str | None,
    file_bytes: bytes,
    usuario: str | None,
) -> dict[str, Any]:
    if not file_bytes:
        raise AppError("El archivo esta vacio.", 400, "EMPTY_FILE")
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise AppError("El archivo supera el limite de 50 MB.", 400, "FILE_TOO_LARGE")

    safe_filename = _safe_filename(filename)
    extension = _file_extension(safe_filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise AppError("Tipo de archivo no permitido para documentos de proyecto.", 400, "FILE_TYPE_NOT_ALLOWED")

    await ensure_document_table(db)
    await _get_project(db, proyecto_id)
    stage = await _get_project_stage(
        db,
        proyecto_id=proyecto_id,
        proyecto_etapa_id=proyecto_etapa_id,
        etapa_id=etapa_id,
    )

    if _is_reception_stage(stage.get("etapa")):
        raise AppError(
            "El acta de recepcion se genera desde la tablet y no permite carga manual.",
            400,
            "RECEPTION_ACT_READ_ONLY",
        )

    document_title = clean(titulo) or os.path.splitext(safe_filename)[0]
    file_content_type = _content_type(safe_filename, content_type)
    hash_sha256 = hashlib.sha256(file_bytes).hexdigest()
    azure_data = await run_in_threadpool(
        _upload_document_sync,
        file_bytes=file_bytes,
        filename=safe_filename,
        content_type=file_content_type,
        proyecto_id=proyecto_id,
        etapa_nombre=stage["etapa"],
    )

    if db.in_transaction():
        await db.rollback()

    rows = await execute(
        db,
        f"""INSERT INTO {DOCUMENTS_TABLE} (
                proyecto_id, proyecto_etapa_id, etapa_id, etapa_nombre,
                titulo, descripcion, nombre_archivo, tipo_archivo, tamano_bytes,
                azure_container, azure_blob_name, azure_blob_url, hash_sha256,
                subido_por, activo, created_at, updated_at
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE,NOW(),NOW()
            )
            RETURNING *""",
        [
            proyecto_id,
            stage["proyecto_etapa_id"],
            stage["etapa_id"],
            stage["etapa"],
            document_title,
            clean(descripcion),
            safe_filename,
            file_content_type,
            len(file_bytes),
            azure_data["container"],
            azure_data["blob_name"],
            azure_data["blob_url"],
            hash_sha256,
            usuario or "web",
        ],
    )
    await db.commit()

    return {"ok": True, "documento": rows[0] if rows else None}


async def obtener_documento(db: AsyncSession, document_id: int) -> dict[str, Any]:
    await ensure_document_table(db)
    document = await fetch_one(
        db,
        f"""SELECT *
           FROM {DOCUMENTS_TABLE}
           WHERE id = $1
             AND activo = TRUE
           LIMIT 1""",
        [document_id],
    )
    if not document:
        raise AppError("Documento no encontrado.", 404, "NOT_FOUND")
    return document


async def aprobar_cotizacion(db: AsyncSession, payload: dict | None = None) -> dict[str, Any]:
    payload = payload or {}
    document_id = int_or_none(payload.get("id"))
    usuario = clean(payload.get("usuario")) or "web"
    if not document_id:
        raise AppError("Falta el identificador de la cotizacion.", 400, "VALIDATION")

    await ensure_document_table(db)
    document = await obtener_documento(db, document_id)
    if "cotiz" not in _normalize_text(document.get("etapa_nombre")):
        raise AppError("Solo se pueden aprobar documentos de la etapa Cotizacion.", 400, "VALIDATION")

    if db.in_transaction():
        await db.rollback()

    async with db.begin():
        await execute(
            db,
            f"""UPDATE {DOCUMENTS_TABLE}
               SET aprobado = FALSE,
                   aprobado_at = NULL,
                   aprobado_por = NULL,
                   updated_at = NOW()
               WHERE proyecto_id = $1
                 AND activo = TRUE
                 AND LOWER(etapa_nombre) LIKE '%cotiz%'""",
            [document["proyecto_id"]],
        )
        rows = await execute(
            db,
            f"""UPDATE {DOCUMENTS_TABLE}
               SET aprobado = TRUE,
                   aprobado_at = NOW(),
                   aprobado_por = $2,
                   updated_at = NOW()
               WHERE id = $1
               RETURNING *""",
            [document_id, usuario],
        )

    return {"ok": True, "documento": rows[0] if rows else None}


async def descargar_documento(db: AsyncSession, document_id: int) -> tuple[bytes, str, str]:
    document = await obtener_documento(db, document_id)
    container_name = document.get("azure_container")
    blob_name = document.get("azure_blob_name")
    if not container_name or not blob_name:
        raise AppError("El documento no tiene archivo asociado en Azure.", 404, "BLOB_NOT_FOUND")

    file_bytes = await run_in_threadpool(
        _download_blob_bytes_sync,
        container_name=container_name,
        blob_name=blob_name,
    )
    if not file_bytes:
        raise AppError("El archivo descargado esta vacio.", 404, "EMPTY_FILE")
    return (
        file_bytes,
        document.get("nombre_archivo") or f"documento_{document_id}",
        document.get("tipo_archivo") or "application/octet-stream",
    )
