from __future__ import annotations

import csv
import io
import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator

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


class DataViewerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tables(self) -> list[DataViewerTable]:
        table_configs = await self._get_allowlist_map()
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
            logger.info(filtered_columns)

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

    async def query(
        self, request_data: DataViewerQueryRequest
    ) -> DataViewerQueryResponse:
        if request_data.limit > 200:
            raise LimitExceededError()

        plan = await self._build_query_plan(request_data)
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
    ) -> DataViewerRowUpdateResponse:
        allowlist = await self._get_allowlist_map()
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

    async def export_csv(self, request_data: DataViewerQueryRequest) -> CsvExportResult:
        plan = await self._build_query_plan(request_data)

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

    async def _get_allowlist_map(self) -> dict[str, TableConfig]:
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

        allowlist: dict[str, TableConfig] = {}
        for row in rows:
            table_id = str(row["table_id"]).strip()
            if not table_id:
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
                can_update=_to_optional_bool(row.get("can_update")),
                can_insert=_to_optional_bool(row.get("can_insert")),
                can_delete=_to_optional_bool(row.get("can_delete")),
            )

        return allowlist

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
        )

    async def _build_query_plan(
        self, request_data: DataViewerQueryRequest
    ) -> QueryPlan:
        allowlist = await self._get_allowlist_map()
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
        select_sql = self._build_select_sql(selected_columns=selected_columns)
        base_from_where_sql = f"FROM {table_ref}{where_sql}"

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

    def _build_select_sql(self, *, selected_columns: list[str]) -> str:
        return ", ".join(_quote_identifier(column) for column in selected_columns)

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
            quoted_column = _quote_identifier(column)

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
                f"{_quote_identifier(column)} ILIKE :{q_placeholder}"
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
                f"{_quote_identifier(sort_column)} {direction} NULLS LAST"
            )
            already_ordered.add(sort_column)

        if metadata.pk_columns:
            for pk_column in metadata.pk_columns:
                if pk_column not in already_ordered:
                    order_parts.append(f"{_quote_identifier(pk_column)} ASC NULLS LAST")
                    already_ordered.add(pk_column)
        else:
            stable_column = (
                metadata.stable_order_column or metadata.default_order_column
            )
            if not stable_column:
                raise NoStableOrderColumnError(request_data.table_id)
            if stable_column not in already_ordered:
                order_parts.append(f"{_quote_identifier(stable_column)} ASC NULLS LAST")

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
        for raw_column, value in changes_payload.items():
            column = _validate_sql_identifier(raw_column, field_name="changes")
            if column not in metadata.allowed_columns:
                raise IdentifierValidationError(
                    detail=f"Invalid identifier in changes: {column}",
                )
            if column not in metadata.editable_columns:
                raise ColumnNotEditableError(column)
            normalized_changes[column] = value

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
