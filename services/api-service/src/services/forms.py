import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

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


def _validate_sql_identifier(identifier: str, *, field_name: str) -> str:
    normalized = _normalize_identifier(identifier)
    if not IDENTIFIER_REGEX.fullmatch(normalized):
        raise IdentifierValidationError(
            detail=f"Invalid identifier in {field_name}: {identifier}",
        )
    return normalized


def _quote_identifier(identifier: str, *, field_name: str) -> str:
    validated = _validate_sql_identifier(identifier, field_name=field_name)
    return f'"{validated}"'


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
) -> list[dict[str, Any]]:
    if table_name is None:
        query = text(
            """
            SELECT id, nombre_tabla_sql, nombre_tabla_ui, categoria_id
            FROM workspace.ui_config_tablas
            WHERE es_visible = true
            ORDER BY id
            """
        )
        result = await db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    query = text(
        """
        SELECT id, nombre_tabla_sql, nombre_tabla_ui, categoria_id
        FROM workspace.ui_config_tablas
        WHERE es_visible = true
          AND lower(nombre_tabla_sql) = :table_name
        ORDER BY id
        """
    )
    result = await db.execute(query, {"table_name": table_name})
    return [dict(row) for row in result.mappings().all()]


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
            _validate_sql_identifier(
                table_config["nombre_tabla_sql"],
                field_name="workspace.ui_config_tablas.nombre_tabla_sql",
            ).lower()
        )

    foreign_keys = await _get_foreign_key_metadata(
        db,
        schema_name=FORMS_SCHEMA,
        source_tables=visible_tables,
    )
    enum_values_by_udt = await _get_enum_values_by_udt(db, schema_name=FORMS_SCHEMA)
    fk_reference_cache = await _build_fk_reference_cache(db, foreign_keys=foreign_keys)

    payload: list[dict[str, Any]] = []
    for table_config in tables_config:
        table_name = _validate_sql_identifier(
            table_config["nombre_tabla_sql"],
            field_name="workspace.ui_config_tablas.nombre_tabla_sql",
        ).lower()
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
            udt_name = column.get("udt_name")
            enum_values = None
            if udt_name:
                enum_values = enum_values_by_udt.get(
                    _normalize_identifier(udt_name).lower()
                )

            column_payload: dict[str, Any] = {
                "name": column["column_name"],
                "type": column["data_type"],
                "nullable": column.get("is_nullable") == "YES",
                "required": column.get("is_nullable") != "YES",
                "max_length": column.get("character_maximum_length"),
                "default_value": (
                    str(column["column_default"])
                    if column.get("column_default") is not None
                    else None
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


async def get_tables(db: AsyncSession) -> list[dict[str, Any]]:
    """
    Obtiene metadata liviana de tablas visibles y columnas (sin opciones FK masivas).
    """
    try:
        tables_config = await _get_visible_table_configs(db)
        return await _build_tables_payload(db, tables_config=tables_config)
    except IdentifierValidationError:
        raise
    except Exception as error:
        raise DBCommunicationError(f"Error obteniendo tablas: {error}")


async def get_table(db: AsyncSession, table_name: str) -> dict[str, Any]:
    table_identifier = _validate_sql_identifier(
        table_name, field_name="table_name"
    ).lower()

    try:
        tables_config = await _get_visible_table_configs(
            db, table_name=table_identifier
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
    table_name: str,
    column_name: str,
    q: str | None = None,
    limit: int = DEFAULT_LOOKUP_LIMIT,
    offset: int = 0,
) -> dict[str, Any]:
    table_identifier = _validate_sql_identifier(
        table_name, field_name="table_name"
    ).lower()
    column_identifier = _validate_sql_identifier(
        column_name, field_name="column_name"
    ).lower()
    _validate_lookup_pagination(limit=limit, offset=offset)

    try:
        allowed_tables = await get_allowed_tables(db)
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


async def new_tabledata(db: AsyncSession, submit_form: SubmitForm) -> str:
    """
    Inserta datos dinamicamente en la tabla especificada.
    """
    correlation_id = f"tb_{int(datetime.now(timezone.utc).timestamp())}"
    table_name = _validate_sql_identifier(
        submit_form.table_name, field_name="table_name"
    ).lower()

    await validate_submit_identifiers(db, submit_form)

    row_data: dict[str, Any] = {}
    for item in submit_form.data:
        normalized_column = _validate_sql_identifier(
            item.column, field_name="column"
        ).lower()
        row_data[normalized_column] = item.value

    if not row_data:
        raise DBCommunicationError("No hay datos para insertar")

    try:
        columns = ", ".join(
            _quote_identifier(column, field_name="column") for column in row_data.keys()
        )
        placeholders = ", ".join([f":{key}" for key in row_data.keys()])

        query = text(
            f"INSERT INTO {_quote_identifier(FORMS_SCHEMA, field_name='schema')}.{_quote_identifier(table_name, field_name='table_name')} ({columns}) VALUES ({placeholders})"
        )

        await db.execute(query, row_data)
        await db.commit()
    except Exception as error:
        await db.rollback()
        raise DBCommunicationError(f"No se pudo insertar en {table_name}: {error}")

    return correlation_id


async def get_allowed_tables(db: AsyncSession) -> set[str]:
    try:
        query = text(
            """
            SELECT nombre_tabla_sql
            FROM workspace.ui_config_tablas
            WHERE es_visible = true
            """
        )
        result = await db.execute(query)
        return {
            _validate_sql_identifier(
                row["nombre_tabla_sql"], field_name="allowed_table"
            ).lower()
            for row in result.mappings()
            if row["nombre_tabla_sql"]
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
    db: AsyncSession, submit_form: SubmitForm
) -> None:
    table_name = _validate_sql_identifier(
        submit_form.table_name, field_name="table_name"
    ).lower()
    allowed_tables = await get_allowed_tables(db)

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

    async def get_tables(self) -> list[TableForms]:
        data = await get_tables(self.db)
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

    async def get_table(self, table_name: str) -> TableForms:
        data = await get_table(self.db, table_name)
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
        table_name: str,
        column_name: str,
        q: str | None = None,
        limit: int = DEFAULT_LOOKUP_LIMIT,
        offset: int = 0,
    ) -> dict[str, Any]:
        return await get_foreign_key_lookup(
            self.db,
            table_name=table_name,
            column_name=column_name,
            q=q,
            limit=limit,
            offset=offset,
        )

    async def submit_form(self, submit_data: SubmitForm) -> str:
        return await new_tabledata(self.db, submit_data)
