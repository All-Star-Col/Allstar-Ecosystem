from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from src.schemas.models import App
from src.core.logging_config import get_logger
logger = get_logger(__name__)


# src/services/apps.py
async def get_user_apps_from_db(db: AsyncSession, user_id: str) -> list[App]:
    # Corregido: Usamos user_id (el parámetro), no current_user.id
    query_role = text("""SELECT role_id FROM auth.user_roles WHERE user_id = :id""")
    r_role = await db.execute(query_role, {"id": user_id})
    role_row = r_role.mappings().first()

    if role_row is None:
        return []
    role_id = role_row["role_id"]

    query_apps = text("""
        SELECT a.id, a.name, a.description, a.path, a.external_url, a.icon_key, a.icon_bg_color, a.badge_color
        FROM workspace.apps a
        JOIN workspace.role_apps ra ON ra.app_id = a.id
        WHERE ra.role_id = :role_id
    """)

    r_apps = await db.execute(query_apps, {"role_id": str(role_id)})
    rows = r_apps.mappings().all()

    return [App(**row) for row in rows]

