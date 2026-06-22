from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.schemas.models import (
    Role,
    RoleAppPermission,
    RoleFormPermission,
    RolePermissionsResponse,
    RolePermissionsUpdateRequest,
    RoleTablePermission,
)
from src.services.data_viewer import DataViewerService

logger = get_logger(__name__)


class RoleNotFoundError(ValueError):
    pass


class UserNotFoundError(ValueError):
    pass


class RoleTablesUnavailableError(RuntimeError):
    pass


class RoleFormsUnavailableError(RuntimeError):
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


async def _ensure_role_data_viewer_tables_table(db: AsyncSession) -> None:
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS workspace.role_data_viewer_tables (
                role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
                table_id TEXT NOT NULL,
                visible BOOLEAN NOT NULL DEFAULT false,
                can_edit BOOLEAN NOT NULL DEFAULT false,
                can_create BOOLEAN NOT NULL DEFAULT false,
                can_release_order_process BOOLEAN NOT NULL DEFAULT false,
                granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (role_id, table_id)
            )
            """
        )
    )
    await db.execute(
        text(
            """
            ALTER TABLE workspace.role_data_viewer_tables
            ADD COLUMN IF NOT EXISTS can_release_order_process BOOLEAN NOT NULL DEFAULT false
            """
        )
    )


async def _resolve_role_data_viewer_tables_columns(
    db: AsyncSession,
) -> dict[str, str | bool] | None:
    try:
        await _ensure_role_data_viewer_tables_table(db)
    except Exception as error:
        logger.warning("workspace.role_data_viewer_tables is not available: %s", error)
        return None

    q = text(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'workspace'
          AND table_name = 'role_data_viewer_tables'
    """
    )
    result = await db.execute(q)
    column_names = {row["column_name"] for row in result.mappings().all()}

    if not {
        "role_id",
        "table_id",
        "visible",
        "can_edit",
        "can_create",
        "can_release_order_process",
    }.issubset(column_names):
        logger.warning(
            "workspace.role_data_viewer_tables exists but required columns are missing"
        )
        return None

    return {
        "visible": "visible",
        "can_edit": "can_edit",
        "can_create": "can_create",
        "can_release_order_process": "can_release_order_process",
        "has_granted_at": "granted_at" in column_names,
    }


