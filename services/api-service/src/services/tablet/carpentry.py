from __future__ import annotations

import hashlib
import importlib
import inspect
import os
import uuid
from typing import Any, Iterable

from fastapi.concurrency import run_in_threadpool
from fastapi.encoders import jsonable_encoder

from src.core.config import settings
from src.services.azure_storage import get_blob_service_client


def _load_sql_db():
    return importlib.import_module("src.services.tablet.carpentry_legacy.sql_db")


def _function_exists(module: Any, function_name: str) -> bool:
    return hasattr(module, function_name) and callable(getattr(module, function_name))


def _function_needs_db(function: Any) -> bool:
    try:
        params = list(inspect.signature(function).parameters.values())
    except Exception:
        return True

    if not params:
        return False
    return params[0].name.lower() in {"db", "session"}


def _call_db_function_sync(function_name: str, *args: Any, **kwargs: Any) -> Any:
    module = _load_sql_db()
    if not _function_exists(module, function_name):
        raise RuntimeError(f"La funcion {function_name} no existe en sql_db.py.")

    function = getattr(module, function_name)
    if not _function_needs_db(function):
        return jsonable_encoder(function(*args, **kwargs))

    db = module.SessionLocal()
    try:
        return jsonable_encoder(function(db, *args, **kwargs))
    finally:
        try:
            db.close()
        except Exception:
            pass


async def call_db_function(function_name: str, *args: Any, **kwargs: Any) -> Any:
    return await run_in_threadpool(_call_db_function_sync, function_name, *args, **kwargs)


async def call_first_available(
    function_names: Iterable[str],
    *args: Any,
    **kwargs: Any,
) -> Any:
    module = _load_sql_db()
    for function_name in function_names:
        if _function_exists(module, function_name):
            return await call_db_function(function_name, *args, **kwargs)
    raise RuntimeError(f"No existe ninguna de estas funciones en sql_db.py: {list(function_names)}")


def _azure_blob_service_client():
    return get_blob_service_client()


def _safe_filename(nombre: str) -> str:
    clean_name = (nombre or "archivo.pdf").strip()
    for char in ('\\', '/', ':', '*', '?', '"', '<', '>', '|'):
        clean_name = clean_name.replace(char, "_")
    clean_name = clean_name.replace(" ", "_")
    if not clean_name.lower().endswith(".pdf"):
        clean_name = f"{clean_name}.pdf"
    return clean_name


def _upload_plano_pdf_to_azure_sync(
    *,
    pdf_bytes: bytes,
    nombre_archivo: str,
    proyecto_id: int,
    lote_id: int | None,
) -> dict[str, Any]:
    from azure.storage.blob import ContentSettings

    if not pdf_bytes:
        raise RuntimeError("El archivo PDF llego vacio.")
    if not pdf_bytes[:5].decode("utf-8", errors="ignore").startswith("%PDF-"):
        raise RuntimeError("El archivo cargado no parece ser un PDF valido.")

    container_name = (
        settings.AZURE_CONTAINER_PLANOS_PROYECTO
        or os.getenv("AZURE_CONTAINER_PLANOS_PROYECTO")
        or "planos-proyecto"
    )
    filename = _safe_filename(nombre_archivo)
    lote_text = lote_id if lote_id is not None else "sin_lote"
    blob_name = (
        f"proyectos/proyecto_{proyecto_id}/"
        f"lote_{lote_text}/"
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
        pdf_bytes,
        overwrite=True,
        content_settings=ContentSettings(content_type="application/pdf"),
    )
    return {
        "container": container_name,
        "blob_name": blob_name,
        "blob_url": blob_client.url,
    }


def _download_blob_bytes_sync(*, container_name: str, blob_name: str) -> bytes:
    service_client = _azure_blob_service_client()
    blob_client = service_client.get_blob_client(
        container=container_name,
        blob=blob_name,
    )
    return blob_client.download_blob().readall()


