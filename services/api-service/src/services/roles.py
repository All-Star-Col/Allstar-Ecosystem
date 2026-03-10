from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from src.schemas.models import Role
from src.core.logging_config import get_logger
logger = get_logger(__name__)

async def get_role(db: AsyncSession, username:str) -> Optional[Role]:
    q = text("""
        SELECT r.id, r.name, r.description
        FROM auth.roles r
        JOIN auth.user_roles ur ON ur.role_id = r.id
        JOIN auth.users u ON u.id = ur.user_id
        WHERE u.username = :username
        LIMIT 1
    """)
    r = await db.execute(q, {"username": username})
    row = r.mappings().first()
    if not row:
        return None

    return Role(
        id=row["id"],
        name=row["name"],
        description=row["description"]
    )