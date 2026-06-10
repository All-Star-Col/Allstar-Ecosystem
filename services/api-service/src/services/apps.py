from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.schemas.models import App

logger = get_logger(__name__)


async def get_user_apps_from_db(db: AsyncSession, user_id: str) -> list[App]:
    query_role = text("""
        SELECT ur.role_id, r.code AS role_code
        FROM auth.user_roles ur
        JOIN auth.roles r ON r.id = ur.role_id
        WHERE ur.user_id = :id
        ORDER BY ur.granted_at DESC NULLS LAST
        LIMIT 1
    """)
    r_role = await db.execute(query_role, {"id": user_id})
    role_row = r_role.mappings().first()

    if role_row is None:
        return []

    role_id = role_row["role_id"]
    role_code = str(role_row["role_code"] or "").upper()

    if role_code == "ADMIN":
        query_apps = text("""
            SELECT a.id, a.name, a.description, a.path, a.external_url, a.icon_key, a.icon_bg_color, a.badge_color
            FROM workspace.apps a
            WHERE COALESCE(a.is_active, true) = true
            ORDER BY COALESCE(a.sort_order, 0), a.name, a.id
        """)

        r_apps = await db.execute(query_apps)
        rows = r_apps.mappings().all()

        return [App(**row) for row in rows]

    query_apps = text("""
        SELECT a.id, a.name, a.description, a.path, a.external_url, a.icon_key, a.icon_bg_color, a.badge_color
        FROM workspace.apps a
        JOIN workspace.role_apps ra ON ra.app_id = a.id
        WHERE ra.role_id = :role_id
          AND COALESCE(ra.can_view, false) = true
          AND COALESCE(a.is_active, true) = true
        ORDER BY COALESCE(a.sort_order, 0), a.name, a.id
    """)

    r_apps = await db.execute(query_apps, {"role_id": str(role_id)})
    rows = r_apps.mappings().all()

    return [App(**row) for row in rows]
