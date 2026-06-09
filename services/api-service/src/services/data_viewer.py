from __future__ import annotations

import csv
import io
import json
import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, AsyncIterator, Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.schemas.models import (
    DATA_VIEWER_IDENTIFIER_PATTERN,
    DataViewerQueryRequest,
    DataViewerQueryResponse,
    DataViewerRowUpdateRequest,
    DataViewerRowUpdateResponse,
    DataViewerTable,
    DataViewerColumn,
)

logger = get_logger(__name__)

TEXTUAL_TYPES = {
    "character varying",
    "character",
    "text",
    "citext",
    "varchar",
    "char",
    "name",
    "uuid",
}
SUPPORTED_FILTER_OPERATORS = {"eq", "contains", "gt", "lt", "in", "between"}
DEFAULT_COUNT_TIMEOUT_MS = 8000
DEFAULT_EXPORT_TIMEOUT_MS = 12000
MAX_EXPORT_ROWS = 10000
EXPORT_CHUNK_SIZE = 1000
IDENTIFIER_REGEX = re.compile(DATA_VIEWER_IDENTIFIER_PATTERN)
IN_CHECK_PATTERN = re.compile(
    r'\b(?P<column>"?[A-Za-z_][A-Za-z0-9_]*"?)\s+IN\s*\((?P<values>[^)]*)\)',
    re.IGNORECASE,
)
ANY_ARRAY_CHECK_PATTERN = re.compile(
    r'\b(?P<column>"?[A-Za-z_][A-Za-z0-9_]*"?)\s*\)?\s*::text\s*=\s*ANY\s*\(\s*\(*\s*ARRAY\[(?P<values>[^\]]*)\]',
    re.IGNORECASE,
)
CHECK_VALUES_PATTERN = re.compile(r"'((?:''|[^'])*)'")
TEMPORARY_READ_ONLY_COLUMNS = {"id", "timestamp"}
FK_LABEL_PRIORITY = (
    "nombre",
    "name",
    "descripcion",
    "description",
    "item_legado",
    "title",
    "label",
    "codigo",
    "code",
    "oc_cliente",
    "oc_interno",
    "referencia",
)
RECENT_DATE_COLUMN_PRIORITY = (
    "fecha_creacion",
    "created_at",
    "fecha",
    "fecha_produccion",
    "fecha_entrega",
    "fecha_inicio",
    "fecha_programada",
    "updated_at",
    "timestamp",
)
ORDER_STATUS_COLUMN_PRIORITY = (
    "estado",
    "status",
    "estado_oc",
    "estado_orden",
    "estado_orden_compra",
)
ORDER_REQUEST_DATE_COLUMN_PRIORITY = (
    "fecha_pedido",
    "fecha_orden",
    "fecha_oc",
    "fecha",
    "created_at",
)
ITEM_ORDER_COLUMN_PRIORITY = (
    "id_orden_compra",
    "orden_compra_id",
    "ordencompra_id",
    "orden_compra",
    "ordencompra",
    "id_oc",
    "oc_id",
    "oc",
)
ORDER_TABLE_NAME_CANDIDATES = {
    "ordencompra",
    "orden_compra",
    "ordenes_compra",
    "ordenes_de_compra",
}
ORDER_PRODUCT_COLUMN_PRIORITY = (
    "id_producto",
    "producto_id",
    "producto",
    "productos",
    "producto_nombre",
    "nombre_producto",
    "referencia",
    "sku",
)
PRODUCT_TABLE_NAME_CANDIDATES = {"producto", "productos"}
PRODUCT_VALUE_COLUMN_PRIORITY = (
    "id",
    "id_producto",
    "producto_id",
    "codigo",
    "codigo_producto",
    "sku",
    "referencia",
    "nombre",
    "producto",
)
PRODUCT_COST_COLUMN_PRIORITY = (
    "costo",
    "cost",
    "costo_unitario",
    "precio_costo",
    "cost_price",
    "valor_costo",
    "precio",
    "valor",
)
ITEM_REFERENCE_COLUMN_PRIORITY = (
    "id_item",
    "item_id",
    "item",
    "item_legado",
    "id_item_legado",
)
ITEM_TABLE_NAME_CANDIDATES = {"item", "items", "ítem", "ítems", "item_legado", "items_legado"}
ORDER_PROCESS_TABLE_NAME_CANDIDATES = {
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
}
UPHOLSTERY_HISTORY_TABLES = (
    ("historialconsumotela", "Historial consumo tela"),
    ("historialconsumomaterial", "Historial consumo material"),
)
ROW_STATUS_COLUMN_PRIORITY = (
    "estado",
    "status",
    "estado_proceso",
    "estado_orden_proceso",
)
ACTIVE_PENDING_STATUS_VALUES = (
    "pendiente",
    "pendientes",
    "en proceso",
    "en_proceso",
    "proceso",
    "retrasado",
    "retrasada",
    "retrasados",
    "retrasadas",
)
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


class DataViewerError(Exception):
    def __init__(self, detail: str, code: str, status_code: int) -> None:
        self.detail = detail
        self.code = code
        self.status_code = status_code
        super().__init__(detail)


class DBCommunicationError(DataViewerError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail=detail, code="INTERNAL_ERROR", status_code=500)


class IdentifierValidationError(DataViewerError):
    def __init__(self, detail: str, code: str = "INVALID_IDENTIFIER") -> None:
        super().__init__(detail=detail, code=code, status_code=422)


class InvalidFilterError(DataViewerError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail=detail, code="INVALID_FILTER", status_code=422)


class UnsupportedOperatorError(DataViewerError):
    def __init__(self, operator: str) -> None:
        super().__init__(
            detail=f"Unsupported operator: {operator}",
            code="UNSUPPORTED_OPERATOR",
            status_code=422,
        )


class QueryTimeoutError(DataViewerError):
    def __init__(self, detail: str = "Query timeout") -> None:
        super().__init__(detail=detail, code="QUERY_TIMEOUT", status_code=504)


class TableNotConfiguredError(DataViewerError):
    def __init__(self, table_id: str) -> None:
        super().__init__(
            detail=f"Table not configured for DataViewer: {table_id}",
            code="TABLE_NOT_CONFIGURED",
            status_code=422,
        )


class LimitExceededError(DataViewerError):
    def __init__(self, detail: str = "Limit exceeds the maximum allowed value") -> None:
        super().__init__(detail=detail, code="LIMIT_EXCEEDED", status_code=422)


class NoStableOrderColumnError(DataViewerError):
    def __init__(self, table_id: str) -> None:
        super().__init__(
            detail=(
                f"Table {table_id} has no PK and no configured stable/default order column"
            ),
            code="NO_STABLE_ORDER_COLUMN",
            status_code=422,
        )


class ExportMaxExceededError(DataViewerError):
    def __init__(self, max_rows: int) -> None:
        super().__init__(
            detail=f"Export exceeds maximum supported rows ({max_rows})",
            code="EXPORT_MAX_EXCEEDED",
            status_code=422,
        )


class NoPkDefinedError(DataViewerError):
    def __init__(self, table_id: str) -> None:
        super().__init__(
            detail=f"Table {table_id} has no primary key configured",
            code="NO_PK_DEFINED",
            status_code=422,
        )


class TableNotEditableError(DataViewerError):
    def __init__(self, table_id: str) -> None:
        super().__init__(
            detail=f"Table {table_id} is not editable",
            code="TABLE_NOT_EDITABLE",
            status_code=422,
        )


class PKRequiredError(DataViewerError):
    def __init__(self, detail: str) -> None:
        super().__init__(
            detail=detail,
            code="PK_REQUIRED",
            status_code=422,
        )


class ColumnNotEditableError(DataViewerError):
    def __init__(self, column: str) -> None:
        super().__init__(
            detail=f"Column {column} is not editable",
            code="COLUMN_NOT_EDITABLE",
            status_code=422,
        )


class RowNotFoundError(DataViewerError):
    def __init__(self, table_id: str) -> None:
        super().__init__(
            detail=f"Row not found in table {table_id}",
            code="ROW_NOT_FOUND",
            status_code=404,
        )


@dataclass
class TableConfig:
    table_id: str
    schema_name: str
    table_name: str
    full_table_name: str
    display_name: str | None
    stable_order_column: str | None
    default_order_column: str | None
    can_update: bool | None
    can_insert: bool | None
    can_delete: bool | None
    view_order_status: str | None = None
    view_row_status: str | None = None
    view_item_order_status: str | None = None


@dataclass
class TableMetadata:
    config: TableConfig
    columns: list[dict[str, Any]]
    allowed_columns: set[str]
    text_columns: set[str]
    pk_columns: list[str]
    has_pk: bool
    editable_columns: set[str]
    can_update: bool
    can_insert: bool
    can_delete: bool
    stable_order_column: str | None
    default_order_column: str | None
    display_select_sql: dict[str, str]
    column_expression_sql: dict[str, str]


@dataclass
class QueryPlan:
    table_id: str
    table_ref: str
    selected_columns: list[str]
    select_sql: str
    base_from_where_sql: str
    where_params: dict[str, Any]
    order_clause_sql: str
    metadata: TableMetadata


