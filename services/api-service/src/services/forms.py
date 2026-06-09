import re
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.concurrency import run_in_threadpool

from src.core.logging_config import get_logger
from src.schemas.models import CategoriesForms, ColumnTable, SubmitForm, TableForms

logger = get_logger(__name__)

FORMS_SCHEMA = "data"
IDENTIFIER_REGEX = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")
TEXTUAL_TYPES = {
    "character varying",
    "character",
    "text",
    "citext",
    "varchar",
    "char",
    "name",
}
CHECK_IN_PATTERN = re.compile(
    r'^\(?\s*(?P<column>"?[A-Za-z_][A-Za-z0-9_]*"?)\s*\)?'
    r'(?:\s*::\s*[A-Za-z_][A-Za-z0-9_\.\s"\[\]]*)?'
    r'\s+IN\s*\((?P<values>.+)\)\s*$',
    re.IGNORECASE,
)
CHECK_ANY_ARRAY_PATTERN = re.compile(
    r'^\(?\s*(?P<column>"?[A-Za-z_][A-Za-z0-9_]*"?)\s*\)?'
    r'(?:\s*::\s*[A-Za-z_][A-Za-z0-9_\.\s"\[\]]*)?'
    r'\s*=\s*ANY\s*\(\s*\(*\s*ARRAY\[(?P<values>[^\]]*)\]'
    r'(?:\s*::\s*[A-Za-z_][A-Za-z0-9_\.\s"\[\]]*)?\s*\)*\s*\)\s*$',
    re.IGNORECASE,
)
_QUOTED_LITERAL_PATTERN = re.compile(r"'((?:''|[^'])*)'", re.IGNORECASE)
DEFAULT_LITERAL_WITH_OPTIONAL_CAST_PATTERN = re.compile(
    r"^'(?P<value>(?:''|[^'])*)'"
    r"(?:\s*::\s*[A-Za-z_][A-Za-z0-9_\.\s\"\[\]]*)?$",
    re.IGNORECASE,
)
FK_LABEL_PRIORITY = (
    "nombre",
    "name",
    "descripcion",
    "description",
    "title",
    "label",
    "codigo",
    "code",
)
DEFAULT_LOOKUP_LIMIT = 20
MAX_LOOKUP_LIMIT = 200
TELA_LOOKUP_FIELDS = ("nombre", "referencia")
FINALIZED_STATUS_VALUES = (
    "finalizado",
    "finalizada",
    "finalizados",
    "finalizadas",
    "completado",
    "completada",
    "completados",
    "completadas",
    "terminado",
    "terminada",
    "terminados",
    "terminadas",
)


class DBCommunicationError(Exception):
    """Falla real de comunicacion/almacenamiento."""

    pass


class IdentifierValidationError(Exception):
    def __init__(self, detail: str, invalid_fields: list[str] | None = None):
        self.detail = detail
        self.invalid_fields = invalid_fields or []
        super().__init__(detail)


def _normalize_identifier(identifier: str) -> str:
    return identifier.strip().strip('"')


def _is_fully_wrapped_in_parentheses(expression: str) -> bool:
    if len(expression) < 2 or expression[0] != "(" or expression[-1] != ")":
        return False

    depth = 0
    in_string = False
    index = 0
    while index < len(expression):
        char = expression[index]

        if char == "'":
            if in_string and index + 1 < len(expression) and expression[index + 1] == "'":
                index += 2
                continue
            in_string = not in_string
        elif not in_string:
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth < 0:
                    return False
                if depth == 0 and index != len(expression) - 1:
                    return False

        index += 1

    return depth == 0 and not in_string


def _strip_outer_parentheses(expression: str) -> str:
    normalized = expression.strip()
    while _is_fully_wrapped_in_parentheses(normalized):
        normalized = normalized[1:-1].strip()
    return normalized


def _unwrap_check_definition(definition: str) -> str | None:
    normalized = definition.strip()
    if not normalized:
        return None

    if normalized[:5].upper() == "CHECK":
        normalized = normalized[5:].strip()

    normalized = _strip_outer_parentheses(normalized)
    return normalized or None


def _parse_check_literal_list(raw_values: str) -> list[str] | None:
    values = [
        match.replace("''", "'")
        for match in _QUOTED_LITERAL_PATTERN.findall(raw_values)
    ]
    return values or None


def _extract_check_enum_values(definition: str) -> tuple[str, list[str]] | None:
    unwrapped_definition = _unwrap_check_definition(definition)
    if not unwrapped_definition:
        return None

    for pattern in (CHECK_IN_PATTERN, CHECK_ANY_ARRAY_PATTERN):
        match = pattern.fullmatch(unwrapped_definition)
        if not match:
            continue

        column = _normalize_identifier(match.group("column")).lower()
        parsed_values = _parse_check_literal_list(match.group("values"))
        if parsed_values:
            return column, parsed_values

    return None


def _merge_enum_values(
    primary_values: list[str] | None,
    secondary_values: list[str] | None,
) -> list[str] | None:
    if not primary_values and not secondary_values:
        return None

    merged_values: list[str] = []
    seen: set[str] = set()

    for source_values in (primary_values or [], secondary_values or []):
        for value in source_values:
            if value in seen:
                continue
            seen.add(value)
            merged_values.append(value)

    return merged_values or None


def _normalize_column_default_value(
    column_default: Any,
    *,
    data_type: str | None,
    has_enum_udt: bool,
) -> str | None:
    if column_default is None:
        return None

    default_value = str(column_default)
    normalized_data_type = (data_type or "").lower()
    should_parse_literal = normalized_data_type in TEXTUAL_TYPES or has_enum_udt
    if not should_parse_literal:
        return default_value

    candidate = _strip_outer_parentheses(default_value.strip())
    match = DEFAULT_LITERAL_WITH_OPTIONAL_CAST_PATTERN.fullmatch(candidate)
    if not match:
        return default_value

    return match.group("value").replace("''", "'")


def _validate_sql_identifier(identifier: str, *, field_name: str) -> str:
    normalized = _normalize_identifier(identifier)
    if not IDENTIFIER_REGEX.fullmatch(normalized):
        raise IdentifierValidationError(
            detail=f"Invalid identifier in {field_name}: {identifier}",
        )
    return normalized


def _extract_table_name(identifier: str, *, field_name: str) -> str:
    normalized = _normalize_identifier(identifier)
    parts = [part.strip() for part in normalized.split(".") if part.strip()]

    if len(parts) == 1:
        return _validate_sql_identifier(parts[0], field_name=field_name).lower()

    if len(parts) == 2:
        schema_name = _validate_sql_identifier(parts[0], field_name=field_name).lower()
        table_name = _validate_sql_identifier(parts[1], field_name=field_name).lower()

        if schema_name != FORMS_SCHEMA:
            raise IdentifierValidationError(
                detail=(
                    f"Invalid schema in {field_name}: {parts[0]}. "
                    f"Expected schema '{FORMS_SCHEMA}'"
                )
            )
        return table_name

    raise IdentifierValidationError(
        detail=f"Invalid identifier in {field_name}: {identifier}",
    )


def _quote_identifier(identifier: str, *, field_name: str) -> str:
    validated = _validate_sql_identifier(identifier, field_name=field_name)
    return f'"{validated}"'


def _normalize_table_name_for_match(table_name: str) -> str:
    return _normalize_identifier(table_name).lower()


def _is_items_table(table_name: str) -> bool:
    return _normalize_table_name_for_match(table_name) in {"item", "items"}


def _is_hidden_form_column(table_name: str, column_name: str) -> bool:
    return _is_items_table(table_name) and column_name == "fecha_entrega"


async def _get_user_role_id(db: AsyncSession, *, user_id: str) -> str | None:
    query = text(
        """
        SELECT role_id
        FROM auth.user_roles
        WHERE user_id = :user_id
        ORDER BY granted_at DESC NULLS LAST
        LIMIT 1
        """
    )
    result = await db.execute(query, {"user_id": user_id})
    role_id = result.scalar_one_or_none()
    return str(role_id) if role_id is not None else None


async def _get_user_role_context(db: AsyncSession, *, user_id: str) -> dict[str, str] | None:
    query = text(
        """
        SELECT r.id AS role_id, r.code AS role_code
        FROM auth.user_roles ur
        JOIN auth.roles r ON r.id = ur.role_id
        WHERE ur.user_id = :user_id
        ORDER BY ur.granted_at DESC NULLS LAST
        LIMIT 1
        """
    )
    result = await db.execute(query, {"user_id": user_id})
    row = result.mappings().first()
    if not row:
        return None
    return {
        "role_id": str(row["role_id"]),
        "role_code": str(row["role_code"] or ""),
    }


async def _resolve_role_tables_create_column(db: AsyncSession) -> str | None:
    query = text(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'workspace'
          AND table_name = 'role_tables'
        """
    )
    result = await db.execute(query)
    column_names = [row["column_name"] for row in result.mappings().all()]
    column_names_lower = {name.lower() for name in column_names}

    if not column_names_lower or "role_id" not in column_names_lower or "table_id" not in column_names_lower:
        return None

    for name in column_names:
        if name.lower() == "can_create":
            return name
    for name in column_names:
        if name.lower() == "create":
            return name
    return None


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


async def _resolve_role_forms_view_column(db: AsyncSession) -> str | None:
    try:
        await _ensure_role_forms_table(db)
    except Exception:
        return None

    query = text(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'workspace'
          AND table_name = 'role_forms'
        """
    )
    result = await db.execute(query)
    column_names = [row["column_name"] for row in result.mappings().all()]
    column_names_lower = {name.lower() for name in column_names}

    if not column_names_lower or "role_id" not in column_names_lower or "table_id" not in column_names_lower:
        return None

    for name in column_names:
        if name.lower() == "can_view":
            return name
    return None