async def upload_acta_entrega_cliente(
    *,
    pdf_bytes: bytes,
    nombre_archivo: str,
    lote_proceso_id: int,
    lote_id: int | None,
    cliente: str,
    lote_nombre: str | None,
    apartamentos: str,
    obra1_nombre: str | None,
    obra1_cargo: str | None,
    obra1_firma_base64: str | None,
    obra2_nombre: str | None,
    obra2_cargo: str | None,
    obra2_firma_base64: str | None,
    allstar_nombre: str | None,
    allstar_cargo: str | None,
    allstar_firma_base64: str | None,
    comentario: str | None,
    content_type: str | None,
) -> Any:
    if not pdf_bytes:
        raise RuntimeError("El archivo PDF llego vacio.")

    def _upload_sync() -> dict[str, Any]:
        from src.services.tablet.carpentry_legacy.azure_blob import subir_acta_pdf_a_blob

        return subir_acta_pdf_a_blob(
            pdf_bytes=pdf_bytes,
            nombre_archivo=nombre_archivo,
            lote_proceso_id=lote_proceso_id,
            lote_id=lote_id,
        )

    blob_info = await run_in_threadpool(_upload_sync)
    mensaje_acta = (
        "ALL STAR COLOMBIA S.A.S. certifica mediante la presente acta que se realizo "
        f"la entrega material de las partes correspondientes a los apartamentos {apartamentos}, "
        f"pertenecientes al lote {lote_nombre or 'Lote no registrado'}, "
        f"al cliente {cliente}."
    )

    return await call_db_function(
        "guardar_acta_entrega_cliente",
        lote_proceso_id=lote_proceso_id,
        lote_id=lote_id,
        cliente=cliente,
        lote_nombre=lote_nombre,
        apartamentos=apartamentos,
        mensaje=mensaje_acta,
        obra1_nombre=obra1_nombre,
        obra1_cargo=obra1_cargo,
        obra1_firma_base64=obra1_firma_base64,
        obra2_nombre=obra2_nombre,
        obra2_cargo=obra2_cargo,
        obra2_firma_base64=obra2_firma_base64,
        allstar_nombre=allstar_nombre,
        allstar_cargo=allstar_cargo,
        allstar_firma_base64=allstar_firma_base64,
        comentario=comentario,
        nombre_archivo=nombre_archivo,
        tipo_archivo=content_type or "application/pdf",
        azure_container=blob_info["container"],
        azure_blob_name=blob_info["blob_name"],
        azure_blob_url=blob_info["blob_url"],
        hash_sha256=blob_info["hash_sha256"],
    )


async def download_acta_pdf(acta_id: int) -> tuple[bytes, str]:
    acta = await call_db_function("get_acta_entrega_cliente_por_id", acta_id=acta_id)
    if not acta:
        raise RuntimeError("No se encontro el acta solicitada.")

    container_name = acta.get("azure_container") or settings.AZURE_STORAGE_CONTAINER_ACTAS
    blob_name = acta.get("azure_blob_name")
    filename = acta.get("nombre_archivo") or f"acta_cliente_{acta_id}.pdf"
    if not blob_name:
        raise RuntimeError("El acta no tiene archivo asociado en Azure.")
    if not container_name:
        raise RuntimeError("El acta no tiene contenedor Azure asociado.")

    return await run_in_threadpool(
        _download_blob_bytes_sync,
        container_name=container_name,
        blob_name=blob_name,
    ), filename


async def upload_plano_proyecto(
    *,
    pdf_bytes: bytes,
    proyecto_id: int,
    lote_id: int | None,
    proyecto_nombre: str | None,
    lote_nombre: str | None,
    cliente: str | None,
    nombre_plano: str,
    descripcion: str | None,
    usuario: str | None,
    filename: str,
) -> Any:
    nombre_archivo = _safe_filename(filename or f"{nombre_plano}.pdf")
    hash_sha256 = hashlib.sha256(pdf_bytes).hexdigest()
    azure_data = await run_in_threadpool(
        _upload_plano_pdf_to_azure_sync,
        pdf_bytes=pdf_bytes,
        nombre_archivo=nombre_archivo,
        proyecto_id=proyecto_id,
        lote_id=lote_id,
    )

    return await call_db_function(
        "guardar_plano_proyecto",
        proyecto_id=proyecto_id,
        lote_id=lote_id,
        proyecto_nombre=proyecto_nombre,
        lote_nombre=lote_nombre,
        cliente=cliente,
        nombre_plano=nombre_plano,
        descripcion=descripcion,
        nombre_archivo=nombre_archivo,
        tipo_archivo="application/pdf",
        azure_container=azure_data["container"],
        azure_blob_name=azure_data["blob_name"],
        azure_blob_url=azure_data["blob_url"],
        hash_sha256=hash_sha256,
        usuario=usuario or "tablet",
    )


async def download_plano_pdf(plano_id: int) -> tuple[bytes, str]:
    result = await call_db_function("get_plano_proyecto_por_id", plano_id=plano_id)
    if not result.get("ok"):
        raise RuntimeError("No se encontro el plano indicado.")

    plano = result.get("plano") or {}
    container_name = plano.get("azure_container")
    blob_name = plano.get("azure_blob_name")
    filename = plano.get("nombre_archivo") or f"plano_{plano_id}.pdf"
    if not container_name or not blob_name:
        raise RuntimeError("El plano no tiene archivo asociado en Azure.")

    pdf_bytes = await run_in_threadpool(
        _download_blob_bytes_sync,
        container_name=container_name,
        blob_name=blob_name,
    )
    if not pdf_bytes:
        raise RuntimeError("El archivo PDF esta vacio o no se pudo descargar.")
    return pdf_bytes, filename