@dataclass
class CsvExportResult:
    filename: str
    stream: AsyncIterator[bytes]
    row_count: int


def _normalize_identifier(identifier: str) -> str:
    return identifier.strip().strip('"')


def _extract_check_enum_values(definition: str) -> tuple[str, list[str]] | None:
    for pattern in (IN_CHECK_PATTERN, ANY_ARRAY_CHECK_PATTERN):
        match = pattern.search(definition)
        if not match:
            continue

        column = _normalize_identifier(match.group("column")).lower()
        raw_values = match.group("values")
        values = [
            value.replace("''", "'")
            for value in CHECK_VALUES_PATTERN.findall(raw_values)
        ]
        if values:
            return column, values

    return None


def _is_timeout_error(error: Exception) -> bool:
    lowered = str(error).lower()
    timeout_fragments = (
        "statement timeout",
        "canceling statement due to statement timeout",
        "query timeout",
    )
    return any(fragment in lowered for fragment in timeout_fragments)


def _validate_sql_identifier(identifier: str, *, field_name: str) -> str:
    normalized = _normalize_identifier(identifier)
    if not IDENTIFIER_REGEX.fullmatch(normalized):
        raise IdentifierValidationError(
            detail=f"Invalid identifier in {field_name}: {identifier}",
        )
    return normalized


def _quote_identifier(identifier: str) -> str:
    validated = _validate_sql_identifier(identifier, field_name="identifier")
    return f'"{validated}"'


def _column_ref(column: str) -> str:
    return f"t.{_quote_identifier(column)}"


def _split_schema_table(full_table_name: str) -> tuple[str, str]:
    normalized = full_table_name.strip()
    if "." in normalized:
        schema_name, table_name = normalized.split(".", 1)
    else:
        schema_name, table_name = "data", normalized

    schema_name = _validate_sql_identifier(schema_name, field_name="schema")
    table_name = _validate_sql_identifier(table_name, field_name="table")
    return schema_name, table_name


def _to_optional_bool(value: Any) -> bool | None:
    if value is None:
        return None
    return bool(value)


async def _get_user_role_id(db: AsyncSession, *, user_id: str | None) -> str | None:
    if not user_id:
        return None

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


async def _resolve_role_tables_columns(
    db: AsyncSession,
) -> dict[str, str] | None:
    query = text(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'workspace'
          AND table_name = 'role_tables'
        """
    )
    result = await db.execute(query)
    column_names = {row["column_name"] for row in result.mappings().all()}

    if not column_names:
        return None

    if "role_id" not in column_names or "table_id" not in column_names:
        return None

    visible_column = "visible" if "visible" in column_names else None
    edit_column = "can_edit" if "can_edit" in column_names else None
    if edit_column is None and "edit" in column_names:
        edit_column = "edit"

    if not visible_column or not edit_column:
        return None

    return {
        "visible": visible_column,
        "edit": edit_column,
    }


async def _get_table_columns(
    db: AsyncSession,
    *,
    schema_name: str,
    table_name: str,
) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = :schema_name
          AND table_name = :table_name
        ORDER BY ordinal_position
        """
    )
    result = await db.execute(
        query,
        {"schema_name": schema_name, "table_name": table_name},
    )
    return [dict(row) for row in result.mappings().all()]


async def _get_foreign_key_metadata(
    db: AsyncSession,
    *,
    schema_name: str,
    source_table: str,
) -> dict[str, dict[str, str]]:
    query = text(
        """
        SELECT
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
          AND tc.table_name = :source_table
        """
    )
    result = await db.execute(
        query,
        {"schema_name": schema_name, "source_table": source_table},
    )

    metadata: dict[str, dict[str, str]] = {}
    for row in result.mappings().all():
        source_column = _normalize_identifier(row["source_column"]).lower()
        metadata[source_column] = {
            "referenced_schema": _normalize_identifier(row["referenced_schema"]).lower(),
            "referenced_table": _normalize_identifier(row["referenced_table"]).lower(),
            "referenced_column": _normalize_identifier(row["referenced_column"]).lower(),
        }
    return metadata


