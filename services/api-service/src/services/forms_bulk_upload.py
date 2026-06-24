import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from io import BytesIO
from typing import Any
from zipfile import ZipFile
from xml.etree import ElementTree as ET

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.forms import (
    DBCommunicationError,
    FORMS_SCHEMA,
    _add_manual_integer_id_if_needed,
    _first_existing_column,
    _get_table_columns,
    _quote_identifier,
    _resolve_initial_employee_value,
)


ORDER_HEADERS = {
    "cliente": "Cliente",
    "oc_cliente": "Oc cliente",
    "cantidad": "Cantidad",
}
DELIVERY_DATE_HEADER_KEYS = (
    "fecha_entrega",
    "fecha_de_entrega",
)
FULL_PRODUCT_HEADERS = {
    "base": "Base",
    "modelo": "Modelo",
    "referencia_1": "Referencia 1",
    "referencia_2": "Referencia 2",
    "referencia_3": "Referencia 3",
    "tela": "Tela",
}
COMPACT_PRODUCT_HEADERS = {
    "nombre": "Nombre",
    "tela": "Tela",
}

TEXT_COLUMNS = {
    "character varying",
    "character",
    "text",
    "citext",
    "varchar",
    "char",
}

FABRIC_UNIT_TABLE_CANDIDATES = (
    "unidades",
    "unidadmedida",
    "unidad_medida",
    "unidades_medida",
    "unidad",
)
FABRIC_METER_UNIT_LABELS = {"METRO", "METROS", "M"}


@dataclass
class BulkRow:
    row_number: int
    cliente: str
    product_name: str
    base: str
    modelo: str
    referencia_1: str
    referencia_2: str
    referencia_3: str
    tela: str
    fecha_entrega: date | None
    detalle: str
    oc_interno: str
    oc_cliente: str
    cantidad: int


@dataclass
class BulkOrderProcessRow:
    row_number: int
    item_legado: str
    id_proceso: int | None
    id_empleado: int | None
    fecha_inicio: datetime | None
    fecha_finalizado: datetime | None
    comentarios: str


def _normalize_key(value: Any) -> str:
    raw = str(value or "").strip().lower()
    raw = (
        raw.replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ñ", "n")
    )
    return re.sub(r"[^a-z0-9]+", "_", raw).strip("_")


def _normalize_match(value: Any) -> str:
    raw = str(value or "").strip().upper()
    raw = (
        raw.replace("Á", "A")
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ú", "U")
        .replace("Ñ", "N")
    )
    return re.sub(r"[^A-Z0-9]+", " ", raw).strip()


def _display_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).upper()


def _clean_cell_text(value: Any) -> str:
    text_value = _display_text(value)
    return "" if text_value in {"", "."} else text_value


def _component_text(value: Any) -> str:
    return _display_text(value)


def _parse_int(value: Any) -> int:
    if value is None or value == "":
        raise ValueError("Cantidad vacia")
    if isinstance(value, (int, float, Decimal)):
        parsed = int(value)
    else:
        parsed = int(float(str(value).strip().replace(",", ".")))
    if parsed < 1:
        raise ValueError("Cantidad debe ser mayor a cero")
    return parsed


def _parse_optional_int(value: Any) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    return int(float(str(value).strip().replace(",", ".")))