def _normalize_search_term(search_q: str | None) -> str | None:
    if search_q is None:
        return None
    normalized = search_q.strip()
    return normalized or None


def _validate_lookup_pagination(*, limit: int, offset: int) -> None:
    if limit < 1 or limit > MAX_LOOKUP_LIMIT:
        raise IdentifierValidationError(
            detail=f"Invalid limit: {limit}. Expected 1..{MAX_LOOKUP_LIMIT}",
        )
    if offset < 0:
        raise IdentifierValidationError(
            detail=f"Invalid offset: {offset}. Expected >= 0",
        )


def _choose_fk_label_field(
    columns: list[dict[str, Any]],
    *,
    value_field: str,
) -> str:
    columns_by_name = {
        _normalize_identifier(column["column_name"]).lower(): column
        for column in columns
    }

    for preferred in FK_LABEL_PRIORITY:
        if preferred in columns_by_name and preferred != value_field:
            return preferred

    for column_name, column in columns_by_name.items():
        if column_name == value_field:
            continue
        data_type = (column.get("data_type") or "").lower()
        if data_type in TEXTUAL_TYPES:
            return column_name

    for column_name in columns_by_name:
        if column_name != value_field:
            return column_name

    return value_field


async def _get_visible_table_configs(
    db: AsyncSession,
    *,
    table_name: str | None = None,
    user_id: str | None = None,
    require_create_permission: bool = False,
    require_form_view_permission: bool = False,
) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT id, nombre_tabla_sql, nombre_tabla_ui, categoria_id
        FROM workspace.ui_config_tablas
        WHERE es_visible = true
        ORDER BY id
        """
    )
    result = await db.execute(query)
    rows = [dict(row) for row in result.mappings().all()]

    if require_create_permission and user_id:
        try:
            create_column = await _resolve_role_tables_create_column(db)
            role_id = await _get_user_role_id(db, user_id=user_id)

            if create_column and role_id:
                quoted_create_column = create_column.replace('"', '""')
                permissions_query = text(
                    f"""
                    SELECT CAST(table_id AS TEXT) AS table_id,
                           COALESCE("{quoted_create_column}", true) AS can_create
                    FROM workspace.role_tables
                    WHERE role_id = :role_id
                    """
                )
                permissions_result = await db.execute(permissions_query, {"role_id": role_id})
                create_permissions = {
                    str(row["table_id"]).strip(): bool(row["can_create"])
                    for row in permissions_result.mappings().all()
                    if row.get("table_id") is not None
                }
                rows = [
                    row
                    for row in rows
                    if create_permissions.get(str(row["id"]).strip(), True)
                ]
        except Exception:
            pass

    if require_form_view_permission and user_id:
        try:
            view_column = await _resolve_role_forms_view_column(db)
            role_context = await _get_user_role_context(db, user_id=user_id)
            role_id = role_context["role_id"] if role_context else None
            is_admin = bool(role_context and role_context["role_code"].upper() == "ADMIN")

            if is_admin:
                pass
            elif view_column and role_id:
                quoted_view_column = view_column.replace('"', '""')
                permissions_query = text(
                    f"""
                    SELECT CAST(table_id AS TEXT) AS table_id,
                           COALESCE("{quoted_view_column}", false) AS can_view
                    FROM workspace.role_forms
                    WHERE role_id = :role_id
                    """
                )
                permissions_result = await db.execute(permissions_query, {"role_id": role_id})
                view_permissions = {
                    str(row["table_id"]).strip(): bool(row["can_view"])
                    for row in permissions_result.mappings().all()
                    if row.get("table_id") is not None
                }
                rows = [
                    row
                    for row in rows
                    if view_permissions.get(str(row["id"]).strip(), False)
                ]
            else:
                rows = []
        except Exception:
            rows = []

    if table_name is None:
        return rows

    target_table = _extract_table_name(table_name, field_name="table_name")
    filtered: list[dict[str, Any]] = []
    for row in rows:
        current_table = _extract_table_name(
            row["nombre_tabla_sql"],
            field_name="workspace.ui_config_tablas.nombre_tabla_sql",
        )
        if current_table == target_table:
            filtered.append(row)
    return filtered


async def _get_table_columns(
    db: AsyncSession,
    *,
    schema_name: str,
    table_name: str,
) -> list[dict[str, Any]]:
    query_cols = text(
        """
        SELECT
            column_name,
            data_type,
            is_nullable,
            character_maximum_length,
            column_default,
            is_identity,
            udt_name
        FROM information_schema.columns
        WHERE table_schema = :schema_name
          AND table_name = :table_name
        ORDER BY ordinal_position
        """
    )
    result_cols = await db.execute(
        query_cols,
        {"schema_name": schema_name, "table_name": table_name},
    )
    return [dict(row) for row in result_cols.mappings().all()]


async def _get_foreign_key_metadata(
    db: AsyncSession,
    *,
    schema_name: str,
    source_tables: set[str],
) -> dict[tuple[str, str], dict[str, str]]:
    if not source_tables:
        return {}

    query_fk = text(
        """
        SELECT
            tc.table_name AS source_table,
            kcu.column_name AS source_column,
            ccu.table_schema AS referenced_schema,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = :schema_name
        """
    )
    result_fk = await db.execute(query_fk, {"schema_name": schema_name})

    metadata: dict[tuple[str, str], dict[str, str]] = {}
    for row in result_fk.mappings().all():
        source_table = _normalize_identifier(row["source_table"]).lower()
        if source_table not in source_tables:
            continue

        source_column = _normalize_identifier(row["source_column"]).lower()
        metadata[(source_table, source_column)] = {
            "referenced_schema": _normalize_identifier(
                row["referenced_schema"]
            ).lower(),
            "referenced_table": _normalize_identifier(row["referenced_table"]).lower(),
            "referenced_column": _normalize_identifier(
                row["referenced_column"]
            ).lower(),
        }
    return metadata


async def _get_enum_values_by_udt(
    db: AsyncSession,
    *,
    schema_name: str,
) -> dict[str, list[str]]:
    query_enums = text(
        """
        SELECT t.typname AS enum_name, e.enumlabel AS enum_label
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = :schema_name
        ORDER BY t.typname, e.enumsortorder
        """
    )
    result_enums = await db.execute(query_enums, {"schema_name": schema_name})

    enums_map: dict[str, list[str]] = defaultdict(list)
    for row in result_enums.mappings().all():
        enum_name = _normalize_identifier(row["enum_name"]).lower()
        enum_label = row["enum_label"]
        if enum_label is not None:
            enums_map[enum_name].append(str(enum_label))
    return dict(enums_map)


async def _get_check_enum_values_by_table(
    db: AsyncSession,
    *,
    schema_name: str,
    source_tables: set[str],
) -> dict[tuple[str, str], list[str]]:
    if not source_tables:
        return {}

    query_checks = text(
        """
        SELECT
            rel.relname AS table_name,
            pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = con.connamespace
        WHERE con.contype = 'c'
          AND nsp.nspname = :schema_name
        """
    )
    result_checks = await db.execute(query_checks, {"schema_name": schema_name})

    enum_values_by_column: dict[tuple[str, str], list[str]] = {}
    for row in result_checks.mappings().all():
        table_name = _normalize_identifier(row.get("table_name", "")).lower()
        if table_name not in source_tables:
            continue

        definition = row.get("definition")
        if not definition:
            continue

        parsed_enum = _extract_check_enum_values(str(definition))
        if not parsed_enum:
            continue

        column_name, enum_values = parsed_enum
        key = (table_name, column_name)
        enum_values_by_column[key] = (
            _merge_enum_values(enum_values_by_column.get(key), enum_values) or []
        )

    return enum_values_by_column


async def _build_fk_reference_cache(
    db: AsyncSession,
    *,
    foreign_keys: dict[tuple[str, str], dict[str, str]],
) -> dict[tuple[str, str, str], dict[str, Any]]:
    fk_reference_cache: dict[tuple[str, str, str], dict[str, Any]] = {}
    columns_cache: dict[tuple[str, str], list[dict[str, Any]]] = {}

    for fk in foreign_keys.values():
        lookup_key = (
            fk["referenced_schema"],
            fk["referenced_table"],
            fk["referenced_column"],
        )
        if lookup_key in fk_reference_cache:
            continue

        columns_key = (fk["referenced_schema"], fk["referenced_table"])
        table_columns = columns_cache.get(columns_key)
        if table_columns is None:
            table_columns = await _get_table_columns(
                db,
                schema_name=fk["referenced_schema"],
                table_name=fk["referenced_table"],
            )
            columns_cache[columns_key] = table_columns

        if not table_columns:
            fk_reference_cache[lookup_key] = {
                "value_field": fk["referenced_column"],
                "label_field": fk["referenced_column"],
                "label_mode": "single",
                "label_components": None,
            }
            continue

        value_field = fk["referenced_column"]
        columns_by_name = {
            _normalize_identifier(column["column_name"]).lower(): column
            for column in table_columns
        }
        if value_field not in columns_by_name:
            fk_reference_cache[lookup_key] = {
                "value_field": value_field,
                "label_field": value_field,
                "label_mode": "single",
                "label_components": None,
            }
            continue

        label_mode = "single"
        label_field = _choose_fk_label_field(table_columns, value_field=value_field)
        label_components: tuple[str, str] | None = None

        if fk["referenced_table"] == "tela":
            has_nombre = TELA_LOOKUP_FIELDS[0] in columns_by_name
            has_referencia = TELA_LOOKUP_FIELDS[1] in columns_by_name
            if has_nombre and has_referencia:
                label_mode = "tela_composite"
                label_field = f"{TELA_LOOKUP_FIELDS[0]} + {TELA_LOOKUP_FIELDS[1]}"
                label_components = TELA_LOOKUP_FIELDS
            elif has_nombre:
                label_field = TELA_LOOKUP_FIELDS[0]
            elif has_referencia:
                label_field = TELA_LOOKUP_FIELDS[1]

        fk_reference_cache[lookup_key] = {
            "value_field": value_field,
            "label_field": label_field,
            "label_mode": label_mode,
            "label_components": label_components,
        }

    return fk_reference_cache


def _build_lookup_label_sql(
    *,
    label_mode: str,
    quoted_label: str,
    quoted_value: str,
    quoted_nombre: str | None,
    quoted_referencia: str | None,
) -> str:
    if label_mode == "tela_composite" and quoted_nombre and quoted_referencia:
        composed_label = (
            "CONCAT_WS(' - ', "
            f"NULLIF(TRIM({quoted_nombre}::text), ''), "
            f"NULLIF(TRIM({quoted_referencia}::text), '')"
            ")"
        )
        return f"COALESCE(NULLIF({composed_label}, ''), {quoted_value}::text)"

    return f"COALESCE({quoted_label}::text, {quoted_value}::text)"


async def _query_foreign_key_lookup(
    db: AsyncSession,
    *,
    schema_name: str,
    table_name: str,
    value_field: str,
    label_field: str,
    search_q: str | None,
    limit: int,
    offset: int,
    label_mode: str = "single",
    label_components: tuple[str, str] | None = None,
) -> tuple[list[dict[str, str]], bool]:
    quoted_schema = _quote_identifier(schema_name, field_name="fk_schema")
    quoted_table = _quote_identifier(table_name, field_name="fk_table")
    quoted_value = _quote_identifier(value_field, field_name="fk_value_field")
    quoted_label = quoted_value
    if label_mode != "tela_composite" or not label_components:
        quoted_label = _quote_identifier(label_field, field_name="fk_label_field")
    quoted_nombre = None
    quoted_referencia = None
    if label_components:
        quoted_nombre = _quote_identifier(label_components[0], field_name="fk_label_component")
        quoted_referencia = _quote_identifier(
            label_components[1], field_name="fk_label_component"
        )

    label_sql = _build_lookup_label_sql(
        label_mode=label_mode,
        quoted_label=quoted_label,
        quoted_value=quoted_value,
        quoted_nombre=quoted_nombre,
        quoted_referencia=quoted_referencia,
    )

    where_clauses = [f"{quoted_value} IS NOT NULL"]
    params: dict[str, Any] = {"limit": limit + 1, "offset": offset}

    normalized_search = _normalize_search_term(search_q)
    if normalized_search:
        where_clauses.append(f"{label_sql} ILIKE :search_q")
        params["search_q"] = f"%{normalized_search}%"

    where_sql = " AND ".join(where_clauses)
    query = text(
        f"""
        SELECT
            {quoted_value}::text AS value,
            {label_sql} AS label
        FROM {quoted_schema}.{quoted_table}
        WHERE {where_sql}
        ORDER BY {label_sql} ASC NULLS LAST, {quoted_value} ASC
        LIMIT :limit OFFSET :offset
        """
    )
    result = await db.execute(query, params)
    rows = result.mappings().all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    items: list[dict[str, str]] = []
    for row in rows:
        value = row.get("value")
        if value is None:
            continue
        label = row.get("label")
        items.append(
            {
                "value": str(value),
                "label": str(label if label is not None else value),
            }
        )

    return items, has_more


async def _build_tables_payload(
    db: AsyncSession,
    *,
    tables_config: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    visible_tables: set[str] = set()
    for table_config in tables_config:
        visible_tables.add(
            _extract_table_name(
                table_config["nombre_tabla_sql"],
                field_name="workspace.ui_config_tablas.nombre_tabla_sql",
            )
        )

    foreign_keys = await _get_foreign_key_metadata(
        db,
        schema_name=FORMS_SCHEMA,
        source_tables=visible_tables,
    )
    enum_values_by_udt = await _get_enum_values_by_udt(db, schema_name=FORMS_SCHEMA)
    check_enum_values_by_table = await _get_check_enum_values_by_table(
        db,
        schema_name=FORMS_SCHEMA,
        source_tables=visible_tables,
    )
    fk_reference_cache = await _build_fk_reference_cache(db, foreign_keys=foreign_keys)

    payload: list[dict[str, Any]] = []
    for table_config in tables_config:
        table_name = _extract_table_name(
            table_config["nombre_tabla_sql"],
            field_name="workspace.ui_config_tablas.nombre_tabla_sql",
        )
        columns = await _get_table_columns(
            db,
            schema_name=FORMS_SCHEMA,
            table_name=table_name,
        )

        columns_payload: list[dict[str, Any]] = []
        for column in columns:
            column_name = _validate_sql_identifier(
                column["column_name"], field_name=f"{table_name}.column_name"
            ).lower()
            if _is_hidden_form_column(table_name, column_name):
                continue

            udt_name = column.get("udt_name")
            udt_enum_values = None
            if udt_name:
                udt_enum_values = enum_values_by_udt.get(
                    _normalize_identifier(udt_name).lower()
                )

            column_type = (column.get("data_type") or "").lower()
            check_enum_values = None
            if column_type in TEXTUAL_TYPES:
                check_enum_values = check_enum_values_by_table.get((table_name, column_name))

            enum_values = _merge_enum_values(udt_enum_values, check_enum_values)

            column_payload: dict[str, Any] = {
                "name": column["column_name"],
                "type": column["data_type"],
                "nullable": column.get("is_nullable") == "YES",
                "required": column.get("is_nullable") != "YES",
                "max_length": column.get("character_maximum_length"),
                "default_value": _normalize_column_default_value(
                    column.get("column_default"),
                    data_type=column.get("data_type"),
                    has_enum_udt=bool(udt_enum_values),
                ),
                "enum_values": enum_values,
                "foreign_key": False,
                "foreign_key_table": None,
                "foreign_key_value_field": None,
                "foreign_key_label_field": None,
                "foreign_key_options": None,
            }

            fk_info = foreign_keys.get((table_name, column_name))
            if fk_info:
                lookup_key = (
                    fk_info["referenced_schema"],
                    fk_info["referenced_table"],
                    fk_info["referenced_column"],
                )
                reference_info = fk_reference_cache.get(lookup_key) or {
                    "value_field": fk_info["referenced_column"],
                    "label_field": fk_info["referenced_column"],
                    "label_mode": "single",
                    "label_components": None,
                }
                column_payload.update(
                    {
                        "foreign_key": True,
                        "foreign_key_table": fk_info["referenced_table"],
                        "foreign_key_value_field": reference_info["value_field"],
                        "foreign_key_label_field": reference_info["label_field"],
                        "foreign_key_options": None,
                    }
                )

            columns_payload.append(column_payload)

        payload.append(
            {
                "id": table_config["id"],
                "name_sql": table_config["nombre_tabla_sql"],
                "name_form": table_config["nombre_tabla_ui"],
                "category_id": table_config["categoria_id"],
                "columns": columns_payload,
            }
        )

    return payload


async def get_categories(db: AsyncSession) -> list[dict[str, Any]]:
    """
    Consulta la tabla workspace.ui_categorias_tablas y retorna id, nombre.
    """
    try:
        query = text("SELECT id, nombre FROM workspace.ui_categorias_tablas")
        result = await db.execute(query)
        return [dict(row) for row in result.mappings()]
    except Exception as error:
        raise DBCommunicationError(f"Error obteniendo categorias: {error}")


async def get_tables(db: AsyncSession, *, user_id: str | None = None) -> list[dict[str, Any]]:
    """
    Obtiene metadata liviana de tablas visibles y columnas (sin opciones FK masivas).
    """
    try:
        tables_config = await _get_visible_table_configs(
            db,
            user_id=user_id,
            require_form_view_permission=True,
        )
        return await _build_tables_payload(db, tables_config=tables_config)
    except IdentifierValidationError:
        raise
    except Exception as error:
        raise DBCommunicationError(f"Error obteniendo tablas: {error}")


async def get_table(
    db: AsyncSession,
    table_name: str,
    *,
    user_id: str | None = None,
) -> dict[str, Any]:
    table_identifier = _extract_table_name(table_name, field_name="table_name")

    try:
        tables_config = await _get_visible_table_configs(
            db,
            table_name=table_identifier,
            user_id=user_id,
            require_form_view_permission=True,
        )
        if not tables_config:
            raise IdentifierValidationError(f"Invalid table identifier: {table_name}")

        payload = await _build_tables_payload(db, tables_config=tables_config)
        return payload[0]
    except IdentifierValidationError:
        raise
    except Exception as error:
        raise DBCommunicationError(f"Error obteniendo tabla {table_name}: {error}")


async def get_foreign_key_lookup(
    db: AsyncSession,
    *,
    user_id: str | None = None,
    table_name: str,
    column_name: str,
    q: str | None = None,
    limit: int = DEFAULT_LOOKUP_LIMIT,
    offset: int = 0,
) -> dict[str, Any]:
    table_identifier = _extract_table_name(table_name, field_name="table_name")
    column_identifier = _validate_sql_identifier(
        column_name, field_name="column_name"
    ).lower()
    _validate_lookup_pagination(limit=limit, offset=offset)

    try:
        allowed_tables = await get_allowed_tables(db, user_id=user_id)
        if table_identifier not in allowed_tables:
            raise IdentifierValidationError(f"Invalid table identifier: {table_name}")

        allowed_columns = await get_allowed_columns(db, table_identifier)
        if column_identifier not in allowed_columns:
            raise IdentifierValidationError(f"Invalid column identifier: {column_name}")

        foreign_keys = await _get_foreign_key_metadata(
            db,
            schema_name=FORMS_SCHEMA,
            source_tables={table_identifier},
        )
        fk_info = foreign_keys.get((table_identifier, column_identifier))
        if not fk_info:
            raise IdentifierValidationError(
                f"Column is not a foreign key: {column_name}"
            )

        fk_reference_cache = await _build_fk_reference_cache(
            db,
            foreign_keys={(table_identifier, column_identifier): fk_info},
        )

        lookup_key = (
            fk_info["referenced_schema"],
            fk_info["referenced_table"],
            fk_info["referenced_column"],
        )
        reference_info = fk_reference_cache.get(lookup_key) or {
            "value_field": fk_info["referenced_column"],
            "label_field": fk_info["referenced_column"],
            "label_mode": "single",
            "label_components": None,
        }

        items, has_more = await _query_foreign_key_lookup(
            db,
            schema_name=fk_info["referenced_schema"],
            table_name=fk_info["referenced_table"],
            value_field=reference_info["value_field"],
            label_field=reference_info["label_field"],
            search_q=q,
            limit=limit,
            offset=offset,
            label_mode=reference_info.get("label_mode", "single"),
            label_components=reference_info.get("label_components"),
        )

        return {
            "items": items,
            "total": None,
            "has_more": has_more,
        }
    except IdentifierValidationError:
        raise
    except Exception as error:
        raise DBCommunicationError(f"Error resolviendo lookup FK: {error}")


async def get_column_values(
    db: AsyncSession,
    table_name: str,
    column_name: str,
    *,
    user_id: str | None = None,
    q: str | None = None,
    limit: int = DEFAULT_LOOKUP_LIMIT,
    offset: int = 0,
) -> dict[str, Any]:
    table_identifier = _extract_table_name(table_name, field_name="table_name")
    column_identifier = _validate_sql_identifier(
        column_name, field_name="column_name"
    ).lower()
    _validate_lookup_pagination(limit=limit, offset=offset)

    try:
        allowed_tables = await get_allowed_tables(db, user_id=user_id)
        if table_identifier not in allowed_tables:
            raise IdentifierValidationError(f"Invalid table identifier: {table_name}")

        allowed_columns = await get_allowed_columns(db, table_identifier)
        if column_identifier not in allowed_columns:
            raise IdentifierValidationError(f"Invalid column identifier: {column_name}")

        quoted_schema = _quote_identifier(FORMS_SCHEMA, field_name="schema")
        quoted_table = _quote_identifier(table_identifier, field_name="table")
        quoted_column = _quote_identifier(column_identifier, field_name="column")

        params: dict[str, Any] = {"limit": limit + 1, "offset": offset}
        where_clauses = [f"{quoted_column} IS NOT NULL", f"TRIM({quoted_column}::text) != ''"]

        normalized_q = _normalize_search_term(q)
        if normalized_q:
            where_clauses.append(f"{quoted_column}::text ILIKE :q")
            params["q"] = f"%{normalized_q}%"

        where_sql = " AND ".join(where_clauses)
        query = text(
            f"""
            SELECT DISTINCT {quoted_column}::text AS value
            FROM {quoted_schema}.{quoted_table}
            WHERE {where_sql}
            ORDER BY {quoted_column}::text ASC NULLS LAST
            LIMIT :limit OFFSET :offset
            """
        )

        result = await db.execute(query, params)
        rows = result.mappings().all()

        has_more = len(rows) > limit
        rows = rows[:limit]

        items: list[dict[str, str]] = [
            {"value": str(row["value"]), "label": str(row["value"])}
            for row in rows
        ]
        return {"items": items, "total": None, "has_more": has_more}
    except IdentifierValidationError:
        raise
    except Exception as error:
        raise DBCommunicationError(f"Error buscando valores de columna: {error}")


async def get_next_consecutive(
    db: AsyncSession,
    *,
    table_name: str,
    column_name: str,
    user_id: str | None = None,
) -> dict[str, int]:
    """
    Devuelve el siguiente valor consecutivo para la columna numérica indicada
    basada en el máximo valor existente en la tabla (solo valores numéricos).
    """
    table_identifier = _extract_table_name(table_name, field_name="table_name")
    column_identifier = _validate_sql_identifier(column_name, field_name="column_name").lower()

    try:
        allowed_tables = await get_allowed_tables(db, user_id=user_id)
        if table_identifier not in allowed_tables:
            raise IdentifierValidationError(f"Invalid table identifier: {table_name}")

        allowed_columns = await get_allowed_columns(db, table_identifier)
        if column_identifier not in allowed_columns:
            raise IdentifierValidationError(f"Invalid column identifier: {column_name}")

        quoted_schema = _quote_identifier(FORMS_SCHEMA, field_name="schema")
        quoted_table = _quote_identifier(table_identifier, field_name="table")
        quoted_column = _quote_identifier(column_identifier, field_name="column")

        # Solo considerar valores que sean numéricos (enteros) para evitar errores de casteo
        query = text(
            f"""
            SELECT MAX(CAST(TRIM({quoted_column}::text) AS BIGINT)) AS maxval
            FROM {quoted_schema}.{quoted_table}
            WHERE TRIM({quoted_column}::text) ~ '^[0-9]+$'
            """
        )

        result = await db.execute(query)
        rows = result.mappings().all()
        maxval = None
        if rows and rows[0] and rows[0].get("maxval") is not None:
            try:
                maxval = int(rows[0]["maxval"])
            except (TypeError, ValueError):
                maxval = None

        next_value = (maxval + 1) if maxval is not None else 1
        return {"next": int(next_value)}
    except IdentifierValidationError:
        raise
    except Exception as error:
        raise DBCommunicationError(f"Error obteniendo consecutivo: {error}")


async def get_unassigned_orders(
    db: AsyncSession,
    *,
    table_name: str,
    order_column: str,
    client_column: str,
    legacy_column: str,
    user_id: str | None = None,
    q: str | None = None,
    limit: int = DEFAULT_LOOKUP_LIMIT,
    offset: int = 0,
    sqlserver_conn: object | None = None,
) -> dict[str, Any]:
    """
    Retorna una lista de órdenes (order, client) cuya columna de legacy está vacía o NULL.
    Devuelve items con campos: value (orden), label (orden - cliente), client.
    """
    table_identifier = _extract_table_name(table_name, field_name="table_name")
    order_col = _validate_sql_identifier(order_column, field_name="order_column").lower()
    client_col = _validate_sql_identifier(client_column, field_name="client_column").lower()
    legacy_col = _validate_sql_identifier(legacy_column, field_name="legacy_column").lower()

    _validate_lookup_pagination(limit=limit, offset=offset)

    try:
        allowed_tables = await get_allowed_tables(db, user_id=user_id)
        if table_identifier not in allowed_tables:
            raise IdentifierValidationError(f"Invalid table identifier: {table_name}")

        allowed_columns = await get_allowed_columns(db, table_identifier)
        for col in (order_col, client_col, legacy_col):
            if col not in allowed_columns:
                raise IdentifierValidationError(f"Invalid column identifier: {col}")

        quoted_schema = _quote_identifier(FORMS_SCHEMA, field_name="schema")
        quoted_table = _quote_identifier(table_identifier, field_name="table")
        q_order = _quote_identifier(order_col, field_name="order_column")
        q_client = _quote_identifier(client_col, field_name="client_column")
        q_legacy = _quote_identifier(legacy_col, field_name="legacy_column")
        target_fk_meta = await _get_foreign_key_metadata(
            db,
            schema_name=FORMS_SCHEMA,
            source_tables={table_identifier},
        )
        order_fk = target_fk_meta.get((table_identifier, order_col))

        params: dict[str, Any] = {"limit": limit + 1, "offset": offset}

        # Try to detect a dedicated orders source table (common names)
        orders_table_candidates = [
            "ordencompra",
            "orden_compra",
            "ordenes_compra",
            "ordenescompra",
            "orden",
            "oc",
        ]

        orders_source: str | None = None
        orders_columns: list[dict[str, Any]] | None = None
        for cand in orders_table_candidates:
            try:
                cols = await _get_table_columns(db, schema_name=FORMS_SCHEMA, table_name=cand)
            except Exception:
                cols = []
            if cols:
                orders_source = cand
                orders_columns = cols
                break

        # If an orders source table exists and it's different from the target table, query it
        if orders_source and orders_source != table_identifier and orders_columns:
            # choose best order and client columns from source table
            src_cols = { _normalize_identifier(c['column_name']).lower(): c for c in orders_columns }

            order_field_candidates = [
                order_col,
                'oc_cliente',
                'oc_interno',
                'id_orden_compra',
                'orden',
                'cod_oc_cliente',
                'codoccliente',
                'oc',
                'numero_orden',
                'numero',
                'id',
                'codigo',
            ]
            client_field_candidates = [
                client_col,
                'cliente',
                'nombre',
                'cliente_nombre',
                'nombre_cliente',
                'id_cliente',
                'razon_social',
            ]
            product_field_candidates = [
                'producto',
                'producto_nombre',
                'nombre_producto',
                'descripcion',
                'referencia',
                'sku',
                'productos',
                'id_producto',
            ]
            quantity_field_candidates = [
                'cantidad',
                'quantity',
                'qty',
                'cant',
                'unidades',
                'piezas',
                'numero_items',
                'num_items',
            ]
            status_field_candidates = [
                'estado',
                'status',
                'estado_oc',
                'estado_orden',
                'estado_orden_compra',
                'orden_estado',
                'oc_estado',
                'estado_pedido',
            ]

            src_order_field = None
            for cand in order_field_candidates:
                if cand and cand.lower() in src_cols:
                    src_order_field = cand.lower()
                    break

            src_client_field = None
            for cand in client_field_candidates:
                if cand and cand.lower() in src_cols:
                    src_client_field = cand.lower()
                    break

            if not src_order_field:
                # fallback to first textual or any column
                for name, col in src_cols.items():
                    dtype = (col.get('data_type') or '').lower()
                    if dtype in TEXTUAL_TYPES:
                        src_order_field = name
                        break
                if not src_order_field:
                    src_order_field = next(iter(src_cols.keys()))

            if not src_client_field:
                # pick a textual column different from order field
                for name, col in src_cols.items():
                    if name == src_order_field:
                        continue
                    dtype = (col.get('data_type') or '').lower()
                    if dtype in TEXTUAL_TYPES:
                        src_client_field = name
                        break

            # quoted identifiers
            q_orders_table = _quote_identifier(orders_source, field_name='orders_table')
            q_src_order = _quote_identifier(src_order_field, field_name='orders_order_column')
            q_src_client = _quote_identifier(src_client_field or src_order_field, field_name='orders_client_column')

            src_product_field = None
            for cand in product_field_candidates:
                if cand and cand.lower() in src_cols:
                    src_product_field = cand.lower()
                    break

            q_src_product = None
            if src_product_field:
                q_src_product = _quote_identifier(src_product_field, field_name='orders_product_column')

            src_quantity_field = None
            for cand in quantity_field_candidates:
                if cand and cand.lower() in src_cols:
                    src_quantity_field = cand.lower()
                    break

            q_src_quantity = None
            if src_quantity_field:
                q_src_quantity = _quote_identifier(src_quantity_field, field_name='orders_quantity_column')

            src_value_field = src_order_field
            if (
                order_fk
                and order_fk["referenced_schema"] == FORMS_SCHEMA
                and order_fk["referenced_table"] == orders_source
                and order_fk["referenced_column"] in src_cols
            ):
                src_value_field = order_fk["referenced_column"]
            else:
                for cand in ("id", "id_orden_compra", "ordencompra_id"):
                    if cand in src_cols:
                        src_value_field = cand
                        break

            q_src_value = _quote_identifier(src_value_field, field_name='orders_value_column')

            src_status_field = None
            for cand in status_field_candidates:
                if cand and cand.lower() in src_cols:
                    src_status_field = cand.lower()
                    break

            q_src_status = None
            if src_status_field:
                q_src_status = _quote_identifier(src_status_field, field_name='orders_status_column')

            logger.debug(
                "[forms.get_unassigned_orders] using orders source table=%s src_value_field=%s src_order_field=%s src_client_field=%s src_status_field=%s",
                orders_source,
                src_value_field,
                src_order_field,
                src_client_field,
                src_status_field,
            )
            # Prefer using FK metadata when available
            fk_meta = await _get_foreign_key_metadata(db, schema_name=FORMS_SCHEMA, source_tables={orders_source})
            fk_client = None
            fk_product = None
            if src_client_field:
                fk_client = fk_meta.get((orders_source, src_client_field))
            if src_product_field:
                fk_product = fk_meta.get((orders_source, src_product_field))

            join_clauses: list[str] = [
                (
                    "LEFT JOIN LATERAL ("
                    f"SELECT COUNT(*) AS conteo "
                    f"FROM {quoted_schema}.{quoted_table} t_count "
                    f"WHERE t_count.{q_order} = o.{q_src_value}"
                    f") item_counts ON true"
                )
            ]
            select_parts: list[str] = [
                f"o.{q_src_value}::text AS value",
                f"o.{q_src_order}::text AS orden",
                "COALESCE(item_counts.conteo, 0) AS conteo",
            ]
            if q_src_quantity:
                select_parts.append(f"o.{q_src_quantity}::text AS cantidad")
            else:
                select_parts.append("NULL::text AS cantidad")

            # Resolve client via FK if possible
            if fk_client:
                try:
                    ref_schema = fk_client["referenced_schema"]
                    ref_table = fk_client["referenced_table"]
                    ref_column = fk_client["referenced_column"]
                    ref_cols = await _get_table_columns(db, schema_name=ref_schema, table_name=ref_table)
                    label_field = _choose_fk_label_field(ref_cols, value_field=ref_column)
                    q_ref_schema = _quote_identifier(ref_schema, field_name='client_ref_schema')
                    q_ref_table = _quote_identifier(ref_table, field_name='client_ref_table')
                    q_ref_value = _quote_identifier(ref_column, field_name='client_ref_value')
                    q_ref_label = _quote_identifier(label_field, field_name='client_ref_label')

                    join_clauses.append(f"LEFT JOIN {q_ref_schema}.{q_ref_table} c ON TRIM(o.{q_src_client}::text) = TRIM(c.{q_ref_value}::text)")
                    select_parts.append(f"COALESCE(NULLIF(TRIM(c.{q_ref_label}::text), ''), o.{q_src_client}::text) AS cliente")
                except Exception:
                    select_parts.append(f"o.{q_src_client}::text AS cliente")
            else:
                # fallback: try tables named cliente/clientes in FORMS_SCHEMA
                found_client = False
                for cand in ("cliente", "clientes"):
                    try:
                        cand_cols = await _get_table_columns(db, schema_name=FORMS_SCHEMA, table_name=cand)
                    except Exception:
                        cand_cols = []
                    if not cand_cols:
                        continue
                    cand_map = { _normalize_identifier(c['column_name']).lower(): c for c in cand_cols }
                    # pick label and pk heuristically
                    label = next((l for l in ("nombre", "razon_social", "cliente", "cliente_nombre", "nombre_cliente", "name") if l in cand_map), None)
                    if not label:
                        label = next(iter(cand_map.keys()))
                    pk = next((p for p in ("id", "id_cliente", "cliente_id", "codigo", "codigo_cliente") if p in cand_map), None)
                    if not pk:
                        pk = next(iter(cand_map.keys()))
                    q_client_table = _quote_identifier(cand, field_name='client_table')
                    q_client_label = _quote_identifier(label, field_name='client_label')
                    q_client_pk = _quote_identifier(pk, field_name='client_pk')
                    join_clauses.append(f"LEFT JOIN {quoted_schema}.{q_client_table} c ON TRIM(o.{q_src_client}::text) = TRIM(c.{q_client_pk}::text)")
                    select_parts.append(f"COALESCE(NULLIF(TRIM(c.{q_client_label}::text), ''), o.{q_src_client}::text) AS cliente")
                    found_client = True
                    break
                if not found_client:
                    select_parts.append(f"o.{q_src_client}::text AS cliente")

            # Resolve product via FK if possible (id_producto -> producto table)
            if q_src_product:
                if fk_product:
                    try:
                        ref_schema = fk_product["referenced_schema"]
                        ref_table = fk_product["referenced_table"]
                        ref_column = fk_product["referenced_column"]
                        ref_cols = await _get_table_columns(db, schema_name=ref_schema, table_name=ref_table)
                        label_field = _choose_fk_label_field(ref_cols, value_field=ref_column)
                        q_ref_schema = _quote_identifier(ref_schema, field_name='product_ref_schema')
                        q_ref_table = _quote_identifier(ref_table, field_name='product_ref_table')
                        q_ref_value = _quote_identifier(ref_column, field_name='product_ref_value')
                        q_ref_label = _quote_identifier(label_field, field_name='product_ref_label')

                        join_clauses.append(f"LEFT JOIN {q_ref_schema}.{q_ref_table} p ON TRIM(o.{q_src_product}::text) = TRIM(p.{q_ref_value}::text)")
                        select_parts.append(f"COALESCE(NULLIF(TRIM(p.{q_ref_label}::text), ''), o.{q_src_product}::text) AS producto")
                    except Exception:
                        select_parts.append(f"o.{q_src_product}::text AS producto")
                else:
                    # fallback: look for producto/productos table in FORMS_SCHEMA
                    found_prod = False
                    for cand in ("producto", "productos"):
                        try:
                            cand_cols = await _get_table_columns(db, schema_name=FORMS_SCHEMA, table_name=cand)
                        except Exception:
                            cand_cols = []
                        if not cand_cols:
                            continue
                        cand_map = { _normalize_identifier(c['column_name']).lower(): c for c in cand_cols }
                        label = next((l for l in ("producto", "nombre", "descripcion", "referencia", "sku") if l in cand_map), None)
                        if not label:
                            label = next(iter(cand_map.keys()))
                        pk = next((p for p in ("id", "id_producto", "producto_id", "codigo", "codigo_producto") if p in cand_map), None)
                        if not pk:
                            pk = next(iter(cand_map.keys()))
                        q_product_table = _quote_identifier(cand, field_name='product_table')
                        q_product_label = _quote_identifier(label, field_name='product_label')
                        q_product_pk = _quote_identifier(pk, field_name='product_pk')
                        join_clauses.append(f"LEFT JOIN {quoted_schema}.{q_product_table} p ON TRIM(o.{q_src_product}::text) = TRIM(p.{q_product_pk}::text)")
                        select_parts.append(f"COALESCE(NULLIF(TRIM(p.{q_product_label}::text), ''), o.{q_src_product}::text) AS producto")
                        found_prod = True
                        break
                    if not found_prod:
                        select_parts.append(f"o.{q_src_product}::text AS producto")

            # Build WHERE clause
            where_clauses = [f"TRIM(o.{q_src_order}::text) != ''"]
            if q_src_status:
                status_params = {}
                for index, status in enumerate(FINALIZED_STATUS_VALUES):
                    key = f"finalized_status_{index}"
                    status_params[key] = status
                status_placeholders = ", ".join(
                    f":finalized_status_{index}"
                    for index in range(len(FINALIZED_STATUS_VALUES))
                )
                where_clauses.append(
                    "("
                    f"o.{q_src_status} IS NULL "
                    f"OR LOWER(TRIM(o.{q_src_status}::text)) NOT IN ({status_placeholders})"
                    ")"
                )
                params.update(status_params)

            normalized_q = _normalize_search_term(q)
            if normalized_q:
                search_parts = [f"TRIM(o.{q_src_order}::text) ILIKE :q"]
                search_parts.append(f"TRIM(o.{q_src_client}::text) ILIKE :q")
                if q_src_product:
                    search_parts.append(f"TRIM(o.{q_src_product}::text) ILIKE :q")
                where_clauses.append("(" + " OR ".join(search_parts) + ")")
                params['q'] = f"%{normalized_q}%"

            where_sql = " AND ".join(where_clauses)

            select_cols = ", ".join(select_parts)
            join_sql = " ".join(join_clauses)

            query = text(
                f"""
                SELECT {select_cols}
                FROM (
                    SELECT *
                    FROM {quoted_schema}.{q_orders_table} o
                    WHERE {where_sql}
                    ORDER BY o.{q_src_order} ASC NULLS LAST
                    LIMIT :limit OFFSET :offset
                ) o
                {join_sql}
                ORDER BY o.{q_src_order} ASC NULLS LAST
                """
            )

            result = await db.execute(query, params)
            rows = result.mappings().all()

            has_more = len(rows) > limit
            rows = rows[:limit]

            items: list[dict[str, str]] = []
            for row in rows:
                value = row.get('value') or ''
                orden = row.get('orden') or ''
                cliente = row.get('cliente') or ''
                producto = row.get('producto') or ''
                cantidad = row.get('cantidad')
                conteo = row.get('conteo')
                items.append({
                    'value': str(value),
                    'order': str(orden),
                    'label': f"{orden} - {producto}" if producto else (f"{orden} - {cliente}" if cliente else str(orden)),
                    'client': str(cliente),
                    'product': str(producto),
                    'quantity': str(cantidad) if cantidad is not None else '',
                    'count': int(conteo or 0),
                })

            return { 'items': items, 'total': None, 'has_more': has_more }

        # If no dedicated orders table found in Postgres, try SQL Server if connection provided
        if (not orders_source or orders_source == table_identifier) and sqlserver_conn is not None:
            normalized_q = _normalize_search_term(q)

            def _fetch_from_sqlserver(conn, normalized_q, offset_val, fetch_limit):
                cur = conn.cursor()
                try:
                    # discover available columns in ordencompra
                    cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ordencompra'")
                    cols = [(row[0].lower(), (row[1] or '').lower()) for row in cur.fetchall()]
                    available = {name: dtype for name, dtype in cols}
                except Exception:
                    available = {}

                order_candidates = ['oc_cliente', 'oc_interno', 'id_orden_compra', 'orden', 'numero_orden', 'numero', 'oc', 'id']
                client_candidates = ['cliente', 'cliente_nombre', 'nombre_cliente', 'nombre', 'razon_social', 'id_cliente']
                product_candidates = ['producto', 'producto_nombre', 'nombre_producto', 'descripcion', 'referencia', 'sku', 'id_producto']
                status_candidates = ['estado', 'status', 'estado_oc', 'estado_orden', 'estado_orden_compra', 'orden_estado', 'oc_estado', 'estado_pedido']

                def choose(candidates, fallback=None):
                    for c in candidates:
                        if c in available:
                            return c
                    return fallback

                src_order = choose(order_candidates, fallback=(next(iter(available)) if available else 'id_orden_compra'))
                src_client = choose(client_candidates, fallback=src_order)
                src_product = choose(product_candidates, fallback=None)
                src_status = choose(status_candidates, fallback=None)

                # Build SQL using bracket-quoted identifiers to be safe in SQL Server
                cols_sql = f"CAST([{src_order}] AS VARCHAR(200)) AS orden, CAST([{src_client}] AS VARCHAR(200)) AS cliente"
                if src_product:
                    cols_sql += f", CAST([{src_product}] AS VARCHAR(200)) AS producto"

                sql = (
                    f"SELECT {cols_sql} FROM ordencompra WHERE [{src_order}] IS NOT NULL AND LTRIM(RTRIM(CAST([{src_order}] AS VARCHAR(200)))) <> ''"
                )

                params = []
                if src_status:
                    sql += f" AND LOWER(LTRIM(RTRIM(CAST([{src_status}] AS VARCHAR(200))))) = ?"
                    params.append("pendiente")

                if normalized_q:
                    like_clause = f" (CAST([{src_order}] AS VARCHAR(200)) LIKE ? OR CAST([{src_client}] AS VARCHAR(200)) LIKE ?"
                    if src_product:
                        like_clause += f" OR CAST([{src_product}] AS VARCHAR(200)) LIKE ?"
                    like_clause += ")"
                    sql += " AND" + like_clause
                    qparam = f"%{normalized_q}%"
                    params.extend([qparam, qparam] + ([qparam] if src_product else []))

                sql += f" ORDER BY [{src_order}] ASC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
                params.extend([offset_val, fetch_limit])

                cur.execute(sql, params)
                rows = cur.fetchall()
                cur.close()
                return rows

            try:
                fetched_rows = await run_in_threadpool(_fetch_from_sqlserver, sqlserver_conn, normalized_q, offset, limit + 1)
            except Exception as e:
                logger.exception(f"Error consultando SQL Server ordencompra: {e}")
                fetched_rows = []

            # fetched_rows may be tuples of (orden, cliente) or (orden, cliente, producto)
            fetched_tuples = [tuple(row) for row in fetched_rows]

            items: list[dict[str, str]] = []
            for row in fetched_tuples:
                if not row:
                    continue
                orden_val = row[0] if len(row) > 0 else None
                cliente_val = row[1] if len(row) > 1 else None
                producto_val = row[2] if len(row) > 2 else None

                orden_s = str(orden_val) if orden_val is not None else ""
                cliente_s = str(cliente_val) if cliente_val is not None else ""
                producto_s = str(producto_val) if producto_val is not None else ""

                items.append({
                    "value": orden_s,
                    "label": f"{orden_s} - {producto_s}" if producto_s else (f"{orden_s} - {cliente_s}" if cliente_s else orden_s),
                    "client": cliente_s,
                    "product": producto_s,
                })

            has_more = len(fetched_tuples) > limit
            return {"items": items[:limit], "total": None, "has_more": has_more}

        # Fallback: query the target table as before
        where_clauses = [f"({q_legacy} IS NULL OR TRIM({q_legacy}::text) = '')"]
        status_col = next(
            (
                candidate
                for candidate in (
                    "estado",
                    "status",
                    "estado_oc",
                    "estado_orden",
                    "estado_orden_compra",
                    "orden_estado",
                    "oc_estado",
                    "estado_pedido",
                )
                if candidate in allowed_columns
            ),
            None,
        )
        if status_col:
            q_status = _quote_identifier(status_col, field_name="status_column")
            where_clauses.append(f"LOWER(TRIM({q_status}::text)) = :pending_status")
            params["pending_status"] = "pendiente"

        normalized_q = _normalize_search_term(q)
        if normalized_q:
            where_clauses.append(f"(TRIM({q_order}::text) ILIKE :q OR TRIM({q_client}::text) ILIKE :q)")
            params['q'] = f"%{normalized_q}%"

        where_sql = " AND ".join(where_clauses)
        query = text(
            f"""
            SELECT {q_order}::text AS orden, {q_client}::text AS cliente
            FROM {quoted_schema}.{quoted_table}
            WHERE {where_sql}
            ORDER BY {q_order} ASC NULLS LAST
            LIMIT :limit OFFSET :offset
            """
        )

        result = await db.execute(query, params)
        rows = result.mappings().all()

        has_more = len(rows) > limit
        rows = rows[:limit]

        items: list[dict[str, str]] = []
        for row in rows:
            orden = row.get("orden") if row.get("orden") is not None else ""
            cliente = row.get("cliente") if row.get("cliente") is not None else ""
            items.append({
                "value": str(orden),
                "label": f"{orden} - {cliente}" if cliente else str(orden),
                "client": str(cliente),
            })

        return {"items": items, "total": None, "has_more": has_more}
    except IdentifierValidationError:
        raise
    except Exception as error:
        raise DBCommunicationError(f"Error obteniendo órdenes sin legacy: {error}")


def _first_existing_column(
    available_columns: set[str],
    candidates: tuple[str, ...],
) -> str | None:
    for candidate in candidates:
        if candidate in available_columns:
            return candidate
    return None


async def _resolve_initial_employee_value(
    db: AsyncSession,
    *,
    process_table: str,
    employee_column: str,
) -> tuple[bool, Any]:
    process_columns = await _get_table_columns(
        db, schema_name=FORMS_SCHEMA, table_name=process_table
    )
    employee_meta = next(
        (
            column
            for column in process_columns
            if _normalize_identifier(column["column_name"]).lower() == employee_column
        ),
        None,
    )
    if not employee_meta:
        return False, None

    if employee_meta.get("column_default") is not None:
        return False, None

    if employee_meta.get("is_nullable") == "YES":
        return True, None

    foreign_keys = await _get_foreign_key_metadata(
        db, schema_name=FORMS_SCHEMA, source_tables={process_table}
    )
    employee_fk = foreign_keys.get((process_table, employee_column))
    if employee_fk:
        ref_schema = employee_fk["referenced_schema"]
        ref_table = employee_fk["referenced_table"]
        ref_column = employee_fk["referenced_column"]
        ref_columns = await _get_table_columns(
            db, schema_name=ref_schema, table_name=ref_table
        )
        q_ref_schema = _quote_identifier(ref_schema, field_name="employee_ref_schema")
        q_ref_table = _quote_identifier(ref_table, field_name="employee_ref_table")
        q_ref_column = _quote_identifier(ref_column, field_name="employee_ref_column")

        text_columns = [
            _normalize_identifier(column["column_name"]).lower()
            for column in ref_columns
            if (column.get("data_type") or "").lower() in TEXTUAL_TYPES
        ]
        if text_columns:
            label_expression = ", ".join(
                f"COALESCE({_quote_identifier(column, field_name='employee_label_column')}::text, '')"
                for column in text_columns[:6]
            )
            term_conditions = " OR ".join(
                f"LOWER(CONCAT_WS(' ', {label_expression})) LIKE :term_{index}"
                for index in range(6)
            )
            unassigned_query = text(
                f"""
                SELECT {q_ref_column} AS value
                FROM {q_ref_schema}.{q_ref_table}
                WHERE {term_conditions}
                ORDER BY {q_ref_column} ASC
                LIMIT 1
                """
            )
            result = await db.execute(
                unassigned_query,
                {
                    "term_0": "%sin asignar%",
                    "term_1": "%sin empleado%",
                    "term_2": "%pendiente%",
                    "term_3": "%n/a%",
                    "term_4": "%no aplica%",
                    "term_5": "%no asignado%",
                },
            )
            value = result.scalar_one_or_none()
            if value is not None:
                return True, value

        fallback_query = text(
            f"""
            SELECT {q_ref_column} AS value
            FROM {q_ref_schema}.{q_ref_table}
            ORDER BY {q_ref_column} ASC
            LIMIT 1
            """
        )
        result = await db.execute(fallback_query)
        value = result.scalar_one_or_none()
        if value is not None:
            return True, value

    return True, 1


async def _add_manual_integer_id_if_needed(
    db: AsyncSession,
    *,
    table_name: str,
    row_data: dict[str, Any],
) -> None:
    if "id" in row_data:
        return

    table_columns = await _get_table_columns(
        db, schema_name=FORMS_SCHEMA, table_name=table_name
    )
    id_meta = next(
        (
            column
            for column in table_columns
            if _normalize_identifier(column["column_name"]).lower() == "id"
        ),
        None,
    )
    if not id_meta:
        return

    data_type = (id_meta.get("data_type") or "").lower()
    has_default = id_meta.get("column_default") is not None
    is_identity = id_meta.get("is_identity") == "YES"
    is_required = id_meta.get("is_nullable") != "YES"
    if is_identity or has_default or not is_required or "int" not in data_type:
        return

    lock_query = text(
        "SELECT pg_advisory_xact_lock(hashtext(:lock_key))"
    )
    await db.execute(
        lock_query,
        {"lock_key": f"{FORMS_SCHEMA}.{table_name}.id"},
    )

    next_id_query = text(
        f"""
        SELECT COALESCE(MAX({_quote_identifier("id", field_name="id_column")}), 0) + 1
        FROM {_quote_identifier(FORMS_SCHEMA, field_name="schema")}.{_quote_identifier(table_name, field_name="manual_id_table")}
        """
    )
    next_id = (await db.execute(next_id_query)).scalar_one()
    row_data["id"] = int(next_id)


async def _find_item_process_table(
    db: AsyncSession,
) -> tuple[str, set[str]] | None:
    table_candidates = (
        "ordenproceso",
        "ordenprocesos",
        "ordenes_proceso",
        "orden_proceso",
        "ordenes_de_proceso",
        "orden_procesos",
        "item_procesos",
        "items_procesos",
        "proceso_items",
        "procesos_items",
    )

    for table_name in table_candidates:
        try:
            columns = await get_allowed_columns(db, table_name)
        except DBCommunicationError:
            continue
        if not columns:
            continue

        process_column = _first_existing_column(
            columns,
            ("id_proceso", "proceso_id", "id_prtoceso"),
        )
        item_column = _first_existing_column(
            columns,
            ("id_item", "item_id", "items_id"),
        )
        if process_column and item_column:
            return table_name, columns

    return None


async def _create_initial_item_process(
    db: AsyncSession,
    *,
    inserted_item: dict[str, Any],
) -> None:
    process_table = await _find_item_process_table(db)
    if not process_table:
        raise DBCommunicationError(
            "No se encontro la tabla ordenproceso para crear el proceso inicial del item"
        )

    table_name, columns = process_table
    process_column = _first_existing_column(
        columns,
        ("id_proceso", "proceso_id", "id_prtoceso"),
    )
    employee_column = _first_existing_column(
        columns,
        ("id_empleado", "empleado_id", "id_persona", "persona_id"),
    )
    item_column = _first_existing_column(
        columns,
        ("id_item", "item_id", "items_id"),
    )
    created_column = _first_existing_column(
        columns,
        ("fecha_creacion", "created_at", "fecha", "fecha_inicio", "timestamp"),
    )

    item_id = (
        inserted_item.get("id")
        or inserted_item.get("id_item")
        or inserted_item.get("item_id")
        or inserted_item.get("item_legado")
    )
    if item_id is None:
        raise DBCommunicationError(
            "No se pudo crear ordenproceso: el item insertado no retorno id, id_item ni item_legado"
        )

    item_created_at = (
        inserted_item.get("fecha_creacion")
        or inserted_item.get("created_at")
        or inserted_item.get("fecha")
        or inserted_item.get("timestamp")
        or datetime.now(timezone.utc)
    )

    row_data: dict[str, Any] = {}
    if process_column:
        row_data[process_column] = 1
    if employee_column:
        include_employee, employee_value = await _resolve_initial_employee_value(
            db,
            process_table=table_name,
            employee_column=employee_column,
        )
        if include_employee:
            row_data[employee_column] = employee_value
    if item_column:
        row_data[item_column] = item_id
    if created_column:
        row_data[created_column] = item_created_at

    await _add_manual_integer_id_if_needed(
        db,
        table_name=table_name,
        row_data=row_data,
    )

    columns_sql = ", ".join(
        _quote_identifier(column, field_name="item_process_column")
        for column in row_data
    )
    placeholders = ", ".join(f":{column}" for column in row_data)
    query = text(
        f"INSERT INTO {_quote_identifier(FORMS_SCHEMA, field_name='schema')}.{_quote_identifier(table_name, field_name='item_process_table')} ({columns_sql}) VALUES ({placeholders})"
    )
    await db.execute(query, row_data)


async def new_tabledata(
    db: AsyncSession,
    submit_form: SubmitForm,
    *,
    user_id: str | None = None,
) -> str:
    """
    Inserta datos dinamicamente en la tabla especificada.
    """
    correlation_id = f"tb_{int(datetime.now(timezone.utc).timestamp())}"
    table_name = _extract_table_name(submit_form.table_name, field_name="table_name")

    await validate_submit_identifiers(db, submit_form, user_id=user_id)

    # load table column metadata to coerce submitted values to appropriate Python types
    try:
        table_columns = await _get_table_columns(
            db, schema_name=FORMS_SCHEMA, table_name=table_name
        )
    except Exception as error:
        raise DBCommunicationError(f"No se pudo obtener metadata de columnas para {table_name}: {error}")

    col_meta: dict[str, dict[str, Any]] = {}
    for col in table_columns:
        col_name = _validate_sql_identifier(col["column_name"], field_name=f"{table_name}.column_name").lower()
        col_meta[col_name] = {
            "data_type": (col.get("data_type") or "").lower(),
            "nullable": col.get("is_nullable") == "YES",
        }

    row_data: dict[str, Any] = {}
    for item in submit_form.data:
        normalized_column = _validate_sql_identifier(item.column, field_name="column").lower()
        if _is_hidden_form_column(table_name, normalized_column):
            continue

        raw_value = item.value

        meta = col_meta.get(normalized_column)
        # treat empty strings as None for nullable columns
        if raw_value is None or (isinstance(raw_value, str) and raw_value.strip() == ""):
            row_data[normalized_column] = None
            continue

        if not meta:
            # unknown column, keep as-is (will likely fail later in identifier validation)
            row_data[normalized_column] = raw_value
            continue

        dtype = meta["data_type"]

        try:
            if "int" in dtype or dtype in ("integer", "bigint", "smallint", "serial", "bigserial"):
                # coerce numeric-ish strings to int
                if isinstance(raw_value, bool):
                    coerced = int(raw_value)
                elif isinstance(raw_value, int):
                    coerced = raw_value
                else:
                    coerced = int(str(raw_value))
            elif "numeric" in dtype or "decimal" in dtype:
                coerced = Decimal(str(raw_value))
            elif dtype in ("real", "double precision", "float4", "float8", "float"):
                coerced = float(raw_value)
            elif dtype in ("boolean", "bool"):
                if isinstance(raw_value, bool):
                    coerced = raw_value
                else:
                    sval = str(raw_value).strip().lower()
                    if sval in ("1", "true", "t", "yes", "y"):
                        coerced = True
                    elif sval in ("0", "false", "f", "no", "n"):
                        coerced = False
                    else:
                        raise ValueError(f"Invalid boolean value: {raw_value}")
            elif dtype == "date":
                if isinstance(raw_value, str):
                    coerced = datetime.fromisoformat(raw_value).date()
                elif isinstance(raw_value, datetime):
                    coerced = raw_value.date()
                else:
                    coerced = raw_value
            elif "timestamp" in dtype or "time" in dtype:
                if isinstance(raw_value, str):
                    coerced = datetime.fromisoformat(raw_value)
                else:
                    coerced = raw_value
            else:
                # textual, enum, jsonb, etc. keep as-is
                coerced = raw_value

        except Exception as error:
            raise DBCommunicationError(
                f"Invalid value for column '{normalized_column}': {raw_value} ({error})"
            )

        row_data[normalized_column] = coerced

    if not row_data:
        raise DBCommunicationError("No hay datos para insertar")

    try:
        columns = ", ".join(
            _quote_identifier(column, field_name="column") for column in row_data.keys()
        )
        placeholders = ", ".join([f":{key}" for key in row_data.keys()])

        query = text(
            f"INSERT INTO {_quote_identifier(FORMS_SCHEMA, field_name='schema')}.{_quote_identifier(table_name, field_name='table_name')} ({columns}) VALUES ({placeholders}) RETURNING *"
        )

        result = await db.execute(query, row_data)
        inserted_row = dict(result.mappings().first() or {})
        if _is_items_table(table_name):
            await _create_initial_item_process(db, inserted_item=inserted_row)
        await db.commit()
    except Exception as error:
        await db.rollback()
        raise DBCommunicationError(f"No se pudo insertar en {table_name}: {error}")

    return correlation_id


async def get_allowed_tables(
    db: AsyncSession,
    *,
    user_id: str | None = None,
) -> set[str]:
    try:
        table_configs = await _get_visible_table_configs(
            db,
            user_id=user_id,
            require_form_view_permission=True,
        )
        return {
            _extract_table_name(row["nombre_tabla_sql"], field_name="allowed_table")
            for row in table_configs
            if row.get("nombre_tabla_sql")
        }
    except IdentifierValidationError:
        raise
    except Exception as error:
        raise DBCommunicationError(f"No se pudo obtener tablas permitidas: {error}")


async def get_allowed_columns(db: AsyncSession, table_name: str) -> set[str]:
    try:
        query = text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = :schema_name
            AND table_name = :table_name
            """
        )
        result = await db.execute(
            query,
            {"schema_name": FORMS_SCHEMA, "table_name": table_name.lower()},
        )
        return {
            _validate_sql_identifier(
                row["column_name"], field_name="allowed_column"
            ).lower()
            for row in result.mappings()
            if row["column_name"]
        }
    except IdentifierValidationError:
        raise
    except Exception as error:
        raise DBCommunicationError(f"No se pudo obtener columnas permitidas: {error}")