async def _find_existing_table(
    db: AsyncSession,
    *,
    schema_name: str,
    table_candidates: set[str],
) -> str | None:
    query = text(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = :schema_name
          AND table_type IN ('BASE TABLE', 'VIEW')
        """
    )
    result = await db.execute(query, {"schema_name": schema_name})
    for row in result.mappings().all():
        table_name = _normalize_identifier(row["table_name"]).lower()
        if table_name in table_candidates:
            return table_name
    return None


def _choose_existing_column(
    columns: list[dict[str, Any]],
    candidates: tuple[str, ...],
) -> str | None:
    columns_by_lower = {
        _normalize_identifier(column["column_name"]).lower(): _normalize_identifier(column["column_name"])
        for column in columns
        if column.get("column_name")
    }
    for candidate in candidates:
        if candidate in columns_by_lower:
            return columns_by_lower[candidate]
    return None


async def _resolve_reference_from_column(
    db: AsyncSession,
    *,
    schema_name: str,
    source_table: str,
    source_column: str,
    fallback_table_candidates: set[str],
    fallback_value_candidates: tuple[str, ...],
) -> dict[str, str] | None:
    foreign_keys = await _get_foreign_key_metadata(
        db,
        schema_name=schema_name,
        source_table=source_table,
    )
    fk_info = foreign_keys.get(source_column.lower())
    if fk_info:
        return fk_info

    referenced_table = await _find_existing_table(
        db,
        schema_name=schema_name,
        table_candidates=fallback_table_candidates,
    )
    if not referenced_table:
        return None

    referenced_columns = await _get_table_columns(
        db,
        schema_name=schema_name,
        table_name=referenced_table,
    )
    referenced_column = _choose_existing_column(
        referenced_columns,
        (source_column.lower(), *fallback_value_candidates),
    )
    if not referenced_column:
        return None

    return {
        "referenced_schema": schema_name,
        "referenced_table": referenced_table,
        "referenced_column": referenced_column,
    }


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


def _parse_iso_datetime(value: str) -> datetime:
    normalized_value = value.strip()
    if normalized_value.endswith("Z"):
        normalized_value = f"{normalized_value[:-1]}+00:00"

    parsed_value = datetime.fromisoformat(normalized_value)
    if parsed_value.tzinfo is not None:
        return parsed_value.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed_value


def _coerce_update_value_for_column(value: Any, column: dict[str, Any]) -> Any:
    if value is None or not isinstance(value, str):
        return value

    data_type = str(column.get("type") or "").lower()
    if data_type == "date":
        parsed_value = _parse_iso_datetime(value) if "T" in value else date.fromisoformat(value)
        return parsed_value.date() if isinstance(parsed_value, datetime) else parsed_value

    if "timestamp" in data_type or data_type == "datetime":
        return _parse_iso_datetime(value)

    return value


def _resolve_view_status_values(status_value: str) -> list[str]:
    normalized_status = status_value.strip().lower()
    if normalized_status.startswith("finaliz"):
        return list(FINALIZED_STATUS_VALUES)
    if normalized_status == "pendiente":
        return list(ACTIVE_PENDING_STATUS_VALUES)
    return [normalized_status]


class DataViewerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tables(self, *, user_id: str | None = None) -> list[DataViewerTable]:
        table_configs = await self._get_allowlist_map(user_id=user_id)
        tables: list[DataViewerTable] = []

        for table_id in sorted(table_configs):
            metadata = await self._get_table_metadata(table_configs[table_id])
            order_error_code = None
            if not metadata.has_pk and not (
                metadata.stable_order_column or metadata.default_order_column
            ):
                order_error_code = "NO_STABLE_ORDER_COLUMN"

            filtered_columns = [
                DataViewerColumn(**column)
                for column in metadata.columns
                if column.get("name") != "timestamp"
            ]
            tables.append(
                DataViewerTable(
                    table_id=metadata.config.table_id,
                    table_name=metadata.config.full_table_name,
                    display_name=metadata.config.display_name,
                    has_pk=metadata.has_pk,
                    stable_order_column=metadata.stable_order_column,
                    default_order_column=metadata.default_order_column,
                    order_error_code=order_error_code,
                    can_update=metadata.can_update,
                    can_insert=metadata.can_insert,
                    can_delete=metadata.can_delete,
                    pk_columns=metadata.pk_columns,
                    columns=filtered_columns,
                )
            )

        return tables

    async def get_table_configs(
        self,
        *,
        user_id: str | None = None,
    ) -> list[TableConfig]:
        table_configs = await self._get_allowlist_map(user_id=user_id)
        return [table_configs[table_id] for table_id in sorted(table_configs)]

    async def query(
        self,
        request_data: DataViewerQueryRequest,
        *,
        user_id: str | None = None,
    ) -> DataViewerQueryResponse:
        if request_data.limit > 200:
            raise LimitExceededError()

        plan = await self._build_query_plan(request_data, user_id=user_id)
        started_at = time.perf_counter()

        query_params = dict(plan.where_params)
        query_params["limit"] = request_data.limit + 1
        query_params["offset"] = request_data.offset

        data_sql = (
            f"SELECT {plan.select_sql} {plan.base_from_where_sql} "
            f"{plan.order_clause_sql} LIMIT :limit OFFSET :offset"
        )

        try:
            data_result = await self.db.execute(text(data_sql), query_params)
            raw_rows = data_result.mappings().all()
        except Exception as error:
            if _is_timeout_error(error):
                raise QueryTimeoutError()
            raise DBCommunicationError(f"Error running DataViewer query: {error}")

        has_more = len(raw_rows) > request_data.limit
        rows = [
            {column: row.get(column) for column in plan.selected_columns}
            for row in raw_rows[: request_data.limit]
        ]

        total_count: int | None = None
        if request_data.include_total:
            total_count = await self._run_count_query(
                plan.base_from_where_sql,
                plan.where_params,
                timeout_ms=DEFAULT_COUNT_TIMEOUT_MS,
            )

        elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
        logger.info(
            "data_viewer.query table_id=%s query_time_ms=%s row_count=%s include_total=%s",
            request_data.table_id,
            elapsed_ms,
            len(rows),
            request_data.include_total,
        )

        return DataViewerQueryResponse(
            rows=rows,
            total_count=total_count,
            limit=request_data.limit,
            offset=request_data.offset,
            has_more=has_more,
        )

    async def patch_row(
        self,
        request_data: DataViewerRowUpdateRequest,
        *,
        user_id: str | None = None,
    ) -> DataViewerRowUpdateResponse:
        allowlist = await self._get_allowlist_map(user_id=user_id)
        table_config = allowlist.get(request_data.table_id)
        if not table_config:
            raise TableNotConfiguredError(request_data.table_id)

        metadata = await self._get_table_metadata(table_config)
        if not metadata.has_pk:
            raise NoPkDefinedError(request_data.table_id)
        if not metadata.can_update:
            raise TableNotEditableError(request_data.table_id)

        normalized_pk = self._validate_pk_payload(request_data.pk, metadata)
        normalized_changes = self._validate_changes_payload(
            request_data.changes, metadata
        )

        table_ref = (
            f"{_quote_identifier(table_config.schema_name)}."
            f"{_quote_identifier(table_config.table_name)}"
        )
        update_columns = list(normalized_changes.keys())

        set_clauses: list[str] = []
        query_params: dict[str, Any] = {}

        for index, column_name in enumerate(update_columns):
            value_key = f"set_value_{index}"
            set_clauses.append(f"{_quote_identifier(column_name)} = :{value_key}")
            query_params[value_key] = normalized_changes[column_name]

        where_clauses: list[str] = []
        for index, pk_column in enumerate(metadata.pk_columns):
            pk_key = f"pk_value_{index}"
            where_clauses.append(f"{_quote_identifier(pk_column)} = :{pk_key}")
            query_params[pk_key] = normalized_pk[pk_column]

        where_sql = " AND ".join(where_clauses)
        update_sql = (
            f"UPDATE {table_ref} "
            f"SET {', '.join(set_clauses)} "
            f"WHERE {where_sql} "
            f"RETURNING {self._build_returning_sql(metadata)}"
        )

        try:
            update_result = await self.db.execute(text(update_sql), query_params)
            updated_row = update_result.mappings().first()

            if not updated_row:
                raise RowNotFoundError(request_data.table_id)

            await self.db.commit()
        except DataViewerError:
            await self.db.rollback()
            raise
        except Exception as error:
            await self.db.rollback()
            raise DBCommunicationError(f"Error patching DataViewer row: {error}")

        returned_columns = [column["name"] for column in metadata.columns]
        row_payload = {column: updated_row.get(column) for column in returned_columns}

        return DataViewerRowUpdateResponse(
            row=row_payload,
            updated_columns=update_columns,
        )

    async def export_csv(
        self,
        request_data: DataViewerQueryRequest,
        *,
        user_id: str | None = None,
    ) -> CsvExportResult:
        plan = await self._build_query_plan(request_data, user_id=user_id)

        total_rows = await self._run_count_query(
            plan.base_from_where_sql,
            plan.where_params,
            timeout_ms=DEFAULT_EXPORT_TIMEOUT_MS,
        )
        if total_rows > MAX_EXPORT_ROWS:
            raise ExportMaxExceededError(max_rows=MAX_EXPORT_ROWS)

        filename = (
            f"data_viewer_{request_data.table_id}_"
            f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.csv"
        )

        logger.info(
            "data_viewer.export table_id=%s row_count=%s",
            request_data.table_id,
            total_rows,
        )

        return CsvExportResult(
            filename=filename,
            stream=self._stream_csv_rows(
                plan=plan,
                total_rows=total_rows,
            ),
            row_count=total_rows,
        )

    async def _get_allowlist_map(
        self,
        *,
        user_id: str | None = None,
    ) -> dict[str, TableConfig]:
        available_columns_query = text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'workspace'
              AND table_name = 'ui_config_tablas'
            """
        )

        try:
            available_columns_result = await self.db.execute(available_columns_query)
            available_columns = {
                row["column_name"] for row in available_columns_result.mappings().all()
            }
        except Exception as error:
            raise DBCommunicationError(
                f"Error reading DataViewer config metadata: {error}"
            )

        table_id_expression = (
            "CAST(table_id AS TEXT)"
            if "table_id" in available_columns
            else "CAST(id AS TEXT)"
        )

        select_columns = [
            f"{table_id_expression} AS table_id",
            "CAST(id AS TEXT) AS ui_config_id",
            "nombre_tabla_sql",
            "nombre_tabla_ui",
        ]

        if "stable_order_column" in available_columns:
            select_columns.append("stable_order_column")
        if "default_order_column" in available_columns:
            select_columns.append("default_order_column")
        if "can_update" in available_columns:
            select_columns.append("can_update")
        if "can_insert" in available_columns:
            select_columns.append("can_insert")
        if "can_delete" in available_columns:
            select_columns.append("can_delete")

        allowlist_query = text(
            f"""
            SELECT {", ".join(select_columns)}
            FROM workspace.ui_config_tablas
            WHERE es_visible = true
            """
        )

        try:
            allowlist_result = await self.db.execute(allowlist_query)
            rows = allowlist_result.mappings().all()
        except Exception as error:
            raise DBCommunicationError(
                f"Error loading DataViewer allowlist from workspace.ui_config_tablas: {error}"
            )

        role_permissions_by_table: dict[str, tuple[bool, bool]] = {}
        if user_id:
            try:
                role_id = await _get_user_role_id(self.db, user_id=user_id)
                role_tables_columns = await _resolve_role_tables_columns(self.db)
                if role_id and role_tables_columns:
                    visible_column = role_tables_columns["visible"].replace('"', '""')
                    edit_column = role_tables_columns["edit"].replace('"', '""')

                    role_permissions_query = text(
                        f"""
                        SELECT
                            CAST(table_id AS TEXT) AS table_id,
                            COALESCE("{visible_column}", true) AS is_visible,
                            COALESCE("{edit_column}", true) AS can_edit
                        FROM workspace.role_tables
                        WHERE role_id = :role_id
                        """
                    )
                    role_permissions_result = await self.db.execute(
                        role_permissions_query,
                        {"role_id": role_id},
                    )
                    role_permissions_by_table = {
                        str(row["table_id"]).strip(): (
                            bool(row["is_visible"]),
                            bool(row["can_edit"]),
                        )
                        for row in role_permissions_result.mappings().all()
                        if row.get("table_id") is not None
                    }

                if role_id:
                    data_viewer_permissions_available = await self.db.execute(
                        text(
                            """
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'workspace'
                              AND table_name = 'role_data_viewer_tables'
                            LIMIT 1
                            """
                        )
                    )
                    if data_viewer_permissions_available.scalar_one_or_none() is not None:
                        data_viewer_permissions_query = text(
                            """
                            SELECT
                                CAST(table_id AS TEXT) AS table_id,
                                COALESCE(visible, false) AS is_visible,
                                COALESCE(can_edit, false) AS can_edit
                            FROM workspace.role_data_viewer_tables
                            WHERE role_id = :role_id
                            """
                        )
                        data_viewer_permissions_result = await self.db.execute(
                            data_viewer_permissions_query,
                            {"role_id": role_id},
                        )
                        role_permissions_by_table.update(
                            {
                                str(row["table_id"]).strip(): (
                                    bool(row["is_visible"]),
                                    bool(row["can_edit"]),
                                )
                                for row in data_viewer_permissions_result.mappings().all()
                                if row.get("table_id") is not None
                            }
                        )
            except Exception as error:
                raise DBCommunicationError(
                    f"Error loading DataViewer role permissions from workspace.role_tables: {error}"
                )

        allowlist: dict[str, TableConfig] = {}
        for row in rows:
            table_id = str(row["table_id"]).strip()
            if not table_id:
                continue

            ui_config_id = str(row.get("ui_config_id") or "").strip()
            role_permissions = role_permissions_by_table.get(
                table_id,
                role_permissions_by_table.get(ui_config_id),
            )
            if role_permissions is not None and not role_permissions[0]:
                continue

            full_table_name = (row.get("nombre_tabla_sql") or "").strip()
            if not full_table_name:
                continue

            schema_name, table_name = _split_schema_table(full_table_name)

            stable_order_column = row.get("stable_order_column")
            if stable_order_column:
                stable_order_column = _validate_sql_identifier(
                    str(stable_order_column),
                    field_name="stable_order_column",
                )

            default_order_column = row.get("default_order_column")
            if default_order_column:
                default_order_column = _validate_sql_identifier(
                    str(default_order_column),
                    field_name="default_order_column",
                )

            if table_id in allowlist:
                raise DBCommunicationError(
                    f"Duplicated DataViewer table_id in allowlist: {table_id}"
                )

            allowlist[table_id] = TableConfig(
                table_id=table_id,
                schema_name=schema_name,
                table_name=table_name,
                full_table_name=f"{schema_name}.{table_name}",
                display_name=(row.get("nombre_tabla_ui") or None),
                stable_order_column=stable_order_column,
                default_order_column=default_order_column,
                can_update=(
                    False
                    if role_permissions is not None and not role_permissions[1]
                    else _to_optional_bool(row.get("can_update"))
                ),
                can_insert=_to_optional_bool(row.get("can_insert")),
                can_delete=_to_optional_bool(row.get("can_delete")),
            )

        expanded_allowlist = dict(allowlist)
        for table_config in list(allowlist.values()):
            item_name_candidates = {
                table_config.table_name.lower(),
                table_config.full_table_name.lower().split(".")[-1],
                table_config.table_id.lower(),
                (table_config.display_name or "").strip().lower(),
            }
            if item_name_candidates.isdisjoint(ITEM_TABLE_NAME_CANDIDATES):
                continue

            base_label = "Items"
            virtual_tables = (
                ("items_en_proceso", "pendiente", f"{base_label} en proceso"),
                ("items_finalizados", "finalizado", f"{base_label} finalizados"),
            )
            for virtual_table_id, status_value, display_name in virtual_tables:
                if virtual_table_id in expanded_allowlist:
                    continue

                expanded_allowlist[virtual_table_id] = TableConfig(
                    table_id=virtual_table_id,
                    schema_name=table_config.schema_name,
                    table_name=table_config.table_name,
                    full_table_name=table_config.full_table_name,
                    display_name=display_name,
                    stable_order_column=table_config.stable_order_column,
                    default_order_column=table_config.default_order_column,
                    can_update=table_config.can_update,
                    can_insert=table_config.can_insert,
                    can_delete=table_config.can_delete,
                    view_order_status=status_value,
                )
            expanded_allowlist.pop(table_config.table_id, None)

        for table_config in list(allowlist.values()):
            order_name_candidates = {
                table_config.table_name.lower(),
                table_config.full_table_name.lower().split(".")[-1],
                table_config.table_id.lower(),
                (table_config.display_name or "").strip().lower(),
            }
            if order_name_candidates.isdisjoint(ORDER_TABLE_NAME_CANDIDATES):
                continue

            virtual_tables = (
                (
                    table_config.table_id,
                    "not_finalized",
                    "Ordenes de compra pendientes",
                ),
                (
                    "ordencompra_finalizadas",
                    "finalized",
                    "Ordenes de compra finalizadas",
                ),
            )
            for virtual_table_id, row_status, display_name in virtual_tables:
                expanded_allowlist[virtual_table_id] = TableConfig(
                    table_id=virtual_table_id,
                    schema_name=table_config.schema_name,
                    table_name=table_config.table_name,
                    full_table_name=table_config.full_table_name,
                    display_name=display_name,
                    stable_order_column=table_config.stable_order_column,
                    default_order_column=table_config.default_order_column,
                    can_update=table_config.can_update,
                    can_insert=table_config.can_insert,
                    can_delete=table_config.can_delete,
                    view_row_status=row_status,
                )

        for table_config in list(allowlist.values()):
            process_name_candidates = {
                table_config.table_name.lower(),
                table_config.full_table_name.lower().split(".")[-1],
                table_config.table_id.lower(),
                (table_config.display_name or "").strip().lower(),
            }
            if process_name_candidates.isdisjoint(ORDER_PROCESS_TABLE_NAME_CANDIDATES):
                continue

            expanded_allowlist.pop(table_config.table_id, None)
            virtual_tables = [
                (
                    "ordenproceso",
                    "pendiente",
                    "Orden proceso en proceso",
                ),
                (
                    "ordenproceso_finalizados",
                    "finalizado",
                    "Orden proceso finalizado",
                ),
            ]
            for virtual_table_id, item_order_status, display_name in virtual_tables:
                expanded_allowlist[virtual_table_id] = TableConfig(
                    table_id=virtual_table_id,
                    schema_name=table_config.schema_name,
                    table_name=table_config.table_name,
                    full_table_name=table_config.full_table_name,
                    display_name=display_name,
                    stable_order_column=table_config.stable_order_column,
                    default_order_column=table_config.default_order_column,
                    can_update=table_config.can_update,
                    can_insert=table_config.can_insert,
                    can_delete=table_config.can_delete,
                    view_item_order_status=item_order_status,
                )

        existing_data_tables = await self._get_existing_data_tables()
        for table_name, display_name in UPHOLSTERY_HISTORY_TABLES:
            if table_name not in existing_data_tables or table_name in expanded_allowlist:
                continue

            expanded_allowlist[table_name] = TableConfig(
                table_id=table_name,
                schema_name="data",
                table_name=table_name,
                full_table_name=f"data.{table_name}",
                display_name=display_name,
                stable_order_column=None,
                default_order_column=None,
                can_update=False,
                can_insert=False,
                can_delete=False,
            )

        await self._sync_purchase_order_statuses(expanded_allowlist)

        if user_id and role_permissions_by_table:
            for table_id, table_config in list(expanded_allowlist.items()):
                role_permissions = role_permissions_by_table.get(table_id)
                if role_permissions is None:
                    continue
                if not role_permissions[0]:
                    expanded_allowlist.pop(table_id, None)
                    continue
                if not role_permissions[1]:
                    table_config.can_update = False

        return expanded_allowlist

    async def _get_existing_data_tables(self) -> set[str]:
        query = text(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'data'
              AND table_type IN ('BASE TABLE', 'VIEW')
            """
        )
        try:
            result = await self.db.execute(query)
            return {
                _normalize_identifier(row["table_name"]).lower()
                for row in result.mappings().all()
                if row.get("table_name")
            }
        except Exception as error:
            raise DBCommunicationError(
                f"Error loading DataViewer data tables from information_schema: {error}"
            )

    async def _sync_purchase_order_statuses(
        self,
        table_configs: dict[str, TableConfig],
    ) -> None:
        order_config = self._find_table_config(
            table_configs.values(),
            ORDER_TABLE_NAME_CANDIDATES,
        )
        item_config = self._find_table_config(
            table_configs.values(),
            ITEM_TABLE_NAME_CANDIDATES,
        )
        if not order_config or not item_config:
            return

        try:
            order_columns = await _get_table_columns(
                self.db,
                schema_name=order_config.schema_name,
                table_name=order_config.table_name,
            )
            item_columns = await _get_table_columns(
                self.db,
                schema_name=item_config.schema_name,
                table_name=item_config.table_name,
            )

            order_status_column = _choose_existing_column(
                order_columns,
                ORDER_STATUS_COLUMN_PRIORITY,
            )
            order_date_column = _choose_existing_column(
                order_columns,
                ORDER_REQUEST_DATE_COLUMN_PRIORITY,
            )
            order_value_column = _choose_existing_column(
                order_columns,
                (
                    "id",
                    "id_orden_compra",
                    "ordencompra_id",
                    "orden_compra_id",
                    "oc",
                ),
            )
            item_order_column = _choose_existing_column(
                item_columns,
                ITEM_ORDER_COLUMN_PRIORITY,
            )
            if not (
                order_status_column
                and order_date_column
                and order_value_column
                and item_order_column
            ):
                return

            item_status_column = _choose_existing_column(
                item_columns,
                ROW_STATUS_COLUMN_PRIORITY,
            )
            item_status_filter = ""
            final_params = {
                f"sync_final_status_{index}": value
                for index, value in enumerate(FINALIZED_STATUS_VALUES)
            }
            final_placeholders = ", ".join(
                f":sync_final_status_{index}"
                for index in range(len(FINALIZED_STATUS_VALUES))
            )
            if item_status_column:
                item_status_ref = f"item_ref.{_quote_identifier(item_status_column)}"
                item_status_filter = (
                    f" AND ({item_status_ref} IS NULL OR "
                    f"LOWER(TRIM({item_status_ref}::text)) NOT IN ({final_placeholders}))"
                )

            order_table_ref = (
                f"{_quote_identifier(order_config.schema_name)}."
                f"{_quote_identifier(order_config.table_name)}"
            )
            item_table_ref = (
                f"{_quote_identifier(item_config.schema_name)}."
                f"{_quote_identifier(item_config.table_name)}"
            )
            order_status_ref = f"order_ref.{_quote_identifier(order_status_column)}"
            order_date_ref = f"order_ref.{_quote_identifier(order_date_column)}"
            order_value_ref = f"order_ref.{_quote_identifier(order_value_column)}"
            item_order_ref = f"item_ref.{_quote_identifier(item_order_column)}"
            not_finalized_order_clause = (
                f"({order_status_ref} IS NULL OR "
                f"LOWER(TRIM({order_status_ref}::text)) NOT IN ({final_placeholders}))"
            )
            linked_item_exists_clause = (
                f"EXISTS (SELECT 1 FROM {item_table_ref} item_ref "
                f"WHERE TRIM({item_order_ref}::text) = TRIM({order_value_ref}::text)"
                f"{item_status_filter})"
            )

            delayed_sql = text(
                f"""
                UPDATE {order_table_ref} AS order_ref
                SET {_quote_identifier(order_status_column)} = :delayed_status
                WHERE {order_date_ref} IS NOT NULL
                  AND {order_date_ref}::date < CURRENT_DATE - INTERVAL '15 days'
                  AND {not_finalized_order_clause}
                """
            )
            in_process_sql = text(
                f"""
                UPDATE {order_table_ref} AS order_ref
                SET {_quote_identifier(order_status_column)} = :in_process_status
                WHERE {order_date_ref} IS NOT NULL
                  AND {order_date_ref}::date >= CURRENT_DATE - INTERVAL '15 days'
                  AND {not_finalized_order_clause}
                  AND {linked_item_exists_clause}
                """
            )
            params = {
                **final_params,
                "delayed_status": "retrasado",
                "in_process_status": "en proceso",
            }

            await self.db.execute(delayed_sql, params)
            await self.db.execute(in_process_sql, params)
            await self.db.commit()
        except Exception as error:
            await self.db.rollback()
            logger.warning(
                "data_viewer purchase order status sync skipped error=%s",
                error,
            )

    @staticmethod
    def _find_table_config(
        table_configs: Iterable[TableConfig],
        table_name_candidates: set[str],
    ) -> TableConfig | None:
        for table_config in table_configs:
            candidates = {
                table_config.table_name.lower(),
                table_config.full_table_name.lower().split(".")[-1],
                table_config.table_id.lower(),
                (table_config.display_name or "").strip().lower(),
            }
            if not candidates.isdisjoint(table_name_candidates):
                return table_config
        return None

    async def _get_table_metadata(self, config: TableConfig) -> TableMetadata:
        columns_query = text(
            """
            SELECT
                column_name,
                data_type,
                is_nullable,
                character_maximum_length,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = :table_schema
              AND table_name = :table_name
            ORDER BY ordinal_position
            """
        )

        pk_query = text(
            """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
             AND tc.table_name = kcu.table_name
            WHERE tc.table_schema = :table_schema
              AND tc.table_name = :table_name
              AND tc.constraint_type = 'PRIMARY KEY'
            ORDER BY kcu.ordinal_position
            """
        )

        checks_query = text(
            """
            SELECT pg_get_constraintdef(con.oid) AS definition
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = con.connamespace
            WHERE con.contype = 'c'
              AND nsp.nspname = :table_schema
              AND rel.relname = :table_name
            """
        )

        query_params = {
            "table_schema": config.schema_name,
            "table_name": config.table_name,
        }

        try:
            columns_result = await self.db.execute(columns_query, query_params)
            column_rows = columns_result.mappings().all()
            pk_result = await self.db.execute(pk_query, query_params)
            pk_columns = [
                row["column_name"]
                for row in pk_result.mappings().all()
                if row["column_name"]
            ]
            checks_result = await self.db.execute(checks_query, query_params)
            check_rows = checks_result.mappings().all()
            foreign_keys = await _get_foreign_key_metadata(
                self.db,
                schema_name=config.schema_name,
                source_table=config.table_name,
            )
        except Exception as error:
            raise DBCommunicationError(
                f"Error loading metadata for table {config.full_table_name}: {error}"
            )

        if not column_rows:
            raise DBCommunicationError(
                f"Configured table {config.full_table_name} has no columns in information_schema"
            )

        columns: list[dict[str, Any]] = []
        allowed_columns: set[str] = set()
        text_columns: set[str] = set()
        editable_columns: set[str] = set()
        pk_columns_lower = {column.lower() for column in pk_columns}
        display_select_sql: dict[str, str] = {}
        column_expression_sql: dict[str, str] = {}

        enum_values_by_column: dict[str, list[str]] = {}
        for check in check_rows:
            definition = check.get("definition")
            if not definition:
                continue

            parsed_enum = _extract_check_enum_values(definition)
            if not parsed_enum:
                continue
            column_name, enum_values = parsed_enum
            enum_values_by_column[column_name] = enum_values

        for row in column_rows:
            column_name = row["column_name"]
            data_type = row["data_type"]
            is_nullable = row["is_nullable"] == "YES"
            normalized_column_name = column_name.lower()

            read_only_reason: str | None = None
            editable = True
            if normalized_column_name in pk_columns_lower:
                editable = False
                read_only_reason = "PRIMARY_KEY"
            elif normalized_column_name in TEMPORARY_READ_ONLY_COLUMNS:
                editable = False
                read_only_reason = "SYSTEM_COLUMN"

            fk_info = foreign_keys.get(normalized_column_name)
            if fk_info:
                try:
                    preserve_raw_fk_id = self._should_preserve_raw_fk_id(config, column_name)
                    if not preserve_raw_fk_id:
                        ref_cols = await _get_table_columns(
                            self.db,
                            schema_name=fk_info["referenced_schema"],
                            table_name=fk_info["referenced_table"],
                        )
                        label_field = _choose_fk_label_field(
                            ref_cols,
                            value_field=fk_info["referenced_column"],
                        )
                        ref_schema = _quote_identifier(fk_info["referenced_schema"])
                        ref_table = _quote_identifier(fk_info["referenced_table"])
                        ref_value = _quote_identifier(fk_info["referenced_column"])
                        ref_label = _quote_identifier(label_field)
                        source_column = _column_ref(column_name)
                        display_select_sql[column_name] = (
                            "COALESCE(("
                            f"SELECT NULLIF(TRIM(ref.{ref_label}::text), '') "
                            f"FROM {ref_schema}.{ref_table} ref "
                            f"WHERE TRIM(ref.{ref_value}::text) = TRIM({source_column}::text) "
                            "LIMIT 1"
                            f"), {source_column}::text) AS {_quote_identifier(column_name)}"
                        )
                    editable = False
                    read_only_reason = read_only_reason or (
                        "FOREIGN_KEY_ID_VALUE"
                        if preserve_raw_fk_id
                        else "FOREIGN_KEY_DISPLAY_VALUE"
                    )
                except Exception:
                    display_select_sql.pop(column_name, None)

            columns.append(
                {
                    "name": column_name,
                    "type": data_type,
                    "nullable": is_nullable,
                    "visible": True,
                    "editable": editable,
                    "required": not is_nullable,
                    "max_length": row.get("character_maximum_length"),
                    "enum_values": enum_values_by_column.get(normalized_column_name),
                    "read_only_reason": read_only_reason,
                }
            )
            allowed_columns.add(column_name)
            if editable:
                editable_columns.add(column_name)
            if data_type and data_type.lower() in TEXTUAL_TYPES:
                text_columns.add(column_name)

        item_cost_expression = await self._build_item_cost_expression(config, allowed_columns)
        if item_cost_expression and "costo" not in allowed_columns:
            cost_column = {
                "name": "costo",
                "type": "numeric",
                "nullable": True,
                "visible": True,
                "editable": False,
                "required": False,
                "max_length": None,
                "enum_values": None,
                "read_only_reason": "DERIVED_PRODUCT_COST",
            }
            columns.append(cost_column)
            allowed_columns.add("costo")
            display_select_sql["costo"] = f"{item_cost_expression} AS {_quote_identifier('costo')}"
            column_expression_sql["costo"] = item_cost_expression

        has_pk = bool(pk_columns)

        stable_order_column = (
            config.stable_order_column
            if config.stable_order_column in allowed_columns
            else None
        )
        default_order_column = (
            config.default_order_column
            if config.default_order_column in allowed_columns
            else None
        )
        if default_order_column is None:
            lowered_allowed = {column.lower(): column for column in allowed_columns}
            for candidate in RECENT_DATE_COLUMN_PRIORITY:
                resolved_candidate = lowered_allowed.get(candidate)
                if resolved_candidate:
                    default_order_column = resolved_candidate
                    break

        can_update = config.can_update if config.can_update is not None else has_pk
        if not has_pk:
            can_update = False

        can_insert = config.can_insert if config.can_insert is not None else False
        can_delete = config.can_delete if config.can_delete is not None else False

        if not can_update:
            editable_columns = set()
            for column in columns:
                if column["editable"]:
                    column["editable"] = False
                    column["read_only_reason"] = (
                        column["read_only_reason"] or "TABLE_NOT_EDITABLE"
                    )

        return TableMetadata(
            config=config,
            columns=columns,
            allowed_columns=allowed_columns,
            text_columns=text_columns,
            pk_columns=pk_columns,
            has_pk=has_pk,
            editable_columns=editable_columns,
            can_update=can_update,
            can_insert=can_insert,
            can_delete=can_delete,
            stable_order_column=stable_order_column,
            default_order_column=default_order_column,
            display_select_sql=display_select_sql,
            column_expression_sql=column_expression_sql,
        )

    async def _build_query_plan(
        self,
        request_data: DataViewerQueryRequest,
        *,
        user_id: str | None = None,
    ) -> QueryPlan:
        allowlist = await self._get_allowlist_map(user_id=user_id)
        table_config = allowlist.get(request_data.table_id)
        if not table_config:
            raise TableNotConfiguredError(request_data.table_id)

        metadata = await self._get_table_metadata(table_config)

        selected_columns = self._resolve_selected_columns(
            requested_columns=request_data.columns,
            metadata=metadata,
        )
        selected_columns = self._ensure_identity_columns_for_query(
            selected_columns=selected_columns,
            metadata=metadata,
        )

        where_sql, where_params = self._build_where_clause(
            request_data=request_data,
            metadata=metadata,
        )
        order_clause_sql = self._build_order_clause(
            request_data=request_data,
            metadata=metadata,
        )

        table_ref = f"{_quote_identifier(table_config.schema_name)}.{_quote_identifier(table_config.table_name)}"
        select_sql = self._build_select_sql(
            selected_columns=selected_columns,
            metadata=metadata,
        )
        status_where_sql, status_where_params = await self._build_order_status_where_clause(
            metadata=metadata,
        )
        where_sql = self._merge_where_clauses(where_sql, status_where_sql)
        where_params.update(status_where_params)
        row_status_where_sql, row_status_where_params = self._build_row_status_where_clause(
            metadata=metadata,
        )
        where_sql = self._merge_where_clauses(where_sql, row_status_where_sql)
        where_params.update(row_status_where_params)
        item_status_where_sql, item_status_where_params = await self._build_item_order_status_where_clause(
            metadata=metadata,
        )
        where_sql = self._merge_where_clauses(where_sql, item_status_where_sql)
        where_params.update(item_status_where_params)
        base_from_where_sql = f"FROM {table_ref} AS t{where_sql}"

        return QueryPlan(
            table_id=request_data.table_id,
            table_ref=table_ref,
            selected_columns=selected_columns,
            select_sql=select_sql,
            base_from_where_sql=base_from_where_sql,
            where_params=where_params,
            order_clause_sql=order_clause_sql,
            metadata=metadata,
        )

    def _resolve_selected_columns(
        self,
        requested_columns: list[str] | None,
        metadata: TableMetadata,
    ) -> list[str]:
        if not requested_columns:
            return [column["name"] for column in metadata.columns]

        resolved_columns: list[str] = []
        seen: set[str] = set()
        for raw_column in requested_columns:
            column = _validate_sql_identifier(raw_column, field_name="columns")
            if column == "row_version":
                # Backward compatibility for FE payloads while row_version is disabled.
                continue
            if column not in metadata.allowed_columns:
                raise IdentifierValidationError(
                    detail=f"Invalid identifier in columns: {column}",
                )
            if column not in seen:
                seen.add(column)
                resolved_columns.append(column)

        if not resolved_columns:
            return [column["name"] for column in metadata.columns]

        return resolved_columns

    def _ensure_identity_columns_for_query(
        self,
        *,
        selected_columns: list[str],
        metadata: TableMetadata,
    ) -> list[str]:
        resolved_columns = list(selected_columns)
        seen = set(resolved_columns)

        for pk_column in metadata.pk_columns:
            if pk_column not in seen:
                resolved_columns.append(pk_column)
                seen.add(pk_column)

        return resolved_columns

    def _build_select_sql(
        self,
        *,
        selected_columns: list[str],
        metadata: TableMetadata,
    ) -> str:
        select_parts: list[str] = []
        for column in selected_columns:
            select_parts.append(
                metadata.display_select_sql.get(
                    column,
                    f"{_column_ref(column)} AS {_quote_identifier(column)}",
                )
            )
        return ", ".join(select_parts)

    def _query_column_expr(self, metadata: TableMetadata, column: str) -> str:
        return metadata.column_expression_sql.get(column, _column_ref(column))

    @staticmethod
    def _merge_where_clauses(primary: str, secondary: str) -> str:
        if not secondary:
            return primary
        secondary_body = secondary.removeprefix(" WHERE ")
        if not primary:
            return f" WHERE {secondary_body}"
        return f"{primary} AND {secondary_body}"

    async def _build_order_status_where_clause(
        self,
        *,
        metadata: TableMetadata,
    ) -> tuple[str, dict[str, Any]]:
        status_value = metadata.config.view_order_status
        if not status_value:
            return "", {}

        item_order_column = next(
            (
                column
                for column in ITEM_ORDER_COLUMN_PRIORITY
                if column in metadata.allowed_columns
            ),
            None,
        )
        if not item_order_column:
            return "", {}

        try:
            foreign_keys = await _get_foreign_key_metadata(
                self.db,
                schema_name=metadata.config.schema_name,
                source_table=metadata.config.table_name,
            )
            fk_info = foreign_keys.get(item_order_column)
            if not fk_info:
                return "", {}

            ref_cols = await _get_table_columns(
                self.db,
                schema_name=fk_info["referenced_schema"],
                table_name=fk_info["referenced_table"],
            )
            ref_col_names = {
                _normalize_identifier(column["column_name"]).lower()
                for column in ref_cols
            }
            status_column = next(
                (
                    column
                    for column in ORDER_STATUS_COLUMN_PRIORITY
                    if column in ref_col_names
                ),
                None,
            )
            if not status_column:
                return "", {}

            ref_schema = _quote_identifier(fk_info["referenced_schema"])
            ref_table = _quote_identifier(fk_info["referenced_table"])
            ref_value = _quote_identifier(fk_info["referenced_column"])
            ref_status = _quote_identifier(status_column)
            status_values = _resolve_view_status_values(status_value)
            params = {
                f"view_order_status_{index}": value
                for index, value in enumerate(status_values)
            }
            status_placeholders = ", ".join(
                f":view_order_status_{index}"
                for index in range(len(status_values))
            )
            clause = (
                " WHERE EXISTS ("
                f"SELECT 1 FROM {ref_schema}.{ref_table} order_ref "
                f"WHERE TRIM(order_ref.{ref_value}::text) = TRIM({_column_ref(item_order_column)}::text) "
                f"AND LOWER(TRIM(order_ref.{ref_status}::text)) IN ({status_placeholders})"
                ")"
            )
            return clause, params
        except Exception as error:
            logger.warning(
                "data_viewer order status filter skipped table=%s status=%s error=%s",
                metadata.config.table_id,
                status_value,
                error,
            )
            return "", {}

    def _build_row_status_where_clause(
        self,
        *,
        metadata: TableMetadata,
    ) -> tuple[str, dict[str, Any]]:
        status_mode = metadata.config.view_row_status
        if not status_mode:
            return "", {}

        lowered_allowed = {column.lower(): column for column in metadata.allowed_columns}
        row_status_candidates = (*ROW_STATUS_COLUMN_PRIORITY, *ORDER_STATUS_COLUMN_PRIORITY)
        status_column = next(
            (
                lowered_allowed[candidate]
                for candidate in row_status_candidates
                if candidate in lowered_allowed
            ),
            None,
        )
        if not status_column:
            return "", {}

        params = {
            f"view_row_status_{index}": value
            for index, value in enumerate(FINALIZED_STATUS_VALUES)
        }
        placeholders = ", ".join(
            f":view_row_status_{index}"
            for index in range(len(FINALIZED_STATUS_VALUES))
        )
        status_expr = f"LOWER(TRIM({_column_ref(status_column)}::text))"
        if status_mode == "finalized":
            return f" WHERE {status_expr} IN ({placeholders})", params
        if status_mode == "not_finalized":
            return (
                f" WHERE ({_column_ref(status_column)} IS NULL OR {status_expr} NOT IN ({placeholders}))",
                params,
            )
        return "", {}

    async def _build_item_order_status_where_clause(
        self,
        *,
        metadata: TableMetadata,
    ) -> tuple[str, dict[str, Any]]:
        status_value = metadata.config.view_item_order_status
        if not status_value:
            return "", {}

        lowered_allowed = {column.lower(): column for column in metadata.allowed_columns}
        item_column = next(
            (
                lowered_allowed[column]
                for column in ITEM_REFERENCE_COLUMN_PRIORITY
                if column in lowered_allowed
            ),
            None,
        )
        if not item_column:
            return "", {}

        try:
            process_foreign_keys = await _get_foreign_key_metadata(
                self.db,
                schema_name=metadata.config.schema_name,
                source_table=metadata.config.table_name,
            )
            item_fk_info = process_foreign_keys.get(item_column.lower())
            if not item_fk_info:
                item_table = await _find_existing_table(
                    self.db,
                    schema_name=metadata.config.schema_name,
                    table_candidates=ITEM_TABLE_NAME_CANDIDATES,
                )
                if not item_table:
                    return "", {}
                item_cols = await _get_table_columns(
                    self.db,
                    schema_name=metadata.config.schema_name,
                    table_name=item_table,
                )
                item_value_column = _choose_existing_column(
                    item_cols,
                    (
                        item_column.lower(),
                        "id",
                        "id_item",
                        "item_id",
                        "item_legado",
                    ),
                )
                if not item_value_column:
                    return "", {}
                item_fk_info = {
                    "referenced_schema": metadata.config.schema_name,
                    "referenced_table": item_table,
                    "referenced_column": item_value_column,
                }
            else:
                item_cols = await _get_table_columns(
                    self.db,
                    schema_name=item_fk_info["referenced_schema"],
                    table_name=item_fk_info["referenced_table"],
                )

            item_col_names = {
                _normalize_identifier(column["column_name"]).lower()
                for column in item_cols
            }
            item_order_column = next(
                (
                    column
                    for column in ITEM_ORDER_COLUMN_PRIORITY
                    if column in item_col_names
                ),
                None,
            )
            if not item_order_column:
                return "", {}

            item_foreign_keys = await _get_foreign_key_metadata(
                self.db,
                schema_name=item_fk_info["referenced_schema"],
                source_table=item_fk_info["referenced_table"],
            )
            order_fk_info = item_foreign_keys.get(item_order_column)
            if not order_fk_info:
                return "", {}

            order_cols = await _get_table_columns(
                self.db,
                schema_name=order_fk_info["referenced_schema"],
                table_name=order_fk_info["referenced_table"],
            )
            order_col_names = {
                _normalize_identifier(column["column_name"]).lower()
                for column in order_cols
            }
            status_column = next(
                (
                    column
                    for column in ORDER_STATUS_COLUMN_PRIORITY
                    if column in order_col_names
                ),
                None,
            )
            if not status_column:
                return "", {}

            status_values = _resolve_view_status_values(status_value)
            params = {
                f"view_item_order_status_{index}": value
                for index, value in enumerate(status_values)
            }
            status_placeholders = ", ".join(
                f":view_item_order_status_{index}"
                for index in range(len(status_values))
            )

            item_schema = _quote_identifier(item_fk_info["referenced_schema"])
            item_table = _quote_identifier(item_fk_info["referenced_table"])
            item_value = _quote_identifier(item_fk_info["referenced_column"])
            process_item_column = _column_ref(item_column)
            item_order_ref = _quote_identifier(item_order_column)
            order_schema = _quote_identifier(order_fk_info["referenced_schema"])
            order_table = _quote_identifier(order_fk_info["referenced_table"])
            order_value = _quote_identifier(order_fk_info["referenced_column"])
            order_status = _quote_identifier(status_column)

            clause = (
                " WHERE EXISTS ("
                f"SELECT 1 FROM {item_schema}.{item_table} item_ref "
                f"WHERE TRIM(item_ref.{item_value}::text) = TRIM({process_item_column}::text) "
                "AND EXISTS ("
                f"SELECT 1 FROM {order_schema}.{order_table} order_ref "
                f"WHERE TRIM(order_ref.{order_value}::text) = TRIM(item_ref.{item_order_ref}::text) "
                f"AND LOWER(TRIM(order_ref.{order_status}::text)) IN ({status_placeholders})"
                ")"
                ")"
            )
            return clause, params
        except Exception as error:
            logger.warning(
                "data_viewer item order status filter skipped table=%s status=%s error=%s",
                metadata.config.table_id,
                status_value,
                error,
            )
            return "", {}

    async def _build_item_cost_expression(
        self,
        config: TableConfig,
        allowed_columns: set[str],
    ) -> str | None:
        table_name_candidates = {
            config.table_name.lower(),
            config.full_table_name.lower().split(".")[-1],
            config.table_id.lower(),
            (config.display_name or "").strip().lower(),
        }
        if table_name_candidates.isdisjoint(ITEM_TABLE_NAME_CANDIDATES):
            return None

        lowered_allowed = {column.lower(): column for column in allowed_columns}
        item_order_column = next(
            (
                lowered_allowed[column]
                for column in ITEM_ORDER_COLUMN_PRIORITY
                if column in lowered_allowed
            ),
            None,
        )
        if not item_order_column:
            return None

        order_ref = await _resolve_reference_from_column(
            self.db,
            schema_name=config.schema_name,
            source_table=config.table_name,
            source_column=item_order_column,
            fallback_table_candidates=ORDER_TABLE_NAME_CANDIDATES,
            fallback_value_candidates=(
                item_order_column.lower(),
                "id",
                "id_orden_compra",
                "orden_compra_id",
                "ordencompra_id",
                "oc",
            ),
        )
        if not order_ref:
            return None

        order_columns = await _get_table_columns(
            self.db,
            schema_name=order_ref["referenced_schema"],
            table_name=order_ref["referenced_table"],
        )
        order_product_column = _choose_existing_column(
            order_columns,
            ORDER_PRODUCT_COLUMN_PRIORITY,
        )
        if not order_product_column:
            return None

        product_ref = await _resolve_reference_from_column(
            self.db,
            schema_name=order_ref["referenced_schema"],
            source_table=order_ref["referenced_table"],
            source_column=order_product_column,
            fallback_table_candidates=PRODUCT_TABLE_NAME_CANDIDATES,
            fallback_value_candidates=PRODUCT_VALUE_COLUMN_PRIORITY,
        )
        if not product_ref:
            return None

        product_columns = await _get_table_columns(
            self.db,
            schema_name=product_ref["referenced_schema"],
            table_name=product_ref["referenced_table"],
        )
        product_cost_column = _choose_existing_column(
            product_columns,
            PRODUCT_COST_COLUMN_PRIORITY,
        )
        if not product_cost_column:
            return None

        order_schema = _quote_identifier(order_ref["referenced_schema"])
        order_table = _quote_identifier(order_ref["referenced_table"])
        order_value = _quote_identifier(order_ref["referenced_column"])
        order_product = _quote_identifier(order_product_column)
        item_order_ref = _column_ref(item_order_column)
        product_schema = _quote_identifier(product_ref["referenced_schema"])
        product_table = _quote_identifier(product_ref["referenced_table"])
        product_value = _quote_identifier(product_ref["referenced_column"])
        product_cost = _quote_identifier(product_cost_column)

        return (
            "COALESCE(("
            f"SELECT product_ref.{product_cost} "
            f"FROM {order_schema}.{order_table} order_ref "
            f"JOIN {product_schema}.{product_table} product_ref "
            f"ON TRIM(product_ref.{product_value}::text) = TRIM(order_ref.{order_product}::text) "
            f"WHERE TRIM(order_ref.{order_value}::text) = TRIM({item_order_ref}::text) "
            "LIMIT 1"
            "), NULL)"
        )

    @staticmethod
    def _should_preserve_raw_fk_id(config: TableConfig, column_name: str) -> bool:
        table_name_candidates = {
            config.table_name.lower(),
            config.full_table_name.lower().split(".")[-1],
            config.table_id.lower(),
            (config.display_name or "").strip().lower(),
        }
        if table_name_candidates.isdisjoint(ORDER_PROCESS_TABLE_NAME_CANDIDATES):
            return False

        normalized_column = column_name.lower()
        return (
            normalized_column == "id"
            or normalized_column.startswith("id_")
            or normalized_column.endswith("_id")
        )

    def _build_where_clause(
        self,
        request_data: DataViewerQueryRequest,
        metadata: TableMetadata,
    ) -> tuple[str, dict[str, Any]]:
        clauses: list[str] = []
        params: dict[str, Any] = {}

        for filter_index, filter_item in enumerate(request_data.filters):
            column = _validate_sql_identifier(
                filter_item.column,
                field_name="filters.column",
            )
            if column not in metadata.allowed_columns:
                raise IdentifierValidationError(
                    detail=f"Invalid identifier in filters.column: {column}",
                )

            operator = filter_item.operator
            if operator not in SUPPORTED_FILTER_OPERATORS:
                raise UnsupportedOperatorError(operator)

            placeholder = f"filter_{filter_index}"
            quoted_column = self._query_column_expr(metadata, column)

            if operator == "eq":
                if filter_item.value is None:
                    clauses.append(f"{quoted_column} IS NULL")
                else:
                    clauses.append(f"{quoted_column} = :{placeholder}")
                    params[placeholder] = filter_item.value
                continue

            if operator == "contains":
                if column not in metadata.text_columns:
                    raise InvalidFilterError(
                        detail=f"contains operator is only supported on textual columns: {column}"
                    )
                if filter_item.value is None:
                    raise InvalidFilterError(
                        detail=f"Filter value is required for operator contains: {column}"
                    )
                clauses.append(f"{quoted_column} ILIKE :{placeholder}")
                params[placeholder] = f"%{str(filter_item.value).strip()}%"
                continue

            if operator in {"gt", "lt"}:
                if filter_item.value is None:
                    raise InvalidFilterError(
                        detail=f"Filter value is required for operator {operator}: {column}"
                    )
                comparator = ">" if operator == "gt" else "<"
                clauses.append(f"{quoted_column} {comparator} :{placeholder}")
                params[placeholder] = filter_item.value
                continue

            if operator == "in":
                if (
                    not isinstance(filter_item.value, list)
                    or len(filter_item.value) == 0
                ):
                    raise InvalidFilterError(
                        detail=f"Filter value must be a non-empty list for operator in: {column}"
                    )

                in_placeholders: list[str] = []
                for value_index, value in enumerate(filter_item.value):
                    value_placeholder = f"{placeholder}_{value_index}"
                    in_placeholders.append(f":{value_placeholder}")
                    params[value_placeholder] = value

                clauses.append(f"{quoted_column} IN ({', '.join(in_placeholders)})")
                continue

            if operator == "between":
                if filter_item.value is None or filter_item.value_to is None:
                    raise InvalidFilterError(
                        detail=f"between operator requires value and value_to: {column}"
                    )

                lower_placeholder = f"{placeholder}_from"
                upper_placeholder = f"{placeholder}_to"
                clauses.append(
                    f"{quoted_column} BETWEEN :{lower_placeholder} AND :{upper_placeholder}"
                )
                params[lower_placeholder] = filter_item.value
                params[upper_placeholder] = filter_item.value_to

        if request_data.q:
            if not metadata.text_columns:
                raise InvalidFilterError(
                    detail="Global search q is not supported for this table (no textual columns)"
                )

            q_placeholder = "global_q"
            q_clauses = [
                f"{self._query_column_expr(metadata, column)} ILIKE :{q_placeholder}"
                for column in sorted(metadata.text_columns)
            ]
            clauses.append("(" + " OR ".join(q_clauses) + ")")
            params[q_placeholder] = f"%{request_data.q}%"

        if not clauses:
            return "", params

        return " WHERE " + " AND ".join(clauses), params

    def _build_order_clause(
        self,
        request_data: DataViewerQueryRequest,
        metadata: TableMetadata,
    ) -> str:
        order_parts: list[str] = []
        already_ordered: set[str] = set()

        if request_data.sort:
            sort_column = _validate_sql_identifier(
                request_data.sort.column,
                field_name="sort.column",
            )
            if sort_column not in metadata.allowed_columns:
                raise IdentifierValidationError(
                    detail=f"Invalid identifier in sort.column: {sort_column}",
                )
            direction = request_data.sort.direction.upper()
            order_parts.append(
                f"{self._query_column_expr(metadata, sort_column)} {direction} NULLS LAST"
            )
            already_ordered.add(sort_column)
        else:
            default_sort_column = (
                metadata.default_order_column or metadata.stable_order_column
            )
            if default_sort_column:
                order_parts.append(
                    f"{self._query_column_expr(metadata, default_sort_column)} DESC NULLS LAST"
                )
                already_ordered.add(default_sort_column)

        if metadata.pk_columns:
            for pk_column in metadata.pk_columns:
                if pk_column not in already_ordered:
                    order_parts.append(f"{self._query_column_expr(metadata, pk_column)} ASC NULLS LAST")
                    already_ordered.add(pk_column)
        else:
            stable_column = (
                metadata.stable_order_column or metadata.default_order_column
            )
            if not stable_column:
                raise NoStableOrderColumnError(request_data.table_id)
            if stable_column not in already_ordered:
                order_parts.append(f"{self._query_column_expr(metadata, stable_column)} DESC NULLS LAST")

        return " ORDER BY " + ", ".join(order_parts)

    def _validate_pk_payload(
        self,
        pk_payload: dict[str, Any],
        metadata: TableMetadata,
    ) -> dict[str, Any]:
        if not pk_payload:
            raise PKRequiredError("pk is required")

        normalized_pk: dict[str, Any] = {}
        for raw_column, value in pk_payload.items():
            column = _validate_sql_identifier(raw_column, field_name="pk")
            normalized_pk[column] = value

        expected_by_lower = {column.lower(): column for column in metadata.pk_columns}
        provided_by_lower = {column.lower(): column for column in normalized_pk}

        missing_columns = [
            expected_by_lower[column_key]
            for column_key in expected_by_lower
            if column_key not in provided_by_lower
        ]
        extra_columns = [
            provided_by_lower[column_key]
            for column_key in provided_by_lower
            if column_key not in expected_by_lower
        ]

        if missing_columns or extra_columns:
            missing_text = (
                ", ".join(sorted(missing_columns)) if missing_columns else "-"
            )
            extra_text = ", ".join(sorted(extra_columns)) if extra_columns else "-"
            raise PKRequiredError(
                detail=f"pk must include exactly the PK columns. missing=[{missing_text}] extra=[{extra_text}]"
            )

        return {
            pk_column: normalized_pk[provided_by_lower[pk_column.lower()]]
            for pk_column in metadata.pk_columns
        }

    def _validate_changes_payload(
        self,
        changes_payload: dict[str, Any],
        metadata: TableMetadata,
    ) -> dict[str, Any]:
        if not changes_payload:
            raise IdentifierValidationError(
                detail="changes must not be empty",
                code="VALIDATION_ERROR",
            )

        normalized_changes: dict[str, Any] = {}
        columns_by_name = {column["name"]: column for column in metadata.columns}
        for raw_column, value in changes_payload.items():
            column = _validate_sql_identifier(raw_column, field_name="changes")
            if column not in metadata.allowed_columns:
                raise IdentifierValidationError(
                    detail=f"Invalid identifier in changes: {column}",
                )
            if column not in metadata.editable_columns:
                raise ColumnNotEditableError(column)
            normalized_changes[column] = _coerce_update_value_for_column(
                value,
                columns_by_name.get(column, {"name": column}),
            )

        return normalized_changes

    def _build_returning_sql(self, metadata: TableMetadata) -> str:
        table_columns = [
            _quote_identifier(column["name"]) for column in metadata.columns
        ]
        return ", ".join(table_columns)

    async def _run_count_query(
        self,
        base_from_where_sql: str,
        where_params: dict[str, Any],
        timeout_ms: int,
    ) -> int:
        try:
            await self.db.execute(
                text(f"SET LOCAL statement_timeout = {int(timeout_ms)}")
            )
            count_sql = f"SELECT COUNT(*) AS total_count {base_from_where_sql}"
            count_result = await self.db.execute(text(count_sql), where_params)
            count_row = count_result.mappings().first()
            return int(count_row["total_count"]) if count_row else 0
        except Exception as error:
            if _is_timeout_error(error):
                raise QueryTimeoutError()
            raise DBCommunicationError(f"Error running DataViewer count query: {error}")

    async def _stream_csv_rows(
        self,
        plan: QueryPlan,
        total_rows: int,
    ) -> AsyncIterator[bytes]:
        header_buffer = io.StringIO(newline="")
        header_writer = csv.writer(
            header_buffer,
            delimiter=",",
            quotechar='"',
            quoting=csv.QUOTE_MINIMAL,
            doublequote=True,
            lineterminator="\r\n",
        )
        header_writer.writerow(plan.selected_columns)
        yield header_buffer.getvalue().encode("utf-8")

        exported_rows = 0
        while exported_rows < total_rows:
            chunk_limit = min(EXPORT_CHUNK_SIZE, total_rows - exported_rows)
            chunk_params = dict(plan.where_params)
            chunk_params["chunk_limit"] = chunk_limit
            chunk_params["chunk_offset"] = exported_rows

            chunk_sql = (
                f"SELECT {plan.select_sql} {plan.base_from_where_sql} "
                f"{plan.order_clause_sql} LIMIT :chunk_limit OFFSET :chunk_offset"
            )

            try:
                await self.db.execute(
                    text(f"SET LOCAL statement_timeout = {DEFAULT_EXPORT_TIMEOUT_MS}")
                )
                chunk_result = await self.db.execute(text(chunk_sql), chunk_params)
                chunk_rows = chunk_result.mappings().all()
            except Exception as error:
                if _is_timeout_error(error):
                    raise QueryTimeoutError("Export query timeout")
                raise DBCommunicationError(f"Error exporting DataViewer CSV: {error}")

            if not chunk_rows:
                break

            chunk_buffer = io.StringIO(newline="")
            chunk_writer = csv.writer(
                chunk_buffer,
                delimiter=",",
                quotechar='"',
                quoting=csv.QUOTE_MINIMAL,
                doublequote=True,
                lineterminator="\r\n",
            )

            for row in chunk_rows:
                chunk_writer.writerow(
                    [
                        self._serialize_csv_value(row.get(column))
                        for column in plan.selected_columns
                    ]
                )

            exported_rows += len(chunk_rows)
            yield chunk_buffer.getvalue().encode("utf-8")

    @staticmethod
    def _serialize_csv_value(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return str(value)