def _parse_optional_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, date):
        return datetime.combine(value, time.min)

    raw = str(value).strip()
    if not raw:
        return None

    numeric_raw = raw.replace(",", ".")
    if re.fullmatch(r"\d+(\.\d+)?", numeric_raw):
        serial = float(numeric_raw)
        if serial > 59:
            return datetime(1899, 12, 30) + timedelta(days=serial)

    normalized = raw.replace("T", " ")
    formats = (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%d-%m-%Y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    return datetime.fromisoformat(normalized).replace(tzinfo=None)


def _parse_optional_date(value: Any) -> date | None:
    parsed_datetime = _parse_optional_datetime(value)
    return parsed_datetime.date() if parsed_datetime else None


def _parse_purchase_order_delivery_date(value: Any) -> date | None:
    return _parse_optional_date(value)


def _first_present_value(row: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in row:
            return row.get(key)
    return None


def _coerce_column_value(value: Any, column_meta: dict[str, Any]) -> Any:
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None

    data_type = str(column_meta.get("data_type") or "").lower()
    if "int" in data_type or data_type in {"integer", "bigint", "smallint"}:
        return int(value) if isinstance(value, (int, float)) else int(str(value).strip())
    if "numeric" in data_type or "decimal" in data_type:
        return Decimal(str(value).strip())
    if data_type in {"real", "double precision", "float4", "float8", "float"}:
        return float(value)
    if data_type == "date":
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        return datetime.fromisoformat(str(value)).date()
    if "timestamp" in data_type:
        if isinstance(value, datetime):
            return value.replace(tzinfo=None)
        return datetime.fromisoformat(str(value)).replace(tzinfo=None)
    return value


def _read_xlsx_rows(content: bytes) -> list[dict[str, Any]]:
    ns = {
        "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }

    with ZipFile(BytesIO(content)) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("a:si", ns):
                texts = [node.text or "" for node in item.findall(".//a:t", ns)]
                shared.append("".join(texts))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in relationships}
        first_sheet = workbook.find("a:sheets/a:sheet", ns)
        if first_sheet is None:
            return []

        rel_id = first_sheet.attrib[
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        ]
        sheet_path = "xl/" + relmap[rel_id].lstrip("/")
        sheet_root = ET.fromstring(archive.read(sheet_path))

        rows: list[list[Any]] = []
        for row in sheet_root.findall("a:sheetData/a:row", ns):
            values_by_index: dict[int, Any] = {}
            for cell in row.findall("a:c", ns):
                ref = cell.attrib.get("r", "")
                column_letters = re.sub(r"[^A-Z]", "", ref)
                column_index = 0
                for char in column_letters:
                    column_index = column_index * 26 + (ord(char) - ord("A") + 1)
                column_index -= 1

                cell_type = cell.attrib.get("t")
                value_node = cell.find("a:v", ns)
                value: Any = "" if value_node is None else value_node.text or ""
                if cell_type == "s" and value != "":
                    value = shared[int(value)]
                elif cell_type == "inlineStr":
                    value = "".join(node.text or "" for node in cell.findall(".//a:t", ns))
                values_by_index[column_index] = value

            if values_by_index:
                max_index = max(values_by_index)
                rows.append([values_by_index.get(index, "") for index in range(max_index + 1)])

        if not rows:
            return []

        headers = [_normalize_key(value) for value in rows[0]]
        parsed_rows: list[dict[str, Any]] = []
        for row_index, row in enumerate(rows[1:], start=2):
            record = {
                headers[index]: row[index] if index < len(row) else ""
                for index in range(len(headers))
                if headers[index]
            }
            if any(str(value or "").strip() for value in record.values()):
                record["_row_number"] = row_index
                parsed_rows.append(record)
        return parsed_rows


async def _table_columns_map(db: AsyncSession, table_name: str) -> dict[str, dict[str, Any]]:
    columns = await _get_table_columns(db, schema_name=FORMS_SCHEMA, table_name=table_name)
    return {str(column["column_name"]).lower(): column for column in columns}


async def _insert_dynamic_row(
    db: AsyncSession,
    table_name: str,
    row_data: dict[str, Any],
) -> dict[str, Any]:
    columns = await _table_columns_map(db, table_name)
    filtered = {
        key: _coerce_column_value(value, columns[key])
        for key, value in row_data.items()
        if key in columns
    }
    await _add_manual_integer_id_if_needed(db, table_name=table_name, row_data=filtered)
    if not filtered:
        raise DBCommunicationError(f"No hay columnas validas para insertar en {table_name}")

    columns_sql = ", ".join(_quote_identifier(column, field_name="bulk_column") for column in filtered)
    placeholders = ", ".join(f":{column}" for column in filtered)
    query = text(
        f"""
        INSERT INTO {_quote_identifier(FORMS_SCHEMA, field_name='schema')}.{_quote_identifier(table_name, field_name='bulk_table')}
        ({columns_sql}) VALUES ({placeholders})
        RETURNING *
        """
    )
    result = await db.execute(query, filtered)
    return dict(result.mappings().first() or {})


async def _get_or_create_named_row(
    db: AsyncSession,
    table_name: str,
    name: Any,
) -> dict[str, Any]:
    clean_name = _component_text(name)
    if not clean_name:
        raise DBCommunicationError(f"No hay nombre para crear en {table_name}")

    rows = await _fetch_lookup(db, table_name, label_columns=("nombre",))
    existing = _find_by_label(rows, clean_name)
    if existing:
        existing["__was_created"] = False
        return existing

    created = await _insert_dynamic_row(db, table_name, {"nombre": clean_name})
    created["__was_created"] = True
    return created


async def _get_or_create_fabric_row(
    db: AsyncSession,
    *,
    name: Any,
    reference: Any,
    unit_id: Any,
) -> dict[str, Any]:
    clean_name = _component_text(name)
    clean_reference = _component_text(reference) or clean_name
    if not clean_name:
        raise DBCommunicationError("Falta nombre de tela")

    rows = await _fetch_lookup(db, "tela", label_columns=("nombre", "referencia"))
    existing = _find_by_label(rows, f"{clean_name} {clean_reference}")
    if existing:
        existing["__was_created"] = False
        return existing

    created = await _insert_dynamic_row(
        db,
        "tela",
        {
            "nombre": clean_name,
            "referencia": clean_reference,
            "id_unidad_medida": unit_id,
        },
    )
    created["__was_created"] = True
    return created


async def _fetch_fabric_units(db: AsyncSession) -> list[dict[str, Any]]:
    _, units = await _fetch_first_available_lookup(
        db,
        FABRIC_UNIT_TABLE_CANDIDATES,
        label_columns=("nombre", "unidad", "descripcion"),
    )
    return units


def _select_default_fabric_unit(units: list[dict[str, Any]]) -> dict[str, Any] | None:
    for unit in units:
        labels = (
            unit.get("__label"),
            unit.get("nombre"),
            unit.get("unidad"),
            unit.get("descripcion"),
        )
        if any(_normalize_match(label) in FABRIC_METER_UNIT_LABELS for label in labels):
            return unit
    return next((unit for unit in units if unit.get("id") is not None), None)


async def _get_default_fabric_unit_id(db: AsyncSession) -> Any:
    default_unit = _select_default_fabric_unit(await _fetch_fabric_units(db))
    if default_unit and default_unit.get("id") is not None:
        return default_unit.get("id")

    try:
        fabrics = await _fetch_lookup(db, "tela", label_columns=("nombre", "referencia"))
    except Exception:
        return None

    for fabric in fabrics:
        unit_id = fabric.get("id_unidad_medida")
        if unit_id is not None and str(unit_id).strip() != "":
            return unit_id
    return None


async def _ensure_order_process_allows_pending_without_employee(
    db: AsyncSession,
) -> None:
    columns = await _table_columns_map(db, "ordenproceso")
    employee_column = columns.get("id_empleado")
    if not employee_column:
        return
    if employee_column.get("is_nullable") == "YES":
        return
    if employee_column.get("column_default") is not None:
        return

    await db.execute(
        text(
            f"""
            ALTER TABLE {_quote_identifier(FORMS_SCHEMA, field_name='schema')}.{_quote_identifier('ordenproceso', field_name='order_process_table')}
            ALTER COLUMN {_quote_identifier('id_empleado', field_name='employee_column')} DROP NOT NULL
            """
        )
    )


async def _get_or_create_product_row(
    db: AsyncSession,
    *,
    base_id: Any,
    model_id: Any,
    reference_1_id: Any = None,
    reference_2_id: Any = None,
    reference_3_id: Any = None,
    fabric_id: Any,
    product_name: str,
) -> dict[str, Any]:
    rows = await _fetch_lookup(db, "producto", label_columns=("nombre", "sku"))
    has_component_ids = any(
        value is not None and str(value).strip() != ""
        for value in (
            base_id,
            model_id,
            reference_1_id,
            reference_2_id,
            reference_3_id,
            fabric_id,
        )
    )
    existing = next(
        (
            row
            for row in rows
            if _normalize_match(row.get("nombre")) == _normalize_match(product_name)
            or (
                has_component_ids
                and str(row.get("id_base") or "") == str(base_id or "")
                and str(row.get("id_modelo") or "") == str(model_id or "")
                and str(row.get("id_referencia_1") or row.get("id_referencia") or "") == str(reference_1_id or "")
                and str(row.get("id_referencia_2") or "") == str(reference_2_id or "")
                and str(row.get("id_referencia_3") or "") == str(reference_3_id or "")
                and str(row.get("id_tela") or "") == str(fabric_id or "")
            )
        ),
        None,
    )
    if existing:
        existing["__was_created"] = False
        return existing

    sku = _build_product_sku(base_id, model_id, reference_1_id, fabric_id)
    created = await _insert_dynamic_row(
        db,
        "producto",
        {
            "sku": sku,
            "id_base": base_id,
            "id_modelo": model_id,
            "id_referencia_1": reference_1_id,
            "id_referencia_2": reference_2_id,
            "id_referencia_3": reference_3_id,
            "id_tela": fabric_id,
            "nombre": product_name,
            "fecha_modificacion": datetime.now(),
        },
    )
    created["__was_created"] = True
    return created


async def _fetch_lookup(
    db: AsyncSession,
    table_name: str,
    *,
    label_columns: tuple[str, ...] = ("nombre",),
) -> list[dict[str, Any]]:
    columns = await _table_columns_map(db, table_name)
    if not columns:
        return []

    available_labels = [column for column in label_columns if column in columns]
    if not available_labels:
        available_labels = [
            name
            for name, meta in columns.items()
            if str(meta.get("data_type") or "").lower() in TEXT_COLUMNS
        ][:2]
    if not available_labels:
        if "id" not in columns:
            return []
        available_labels = ["id"]

    label_sql = ", ".join(
        f"COALESCE({_quote_identifier(column, field_name='lookup_column')}::text, '')"
        for column in available_labels
    )
    query = text(
        f"""
        SELECT *, CONCAT_WS(' ', {label_sql}) AS __label
        FROM {_quote_identifier(FORMS_SCHEMA, field_name='schema')}.{_quote_identifier(table_name, field_name='lookup_table')}
        """
    )
    result = await db.execute(query)
    return [dict(row) for row in result.mappings().all()]


async def _fetch_first_available_lookup(
    db: AsyncSession,
    table_names: tuple[str, ...],
    *,
    label_columns: tuple[str, ...] = ("nombre",),
) -> tuple[str | None, list[dict[str, Any]]]:
    for table_name in table_names:
        columns = await _table_columns_map(db, table_name)
        if not columns:
            continue
        return table_name, await _fetch_lookup(
            db,
            table_name,
            label_columns=label_columns,
        )
    return None, []


def _find_by_label(rows: list[dict[str, Any]], value: str) -> dict[str, Any] | None:
    target = _normalize_match(value)
    for row in rows:
        candidates = [
            row.get("__label"),
            row.get("nombre"),
            row.get("referencia"),
            f"{row.get('nombre') or ''} {row.get('referencia') or ''}",
        ]
        if any(_normalize_match(candidate) == target for candidate in candidates):
            return row
    return None


def _find_by_id(rows: list[dict[str, Any]], value: Any) -> dict[str, Any] | None:
    if value is None or str(value).strip() == "":
        return None
    target = str(value)
    return next((row for row in rows if str(row.get("id")) == target), None)


def _first_value(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip() != "":
            return value
    return None


def _find_product_by_name_tokens(
    products: list[dict[str, Any]],
    product_name: str,
) -> dict[str, Any] | None:
    target_tokens = _normalize_match(product_name).split()
    if not target_tokens:
        return None

    candidates: list[tuple[int, str, dict[str, Any]]] = []
    for product in products:
        label = product.get("nombre") or product.get("__label")
        label_tokens = _normalize_match(label).split()
        if not label_tokens:
            continue
        if _token_groups_match(label_tokens, target_tokens, require_same_size=True):
            candidates.append((len(label_tokens), str(label), product))

    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], item[1]))
    return candidates[0][2]


