from datetime import datetime, timezone
from sqlalchemy import text, Table, Column, Integer, String, Numeric, Text as SAText, MetaData
from sqlalchemy.ext.asyncio import AsyncSession


from src.services.forms import DBCommunicationError
from src.core.logging_config import get_logger
logger = get_logger(__name__)

metadata = MetaData()

# Tabla para correos (si decides usarla en el futuro)
email_data = Table(
    "email_data",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("subject", String(500), nullable=False),
    Column("sender", String(255), nullable=False),
    Column("date", String(500), nullable=False),
    Column("valor_unidad", Numeric(12, 2), nullable=True),
    Column("detalle", SAText, nullable=True),
    Column("cliente", String(255), nullable=True),
    Column("producto", String(255), nullable=True),
    Column("referencia", String(255), nullable=True),
    Column("modelo", String(255), nullable=True),
    Column("tela", String(255), nullable=True),
    Column("creado_en", String(100), default=lambda: datetime.now(timezone.utc).isoformat()),
    Column("status", String(50), server_default=text("'nuevo'")),
)

def safe_float(value, default=0.0):
    if value is None or value == "" or value == "null":
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

async def save_email(db: AsyncSession, payload) -> str:
    correlation_id = f"em_{int(datetime.now(timezone.utc).timestamp())}"
    email_dict = payload.model_dump()
    ai = email_dict.get("data") or {}
    valor = safe_float(ai.get("valor_unidad"))

    query = text("""
        INSERT INTO email_data (
            subject, sender, date, valor_unidad, detalle,
            cliente, producto, referencia, modelo, tela
        ) VALUES (
            :subject, :sender, :date, :valor, :detalle,
            :cliente, :producto, :referencia, :modelo, :tela
        )
    """)

    try:
        await db.execute(query, {
            "subject": email_dict["subject"],
            "sender": email_dict["sender"],
            "date": email_dict["date"],
            "valor": valor,
            "detalle": ai.get("detalle"),
            "cliente": ai.get("cliente"),
            "producto": ai.get("producto"),
            "referencia": ai.get("referencia"),
            "modelo": ai.get("modelo"),
            "tela": ai.get("tela"),
        })
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise DBCommunicationError(f"Error guardando email: {e}")

    return correlation_id

async def all_missing(db: AsyncSession):
    try:
        query = text("SELECT * FROM email_data WHERE status = 'nuevo'")
        result = await db.execute(query)
        return [dict(row) for row in result.mappings()]
    except Exception as e:
        raise DBCommunicationError(f"Error consultando pendientes: {e}")