async def _ensure_role_forms_table(db: AsyncSession) -> None:
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS workspace.role_forms (
                role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
                table_id INTEGER NOT NULL REFERENCES workspace.ui_config_tablas(id) ON DELETE CASCADE,
                can_view BOOLEAN NOT NULL DEFAULT false,
                granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (role_id, table_id)
            )
            """
        )
    )


async def _resolve_role_forms_columns(
    db: AsyncSession,
) -> dict[str, str | bool] | None:
    try:
        await _ensure_role_forms_table(db)
    except Exception as error:
        logger.warning("workspace.role_forms is not available: %s", error)
        return None

    q = text(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'workspace'
          AND table_name = 'role_forms'
    """
    )
    result = await db.execute(q)
    column_names = {row["column_name"] for row in result.mappings().all()}

    if not {"role_id", "table_id", "can_view"}.issubset(column_names):
        logger.warning(
            "workspace.role_forms exists but role_id/table_id/can_view columns are missing"
        )
        return None

    return {
        "can_view": "can_view",
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

    role_data_viewer_tables_columns = await _resolve_role_data_viewer_tables_columns(db)
    role_tables_columns = await _resolve_role_tables_columns(db)
    table_permissions: list[RoleTablePermission] = []

    if role_data_viewer_tables_columns:
        visible_column = _quote_identifier(
            str(role_data_viewer_tables_columns["visible"])
        )
        can_edit_column = _quote_identifier(
            str(role_data_viewer_tables_columns["can_edit"])
        )
        can_create_column = _quote_identifier(
            str(role_data_viewer_tables_columns["can_create"])
        )
        can_release_column = _quote_identifier(
            str(role_data_viewer_tables_columns["can_release_order_process"])
        )

        role_permissions_query = text(
            f"""
            SELECT
                CAST(table_id AS TEXT) AS table_id,
                COALESCE({visible_column}, false) AS visible,
                COALESCE({can_edit_column}, false) AS can_edit,
                COALESCE({can_create_column}, false) AS can_create,
                COALESCE({can_release_column}, false) AS can_release_order_process
            FROM workspace.role_data_viewer_tables
            WHERE role_id = :role_id
        """
        )
        role_permission_rows = (
            await db.execute(role_permissions_query, {"role_id": role_id})
        ).mappings().all()
        role_permissions_by_table = {
            str(row["table_id"]).strip(): row
            for row in role_permission_rows
            if row.get("table_id") is not None
        }

        legacy_permissions_by_table: dict[str, object] = {}
        if role_tables_columns:
            legacy_visible_column = _quote_identifier(str(role_tables_columns["visible"]))
            legacy_can_edit_column = _quote_identifier(str(role_tables_columns["can_edit"]))
            legacy_can_create_column = _quote_identifier(
                str(role_tables_columns["can_create"])
            )
            legacy_permissions_query = text(
                f"""
                SELECT
                    CAST(table_id AS TEXT) AS table_id,
                    COALESCE({legacy_visible_column}, false) AS visible,
                    COALESCE({legacy_can_edit_column}, false) AS can_edit,
                    COALESCE({legacy_can_create_column}, false) AS can_create
                FROM workspace.role_tables
                WHERE role_id = :role_id
            """
            )
            legacy_permission_rows = (
                await db.execute(legacy_permissions_query, {"role_id": role_id})
            ).mappings().all()
            legacy_permissions_by_table = {
                str(row["table_id"]).strip(): row
                for row in legacy_permission_rows
                if row.get("table_id") is not None
            }

        data_viewer_tables = await DataViewerService(db).get_table_configs(
            user_id=None,
        )
        table_permissions = [
            RoleTablePermission(
                table_id=table.table_id,
                table_name=table.full_table_name,
                table_label=table.display_name,
                visible=bool(
                    role_permissions_by_table.get(
                        table.table_id,
                        legacy_permissions_by_table.get(table.table_id, {}),
                    ).get("visible", False)
                ),
                can_edit=bool(
                    role_permissions_by_table.get(
                        table.table_id,
                        legacy_permissions_by_table.get(table.table_id, {}),
                    ).get("can_edit", False)
                ),
                can_create=bool(
                    role_permissions_by_table.get(
                        table.table_id,
                        legacy_permissions_by_table.get(table.table_id, {}),
                    ).get("can_create", False)
                ),
                can_release_order_process=bool(
                    role_permissions_by_table.get(
                        table.table_id,
                        legacy_permissions_by_table.get(table.table_id, {}),
                    ).get("can_release_order_process", False)
                ),
            )
            for table in data_viewer_tables
        ]

    role_forms_columns = await _resolve_role_forms_columns(db)
    form_permissions: list[RoleFormPermission] = []
    if role_forms_columns:
        can_view_column = _quote_identifier(str(role_forms_columns["can_view"]))
        role_forms_query = text(
            f"""
            SELECT
                cfg.id AS table_id,
                cfg.nombre_tabla_sql AS table_name,
                cfg.nombre_tabla_ui AS form_label,
                COALESCE(rf.{can_view_column}, false) AS can_view
            FROM workspace.ui_config_tablas cfg
            LEFT JOIN workspace.role_forms rf
                ON rf.table_id = cfg.id
               AND rf.role_id = :role_id
            WHERE cfg.es_visible = true
            ORDER BY cfg.id
            """
        )
        form_rows = (
            await db.execute(role_forms_query, {"role_id": role_id})
        ).mappings().all()
        form_permissions = [
            RoleFormPermission(
                table_id=row["table_id"],
                table_name=row["table_name"],
                form_label=row["form_label"],
                can_view=row["can_view"],
            )
            for row in form_rows
        ]

    return RolePermissionsResponse(
        role_id=role_id,
        apps=app_permissions,
        tables=table_permissions,
        forms=form_permissions,
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

    role_data_viewer_tables_columns = await _resolve_role_data_viewer_tables_columns(db)

    if data.tables and role_data_viewer_tables_columns is None:
        raise RoleTablesUnavailableError(
            "workspace.role_data_viewer_tables no está disponible; crea la tabla antes de guardar permisos de tablas."
        )

    table_permission_query = None
    if role_data_viewer_tables_columns:
        visible_column = _quote_identifier(
            str(role_data_viewer_tables_columns["visible"])
        )
        can_edit_column = _quote_identifier(
            str(role_data_viewer_tables_columns["can_edit"])
        )
        can_create_column = _quote_identifier(
            str(role_data_viewer_tables_columns["can_create"])
        )
        can_release_column = _quote_identifier(
            str(role_data_viewer_tables_columns["can_release_order_process"])
        )
        has_granted_at = bool(role_data_viewer_tables_columns["has_granted_at"])

        insert_columns = [
            "role_id",
            "table_id",
            visible_column,
            can_edit_column,
            can_create_column,
            can_release_column,
        ]
        insert_values = [
            ":role_id",
            ":table_id",
            ":visible",
            ":can_edit",
            ":can_create",
            ":can_release_order_process",
        ]
        update_assignments = [
            f"{visible_column} = EXCLUDED.{visible_column}",
            f"{can_edit_column} = EXCLUDED.{can_edit_column}",
            f"{can_create_column} = EXCLUDED.{can_create_column}",
            f"{can_release_column} = EXCLUDED.{can_release_column}",
        ]

        if has_granted_at:
            insert_columns.append("granted_at")
            insert_values.append("NOW()")
            update_assignments.append("granted_at = NOW()")

        table_permission_query = text(
            f"""
            INSERT INTO workspace.role_data_viewer_tables ({", ".join(insert_columns)})
            VALUES ({", ".join(insert_values)})
            ON CONFLICT (role_id, table_id)
            DO UPDATE SET {", ".join(update_assignments)}
        """
        )

    role_forms_columns = await _resolve_role_forms_columns(db)
    if data.forms and role_forms_columns is None:
        raise RoleFormsUnavailableError(
            "workspace.role_forms no está disponible; crea la tabla antes de guardar permisos de formularios."
        )

    form_permission_query = None
    if role_forms_columns:
        can_view_column = _quote_identifier(str(role_forms_columns["can_view"]))
        has_granted_at = bool(role_forms_columns["has_granted_at"])
        insert_columns = ["role_id", "table_id", can_view_column]
        insert_values = [":role_id", ":table_id", ":can_view"]
        update_assignments = [f"{can_view_column} = EXCLUDED.{can_view_column}"]
        if has_granted_at:
            insert_columns.append("granted_at")
            insert_values.append("NOW()")
            update_assignments.append("granted_at = NOW()")

        form_permission_query = text(
            f"""
            INSERT INTO workspace.role_forms ({", ".join(insert_columns)})
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
                        "table_id": str(permission.table_id),
                        "visible": permission.visible,
                        "can_edit": permission.can_edit,
                        "can_create": permission.can_create,
                        "can_release_order_process": permission.can_release_order_process,
                    },
                )

        if form_permission_query is not None:
            for permission in data.forms:
                await db.execute(
                    form_permission_query,
                    {
                        "role_id": role_id,
                        "table_id": permission.table_id,
                        "can_view": permission.can_view,
                    },
                )

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return await get_role_permissions(db=db, role_id=role_id)
