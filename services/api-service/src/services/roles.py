from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.schemas.models import (
    Role,
    RoleAppPermission,
    RolePermissionsResponse,
    RolePermissionsUpdateRequest,
    RoleTablePermission,
)

logger = get_logger(__name__)


class RoleNotFoundError(ValueError):
    pass


class UserNotFoundError(ValueError):
    pass


class RoleTablesUnavailableError(RuntimeError):
    pass


def _quote_identifier(identifier: str) -> str:
    safe_identifier = identifier.replace('"', '""')
    return f'"{safe_identifier}"'


async def _role_exists(db: AsyncSession, role_id: UUID) -> bool:
    q = text("SELECT 1 FROM auth.roles WHERE id = :role_id LIMIT 1")
    result = await db.execute(q, {"role_id": role_id})
    return result.scalar_one_or_none() is not None


async def _user_exists(db: AsyncSession, user_id: UUID) -> bool:
    q = text("SELECT 1 FROM auth.users WHERE id = :user_id LIMIT 1")
    result = await db.execute(q, {"user_id": user_id})
    return result.scalar_one_or_none() is not None


async def _resolve_role_tables_columns(
    db: AsyncSession,
) -> dict[str, str | bool] | None:
    q = text(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'workspace'
          AND table_name = 'role_tables'
    """
    )
    result = await db.execute(q)
    column_names = {row["column_name"] for row in result.mappings().all()}

    if not column_names:
        return None

    if not {"role_id", "table_id"}.issubset(column_names):
        logger.warning(
            "workspace.role_tables exists but is missing role_id/table_id columns"
        )
        return None

    visible_column = "visible" if "visible" in column_names else None
    can_edit_column = "can_edit" if "can_edit" in column_names else None
    can_create_column = "can_create" if "can_create" in column_names else None

    if can_edit_column is None and "edit" in column_names:
        can_edit_column = "edit"
    if can_create_column is None and "create" in column_names:
        can_create_column = "create"

    if not visible_column or not can_edit_column or not can_create_column:
        logger.warning(
            "workspace.role_tables exists but visibility/edit/create columns are missing"
        )
        return None

    return {
        "visible": visible_column,
        "can_edit": can_edit_column,
        "can_create": can_create_column,
        "has_granted_at": "granted_at" in column_names,
    }


async def get_role(db: AsyncSession, username: str) -> Optional[Role]:
    q = text(
        """
        SELECT r.id, r.code, r.name, r.description
        FROM auth.roles r
        JOIN auth.user_roles ur ON ur.role_id = r.id
        JOIN auth.users u ON u.id = ur.user_id
        WHERE u.username = :username
        ORDER BY ur.granted_at DESC NULLS LAST
        LIMIT 1
    """
    )
    r = await db.execute(q, {"username": username})
    row = r.mappings().first()
    if not row:
        return None

    return Role(
        id=row["id"],
        code=row["code"],
        name=row["name"],
        description=row["description"],
    )


async def list_active_roles(db: AsyncSession) -> list[Role]:
    q = text(
        """
        SELECT id, code, name, description
        FROM auth.roles
        WHERE is_active = true
        ORDER BY name ASC
    """
    )
    result = await db.execute(q)
    rows = result.mappings().all()
    return [
        Role(
            id=row["id"],
            code=row["code"],
            name=row["name"],
            description=row["description"],
        )
        for row in rows
    ]


async def get_user_role_by_user_id(db: AsyncSession, user_id: UUID) -> Optional[Role]:
    if not await _user_exists(db, user_id):
        raise UserNotFoundError("User not found")

    q = text(
        """
        SELECT r.id, r.code, r.name, r.description
        FROM auth.user_roles ur
        JOIN auth.roles r ON r.id = ur.role_id
        WHERE ur.user_id = :user_id
        ORDER BY ur.granted_at DESC NULLS LAST
        LIMIT 1
    """
    )
    result = await db.execute(q, {"user_id": user_id})
    row = result.mappings().first()
    if not row:
        return None

    return Role(
        id=row["id"],
        code=row["code"],
        name=row["name"],
        description=row["description"],
    )


async def assign_user_role(db: AsyncSession, user_id: UUID, role_id: UUID) -> Role:
    if not await _user_exists(db, user_id):
        raise UserNotFoundError("User not found")

    role_query = text(
        """
        SELECT id, code, name, description
        FROM auth.roles
        WHERE id = :role_id
          AND is_active = true
        LIMIT 1
    """
    )
    role_result = await db.execute(role_query, {"role_id": role_id})
    role_row = role_result.mappings().first()
    if not role_row:
        raise RoleNotFoundError("Role not found")

    try:
        await db.execute(
            text("DELETE FROM auth.user_roles WHERE user_id = :user_id"),
            {"user_id": user_id},
        )
        await db.execute(
            text(
                """
                INSERT INTO auth.user_roles (user_id, role_id, granted_at)
                VALUES (:user_id, :role_id, NOW())
            """
            ),
            {"user_id": user_id, "role_id": role_id},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return Role(
        id=role_row["id"],
        code=role_row["code"],
        name=role_row["name"],
        description=role_row["description"],
    )


async def get_role_permissions(
    db: AsyncSession, role_id: UUID
) -> RolePermissionsResponse:
    if not await _role_exists(db, role_id):
        raise RoleNotFoundError("Role not found")

    app_permissions_query = text(
        """
        SELECT
            a.id AS app_id,
            a.name AS app_name,
            a.description AS app_description,
            a.path AS app_path,
            COALESCE(ra.can_view, false) AS can_view
        FROM workspace.apps a
        LEFT JOIN workspace.role_apps ra
            ON ra.app_id = a.id
           AND ra.role_id = :role_id
        WHERE a.is_active = true
        ORDER BY a.sort_order ASC, a.name ASC, a.id ASC
    """
    )
    app_rows = (
        await db.execute(app_permissions_query, {"role_id": role_id})
    ).mappings().all()
    app_permissions = [
        RoleAppPermission(
            app_id=row["app_id"],
            app_name=row["app_name"],
            app_description=row["app_description"],
            app_path=row["app_path"],
            can_view=row["can_view"],
        )
        for row in app_rows
    ]

    role_tables_columns = await _resolve_role_tables_columns(db)
    table_permissions: list[RoleTablePermission] = []

    if role_tables_columns:
        visible_column = _quote_identifier(str(role_tables_columns["visible"]))
        can_edit_column = _quote_identifier(str(role_tables_columns["can_edit"]))
        can_create_column = _quote_identifier(str(role_tables_columns["can_create"]))

        role_tables_query = text(
            f"""
            SELECT
                cfg.id AS table_id,
                cfg.nombre_tabla_sql AS table_name,
                cfg.nombre_tabla_ui AS table_label,
                COALESCE(rt.{visible_column}, false) AS visible,
                COALESCE(rt.{can_edit_column}, false) AS can_edit,
                COALESCE(rt.{can_create_column}, false) AS can_create
            FROM workspace.ui_config_tablas cfg
            LEFT JOIN workspace.role_tables rt
                ON rt.table_id = cfg.id
               AND rt.role_id = :role_id
            ORDER BY cfg.id
        """
        )
        table_rows = (
            await db.execute(role_tables_query, {"role_id": role_id})
        ).mappings().all()
        table_permissions = [
            RoleTablePermission(
                table_id=row["table_id"],
                table_name=row["table_name"],
                table_label=row["table_label"],
                visible=row["visible"],
                can_edit=row["can_edit"],
                can_create=row["can_create"],
            )
            for row in table_rows
        ]
    else:
        ui_tables_query = text(
            """
            SELECT id AS table_id, nombre_tabla_sql AS table_name, nombre_tabla_ui AS table_label
            FROM workspace.ui_config_tablas
            ORDER BY id
        """
        )
        ui_table_rows = (await db.execute(ui_tables_query)).mappings().all()
        table_permissions = [
            RoleTablePermission(
                table_id=row["table_id"],
                table_name=row["table_name"],
                table_label=row["table_label"],
                visible=False,
                can_edit=False,
                can_create=False,
            )
            for row in ui_table_rows
        ]

    return RolePermissionsResponse(
        role_id=role_id,
        apps=app_permissions,
        tables=table_permissions,
    )


async def upsert_role_permissions(
    db: AsyncSession,
    role_id: UUID,
    data: RolePermissionsUpdateRequest,
) -> RolePermissionsResponse:
    if not await _role_exists(db, role_id):
        raise RoleNotFoundError("Role not found")

    app_permission_query = text(
        """
        INSERT INTO workspace.role_apps (role_id, app_id, can_view)
        VALUES (:role_id, :app_id, :can_view)
        ON CONFLICT (role_id, app_id)
        DO UPDATE SET can_view = EXCLUDED.can_view
    """
    )

    role_tables_columns = await _resolve_role_tables_columns(db)

    if data.tables and role_tables_columns is None:
        raise RoleTablesUnavailableError(
            "workspace.role_tables no está disponible; crea la tabla antes de guardar permisos de tablas."
        )

    table_permission_query = None
    if role_tables_columns:
        visible_column = _quote_identifier(str(role_tables_columns["visible"]))
        can_edit_column = _quote_identifier(str(role_tables_columns["can_edit"]))
        can_create_column = _quote_identifier(str(role_tables_columns["can_create"]))
        has_granted_at = bool(role_tables_columns["has_granted_at"])

        insert_columns = [
            "role_id",
            "table_id",
            visible_column,
            can_edit_column,
            can_create_column,
        ]
        insert_values = [":role_id", ":table_id", ":visible", ":can_edit", ":can_create"]
        update_assignments = [
            f"{visible_column} = EXCLUDED.{visible_column}",
            f"{can_edit_column} = EXCLUDED.{can_edit_column}",
            f"{can_create_column} = EXCLUDED.{can_create_column}",
        ]

        if has_granted_at:
            insert_columns.append("granted_at")
            insert_values.append("NOW()")
            update_assignments.append("granted_at = NOW()")

        table_permission_query = text(
            f"""
            INSERT INTO workspace.role_tables ({", ".join(insert_columns)})
            VALUES ({", ".join(insert_values)})
            ON CONFLICT (role_id, table_id)
            DO UPDATE SET {", ".join(update_assignments)}
        """
        )

    try:
        for permission in data.apps:
            await db.execute(
                app_permission_query,
                {
                    "role_id": role_id,
                    "app_id": permission.app_id,
                    "can_view": permission.can_view,
                },
            )

        if table_permission_query is not None:
            for permission in data.tables:
                await db.execute(
                    table_permission_query,
                    {
                        "role_id": role_id,
                        "table_id": permission.table_id,
                        "visible": permission.visible,
                        "can_edit": permission.can_edit,
                        "can_create": permission.can_create,
                    },
                )

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return await get_role_permissions(db=db, role_id=role_id)
