import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from typing import Any
from zipfile import ZipFile
from xml.etree import ElementTree as ET

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.forms import (
    DBCommunicationError,
    FORMS_SCHEMA,
    _add_manual_integer_id_if_needed,
    _get_table_columns,
    _quote_identifier,
)


ORDER_HEADERS = {
    "cliente": "Cliente",
    "oc_interno": "Oc interno",
    "oc_cliente": "Oc cliente",
    "cantidad": "Cantidad",
}
FULL_PRODUCT_HEADERS = {
    "base": "Base",
    "modelo": "Modelo",
    "referencia": "Referencia",
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


@dataclass
class BulkRow:
    row_number: int
    cliente: str
    product_name: str
    base: str
    modelo: str
    referencia: str
    tela: str
    oc_interno: str
    oc_cliente: str
    cantidad: int


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


async def _get_or_create_product_row(
    db: AsyncSession,
    *,
    base_id: Any,
    model_id: Any,
    reference_id: Any,
    fabric_id: Any,
    product_name: str,
) -> dict[str, Any]:
    product_sku = _build_product_sku(base_id, model_id, reference_id, fabric_id)
    rows = await _fetch_lookup(db, "producto", label_columns=("nombre", "sku"))
    existing = next(
        (
            row
            for row in rows
            if _normalize_match(row.get("sku")) == _normalize_match(product_sku)
            or _normalize_match(row.get("nombre")) == _normalize_match(product_name)
        ),
        None,
    )
    if existing:
        existing["__was_created"] = False
        return existing

    created = await _insert_dynamic_row(
        db,
        "producto",
        {
            "id_base": base_id,
            "id_modelo": model_id,
            "id_referencia": reference_id,
            "id_tela": fabric_id,
            "sku": product_sku,
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
    available_labels = [column for column in label_columns if column in columns]
    if not available_labels:
        available_labels = [
            name
            for name, meta in columns.items()
            if str(meta.get("data_type") or "").lower() in TEXT_COLUMNS
        ][:2]
    if not available_labels:
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
        try:
            return table_name, await _fetch_lookup(
                db,
                table_name,
                label_columns=label_columns,
            )
        except Exception:
            continue
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


def _find_contained_lookup(
    rows: list[dict[str, Any]],
    product_name: str,
) -> dict[str, Any] | None:
    normalized_product = f" {_normalize_match(product_name)} "
    candidates: list[tuple[int, dict[str, Any]]] = []
    for row in rows:
        label = _normalize_match(row.get("__label") or row.get("nombre"))
        if not label:
            continue
        if f" {label} " in normalized_product:
            candidates.append((len(label), row))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def _lookup_options(rows: list[dict[str, Any]], product_name: str, limit: int = 6) -> list[dict[str, Any]]:
    product_tokens = set(_normalize_match(product_name).split())
    scored: list[tuple[int, str, dict[str, Any]]] = []
    for row in rows:
        label = str(row.get("__label") or row.get("nombre") or row.get("referencia") or "")
        normalized_label = _normalize_match(label)
        if not normalized_label:
            continue
        label_tokens = set(normalized_label.split())
        score = len(product_tokens.intersection(label_tokens))
        if f" {normalized_label} " in f" {_normalize_match(product_name)} ":
            score += 10
        if score > 0:
            scored.append((score, label, row))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return [
        {"id": item[2].get("id"), "label": str(item[2].get("__label") or item[1])}
        for item in scored[:limit]
        if item[2].get("id") is not None
    ]


def _build_product_name(row: BulkRow) -> str:
    if row.product_name:
        return row.product_name
    parts = [row.base, row.modelo, row.referencia, row.tela]
    return " ".join(part for part in parts if part).strip()


def _split_fabric_text(value: Any) -> tuple[str, str]:
    text_value = _display_text(value)
    if "-" not in text_value:
        return text_value, text_value
    name, reference = text_value.split("-", 1)
    name = _display_text(name)
    reference = _display_text(reference)
    return name, reference or name


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
        _component_text(suggested.get("referencia") or row.referencia),
        fabric_text or _component_text(row.tela),
    ]
    combined = " ".join(part for part in parts if part).strip()
    return combined or _build_product_name(row)


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
    has_full_product = all(key in headers for key in FULL_PRODUCT_HEADERS)
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
                    referencia=_component_text(raw.get("referencia")),
                    tela=_component_text(raw.get("tela")),
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


async def preview_purchase_order_import(db: AsyncSession, content: bytes) -> dict[str, Any]:
    rows = parse_purchase_order_excel(content)

    clients = await _fetch_lookup(db, "cliente", label_columns=("nombre",))
    bases = await _fetch_lookup(db, "base", label_columns=("nombre",))
    models = await _fetch_lookup(db, "modelo", label_columns=("nombre",))
    references = await _fetch_lookup(db, "referencia", label_columns=("nombre",))
    fabrics = await _fetch_lookup(db, "tela", label_columns=("nombre", "referencia"))
    products = await _fetch_lookup(db, "producto", label_columns=("nombre", "sku"))
    unit_table_name, units = await _fetch_first_available_lookup(
        db,
        ("unidadmedida", "unidad_medida", "unidades", "unidad"),
        label_columns=("nombre", "unidad", "descripcion"),
    )

    preview_rows: list[dict[str, Any]] = []
    for row in rows:
        client = _find_by_label(clients, row.cliente)
        product_name = _build_product_name(row)
        base = _find_by_label(bases, row.base) if row.base else _find_contained_lookup(bases, product_name)
        model = _find_by_label(models, row.modelo) if row.modelo else _find_contained_lookup(models, product_name)
        reference = _find_by_label(references, row.referencia) if row.referencia else _find_contained_lookup(references, product_name)
        fabric = _find_by_label(fabrics, row.tela)
        default_unit = units[0] if units else None
        fabric_parts = _default_fabric_parts(row.tela)

        product = _find_by_label(products, product_name)
        if not product and base and model and reference and fabric:
            product_sku = _build_product_sku(base.get("id"), model.get("id"), reference.get("id"), fabric.get("id"))
            product = next((item for item in products if _normalize_match(item.get("sku")) == _normalize_match(product_sku)), None)

        missing = []
        for key, resolved in (
            ("cliente", client),
            ("base", base),
            ("modelo", model),
            ("referencia", reference),
            ("tela", fabric),
        ):
            if not resolved:
                missing.append(key)
        if not product:
            missing.append("producto")

        preview_rows.append(
            {
                "row_number": row.row_number,
                "cliente": row.cliente,
                "base": row.base,
                "modelo": row.modelo,
                "referencia": row.referencia,
                "tela": row.tela,
                "oc_interno": row.oc_interno,
                "oc_cliente": row.oc_cliente,
                "cantidad": row.cantidad,
                "product_name": product_name,
                "resolved": {
                    "cliente_id": client.get("id") if client else None,
                    "base_id": base.get("id") if base else None,
                    "modelo_id": model.get("id") if model else None,
                    "referencia_id": reference.get("id") if reference else None,
                    "tela_id": fabric.get("id") if fabric else None,
                    "tela_unidad_medida_id": default_unit.get("id") if default_unit else None,
                    "producto_id": product.get("id") if product else None,
                },
                "suggested": {
                    "base": str(base.get("__label") or base.get("nombre") or "") if base else row.base,
                    "modelo": str(model.get("__label") or model.get("nombre") or "") if model else row.modelo,
                    "referencia": str(reference.get("__label") or reference.get("nombre") or "") if reference else row.referencia,
                    "tela": str(fabric.get("__label") or fabric.get("nombre") or "") if fabric else row.tela,
                    "tela_nombre": fabric_parts["tela_nombre"],
                    "tela_referencia": fabric_parts["tela_referencia"],
                    "tela_unidad_medida": str(default_unit.get("__label") or default_unit.get("nombre") or "") if default_unit else "",
                },
                "options": {
                    "base": _lookup_options(bases, product_name),
                    "modelo": _lookup_options(models, product_name),
                    "referencia": _lookup_options(references, product_name),
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

    await _insert_dynamic_row(
        db,
        "ordenproceso",
        {
            "id_proceso": 1,
            "id_item": item_id,
        },
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

    try:
        for payload in rows_payload:
            row = BulkRow(
                row_number=int(payload["row_number"]),
                cliente=_clean_cell_text(payload.get("cliente")),
                product_name=_component_text(payload.get("product_name")),
                base=_component_text(payload.get("base")),
                modelo=_component_text(payload.get("modelo")),
                referencia=_component_text(payload.get("referencia")),
                tela=_component_text(payload.get("tela")),
                oc_interno=_clean_cell_text(payload.get("oc_interno")),
                oc_cliente=_clean_cell_text(payload.get("oc_cliente")),
                cantidad=_parse_int(payload.get("cantidad")),
            )
            resolved = dict(payload.get("resolved") or {})

            client_id = resolved.get("cliente_id")
            base_id = resolved.get("base_id")
            model_id = resolved.get("modelo_id")
            reference_id = resolved.get("referencia_id")
            fabric_id = resolved.get("tela_id")
            fabric_unit_id = resolved.get("tela_unidad_medida_id")
            product_id = resolved.get("producto_id")
            suggested = dict(payload.get("suggested") or {})

            if not client_id:
                raise DBCommunicationError(
                    f"Fila {row.row_number}: el cliente debe existir antes de cargar"
                )

            if not base_id:
                if not create_missing:
                    raise DBCommunicationError(f"Fila {row.row_number}: falta homologar base")
                base = await _get_or_create_named_row(
                    db,
                    "base",
                    suggested.get("base") or row.base,
                )
                base_id = base.get("id")

            if not model_id:
                if not create_missing:
                    raise DBCommunicationError(f"Fila {row.row_number}: falta homologar modelo")
                model = await _get_or_create_named_row(
                    db,
                    "modelo",
                    suggested.get("modelo") or row.modelo,
                )
                model_id = model.get("id")

            if not reference_id:
                if not create_missing:
                    raise DBCommunicationError(f"Fila {row.row_number}: falta homologar referencia")
                reference = await _get_or_create_named_row(
                    db,
                    "referencia",
                    suggested.get("referencia") or row.referencia,
                )
                reference_id = reference.get("id")

            if not fabric_id:
                if not create_missing:
                    raise DBCommunicationError(f"Fila {row.row_number}: falta homologar tela")
                fabric_name = _component_text(suggested.get("tela_nombre"))
                fabric_reference = _component_text(suggested.get("tela_referencia"))
                if not fabric_name and not fabric_reference:
                    fabric_name, fabric_reference = _split_fabric_text(
                        suggested.get("tela") or row.tela
                    )
                if not fabric_name:
                    raise DBCommunicationError(f"Fila {row.row_number}: falta nombre de tela")
                if not fabric_reference:
                    fabric_reference = fabric_name
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
            if not product_id:
                if not create_missing:
                    raise DBCommunicationError(f"Fila {row.row_number}: falta homologar producto")
                product = await _get_or_create_product_row(
                    db,
                    base_id=base_id,
                    model_id=model_id,
                    reference_id=reference_id,
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