async def validate_submit_identifiers(
    db: AsyncSession,
    submit_form: SubmitForm,
    *,
    user_id: str | None = None,
) -> None:
    table_name = _extract_table_name(submit_form.table_name, field_name="table_name")
    allowed_tables = await get_allowed_tables(db, user_id=user_id)

    if table_name not in allowed_tables:
        raise IdentifierValidationError(
            f"Invalid table identifier: {submit_form.table_name}"
        )

    allowed_columns = await get_allowed_columns(db, table_name)
    submitted_columns = [
        _validate_sql_identifier(item.column, field_name="column")
        for item in submit_form.data
    ]
    invalid_columns = sorted(
        {
            column
            for column in submitted_columns
            if column.lower() not in allowed_columns
        }
    )

    if invalid_columns:
        invalid_columns_text = ", ".join(invalid_columns)
        raise IdentifierValidationError(
            f"Invalid column identifiers: {invalid_columns_text}",
            invalid_fields=invalid_columns,
        )


class FormsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_categories(self) -> list[CategoriesForms]:
        data = await get_categories(self.db)
        return [CategoriesForms(**item) for item in data]

    async def get_tables(self, *, user_id: str | None = None) -> list[TableForms]:
        data = await get_tables(self.db, user_id=user_id)
        return [
            TableForms(
                id=item["id"],
                name_sql=item["name_sql"],
                name_form=item["name_form"],
                category_id=item["category_id"],
                columns=[ColumnTable(**column) for column in item["columns"]],
            )
            for item in data
        ]

    async def get_table(
        self,
        table_name: str,
        *,
        user_id: str | None = None,
    ) -> TableForms:
        data = await get_table(self.db, table_name, user_id=user_id)
        return TableForms(
            id=data["id"],
            name_sql=data["name_sql"],
            name_form=data["name_form"],
            category_id=data["category_id"],
            columns=[ColumnTable(**column) for column in data["columns"]],
        )

    async def get_foreign_key_lookup(
        self,
        *,
        user_id: str | None = None,
        table_name: str,
        column_name: str,
        q: str | None = None,
        limit: int = DEFAULT_LOOKUP_LIMIT,
        offset: int = 0,
    ) -> dict[str, Any]:
        return await get_foreign_key_lookup(
            self.db,
            user_id=user_id,
            table_name=table_name,
            column_name=column_name,
            q=q,
            limit=limit,
            offset=offset,
        )

    async def get_next_consecutive(
        self,
        *,
        table_name: str,
        column_name: str,
        user_id: str | None = None,
    ) -> dict[str, int]:
        return await get_next_consecutive(
            self.db,
            table_name=table_name,
            column_name=column_name,
            user_id=user_id,
        )

    async def get_unassigned_orders(
        self,
        *,
        table_name: str,
        order_column: str,
        client_column: str,
        legacy_column: str,
        user_id: str | None = None,
        q: str | None = None,
        limit: int = DEFAULT_LOOKUP_LIMIT,
        offset: int = 0,
        sqlserver_conn: object | None = None,
    ) -> dict[str, Any]:
        return await get_unassigned_orders(
            self.db,
            table_name=table_name,
            order_column=order_column,
            client_column=client_column,
            legacy_column=legacy_column,
            user_id=user_id,
            q=q,
            limit=limit,
            offset=offset,
            sqlserver_conn=sqlserver_conn,
        )

    async def get_column_values(
        self,
        table_name: str,
        column_name: str,
        *,
        user_id: str | None = None,
        q: str | None = None,
        limit: int = DEFAULT_LOOKUP_LIMIT,
        offset: int = 0,
    ) -> dict[str, Any]:
        return await get_column_values(
            self.db,
            table_name,
            column_name,
            user_id=user_id,
            q=q,
            limit=limit,
            offset=offset,
        )

    async def submit_form(
        self,
        submit_data: SubmitForm,
        *,
        user_id: str | None = None,
    ) -> str:
        return await new_tabledata(self.db, submit_data, user_id=user_id)