def _is_near_text_token(expected: str, actual: str) -> bool:
    if expected == actual:
        return True
    if expected.rstrip("S") == actual.rstrip("S") and min(len(expected), len(actual)) >= 5:
        return True
    if expected.endswith("ES") and expected[:-2] == actual and len(actual) >= 5:
        return True
    if actual.endswith("ES") and actual[:-2] == expected and len(expected) >= 5:
        return True
    if len(expected) < 5 or len(actual) < 5:
        return False
    if expected.isdigit() or actual.isdigit():
        return False
    if abs(len(expected) - len(actual)) > 1:
        return False

    if len(expected) == len(actual):
        differences = [index for index, char in enumerate(expected) if char != actual[index]]
        if len(differences) <= 1:
            return True
        if len(differences) == 2:
            first, second = differences
            return (
                second == first + 1
                and expected[first] == actual[second]
                and expected[second] == actual[first]
            )

    previous = current = range(len(actual) + 1)
    for index_expected, char_expected in enumerate(expected, start=1):
        previous, current = current, [index_expected]
        for index_actual, char_actual in enumerate(actual, start=1):
            insert_cost = current[index_actual - 1] + 1
            delete_cost = previous[index_actual] + 1
            replace_cost = previous[index_actual - 1] + (char_expected != char_actual)
            current.append(min(insert_cost, delete_cost, replace_cost))
    return current[-1] <= 1


def _expand_compound_measure_tokens(tokens: list[str]) -> list[str]:
    expanded = list(tokens)
    for index, token in enumerate(tokens[:-1]):
        next_token = tokens[index + 1]
        if len(token) == 1 and token.isalpha() and next_token.isdigit():
            expanded.append(f"{token}{next_token}")
        if token.isdigit() and len(next_token) == 1 and next_token.isalpha():
            expanded.append(f"{token}{next_token}")
    return expanded


def _token_groups_match(
    expected_tokens: list[str],
    actual_tokens: list[str],
    *,
    require_same_size: bool = False,
) -> bool:
    expected_tokens = _expand_compound_measure_tokens(expected_tokens)
    actual_tokens = _expand_compound_measure_tokens(actual_tokens)

    if require_same_size and len(expected_tokens) != len(actual_tokens):
        return False

    used_indexes: set[int] = set()
    for expected in expected_tokens:
        matched_index = next(
            (
                index
                for index, actual in enumerate(actual_tokens)
                if index not in used_indexes and _is_near_text_token(expected, actual)
            ),
            None,
        )
        if matched_index is None:
            return False
        used_indexes.add(matched_index)
    return True


def _score_catalog_match(label: Any, product_name: str) -> int:
    normalized_label = _normalize_match(label)
    normalized_product = _normalize_match(product_name)
    if not normalized_label or not normalized_product:
        return 0

    label_tokens = [token for token in normalized_label.split() if token]
    product_tokens = [token for token in normalized_product.split() if token]
    if not label_tokens or not product_tokens:
        return 0

    if not _token_groups_match(label_tokens, product_tokens):
        matched_tokens = [
            label_token
            for label_token in label_tokens
            if len(label_token) >= 5
            and any(_is_near_text_token(label_token, product_token) for product_token in product_tokens)
        ]
        if not matched_tokens:
            return 0
        score = len(set(matched_tokens)) * 10 + 40
        score += sum(len(token) for token in set(matched_tokens))
        return score

    score = len(set(label_tokens)) * 10 + 100
    if f" {normalized_label} " in f" {normalized_product} ":
        score += 50
    score += len(normalized_label)
    return score


def _find_contained_lookup(
    rows: list[dict[str, Any]],
    product_name: str,
) -> dict[str, Any] | None:
    candidates: list[tuple[int, dict[str, Any]]] = []
    for row in rows:
        label = _normalize_match(row.get("__label") or row.get("nombre"))
        if not label:
            continue
        score = _score_catalog_match(label, product_name)
        if score > 0:
            candidates.append((score, row))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def _number_signature(value: Any) -> frozenset[str]:
    normalized = _normalize_match(value)
    return frozenset(re.findall(r"\d+", normalized))


def _reference_number_tokens(value: Any) -> set[str]:
    return set(re.findall(r"\d+", _normalize_match(value)))


def _reference_family_signature(value: Any) -> str:
    normalized = _normalize_match(value)
    tokens = normalized.split()
    numbers = tuple(re.findall(r"\d+(?:\.\d+)?", normalized.replace(",", ".")))
    semantic_tokens = {
        token.rstrip("S")
        for token in tokens
        if not re.fullmatch(r"\d+(?:\.\d+)?", token)
        and token not in {"X", "DE", "LA", "EL", "LOS", "LAS"}
    }
    if numbers and semantic_tokens:
        return "|".join(["NUM", ",".join(numbers), ",".join(sorted(semantic_tokens))])
    if numbers:
        return "|".join(["NUM", ",".join(numbers)])
    return normalized


def _score_reference_match(label: Any, product_name: str) -> int:
    label_numbers = _reference_number_tokens(label)
    product_numbers = _reference_number_tokens(product_name)
    if label_numbers and not label_numbers.issubset(product_numbers):
        return 0
    return _score_catalog_match(label, product_name)


def _reference_matches_product(row: dict[str, Any], product_name: str) -> bool:
    label = _normalize_match(row.get("__label") or row.get("nombre"))
    product = _normalize_match(product_name)
    if not label or not product:
        return False
    return _score_reference_match(label, product) > 0


def _find_contained_lookups(
    rows: list[dict[str, Any]],
    product_name: str,
    *,
    limit: int = 3,
) -> list[dict[str, Any]]:
    candidates: list[tuple[int, str, dict[str, Any]]] = []
    seen_ids: set[str] = set()
    for row in rows:
        label = _normalize_match(row.get("__label") or row.get("nombre"))
        if not label:
            continue
        row_id = str(row.get("id") or label)
        if row_id in seen_ids:
            continue
        score = _score_reference_match(label, product_name)
        if score > 0:
            candidates.append((score, label, row))
            seen_ids.add(row_id)
    candidates.sort(key=lambda item: (-item[0], item[1]))

    selected: list[dict[str, Any]] = []
    used_signatures: set[str] = set()
    for _, label, row in candidates:
        signature = _reference_family_signature(label)
        if signature and signature in used_signatures:
            continue
        selected.append(row)
        if signature:
            used_signatures.add(signature)
        if len(selected) >= limit:
            break
    return selected


