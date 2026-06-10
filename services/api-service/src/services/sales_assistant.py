import hashlib
import imaplib
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime
from email import message_from_bytes
from email.header import decode_header
from email.message import Message
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


ORDER_KEYWORDS = (
    "orden de compra",
    "purchase order",
    "pedido",
    "orden",
    " oc ",
)
ALLOWED_ATTACHMENT_EXTENSIONS = {
    ".pdf",
    ".xlsx",
    ".xls",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
}
INITIAL_STATUS = "PENDIENTE_REVISION"
INITIAL_OBSERVATION = "Preorden creada desde correo. Pendiente extracción IA."
PREORDERS_TABLE_NAME = "preordenes_compra"


class SalesAssistantConfigError(RuntimeError):
    pass


class SalesAssistantAIError(RuntimeError):
    pass


@dataclass(frozen=True)
class EmailConfig:
    host: str
    port: int
    user: str
    password: str
    attachments_dir: Path


def _get_email_config() -> EmailConfig:
    missing = [
        key
        for key in ("EMAIL_USER", "EMAIL_PASSWORD")
        if not os.getenv(key)
    ]
    if missing:
        raise SalesAssistantConfigError(
            "Faltan variables de entorno de correo: " + ", ".join(missing)
        )

    email_host = os.getenv("EMAIL_HOST") or "imap.gmail.com"
    email_port_raw = os.getenv("EMAIL_PORT") or "993"
    attachments_dir = Path(os.getenv("ATTACHMENTS_DIR") or "./adjuntos_oc")
    attachments_dir.mkdir(parents=True, exist_ok=True)

    return EmailConfig(
        host=email_host,
        port=int(email_port_raw),
        user=os.getenv("EMAIL_USER", ""),
        password=os.getenv("EMAIL_PASSWORD", ""),
        attachments_dir=attachments_dir,
    )


def decode_header_text(value: str | None) -> str:
    if not value:
        return ""

    parts: list[str] = []
    for raw_part, encoding in decode_header(value):
        if isinstance(raw_part, bytes):
            charset = encoding or "utf-8"
            try:
                parts.append(raw_part.decode(charset, errors="replace"))
            except LookupError:
                parts.append(raw_part.decode("utf-8", errors="replace"))
        else:
            parts.append(raw_part)
    return "".join(parts).strip()


def clean_spaces(value: str) -> str:
    lines = [line.strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line)


def clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    return clean_spaces(soup.get_text(separator="\n"))