def _reference_lookup_options(
    rows: list[dict[str, Any]],
    product_name: str,
    selected_reference: dict[str, Any] | None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    selected_id = str(selected_reference.get("id")) if selected_reference and selected_reference.get("id") is not None else ""
    selected_family = (
        _reference_family_signature(selected_reference.get("__label") or selected_reference.get("nombre"))
        if selected_reference
        else ""
    )

    scored: list[tuple[int, str, dict[str, Any]]] = []
    for row in rows:
        label = str(row.get("__label") or row.get("nombre") or row.get("referencia") or "")
        normalized_label = _normalize_match(label)
        if not normalized_label:
            continue
        score = _score_reference_match(normalized_label, product_name)
        scored.append((score, label, row))
    scored.sort(key=lambda item: (-item[0], item[1]))

    options: list[dict[str, Any]] = []
    emitted_families: set[str] = set()
    for score, label, row in scored:
        row_id = str(row.get("id")) if row.get("id") is not None else ""
        family = _reference_family_signature(label)
        is_selected = bool(selected_id and row_id == selected_id)
        if family and family in emitted_families and not is_selected:
            continue
        emitted_families.add(family)
        is_suggested = is_selected or (
            bool(selected_reference)
            and bool(selected_family)
            and family == selected_family
            and _reference_matches_product(row, product_name)
        )
        options.append(
            {
                "id": row.get("id"),
                "label": label,
                "suggested": is_suggested,
            }
        )
        if len(options) >= limit:
            break
    return options


def _lookup_options(rows: list[dict[str, Any]], product_name: str, limit: int = 200) -> list[dict[str, Any]]:
    scored: list[tuple[int, str, dict[str, Any]]] = []
    for row in rows:
        label = str(row.get("__label") or row.get("nombre") or row.get("referencia") or "")
        normalized_label = _normalize_match(label)
        if not normalized_label:
            continue
        score = _score_catalog_match(normalized_label, product_name)
        scored.append((score, label, row))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return [
        {
            "id": item[2].get("id"),
            "label": str(item[2].get("__label") or item[1]),
            "suggested": item[0] > 0,
        }
        for item in scored[:limit]
        if item[2].get("id") is not None
    ]


def _build_product_name(row: BulkRow) -> str:
    if row.product_name:
        return row.product_name
    parts = [row.base, row.modelo, row.referencia_1, row.referencia_2, row.referencia_3, row.tela]
    return " ".join(part for part in parts if part).strip()


def _product_search_names(
    product_name: str,
    row: BulkRow,
    fabric: dict[str, Any] | None,
) -> list[str]:
    candidates = [
        product_name,
        " ".join(part for part in (product_name, row.tela) if part).strip(),
    ]
    if fabric:
        fabric_label = _component_text(fabric.get("__label") or fabric.get("nombre"))
        fabric_name = _component_text(fabric.get("nombre"))
        fabric_reference = _component_text(fabric.get("referencia"))
        candidates.extend(
            [
                " ".join(part for part in (product_name, fabric_label) if part).strip(),
                " ".join(
                    part for part in (product_name, fabric_name, fabric_reference) if part
                ).strip(),
            ]
        )

    seen: set[str] = set()
    normalized_candidates: list[str] = []
    for candidate in candidates:
        normalized = _normalize_match(candidate)
        if normalized and normalized not in seen:
            seen.add(normalized)
            normalized_candidates.append(candidate)
    return normalized_candidates


def _find_product_by_search_names(
    products: list[dict[str, Any]],
    search_names: list[str],
) -> dict[str, Any] | None:
    for search_name in search_names:
        product = _find_by_label(products, search_name) or _find_product_by_name_tokens(
            products,
            search_name,
        )
        if product:
            return product
    return None


def _split_fabric_text(value: Any) -> tuple[str, str]:
    text_value = _display_text(value)
    if "-" not in text_value:
        return text_value, ""
    name, reference = text_value.split("-", 1)
    name = _display_text(name)
    reference = _display_text(reference)
    return name, reference


def _default_fabric_parts(value: Any) -> dict[str, str]:
    name, reference = _split_fabric_text(value)
    return {
        "tela_nombre": _component_text(name),
        "tela_referencia": _component_text(reference),
    }


def _build_final_product_name(row: BulkRow, suggested: dict[str, Any]) -> str:
    fabric_name = _component_text(suggested.get("tela_nombre"))
    fabric_reference = _component_text(suggested.get("tela_referencia"))
    fabric_text = " ".join(
        part for part in (fabric_name, fabric_reference) if part
    ).strip()
    if not fabric_text:
        fabric_text = _component_text(suggested.get("tela"))

    parts = [
        _component_text(suggested.get("base") or row.base),
        _component_text(suggested.get("modelo") or row.modelo),
        _component_text(suggested.get("referencia_1") or row.referencia_1),
        _component_text(suggested.get("referencia_2") or row.referencia_2),
        _component_text(suggested.get("referencia_3") or row.referencia_3),
        fabric_text or _component_text(row.tela),
    ]
    combined = " ".join(part for part in parts if part).strip()
    return combined or _build_product_name(row)


def _build_product_name_from_payload(
    row: BulkRow,
    suggested: dict[str, Any],
    fabric: dict[str, Any] | None = None,
) -> str:
    if fabric:
        fabric_text = _component_text(fabric.get("__label") or fabric.get("nombre"))
    else:
        fabric_name = _component_text(suggested.get("tela_nombre"))
        fabric_reference = _component_text(suggested.get("tela_referencia"))
        fabric_parts = []
        for part in (fabric_name, fabric_reference):
            if part and part not in fabric_parts:
                fabric_parts.append(part)
        fabric_text = " ".join(fabric_parts) or _component_text(suggested.get("tela") or row.tela)

    parts = [
        _component_text(suggested.get("base") or row.base),
        _component_text(suggested.get("modelo") or row.modelo),
        _component_text(suggested.get("referencia_1") or row.referencia_1),
        _component_text(suggested.get("referencia_2") or row.referencia_2),
        _component_text(suggested.get("referencia_3") or row.referencia_3),
        fabric_text,
    ]

    unique_parts: list[str] = []
    seen: set[str] = set()
    for part in parts:
        key = _normalize_match(part)
        if key and key not in seen:
            seen.add(key)
            unique_parts.append(part)
    return " ".join(unique_parts).strip() or _build_final_product_name(row, suggested)


def _build_product_sku(base_id: Any, model_id: Any, reference_id: Any, fabric_id: Any) -> str:
    def segment(value: Any, width: int) -> str:
        digits = re.sub(r"\D", "", str(value or ""))
        return digits[-width:].zfill(width)

    return f"1-{segment(base_id, 3)}-{segment(model_id, 3)}-{segment(reference_id, 4)}-{segment(fabric_id, 5)}"


def parse_purchase_order_excel(content: bytes) -> list[BulkRow]:
    raw_rows = _read_xlsx_rows(content)
    headers = set(raw_rows[0].keys() if raw_rows else [])
    missing_headers = [
        label
        for key, label in ORDER_HEADERS.items()
        if key not in headers
    ]
    has_full_product = {"base", "modelo", "tela"}.issubset(headers)
    has_compact_product = all(key in headers for key in COMPACT_PRODUCT_HEADERS)
    if not raw_rows:
        raise DBCommunicationError("El archivo no tiene filas para cargar")
    if not has_full_product and not has_compact_product:
        missing_headers.extend(["Nombre o Base/Modelo/Referencia", "Tela"])
    if missing_headers:
        raise DBCommunicationError(
            "Faltan columnas obligatorias en el Excel: " + ", ".join(missing_headers)
        )

    rows: list[BulkRow] = []
    for raw in raw_rows:
        try:
            rows.append(
                BulkRow(
                    row_number=int(raw["_row_number"]),
                    cliente=_clean_cell_text(raw.get("cliente")),
                    product_name=_component_text(raw.get("nombre")),
                    base=_component_text(raw.get("base")),
                    modelo=_component_text(raw.get("modelo")),
                    referencia_1=_component_text(raw.get("referencia_1") or raw.get("referencia")),
                    referencia_2=_component_text(raw.get("referencia_2")),
                    referencia_3=_component_text(raw.get("referencia_3")),
                    tela=_component_text(raw.get("tela")),
                    fecha_entrega=_parse_purchase_order_delivery_date(
                        _first_present_value(raw, DELIVERY_DATE_HEADER_KEYS)
                    ),
                    detalle=_clean_cell_text(raw.get("detalle")),
                    oc_interno=_clean_cell_text(raw.get("oc_interno")),
                    oc_cliente=_clean_cell_text(raw.get("oc_cliente")),
                    cantidad=_parse_int(raw.get("cantidad")),
                )
            )
        except Exception as error:
            raise DBCommunicationError(
                f"Fila {raw.get('_row_number')}: no se pudo leer la fila ({error})"
            )
    return rows


def _bulk_row_from_payload(payload: dict[str, Any]) -> BulkRow:
    return BulkRow(
        row_number=int(payload.get("row_number") or 0),
        cliente=_clean_cell_text(payload.get("cliente")),
        product_name=_component_text(payload.get("product_name")),
        base=_component_text(payload.get("base")),
        modelo=_component_text(payload.get("modelo")),
        referencia_1=_component_text(payload.get("referencia_1") or payload.get("referencia")),
        referencia_2=_component_text(payload.get("referencia_2")),
        referencia_3=_component_text(payload.get("referencia_3")),
        tela=_component_text(payload.get("tela")),
        fecha_entrega=_parse_purchase_order_delivery_date(
            _first_present_value(payload, DELIVERY_DATE_HEADER_KEYS)
        ),
        detalle=_clean_cell_text(payload.get("detalle")),
        oc_interno=_clean_cell_text(payload.get("oc_interno")),
        oc_cliente=_clean_cell_text(payload.get("oc_cliente")),
        cantidad=_parse_int(payload.get("cantidad") or 1),
    )


def _bulk_order_process_row_from_raw(raw: dict[str, Any]) -> BulkOrderProcessRow:
    return BulkOrderProcessRow(
        row_number=int(raw.get("_row_number") or raw.get("row_number") or 0),
        item_legado=_clean_cell_text(raw.get("item") or raw.get("item_legado")),
        id_proceso=_parse_optional_int(
            raw.get("id_proceso") or raw.get("proceso") or raw.get("proceso_id")
        ),
        id_empleado=_parse_optional_int(
            raw.get("id_empleado") or raw.get("empleado") or raw.get("empleado_id")
        ),
        fecha_inicio=_parse_optional_datetime(raw.get("fecha_inicio")),
        fecha_finalizado=_parse_optional_datetime(
            raw.get("fecha_finalizacion")
            or raw.get("fecha_finalizado")
            or raw.get("fecha_fin")
        ),
        comentarios=_clean_cell_text(
            raw.get("comentario") or raw.get("comentarios") or raw.get("observaciones")
        ),
    )


def _bulk_order_process_row_from_payload(
    payload: dict[str, Any],
) -> BulkOrderProcessRow:
    return BulkOrderProcessRow(
        row_number=int(payload.get("row_number") or 0),
        item_legado=_clean_cell_text(payload.get("item") or payload.get("item_legado")),
        id_proceso=_parse_optional_int(payload.get("id_proceso")),
        id_empleado=_parse_optional_int(payload.get("id_empleado")),
        fecha_inicio=_parse_optional_datetime(payload.get("fecha_inicio")),
        fecha_finalizado=_parse_optional_datetime(payload.get("fecha_finalizado")),
        comentarios=_clean_cell_text(payload.get("comentarios")),
    )


def _serialize_datetime(value: datetime | None) -> str:
    return value.isoformat(timespec="minutes") if value else ""


def parse_order_process_excel(content: bytes) -> list[BulkOrderProcessRow]:
    parsed_rows = _read_xlsx_rows(content)
    rows: list[BulkOrderProcessRow] = []
    for raw in parsed_rows:
        try:
            rows.append(_bulk_order_process_row_from_raw(raw))
        except Exception as error:
            raise DBCommunicationError(
                f"Fila {raw.get('_row_number')}: no se pudo leer la fila ({error})"
            )
    return rows


async def _fetch_items_by_legacy(
    db: AsyncSession,
    item_legacy_values: list[str],
) -> dict[str, dict[str, Any]]:
    clean_values = [
        value for value in {_clean_cell_text(item) for item in item_legacy_values} if value
    ]
    if not clean_values:
        return {}

    query = text(
        """
        SELECT *
        FROM data.item
        WHERE TRIM(item_legado::text) IN :items
        """
    ).bindparams(bindparam("items", expanding=True))
    result = await db.execute(query, {"items": clean_values})
    return {
        _clean_cell_text(row.get("item_legado")): dict(row)
        for row in result.mappings().all()
    }


async def _preview_order_process_row(
    db: AsyncSession,
    row: BulkOrderProcessRow,
    items_by_legacy: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    items = items_by_legacy
    if items is None:
        items = await _fetch_items_by_legacy(db, [row.item_legado])

    item = items.get(row.item_legado)
    missing: list[str] = []
    errors: list[str] = []

    if not row.item_legado:
        missing.append("item")
        errors.append("Falta item")
    elif not item:
        missing.append("item")
        errors.append("El item no existe")
    if row.id_proceso is None:
        missing.append("id_proceso")
        errors.append("Falta ID proceso")

    return {
        "row_number": row.row_number,
        "item": row.item_legado,
        "id_proceso": row.id_proceso,
        "id_empleado": row.id_empleado,
        "fecha_inicio": _serialize_datetime(row.fecha_inicio),
        "fecha_finalizado": _serialize_datetime(row.fecha_finalizado),
        "comentarios": row.comentarios,
        "resolved": {
            "item_id": item.get("id") if item else None,
        },
        "missing": missing,
        "errors": errors,
        "omitted": False,
        "status": "ready" if not missing else "invalid",
    }


async def preview_order_process_import(
    db: AsyncSession,
    content: bytes,
) -> dict[str, Any]:
    rows = parse_order_process_excel(content)
    items_by_legacy = await _fetch_items_by_legacy(
        db,
        [row.item_legado for row in rows],
    )
    preview_rows = [
        await _preview_order_process_row(db, row, items_by_legacy) for row in rows
    ]
    return {
        "rows": preview_rows,
        "summary": {
            "total": len(preview_rows),
            "ready": sum(1 for row in preview_rows if row["status"] == "ready"),
            "invalid": sum(1 for row in preview_rows if row["status"] != "ready"),
            "omitted": 0,
        },
    }


async def revalidate_order_process_row(
    db: AsyncSession,
    payload: dict[str, Any],
) -> dict[str, Any]:
    row = _bulk_order_process_row_from_payload(payload)
    next_row = await _preview_order_process_row(db, row)
    next_row["omitted"] = bool(payload.get("omitted"))
    if next_row["omitted"]:
        next_row["status"] = "omitted"
    return next_row


async def commit_order_process_import(
    db: AsyncSession,
    rows_payload: list[dict[str, Any]],
) -> dict[str, Any]:
    columns = await _table_columns_map(db, "ordenproceso")
    available_columns = set(columns)
    process_column = _first_existing_column(
        available_columns,
        ("id_proceso", "proceso_id", "id_prtoceso"),
    )
    employee_column = _first_existing_column(
        available_columns,
        ("id_empleado", "empleado_id", "id_persona", "persona_id"),
    )
    item_column = _first_existing_column(
        available_columns,
        ("id_item", "item_id", "items_id"),
    )
    start_column = _first_existing_column(
        available_columns,
        ("fecha_inicio", "fecha_iniciado", "fecha"),
    )
    finished_column = _first_existing_column(
        available_columns,
        ("fecha_finalizado", "fecha_finalizacion", "fecha_fin"),
    )
    comment_column = _first_existing_column(
        available_columns,
        ("comentarios", "comentario", "observaciones"),
    )

    if not item_column or not process_column:
        raise DBCommunicationError("ordenproceso no tiene columnas de item/proceso")

    active_payloads = [
        payload for payload in rows_payload if not bool(payload.get("omitted"))
    ]
    rows = [_bulk_order_process_row_from_payload(payload) for payload in active_payloads]
    items_by_legacy = await _fetch_items_by_legacy(db, [row.item_legado for row in rows])

    inserted = 0
    updated = 0
    omitted = len(rows_payload) - len(active_payloads)

    try:
        for row in rows:
            row_number = row.row_number or "?"
            item = items_by_legacy.get(row.item_legado)
            if not item:
                raise DBCommunicationError(f"Fila {row_number}: el item no existe")
            if row.id_proceso is None:
                raise DBCommunicationError(f"Fila {row_number}: falta ID proceso")

            item_id = item.get("id")
            result = await db.execute(
                text(
                    f"""
                    SELECT *
                    FROM {_quote_identifier(FORMS_SCHEMA, field_name='schema')}.{_quote_identifier('ordenproceso', field_name='order_process_table')}
                    WHERE {_quote_identifier(item_column, field_name='item_column')} = :item_id
                      AND {_quote_identifier(process_column, field_name='process_column')} = :process_id
                    LIMIT 1
                    """
                ),
                {"item_id": item_id, "process_id": row.id_proceso},
            )
            existing = dict(result.mappings().first() or {})

            row_data: dict[str, Any] = {
                item_column: item_id,
                process_column: row.id_proceso,
            }
            if employee_column:
                row_data[employee_column] = row.id_empleado
            if start_column:
                row_data[start_column] = row.fecha_inicio
            if finished_column:
                row_data[finished_column] = row.fecha_finalizado
            if comment_column:
                row_data[comment_column] = row.comentarios

            if existing:
                primary_key = _first_existing_column(
                    set(existing),
                    ("id", "id_ordenproceso", "ordenproceso_id"),
                )
                if not primary_key:
                    raise DBCommunicationError(
                        f"Fila {row_number}: no se pudo identificar la fila existente"
                    )
                filtered = {
                    key: _coerce_column_value(value, columns[key])
                    for key, value in row_data.items()
                    if key in columns
                }
                assignments = ", ".join(
                    f"{_quote_identifier(column, field_name='bulk_column')} = :{column}"
                    for column in filtered
                )
                params = {
                    **filtered,
                    "__existing_id": existing.get(primary_key),
                }
                await db.execute(
                    text(
                        f"""
                        UPDATE {_quote_identifier(FORMS_SCHEMA, field_name='schema')}.{_quote_identifier('ordenproceso', field_name='order_process_table')}
                        SET {assignments}
                        WHERE {_quote_identifier(primary_key, field_name='primary_key')} = :__existing_id
                        """
                    ),
                    params,
                )
                updated += 1
            else:
                await _insert_dynamic_row(db, "ordenproceso", row_data)
                inserted += 1

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {
        "status": "success",
        "inserted": inserted,
        "updated": updated,
        "omitted": omitted,
    }


async def preview_purchase_order_import(db: AsyncSession, content: bytes) -> dict[str, Any]:
    rows = parse_purchase_order_excel(content)

    clients = await _fetch_lookup(db, "cliente", label_columns=("nombre",))
    bases = await _fetch_lookup(db, "base", label_columns=("nombre",))
    models = await _fetch_lookup(db, "modelo", label_columns=("nombre",))
    references = await _fetch_lookup(db, "referencia", label_columns=("nombre",))
    fabrics = await _fetch_lookup(db, "tela", label_columns=("nombre", "referencia"))
    products = await _fetch_lookup(db, "producto", label_columns=("nombre", "sku"))
    units = await _fetch_fabric_units(db)
    default_unit = _select_default_fabric_unit(units)

    preview_rows: list[dict[str, Any]] = []
    for row in rows:
        client = _find_by_label(clients, row.cliente)
        product_name = _build_product_name(row)
        base = _find_by_label(bases, row.base) if row.base else _find_contained_lookup(bases, product_name)
        model = _find_by_label(models, row.modelo) if row.modelo else _find_contained_lookup(models, product_name)
        contained_references = _find_contained_lookups(references, product_name, limit=3)
        reference_1 = _find_by_label(references, row.referencia_1) if row.referencia_1 else (contained_references[0] if len(contained_references) > 0 else None)
        reference_2 = _find_by_label(references, row.referencia_2) if row.referencia_2 else (contained_references[1] if len(contained_references) > 1 else None)
        reference_3 = _find_by_label(references, row.referencia_3) if row.referencia_3 else (contained_references[2] if len(contained_references) > 2 else None)
        fabric = _find_by_label(fabrics, row.tela)
        fabric_parts = _default_fabric_parts(row.tela)
        product_search_names = _product_search_names(product_name, row, fabric)

        product = _find_product_by_search_names(products, product_search_names)
        if not product and base and model and fabric:
            product = next(
                (
                    item
                    for item in products
                    if str(item.get("id_base") or "") == str(base.get("id") or "")
                    and str(item.get("id_modelo") or "") == str(model.get("id") or "")
                    and str(item.get("id_referencia_1") or item.get("id_referencia") or "") == str((reference_1 or {}).get("id") or "")
                    and str(item.get("id_referencia_2") or "") == str((reference_2 or {}).get("id") or "")
                    and str(item.get("id_referencia_3") or "") == str((reference_3 or {}).get("id") or "")
                    and str(item.get("id_tela") or "") == str(fabric.get("id") or "")
                ),
                None,
            )

        if product:
            product_base = _find_by_id(bases, product.get("id_base"))
            product_model = _find_by_id(models, product.get("id_modelo"))
            product_reference_1 = _find_by_id(
                references,
                _first_value(product, "id_referencia_1", "id_referencia"),
            )
            product_reference_2 = _find_by_id(references, product.get("id_referencia_2"))
            product_reference_3 = _find_by_id(references, product.get("id_referencia_3"))
            product_fabric = _find_by_id(fabrics, product.get("id_tela"))

            base = product_base or base
            model = product_model or model
            reference_1 = product_reference_1
            reference_2 = product_reference_2
            reference_3 = product_reference_3
            fabric = product_fabric or fabric

        missing = []
        if not client:
            missing.append("cliente")
        if not row.fecha_entrega:
            missing.append("fecha_entrega")

        preview_rows.append(
            {
                "row_number": row.row_number,
                "cliente": row.cliente,
                "base": row.base,
                "modelo": row.modelo,
                "referencia_1": row.referencia_1,
                "referencia_2": row.referencia_2,
                "referencia_3": row.referencia_3,
                "tela": row.tela,
                "fecha_entrega": row.fecha_entrega.isoformat() if row.fecha_entrega else "",
                "detalle": row.detalle,
                "oc_interno": row.oc_interno,
                "oc_cliente": row.oc_cliente,
                "cantidad": row.cantidad,
                "product_name": product_name,
                "resolved": {
                    "cliente_id": client.get("id") if client else None,
                    "base_id": base.get("id") if base else None,
                    "modelo_id": model.get("id") if model else None,
                    "referencia_1_id": reference_1.get("id") if reference_1 else None,
                    "referencia_2_id": reference_2.get("id") if reference_2 else None,
                    "referencia_3_id": reference_3.get("id") if reference_3 else None,
                    "tela_id": fabric.get("id") if fabric else None,
                    "tela_unidad_medida_id": default_unit.get("id") if default_unit else None,
                    "producto_id": product.get("id") if product else None,
                },
                "suggested": {
                    "base": str(base.get("__label") or base.get("nombre") or "") if base else row.base,
                    "modelo": str(model.get("__label") or model.get("nombre") or "") if model else row.modelo,
                    "referencia_1": str(reference_1.get("__label") or reference_1.get("nombre") or "") if reference_1 else row.referencia_1,
                    "referencia_2": str(reference_2.get("__label") or reference_2.get("nombre") or "") if reference_2 else row.referencia_2,
                    "referencia_3": str(reference_3.get("__label") or reference_3.get("nombre") or "") if reference_3 else row.referencia_3,
                    "tela": str(fabric.get("__label") or fabric.get("nombre") or "") if fabric else row.tela,
                    "tela_nombre": fabric_parts["tela_nombre"],
                    "tela_referencia": fabric_parts["tela_referencia"],
                    "tela_unidad_medida": str(default_unit.get("__label") or default_unit.get("nombre") or "") if default_unit else "",
                    "producto": str(product.get("nombre") or product.get("__label") or "") if product else "",
                },
                "options": {
                    "base": _lookup_options(bases, product_name),
                    "modelo": _lookup_options(models, product_name),
                    "referencia_1": _reference_lookup_options(references, product_name, reference_1),
                    "referencia_2": _reference_lookup_options(references, product_name, reference_2),
                    "referencia_3": _reference_lookup_options(references, product_name, reference_3),
                    "tela": _lookup_options(fabrics, row.tela),
                    "tela_unidad_medida": _lookup_options(units, product_name) or [
                        {"id": unit.get("id"), "label": str(unit.get("__label") or unit.get("nombre") or unit.get("id"))}
                        for unit in units[:20]
                        if unit.get("id") is not None
                    ],
                },
                "missing": missing,
                "status": "ready" if not missing else "needs_approval",
            }
        )

    return {
        "rows": preview_rows,
        "summary": {
            "total": len(preview_rows),
            "ready": sum(1 for row in preview_rows if row["status"] == "ready"),
            "needs_approval": sum(1 for row in preview_rows if row["status"] != "ready"),
        },
    }


async def revalidate_purchase_order_product(
    db: AsyncSession,
    payload: dict[str, Any],
) -> dict[str, Any]:
    row = _bulk_row_from_payload(payload)
    resolved = dict(payload.get("resolved") or {})
    suggested = dict(payload.get("suggested") or {})

    products = await _fetch_lookup(db, "producto", label_columns=("nombre", "sku"))
    bases = await _fetch_lookup(db, "base", label_columns=("nombre",))
    models = await _fetch_lookup(db, "modelo", label_columns=("nombre",))
    references = await _fetch_lookup(db, "referencia", label_columns=("nombre",))
    fabrics = await _fetch_lookup(db, "tela", label_columns=("nombre", "referencia"))

    base_id = resolved.get("base_id")
    model_id = resolved.get("modelo_id")
    reference_1_id = resolved.get("referencia_1_id") or resolved.get("referencia_id")
    reference_2_id = resolved.get("referencia_2_id")
    reference_3_id = resolved.get("referencia_3_id")
    fabric_id = resolved.get("tela_id")
    fabric = _find_by_id(fabrics, fabric_id)

    product = None
    if base_id and model_id and fabric_id:
        product = next(
            (
                item
                for item in products
                if str(item.get("id_base") or "") == str(base_id or "")
                and str(item.get("id_modelo") or "") == str(model_id or "")
                and str(item.get("id_referencia_1") or item.get("id_referencia") or "") == str(reference_1_id or "")
                and str(item.get("id_referencia_2") or "") == str(reference_2_id or "")
                and str(item.get("id_referencia_3") or "") == str(reference_3_id or "")
                and str(item.get("id_tela") or "") == str(fabric_id or "")
            ),
            None,
        )

    current_product_name = _build_product_name_from_payload(row, suggested, fabric)
    if not product:
        search_names = _product_search_names(current_product_name, row, fabric)
        product = _find_product_by_search_names(products, search_names)

    next_payload = dict(payload)
    next_resolved = dict(resolved)
    next_suggested = dict(suggested)
    missing = [item for item in list(payload.get("missing") or []) if item != "producto"]

    if product:
        product_base = _find_by_id(bases, product.get("id_base"))
        product_model = _find_by_id(models, product.get("id_modelo"))
        product_reference_1 = _find_by_id(
            references,
            _first_value(product, "id_referencia_1", "id_referencia"),
        )
        product_reference_2 = _find_by_id(references, product.get("id_referencia_2"))
        product_reference_3 = _find_by_id(references, product.get("id_referencia_3"))
        product_fabric = _find_by_id(fabrics, product.get("id_tela"))

        next_resolved.update(
            {
                "producto_id": product.get("id"),
                "base_id": product_base.get("id") if product_base else base_id,
                "modelo_id": product_model.get("id") if product_model else model_id,
                "referencia_1_id": product_reference_1.get("id") if product_reference_1 else None,
                "referencia_2_id": product_reference_2.get("id") if product_reference_2 else None,
                "referencia_3_id": product_reference_3.get("id") if product_reference_3 else None,
                "tela_id": product_fabric.get("id") if product_fabric else fabric_id,
            }
        )
        next_suggested.update(
            {
                "producto": str(product.get("nombre") or product.get("__label") or ""),
                "base": str(product_base.get("__label") or product_base.get("nombre") or "") if product_base else next_suggested.get("base"),
                "modelo": str(product_model.get("__label") or product_model.get("nombre") or "") if product_model else next_suggested.get("modelo"),
                "referencia_1": str(product_reference_1.get("__label") or product_reference_1.get("nombre") or "") if product_reference_1 else "",
                "referencia_2": str(product_reference_2.get("__label") or product_reference_2.get("nombre") or "") if product_reference_2 else "",
                "referencia_3": str(product_reference_3.get("__label") or product_reference_3.get("nombre") or "") if product_reference_3 else "",
                "tela": str(product_fabric.get("__label") or product_fabric.get("nombre") or "") if product_fabric else next_suggested.get("tela"),
            }
        )
        status = "ready" if not missing else "needs_approval"
    else:
        next_resolved["producto_id"] = None
        next_suggested["producto"] = ""
        missing = list(dict.fromkeys([*missing, "producto"]))
        status = "needs_approval"

    next_payload["resolved"] = next_resolved
    next_payload["suggested"] = next_suggested
    next_payload["missing"] = missing
    next_payload["status"] = status
    return next_payload


async def _get_next_item_legado(db: AsyncSession) -> int:
    query = text(
        """
        SELECT MAX(CAST(TRIM(item_legado::text) AS BIGINT)) AS maxval
        FROM data.item
        WHERE item_legado IS NOT NULL
          AND TRIM(item_legado::text) ~ '^[0-9]+$'
        """
    )
    result = await db.execute(query)
    maxval = result.scalar_one_or_none()
    return int(maxval or 0) + 1


async def _create_initial_bulk_item_process(
    db: AsyncSession,
    *,
    item_id: Any,
) -> None:
    if item_id is None:
        raise DBCommunicationError("No se pudo crear ordenproceso: item sin id")

    columns = await _table_columns_map(db, "ordenproceso")
    available_columns = set(columns)
    process_column = _first_existing_column(
        available_columns,
        ("id_proceso", "proceso_id", "id_prtoceso"),
    )
    employee_column = _first_existing_column(
        available_columns,
        ("id_empleado", "empleado_id", "id_persona", "persona_id"),
    )
    item_column = _first_existing_column(
        available_columns,
        ("id_item", "item_id", "items_id"),
    )
    created_column = _first_existing_column(
        available_columns,
        ("fecha_inicio", "fecha_creacion", "created_at", "fecha", "timestamp"),
    )

    row_data: dict[str, Any] = {}
    if process_column:
        row_data[process_column] = 1
    if employee_column:
        include_employee, employee_value = await _resolve_initial_employee_value(
            db,
            process_table="ordenproceso",
            employee_column=employee_column,
        )
        if include_employee:
            row_data[employee_column] = employee_value
    if item_column:
        row_data[item_column] = item_id
    if created_column:
        row_data[created_column] = date.today()

    await _insert_dynamic_row(
        db,
        "ordenproceso",
        row_data,
    )


async def commit_purchase_order_import(
    db: AsyncSession,
    rows_payload: list[dict[str, Any]],
    *,
    create_missing: bool,
) -> dict[str, Any]:
    created_orders = 0
    reused_orders = 0
    created_items = 0
    created_fabrics = 0
    created_products = 0
    next_item_legado = await _get_next_item_legado(db)
    default_fabric_unit_id = await _get_default_fabric_unit_id(db)
    order_columns = await _table_columns_map(db, "ordencompra")
    if "fecha_entrega" not in order_columns:
        raise DBCommunicationError(
            "La tabla data.ordencompra no tiene la columna fecha_entrega. "
            "Crea la columna antes de continuar con la carga masiva."
        )

    try:
        for payload in rows_payload:
            row_number = payload.get("row_number", "?")
            try:
                row = BulkRow(
                    row_number=int(payload["row_number"]),
                    cliente=_clean_cell_text(payload.get("cliente")),
                    product_name=_component_text(payload.get("product_name")),
                    base=_component_text(payload.get("base")),
                    modelo=_component_text(payload.get("modelo")),
                    referencia_1=_component_text(payload.get("referencia_1") or payload.get("referencia")),
                    referencia_2=_component_text(payload.get("referencia_2")),
                    referencia_3=_component_text(payload.get("referencia_3")),
                    tela=_component_text(payload.get("tela")),
                    fecha_entrega=_parse_purchase_order_delivery_date(
                        _first_present_value(payload, DELIVERY_DATE_HEADER_KEYS)
                    ),
                    detalle=_clean_cell_text(payload.get("detalle")),
                    oc_interno=_clean_cell_text(payload.get("oc_interno")),
                    oc_cliente=_clean_cell_text(payload.get("oc_cliente")),
                    cantidad=_parse_int(payload.get("cantidad")),
                )
                resolved = dict(payload.get("resolved") or {})
                client_id = resolved.get("cliente_id")
                base_id = resolved.get("base_id")
                model_id = resolved.get("modelo_id")
                reference_1_id = resolved.get("referencia_1_id") or resolved.get("referencia_id")
                reference_2_id = resolved.get("referencia_2_id")
                reference_3_id = resolved.get("referencia_3_id")
                fabric_id = resolved.get("tela_id")
                fabric_unit_id = resolved.get("tela_unidad_medida_id")
                product_id = resolved.get("producto_id")
                suggested = dict(payload.get("suggested") or {})

                if not client_id:
                    raise DBCommunicationError(
                        f"Fila {row.row_number}: el cliente debe existir antes de cargar"
                    )
                if not row.fecha_entrega:
                    raise DBCommunicationError(
                        f"Fila {row.row_number}: falta fecha de entrega"
                    )

                if product_id:
                    product_name = _component_text(suggested.get("producto")) or _build_final_product_name(
                        row,
                        suggested,
                    )
                else:
                    if not base_id:
                        if not create_missing:
                            raise DBCommunicationError(f"Fila {row.row_number}: falta homologar base")
                        base_name = _component_text(suggested.get("base") or row.base)
                        if base_name:
                            base = await _get_or_create_named_row(
                                db,
                                "base",
                                base_name,
                            )
                            base_id = base.get("id")

                    if not model_id:
                        if not create_missing:
                            raise DBCommunicationError(f"Fila {row.row_number}: falta homologar modelo")
                        model_name = _component_text(suggested.get("modelo") or row.modelo)
                        if model_name:
                            model = await _get_or_create_named_row(
                                db,
                                "modelo",
                                model_name,
                            )
                            model_id = model.get("id")

                    if not reference_1_id and _component_text(suggested.get("referencia_1") or row.referencia_1):
                        reference_1 = await _get_or_create_named_row(
                            db,
                            "referencia",
                            suggested.get("referencia_1") or row.referencia_1,
                        )
                        reference_1_id = reference_1.get("id")

                    if not reference_2_id and _component_text(suggested.get("referencia_2") or row.referencia_2):
                        reference_2 = await _get_or_create_named_row(
                            db,
                            "referencia",
                            suggested.get("referencia_2") or row.referencia_2,
                        )
                        reference_2_id = reference_2.get("id")

                    if not reference_3_id and _component_text(suggested.get("referencia_3") or row.referencia_3):
                        reference_3 = await _get_or_create_named_row(
                            db,
                            "referencia",
                            suggested.get("referencia_3") or row.referencia_3,
                        )
                        reference_3_id = reference_3.get("id")

                    if not fabric_id:
                        if not create_missing:
                            raise DBCommunicationError(f"Fila {row.row_number}: falta homologar tela")
                        fabric_name = _component_text(suggested.get("tela_nombre"))
                        fabric_reference = _component_text(suggested.get("tela_referencia"))
                        if not fabric_name and not fabric_reference:
                            fabric_name, fabric_reference = _split_fabric_text(
                                suggested.get("tela") or row.tela
                            )
                        if fabric_name or fabric_reference:
                            if not fabric_name:
                                fabric_name = fabric_reference
                            if not fabric_reference:
                                fabric_reference = fabric_name
                            if not fabric_unit_id:
                                fabric_unit_id = default_fabric_unit_id
                            if not fabric_unit_id:
                                raise DBCommunicationError(
                                    f"Fila {row.row_number}: falta unidad METRO para crear la tela {fabric_name} {fabric_reference}"
                                )
                            fabric = await _get_or_create_fabric_row(
                                db,
                                name=fabric_name,
                                reference=fabric_reference,
                                unit_id=fabric_unit_id,
                            )
                            fabric_id = fabric.get("id")
                            if fabric.get("__was_created"):
                                created_fabrics += 1

                    product_name = _build_final_product_name(row, suggested)
                    if not create_missing:
                        raise DBCommunicationError(f"Fila {row.row_number}: falta homologar producto")
                    product = await _get_or_create_product_row(
                        db,
                        base_id=base_id,
                        model_id=model_id,
                        reference_1_id=reference_1_id,
                        reference_2_id=reference_2_id,
                        reference_3_id=reference_3_id,
                        fabric_id=fabric_id,
                        product_name=product_name,
                    )
                    product_id = product.get("id")
                    if product.get("__was_created"):
                        created_products += 1

                order = await _insert_dynamic_row(
                    db,
                    "ordencompra",
                    {
                        "id_cliente": client_id,
                        "id_producto": product_id,
                        "oc_interno": row.oc_interno,
                        "oc_cliente": row.oc_cliente,
                        "cantidad": row.cantidad,
                        "detalle": row.detalle,
                        "fecha_entrega": row.fecha_entrega,
                        "estado": "pendiente",
                        "fecha_pedido": date.today(),
                    },
                )
                created_orders += 1

                order_id = order.get("id")
                for _ in range(row.cantidad):
                    item = await _insert_dynamic_row(
                        db,
                        "item",
                        {
                            "item_legado": next_item_legado,
                            "id_orden_compra": order_id,
                            "id_cliente": client_id,
                            "detalle": product_name,
                            "fecha_produccion": date.today(),
                        },
                    )
                    await _create_initial_bulk_item_process(
                        db,
                        item_id=item.get("id") or item.get("id_item") or item.get("item_id"),
                    )
                    next_item_legado += 1
                    created_items += 1
            except DBCommunicationError as error:
                detail = str(error)
                if detail.startswith("Fila "):
                    raise
                raise DBCommunicationError(f"Fila {row_number}: {detail}") from error
            except Exception as error:
                raise DBCommunicationError(
                    f"Fila {row_number}: no se pudo cargar ({error})"
                ) from error

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {
        "status": "success",
        "created_orders": created_orders,
        "reused_orders": reused_orders,
        "created_items": created_items,
        "created_fabrics": created_fabrics,
        "created_products": created_products,
    }