def _decode_payload(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        raw_payload = part.get_payload()
        return raw_payload if isinstance(raw_payload, str) else ""

    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def get_email_body(msg: Message) -> str:
    plain_parts: list[str] = []
    html_parts: list[str] = []

    if msg.is_multipart():
        for part in msg.walk():
            disposition = str(part.get("Content-Disposition", "")).lower()
            if "attachment" in disposition:
                continue

            content_type = part.get_content_type()
            if content_type == "text/plain":
                plain_parts.append(clean_spaces(_decode_payload(part)))
            elif content_type == "text/html":
                html_parts.append(clean_html(_decode_payload(part)))
    elif msg.get_content_type() == "text/html":
        html_parts.append(clean_html(_decode_payload(msg)))
    else:
        plain_parts.append(clean_spaces(_decode_payload(msg)))

    plain = "\n\n".join(part for part in plain_parts if part).strip()
    if plain:
        return plain
    return "\n\n".join(part for part in html_parts if part).strip()


def subject_looks_like_purchase_order(subject: str) -> bool:
    normalized = f" {subject.lower()} "
    normalized = re.sub(r"[\s\-_./]+", " ", normalized)
    return any(keyword in normalized for keyword in ORDER_KEYWORDS)


def generate_email_id(msg: Message, body: str) -> str:
    message_id = decode_header_text(msg.get("Message-ID"))
    if message_id:
        return message_id[:255]

    fingerprint = "|".join(
        [
            decode_header_text(msg.get("From")),
            decode_header_text(msg.get("Subject")),
            decode_header_text(msg.get("Date")),
            body[:1000],
        ]
    )
    return hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()


def _safe_attachment_name(filename: str) -> str:
    decoded = decode_header_text(filename)
    name = Path(decoded).name.strip()
    name = re.sub(r"[^A-Za-z0-9._ -]+", "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name or "adjunto"


def save_allowed_attachments(
    msg: Message,
    attachments_dir: Path,
    email_id: str,
) -> list[str]:
    saved_paths: list[str] = []
    email_hash = hashlib.sha256(email_id.encode("utf-8")).hexdigest()[:16]
    email_dir = attachments_dir / email_hash
    email_dir.mkdir(parents=True, exist_ok=True)

    for index, part in enumerate(msg.walk(), start=1):
        filename = part.get_filename()
        if not filename:
            continue

        safe_name = _safe_attachment_name(filename)
        extension = Path(safe_name).suffix.lower()
        if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
            continue

        payload = part.get_payload(decode=True)
        if not payload:
            continue

        destination = email_dir / safe_name
        if destination.exists():
            destination = email_dir / f"{destination.stem}_{index}{extension}"

        destination.write_bytes(payload)
        saved_paths.append(str(destination))

    return saved_paths


def _parse_email_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError, OverflowError):
        return None


async def _preorders_columns(db: AsyncSession) -> set[str]:
    table_schema = await _resolve_preorders_schema(db)
    result = await db.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'preordenes_compra'
              AND table_schema = :table_schema
            """
        ),
        {"table_schema": table_schema},
    )
    return {row["column_name"] for row in result.mappings().all()}


async def _resolve_preorders_schema(db: AsyncSession) -> str:
    result = await db.execute(
        text(
            """
            SELECT table_schema
            FROM information_schema.tables
            WHERE table_name = :table_name
              AND table_type = 'BASE TABLE'
              AND table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY
                CASE table_schema
                    WHEN 'public' THEN 0
                    WHEN 'data' THEN 1
                    ELSE 2
                END,
                table_schema
            LIMIT 1
            """
        ),
        {"table_name": PREORDERS_TABLE_NAME},
    )
    schema = result.scalar_one_or_none()
    if not schema:
        raise SalesAssistantConfigError(
            "No existe la tabla preordenes_compra en PostgreSQL."
        )
    return str(schema)


async def _preorders_table_sql(db: AsyncSession) -> str:
    schema = (await _resolve_preorders_schema(db)).replace('"', '""')
    table = PREORDERS_TABLE_NAME.replace('"', '""')
    return f'"{schema}"."{table}"'


async def preorder_exists(db: AsyncSession, email_id: str) -> bool:
    table_sql = await _preorders_table_sql(db)
    result = await db.execute(
        text(
            f"""
            SELECT 1
            FROM {table_sql}
            WHERE correo_id = :correo_id
            LIMIT 1
            """
        ),
        {"correo_id": email_id},
    )
    return result.scalar_one_or_none() is not None


async def insert_preorder_from_email(
    db: AsyncSession,
    *,
    email_id: str,
    sender: str,
    subject: str,
    email_date: datetime | None,
    body: str,
    attachment_paths: list[str],
) -> None:
    extracted_json = {
        "origen": "correo",
        "remitente": sender,
        "asunto": subject,
        "fecha_correo": email_date.isoformat() if email_date else None,
        "cuerpo": body[:5000],
        "adjuntos": attachment_paths,
        "extraccion_ia": None,
    }
    values: dict[str, Any] = {
        "correo_id": email_id,
        "remitente": sender,
        "asunto": subject,
        "fecha_correo": email_date,
        "estado": INITIAL_STATUS,
        "json_extraido": json.dumps(extracted_json),
        "observaciones_ia": INITIAL_OBSERVATION,
        "archivo_fuente_url": attachment_paths[0] if attachment_paths else None,
    }
    existing_columns = await _preorders_columns(db)
    table_sql = await _preorders_table_sql(db)
    filtered_values = {
        column: value for column, value in values.items() if column in existing_columns
    }

    if "correo_id" not in filtered_values:
        raise SalesAssistantConfigError(
            "preordenes_compra necesita la columna correo_id para evitar duplicados."
        )

    columns_sql = ", ".join(filtered_values.keys())
    params_sql = ", ".join(f":{column}" for column in filtered_values)
    await db.execute(
        text(
            f"""
            INSERT INTO {table_sql} ({columns_sql})
            VALUES ({params_sql})
            """
        ),
        filtered_values,
    )


def _connect_mail(config: EmailConfig) -> imaplib.IMAP4_SSL:
    mail = imaplib.IMAP4_SSL(config.host, config.port)
    mail.login(config.user, config.password)
    mail.select("INBOX")
    return mail


def _fetch_message(mail: imaplib.IMAP4_SSL, email_num: bytes) -> Message:
    status, data = mail.fetch(email_num, "(BODY.PEEK[])")
    if status != "OK" or not data:
        raise RuntimeError(f"No se pudo leer el correo IMAP {email_num!r}.")
    raw_email = next(
        (item[1] for item in data if isinstance(item, tuple) and item[1]),
        None,
    )
    if raw_email is None:
        raise RuntimeError(f"Respuesta IMAP vacía para correo {email_num!r}.")
    return message_from_bytes(raw_email)


async def import_purchase_order_emails(
    db: AsyncSession,
    *,
    max_emails: int = 20,
) -> dict[str, int]:
    config = _get_email_config()
    summary = {
        "preordenes_creadas": 0,
        "correos_ignorados": 0,
        "duplicados": 0,
        "errores": 0,
    }
    mail: imaplib.IMAP4_SSL | None = None

    try:
        mail = _connect_mail(config)
        status, data = mail.search(None, "UNSEEN")
        if status != "OK":
            raise RuntimeError("No fue posible buscar correos no leídos.")

        email_nums = (data[0].split() if data and data[0] else [])[:max_emails]
        for email_num in email_nums:
            try:
                msg = _fetch_message(mail, email_num)
                subject = decode_header_text(msg.get("Subject"))
                if not subject_looks_like_purchase_order(subject):
                    summary["correos_ignorados"] += 1
                    continue

                body = get_email_body(msg)
                email_id = generate_email_id(msg, body)
                if await preorder_exists(db, email_id):
                    summary["duplicados"] += 1
                    continue

                attachment_paths = save_allowed_attachments(
                    msg,
                    config.attachments_dir,
                    email_id,
                )
                await insert_preorder_from_email(
                    db,
                    email_id=email_id,
                    sender=decode_header_text(msg.get("From")),
                    subject=subject,
                    email_date=_parse_email_date(decode_header_text(msg.get("Date"))),
                    body=body,
                    attachment_paths=attachment_paths,
                )
                await db.commit()
                summary["preordenes_creadas"] += 1
            except Exception:
                await db.rollback()
                summary["errores"] += 1
    finally:
        if mail:
            try:
                mail.close()
            except imaplib.IMAP4.error:
                pass
            mail.logout()

    return summary


async def list_preorders(db: AsyncSession, *, limit: int = 50) -> list[dict[str, Any]]:
    table_sql = await _preorders_table_sql(db)
    result = await db.execute(
        text(
            f"""
            SELECT *
            FROM {table_sql}
            ORDER BY created_at DESC NULLS LAST, id DESC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    return [dict(row) for row in result.mappings().all()]


async def get_preorder(db: AsyncSession, preorder_id: int) -> dict[str, Any] | None:
    table_sql = await _preorders_table_sql(db)
    result = await db.execute(
        text(f"SELECT * FROM {table_sql} WHERE id = :id LIMIT 1"),
        {"id": preorder_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


def _parse_json_extraido(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _extract_response_text(payload: dict[str, Any]) -> str:
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    chunks: list[str] = []
    for output_item in payload.get("output", []) or []:
        if not isinstance(output_item, dict):
            continue
        for content_item in output_item.get("content", []) or []:
            if isinstance(content_item, dict) and isinstance(content_item.get("text"), str):
                chunks.append(content_item["text"])
    return "\n".join(chunks).strip()


async def extract_purchase_order_ai(
    db: AsyncSession,
    *,
    preorder_id: int,
) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SalesAssistantConfigError("Falta OPENAI_API_KEY para extracción IA.")

    preorder = await get_preorder(db, preorder_id)
    if not preorder:
        raise ValueError("Preorden no encontrada.")

    json_extraido = _parse_json_extraido(preorder.get("json_extraido"))
    email_body = str(json_extraido.get("cuerpo") or "")[:5000]
    subject = str(preorder.get("asunto") or json_extraido.get("asunto") or "")
    sender = str(preorder.get("remitente") or json_extraido.get("remitente") or "")
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "cliente": {"type": ["string", "null"]},
            "oc_cliente": {"type": ["string", "null"]},
            "oc_interno": {"type": ["string", "null"]},
            "fecha_pedido": {"type": ["string", "null"]},
            "observaciones": {"type": ["string", "null"]},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "producto": {"type": ["string", "null"]},
                        "tela": {"type": ["string", "null"]},
                        "cantidad": {"type": ["number", "null"]},
                        "valor_unitario": {"type": ["number", "null"]},
                        "notas": {"type": ["string", "null"]},
                    },
                    "required": [
                        "producto",
                        "tela",
                        "cantidad",
                        "valor_unitario",
                        "notas",
                    ],
                },
            },
            "confianza": {"type": "number"},
            "campos_pendientes": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": [
            "cliente",
            "oc_cliente",
            "oc_interno",
            "fecha_pedido",
            "observaciones",
            "items",
            "confianza",
            "campos_pendientes",
        ],
    }

    prompt = (
        "Extrae una orden de compra del correo. Devuelve solo datos encontrados "
        "o inferencias de baja ambigüedad. Si falta un dato usa null y agrégalo "
        "a campos_pendientes. No inventes productos, cantidades ni precios.\n\n"
        f"Remitente: {sender}\n"
        f"Asunto: {subject}\n"
        f"Cuerpo:\n{email_body}"
    )

    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "input": prompt,
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "purchase_order_extraction",
                        "schema": schema,
                        "strict": True,
                    }
                },
            },
        )

    if response.status_code >= 400:
        raise SalesAssistantAIError(
            f"OpenAI respondió HTTP {response.status_code}: {response.text[:500]}"
        )

    response_payload = response.json()
    response_text = _extract_response_text(response_payload)
    try:
        extraction = json.loads(response_text)
    except json.JSONDecodeError as exc:
        raise SalesAssistantAIError("La IA no devolvió JSON válido.") from exc

    json_extraido["extraccion_ia"] = extraction
    json_extraido["modelo_ia"] = model
    json_extraido["fecha_extraccion_ia"] = datetime.utcnow().isoformat()

    columns = await _preorders_columns(db)
    table_sql = await _preorders_table_sql(db)
    update_values: dict[str, Any] = {
        "id": preorder_id,
        "json_extraido": json.dumps(json_extraido),
    }
    set_parts = ["json_extraido = :json_extraido"]
    if "estado" in columns:
        set_parts.append("estado = :estado")
        update_values["estado"] = "EXTRAIDA_IA"
    if "observaciones_ia" in columns:
        set_parts.append("observaciones_ia = :observaciones_ia")
        update_values["observaciones_ia"] = (
            "Extracción IA completada. Pendiente revisión y aprobación humana."
        )

    await db.execute(
        text(
            f"""
            UPDATE {table_sql}
            SET {", ".join(set_parts)}
            WHERE id = :id
            """
        ),
        update_values,
    )
    await db.commit()
    return extraction
