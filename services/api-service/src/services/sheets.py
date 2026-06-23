import os
import pyodbc
import re
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from fastapi.concurrency import run_in_threadpool
from typing import List, Tuple, Optional, Any
import json
from zoneinfo import ZoneInfo
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.logging_config import get_logger

logger = get_logger(__name__)

_EXTERNAL_LOCATIONS = {"Tienda Bucaramanga", "Nihao Principal", "Tienda Unicentro"}
DATA_SCHEMA = "data"
FINALIZED_ORDER_STATUS_VALUES = (
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
ITEM_TABLE_CANDIDATES = ("item", "items")
ORDER_TABLE_CANDIDATES = ("ordencompra", "orden_compra", "ordenes_compra")
PRODUCT_TABLE_CANDIDATES = ("producto", "productos")
CLIENT_TABLE_CANDIDATES = ("cliente", "clientes")
FABRIC_TABLE_CANDIDATES = ("tela", "telas")
FABRIC_REFERENCE_TABLE_CANDIDATES = (
    "referenciatela",
    "referencia_tela",
    "referencias_tela",
    "referencia_telas",
)
ITEM_LEGACY_COLUMN_CANDIDATES = ("item_legado", "id_item_legado", "coditem", "item")
ITEM_ORDER_COLUMN_CANDIDATES = (
    "id_orden_compra",
    "orden_compra_id",
    "ordencompra_id",
    "orden_compra",
    "ordencompra",
    "id_oc",
    "oc_id",
    "oc",
)
ITEM_FABRIC_COLUMN_CANDIDATES = (
    "id_tela",
    "tela_id",
    "tela",
    "id_referencia_tela",
    "referencia_tela_id",
    "referencia_tela",
)
ITEM_FABRIC_NAME_COLUMN_CANDIDATES = ("id_tela", "tela_id", "tela")
ITEM_FABRIC_REFERENCE_COLUMN_CANDIDATES = (
    "id_referencia_tela",
    "referencia_tela_id",
    "referencia_tela",
    "id_referenciatela",
    "referenciatela_id",
    "referenciatela",
)
ORDER_STATUS_COLUMN_CANDIDATES = (
    "estado",
    "status",
    "estado_oc",
    "estado_orden",
    "estado_orden_compra",
)
ORDER_CLIENT_ORDER_COLUMN_CANDIDATES = (
    "oc_cliente",
    "cod_oc_cliente",
    "codoccliente",
    "orden_cliente",
    "orden_compra_cliente",
    "numero_orden",
    "orden",
    "oc",
    "id_orden_compra",
)
ORDER_CLIENT_COLUMN_CANDIDATES = (
    "id_cliente",
    "cliente_id",
    "cliente",
    "clientes",
    "nombre_cliente",
    "razon_social",
)
ORDER_PRODUCT_COLUMN_CANDIDATES = (
    "id_producto",
    "producto_id",
    "producto",
    "productos",
    "producto_nombre",
    "nombre_producto",
    "referencia",
    "sku",
)
ORDER_QUANTITY_COLUMN_CANDIDATES = (
    "cantidad",
    "quantity",
    "qty",
    "cant",
    "unidades",
    "piezas",
    "numero_items",
    "num_items",
)
ORDER_DETAIL_COLUMN_CANDIDATES = (
    "detalle",
    "descripcion",
    "observaciones",
    "nota",
    "notas",
)
PRODUCT_NAME_COLUMN_CANDIDATES = ("nombre", "producto", "descripcion", "referencia", "sku")
PRODUCT_COST_COLUMN_CANDIDATES = (
    "costo",
    "cost",
    "costo_unitario",
    "precio_costo",
    "cost_price",
    "valor_costo",
    "precio",
    "valor",
)
LOOKUP_LABEL_COLUMN_CANDIDATES = (
    "nombre",
    "name",
    "descripcion",
    "description",
    "tela",
    "referencia",
    "cliente",
    "razon_social",
)
ORDER_PROCESS_TABLE_CANDIDATES = ("ordenproceso", "ordenprocesos")
ORDER_PROCESS_ITEM_COLUMN_CANDIDATES = ("id_item", "item_id", "item", "id_items")
ORDER_PROCESS_PROCESS_COLUMN_CANDIDATES = ("id_proceso", "proceso_id", "id_prtoceso", "proceso")
ORDER_PROCESS_START_COLUMN_CANDIDATES = (
    "fecha_inicio",
    "fecha_iniciado",
    "fecha_inicio_real",
    "fecha",
)
ORDER_PROCESS_FINISH_COLUMN_CANDIDATES = (
    "fecha_finalizado",
    "fecha_finalizacion",
    "fecha_fin",
    "fecha_terminado",
)
ORDER_PROCESS_ID_COLUMN_CANDIDATES = ("id", "id_ordenproceso", "ordenproceso_id")
ITEM_PK_COLUMN_CANDIDATES = ("id", "id_item", "item_id")


def _quote_identifier(identifier: str) -> str:
    if not identifier or not identifier.replace("_", "").isalnum() or identifier[0].isdigit():
        raise ValueError(f"Invalid SQL identifier: {identifier}")
    return f'"{identifier}"'


def _columns_by_name(columns: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        str(column["column_name"]).strip().lower(): dict(column)
        for column in columns
        if column.get("column_name")
    }


def _choose_column(
    columns: list[dict[str, Any]],
    candidates: tuple[str, ...],
) -> str | None:
    available = _columns_by_name(columns)
    for candidate in candidates:
        if candidate in available:
            return str(available[candidate]["column_name"])
    return None


def _clean_product_name(value: Any) -> str:
    return str(value or "").replace(".", "").strip()


def _clean_sheet_text(value: Any) -> str:
    return str(value or "").replace(".", "").strip().upper()


def _normalize_spaces(value: str) -> str:
    return " ".join(value.split())


def _remove_text_fragment(value: str, fragment: str) -> str:
    if not value or not fragment:
        return value

    fragment_tokens = [re.escape(token) for token in _normalize_spaces(fragment).split()]
    if not fragment_tokens:
        return value

    separator_pattern = r"[\s\-/|]+"
    fragment_pattern = separator_pattern.join(fragment_tokens)
    cleaned = re.sub(
        rf"(?<!\w){fragment_pattern}(?!\w)",
        " ",
        value,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s*[-/|]\s*$", " ", cleaned)
    cleaned = re.sub(r"^\s*[-/|]\s*", " ", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return _normalize_spaces(cleaned.strip(" -/|"))


def _split_product_and_fabric(product_value: Any, fabric_value: Any) -> tuple[str, str]:
    product = _normalize_spaces(_clean_sheet_text(product_value))
    fabric = _normalize_spaces(_clean_sheet_text(fabric_value))

    if fabric:
        return _remove_text_fragment(product, fabric), fabric

    for separator in (" - ", " / ", " | "):
        if separator in product:
            product_part, fabric_part = product.rsplit(separator, 1)
            if product_part.strip() and fabric_part.strip():
                return _normalize_spaces(product_part), _normalize_spaces(fabric_part)

    return product, fabric


def _compose_inventory_product(product_value: Any, fabric_value: Any, detail_value: Any) -> tuple[str, str]:
    product, fabric = _split_product_and_fabric(product_value, fabric_value)
    detail = _normalize_spaces(_clean_sheet_text(detail_value))
    if detail:
        product = _normalize_spaces(f"{product} {detail}".strip())
    return product, fabric


def _is_finalized_status(value: Any) -> bool:
    return str(value or "").strip().lower() in FINALIZED_ORDER_STATUS_VALUES


async def _get_pg_table_columns(
    db: AsyncSession,
    *,
    schema_name: str,
    table_name: str,
) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = :schema_name
              AND table_name = :table_name
            ORDER BY ordinal_position
            """
        ),
        {"schema_name": schema_name, "table_name": table_name},
    )
    return [dict(row) for row in result.mappings().all()]


async def _find_pg_table(
    db: AsyncSession,
    *,
    schema_name: str,
    candidates: tuple[str, ...],
) -> tuple[str, list[dict[str, Any]]] | tuple[None, list[dict[str, Any]]]:
    for table_name in candidates:
        columns = await _get_pg_table_columns(
            db,
            schema_name=schema_name,
            table_name=table_name,
        )
        if columns:
            return table_name, columns
    return None, []


async def _get_pg_foreign_keys(
    db: AsyncSession,
    *,
    schema_name: str,
    table_name: str,
) -> dict[str, dict[str, str]]:
    result = await db.execute(
        text(
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
              AND tc.table_name = :table_name
            """
        ),
        {"schema_name": schema_name, "table_name": table_name},
    )

    return {
        str(row["source_column"]).strip().lower(): {
            "referenced_schema": str(row["referenced_schema"]).strip(),
            "referenced_table": str(row["referenced_table"]).strip(),
            "referenced_column": str(row["referenced_column"]).strip(),
        }
        for row in result.mappings().all()
    }


async def _resolve_lookup_expression(
    db: AsyncSession,
    *,
    source_alias: str,
    source_column: str | None,
    source_table: str,
    fallback_tables: tuple[str, ...],
    fallback_key_candidates: tuple[str, ...],
    label_candidates: tuple[str, ...],
    join_alias: str,
) -> tuple[list[str], str | None]:
    if not source_column:
        return [], None

    foreign_keys = await _get_pg_foreign_keys(
        db,
        schema_name=DATA_SCHEMA,
        table_name=source_table,
    )
    fk = foreign_keys.get(source_column.lower())
    ref_table = fk["referenced_table"] if fk else None
    ref_schema = fk["referenced_schema"] if fk else DATA_SCHEMA
    ref_key = fk["referenced_column"] if fk else None
    ref_columns: list[dict[str, Any]] = []

    if ref_table:
        ref_columns = await _get_pg_table_columns(
            db,
            schema_name=ref_schema,
            table_name=ref_table,
        )
    else:
        found_table, ref_columns = await _find_pg_table(
            db,
            schema_name=DATA_SCHEMA,
            candidates=fallback_tables,
        )
        ref_table = found_table
        ref_key = _choose_column(ref_columns, fallback_key_candidates)

    if not ref_table or not ref_key or not ref_columns:
        return [], f"{source_alias}.{_quote_identifier(source_column)}::text"

    label_column = _choose_column(ref_columns, label_candidates) or ref_key
    join_sql = (
        f"LEFT JOIN {_quote_identifier(ref_schema)}.{_quote_identifier(ref_table)} {join_alias} "
        f"ON TRIM({join_alias}.{_quote_identifier(ref_key)}::text) = "
        f"TRIM({source_alias}.{_quote_identifier(source_column)}::text)"
    )
    expression = (
        f"COALESCE(NULLIF(TRIM({join_alias}.{_quote_identifier(label_column)}::text), ''), "
        f"{source_alias}.{_quote_identifier(source_column)}::text)"
    )
    return [join_sql], expression


async def _resolve_tela_lookup_expression(
    db: AsyncSession,
    *,
    source_alias: str,
    source_column: str | None,
    source_table: str,
    join_alias: str,
) -> tuple[list[str], str | None]:
    if not source_column:
        return [], None

    foreign_keys = await _get_pg_foreign_keys(
        db,
        schema_name=DATA_SCHEMA,
        table_name=source_table,
    )
    fk = foreign_keys.get(source_column.lower())
    ref_table = fk["referenced_table"] if fk else None
    ref_schema = fk["referenced_schema"] if fk else DATA_SCHEMA
    ref_key = fk["referenced_column"] if fk else None
    ref_columns: list[dict[str, Any]] = []

    if ref_table:
        ref_columns = await _get_pg_table_columns(
            db,
            schema_name=ref_schema,
            table_name=ref_table,
        )
    else:
        ref_table, ref_columns = await _find_pg_table(
            db,
            schema_name=DATA_SCHEMA,
            candidates=FABRIC_TABLE_CANDIDATES,
        )
        ref_key = _choose_column(ref_columns, ("id", "id_tela", "tela_id", "codigo", "codigo_tela"))

    if not ref_table or not ref_key or not ref_columns:
        return [], f"{source_alias}.{_quote_identifier(source_column)}::text"

    join_sql = (
        f"LEFT JOIN {_quote_identifier(ref_schema)}.{_quote_identifier(ref_table)} {join_alias} "
        f"ON TRIM({join_alias}.{_quote_identifier(ref_key)}::text) = "
        f"TRIM({source_alias}.{_quote_identifier(source_column)}::text)"
    )

    columns_by_name = _columns_by_name(ref_columns)
    nombre_column = columns_by_name.get("nombre")
    referencia_column = columns_by_name.get("referencia")
    if ref_table in FABRIC_TABLE_CANDIDATES and nombre_column and referencia_column:
        expression = (
            "COALESCE(NULLIF(CONCAT_WS(' ', "
            f"NULLIF(TRIM({join_alias}.{_quote_identifier(str(nombre_column['column_name']))}::text), ''), "
            f"NULLIF(TRIM({join_alias}.{_quote_identifier(str(referencia_column['column_name']))}::text), '')"
            "), ''), "
            f"{source_alias}.{_quote_identifier(source_column)}::text)"
        )
        return [join_sql], expression

    label_column = _choose_column(
        ref_columns,
        ("tela", "nombre", "descripcion", "referencia", "codigo"),
    ) or ref_key
    expression = (
        f"COALESCE(NULLIF(TRIM({join_alias}.{_quote_identifier(label_column)}::text), ''), "
        f"{source_alias}.{_quote_identifier(source_column)}::text)"
    )
    return [join_sql], expression


class SheetsService:
    def __init__(self):
        self.scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        self._service = None
        self._service_email: str = ""
        self.SHEET_NAME_INV: str = "INVENTARIO"
        self.SHEET_NAME_OPT: str = "Complementos"
        self.SHEET_NAME_DISPATCH: str = "DESPACHADO"
        self.SHEET_NAME_LOGS: str = "Logs"
        self.SHEET_NAME_RETURNS: str = "DEVOLUCIONES"

    #_________________________________________________________
    #   Connections and utils
    #_________________________________________________________

    def get_sql_connection(self):
        """
        get_sql_connection()
        Retorna una conexion sincrona a SQL Server usando el connection string de settings.
        """
        return pyodbc.connect(settings.SQLSERVER_URL_DATABASE)

    def get_google_service(self):
        """
        get_google_service()
        Construye y retorna el cliente de Google Sheets API usando credenciales de Bitwarden.
        Cachea el servicio en self._service para reutilizarlo entre llamadas.
        Retorna None si las credenciales no estan disponibles o hay un error.
        """
        if self._service:
            return self._service

        try:
            if not settings.GOOGLE_CREDENTIALS_JSON:
                logger.error("No hay credenciales configuradas")
                return None

            creds_dict = json.loads(settings.GOOGLE_CREDENTIALS_JSON)
            self._service_email = creds_dict.get("client_email", "")

            creds = service_account.Credentials.from_service_account_info(
                creds_dict, scopes=self.scopes
            )

            self._service = build("sheets", "v4", credentials=creds)
            return self._service

        except Exception as e:
            logger.exception(f"Error construyendo servicio Google: {e}")
            return None

    def get_val(self, row_data, idx):
        """
        get_val()
        Retorna el valor en la posicion idx de row_data, o cadena vacia si el indice no existe.
            - row_data:list | fila de datos obtenida desde Google Sheets
            - idx:int       | indice de la columna a leer
        """
        return row_data[idx] if idx < len(row_data) else ""

    def sheets_logs_sync(self, item: str,actividad: str,detalle: str,observaciones: str):
        """
        sheets_logs_sync()
        Escribe una fila de log en la hoja SHEET_NAME_LOGS.
        Columnas A-H: Macro | Item | Actividad | Detalle | Observaciones | Usuario | Fecha | Hora
            - item:str         | identificador del item involucrado
            - actividad:str    | descripcion breve de la accion ejecutada
            - detalle:str      | detalle ampliado de la accion
            - observaciones:str| notas adicionales
        Los campos Macro, Usuario, Fecha y Hora se fijan internamente.
        """
        from datetime import datetime

        service = self.get_google_service()
        if not service:
            logger.error("[LOG] No se pudo obtener el servicio de Google para registrar log.")
            return

        try:
            tz_bogota = ZoneInfo("America/Bogota")
            now = datetime.now(tz_bogota)
            row = [
                "PDA",
                str(item),
                actividad,
                detalle,
                observaciones,
                self._service_email,
                now.strftime("%d-%m-%Y"),
                now.strftime("%H:%M:%S"),
            ]
            service.spreadsheets().values().append(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=f"{self.SHEET_NAME_LOGS}!A:H",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [row]},
            ).execute()
        except Exception as e:
            logger.exception(f"[LOG] Error escribiendo log en Sheets: {e}")

    #_________________________________________________________
    #   GET | /get/{item}
    #_________________________________________________________

    async def get_item(self, item: int):
        """
        get_item()
        Wrapper asincrono de get_item_sync.
            - item:int | codigo del item a buscar en INVENTARIO
        """
        return await run_in_threadpool(self.get_item_sync, item)

    def get_item_sync(self, item: int):
        """
        get_item_sync()
        Busca un item en INVENTARIO y retorna sus datos junto con las listas de opciones de Complementos.
            - item:int | codigo del item a buscar (columna A)
        Retorna tupla de 8 elementos: (excel_row, producto, tela, ubicacion, fila, opt_warehouse, opt_row, opt_conveyor)
        """
        service = self.get_google_service()

        if not service:
            return None

        sheet_api = service.spreadsheets()
        try:
            range_search = f"{self.SHEET_NAME_INV}!A:A"
            result_search = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR, range=range_search
                )
                .execute()
            )
            rows_a = result_search.get("values", [])

            item_str = str(item)
            found_row_index = -1
            for i, row in enumerate(rows_a):
                if row and row[0] == item_str:
                    found_row_index = i
                    break

            if found_row_index == -1:
                return None

            excel_row = found_row_index + 1
            range_data = f"{self.SHEET_NAME_INV}!A{excel_row}:I{excel_row}"
            result_data = (
                sheet_api.values()
                .get(spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR, range=range_data)
                .execute()
            )
            fetched_rows = result_data.get("values", [])

            if not fetched_rows:
                return None

            row_data = fetched_rows[0]
            prod = self.get_val(row_data, 1)       # B - PRODUCTO
            tela = self.get_val(row_data, 2)       # C - TELA
            ubicacion = self.get_val(row_data, 5)  # F - UBICACION
            fila = self.get_val(row_data, 6)       # G - FILA

            ranges_opts = [
                f"{self.SHEET_NAME_OPT}!A2:A",  # opt_warehouse
                f"{self.SHEET_NAME_OPT}!C2:C",  # opt_row
                f"{self.SHEET_NAME_OPT}!I2:I",  # opt_conveyor
            ]
            result_opts = (
                sheet_api.values()
                .batchGet(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    ranges=ranges_opts,
                )
                .execute()
            )
            valueRanges = result_opts.get("valueRanges", [])

            opt_warehouse = []
            if len(valueRanges) > 0:
                raw_wh = valueRanges[0].get("values", [])
                opt_warehouse = [r[0] for r in raw_wh if r]

            opt_row = []
            if len(valueRanges) > 1:
                raw_r = valueRanges[1].get("values", [])
                opt_row = [r[0] for r in raw_r if r]

            opt_conveyor = []
            if len(valueRanges) > 2:
                raw_c = valueRanges[2].get("values", [])
                opt_conveyor = [r[0] for r in raw_c if r]

            return excel_row, prod, tela, ubicacion, fila, opt_warehouse, opt_row, opt_conveyor

        except HttpError as err:
            logger.exception(f"Ocurrio un error HTTP: {err}")
            return None

    #_________________________________________________________
    #   PATCH | /location/{row}
    #_________________________________________________________

    async def update_location(
        self, row: int, new_warehouse: str, new_row: str, referral: Optional[str] = None
    ):
        """
        update_location()
        Wrapper asincrono de update_location_sync.
            - row:int              | numero de fila en INVENTARIO
            - new_warehouse:str    | nuevo valor de UBICACION (col F)
            - new_row:str          | nuevo valor de FILA (col G)
            - referral:str|None    | valor opcional para OBSERVACIONES PRODUCTO (col I)
        """
        return await run_in_threadpool(
            self.update_location_sync, row, new_warehouse, new_row, referral
        )

    def update_location_sync(
        self, row: int, new_warehouse: str, new_row: str, referral: Optional[str] = None
    ):
        """
        update_location_sync()
        Actualiza la ubicacion de un item en la hoja INVENTARIO.
            - row:int              | numero de fila en el sheet
            - new_warehouse:str    | nuevo valor de UBICACION (col F)
            - new_row:str          | nuevo valor de FILA (col G)
            - referral:str|None    | si se provee, se escribe en OBSERVACIONES PRODUCTO (col I)
        Lee la fila completa antes de modificar y la almacena en init_data.
        """
        service = self.get_google_service()

        if not service:
            return 404

        try:
            # Leer fila completa para tener estado inicial
            result_read = (
                service.spreadsheets()
                .values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_INV}!A{row}:I{row}",
                )
                .execute()
            )
            fetched = result_read.get("values", [])
            init_data = fetched[0] if fetched else []
            logger.debug(f"[update_location] init_data fila {row}: {init_data}")

            # Actualizar UBICACION (col F) y FILA (col G)
            range_update = f"{self.SHEET_NAME_INV}!F{row}:G{row}"
            body = {"values": [[new_warehouse, new_row]]}
            service.spreadsheets().values().update(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=range_update,
                valueInputOption="USER_ENTERED",
                body=body,
            ).execute()

            # Actualizar OBSERVACIONES PRODUCTO (col I) si se provee referral
            range_referral = f"{self.SHEET_NAME_INV}!I{row}"
            body_referral = {"values": [[referral if referral else ""]]}
            service.spreadsheets().values().update(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=range_referral,
                valueInputOption="USER_ENTERED",
                body=body_referral,
            ).execute()

            # Log en Sheets
            item_str = self.get_val(init_data, 0)
            old_warehouse = self.get_val(init_data, 5)
            old_row_val = self.get_val(init_data, 6)
            is_external = old_warehouse in _EXTERNAL_LOCATIONS

            actividad = "Movimiento EXTERIOR del producto" if referral else "Movimiento INTERNO del producto"

            if referral:
                detalle = f"Salida del producto con remision {referral}"
            elif is_external:
                detalle = "Regreso del producto"
            else:
                detalle = "Movimiento entre bodegas de la compañia"

            observaciones = f"El item {item_str} se movio de {old_warehouse}/{old_row_val} a {new_warehouse}/{new_row}"
            self.sheets_logs_sync(item_str, actividad, detalle, observaciones)

            return 200
        except Exception as e:
            logger.exception(f"Error actualizando ubicacion o referral: {e}")
            return 500

    #_________________________________________________________
    #   PATCH | /dispatch/{row}
    #_________________________________________________________

    async def ship_product(
        self, row: int, shipping_date: str, referral_number: str, invoice_number: str, conveyor: str
    ):
        """
        ship_product()
        Wrapper asincrono de ship_product_sync.
            - row:int              | numero de fila del item en INVENTARIO
            - shipping_date:str    | fecha de despacho
            - referral_number:str  | numero de remision/salida
            - invoice_number:str   | numero de factura
            - conveyor:str         | nombre del transportador
        """
        return await run_in_threadpool(
            self.ship_product_sync, row, shipping_date, referral_number, invoice_number, conveyor
        )

    def ship_product_sync(
        self, row: int, shipping_date: str, referral_number: str, invoice_number: str, conveyor: str
    ):
        """
        ship_product_sync()
        Mueve un item de INVENTARIO a DESPACHADO y elimina la fila original.
            - row:int              | numero de fila del item en INVENTARIO
            - shipping_date:str    | fecha de despacho -> col H de DESPACHADO
            - referral_number:str  | remision/salida -> col F de DESPACHADO
            - invoice_number:str   | factura -> col G de DESPACHADO
            - conveyor:str         | transportador -> col I de DESPACHADO
        """
        service = self.get_google_service()

        if not service:
            return 404

        try:
            sheet_api = service.spreadsheets()

            # 1. Leer fila completa de INVENTARIO
            result = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_INV}!A{row}:I{row}",
                )
                .execute()
            )
            inv_rows = result.get("values", [])
            inv_data = inv_rows[0] if inv_rows else []

            # 2. Construir fila para DESPACHADO mapeando columnas coincidentes
            # INVENTARIO: A=ITEM B=PRODUCTO C=TELA D=CLIENTE E=ORDEN H=VALOR_PRODUCTO
            # DESPACHADO: A=ITEM B=PRODUCTO C=TELA D=CLIENTE E=ORDEN F=SALIDA/REMISION
            #             G=FACTURA H=FECHA_DESPACHO I=TRANSPORTADOR J=VALOR_PRODUCTO K=OBS_ENTREGA
            dispatch_row = [
                self.get_val(inv_data, 0), # A: ITEM
                self.get_val(inv_data, 1), # B: PRODUCTO
                self.get_val(inv_data, 2), # C: TELA
                self.get_val(inv_data, 3), # D: CLIENTE
                self.get_val(inv_data, 4), # E: ORDEN
                referral_number,           # F: SALIDA / REMISION
                invoice_number,            # G: FACTURA
                shipping_date,             # H: FECHA DESPACHO
                conveyor,                  # I: TRANSPORTADOR
                self.get_val(inv_data, 7), # J: VALOR PRODUCTO (col H de INVENTARIO)
                "",                        # K: OBSERVACIONES DE ENTREGA
            ]

            sheet_api.values().append(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=f"{self.SHEET_NAME_DISPATCH}!A:K",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [dispatch_row]},
            ).execute()

            # 3. Obtener sheetId de INVENTARIO para eliminar la fila
            spreadsheet = sheet_api.get(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR
            ).execute()
            sheet_id = None
            for s in spreadsheet.get("sheets", []):
                if s["properties"]["title"] == self.SHEET_NAME_INV:
                    sheet_id = s["properties"]["sheetId"]
                    break

            if sheet_id is None:
                logger.error(f"No se encontro la hoja {self.SHEET_NAME_INV} para eliminar fila.")
                return 500

            # 4. Eliminar fila de INVENTARIO (startIndex es 0-based, endIndex exclusivo)
            sheet_api.batchUpdate(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                body={
                    "requests": [
                        {
                            "deleteDimension": {
                                "range": {
                                    "sheetId": sheet_id,
                                    "dimension": "ROWS",
                                    "startIndex": row - 1,
                                    "endIndex": row,
                                }
                            }
                        }
                    ]
                },
            ).execute()

            # Log en Sheets
            item_str = self.get_val(inv_data, 0)
            detalle = f"Se despacho el item {item_str} con remision {referral_number} y el transportador {conveyor}"
            observaciones = (
                f"Se despacho con factura {invoice_number}"
                if invoice_number
                else "No se digito factura al despachar"
            )
            self.sheets_logs_sync(item_str, "Despacho Productos", detalle, observaciones)

            return 200
        except Exception as e:
            logger.exception(f"Error en despacho: {e}")
            return 500

    #_________________________________________________________
    #   POST | /new/{item}
    #_________________________________________________________

    async def new_item(self, item: int, db: AsyncSession | None = None):
        """
        new_item()
        Agrega un item a INVENTARIO consultando allstar_db.
            - item:int | codigo del item a agregar en INVENTARIO
        """
        if db is None:
            logger.error("new_item requiere AsyncSession para consultar allstar_db")
            return 500

        service = self.get_google_service()
        if not service:
            return 404

        try:
            item_payload = await self._get_production_item_from_allstar_db(db, item)
            if not item_payload:
                return 404

            item_code = str(item_payload["item_legado"])
            sheet_api = service.spreadsheets()

            exists_in_inventory = await run_in_threadpool(
                self._sheet_column_contains,
                sheet_api,
                self.SHEET_NAME_INV,
                "A:A",
                item_code,
            )
            if exists_in_inventory:
                return 409

            exists_in_dispatch = await run_in_threadpool(
                self._sheet_column_contains,
                sheet_api,
                self.SHEET_NAME_DISPATCH,
                "A:A",
                item_code,
            )
            if exists_in_dispatch:
                return 409

            producto, tela = _compose_inventory_product(
                item_payload["producto"],
                item_payload["tela"],
                item_payload.get("detalle"),
            )

            new_row = [
                item_code,
                producto,
                tela,
                _clean_sheet_text(item_payload["cliente"]),
                _clean_sheet_text(item_payload["orden_cliente"]),
                "Bodega 1 / Piso 1",
                "1",
                item_payload["valor_producto"],
                "",
            ]

            await run_in_threadpool(
                self._append_inventory_row,
                sheet_api,
                new_row,
            )

            await self._mark_item_delivered_today(
                db,
                item_table=item_payload["item_table"],
                item_legacy_column=item_payload["item_legacy_column"],
                item_delivery_column=item_payload["item_delivery_column"],
                item_code=item_code,
            )

            await self._finalize_order_if_complete(
                db,
                item_table=item_payload["item_table"],
                item_order_column=item_payload["item_order_column"],
                item_delivery_column=item_payload["item_delivery_column"],
                order_table=item_payload["order_table"],
                order_status_column=item_payload["order_status_column"],
                order_pk_column=item_payload["order_pk_column"],
                order_pk_value=item_payload["order_pk_value"],
                order_quantity=item_payload["order_quantity"],
            )

            await self._mark_order_process_5_finished_today(
                db,
                item_table=item_payload["item_table"],
                item_legacy_column=item_payload["item_legacy_column"],
                item_pk_column=item_payload["item_pk_column"],
                item_pk_value=item_payload["item_pk_value"],
                item_code=item_code,
            )

            self.sheets_logs_sync(
                item_code,
                "Ingreso Produccion",
                f"Se ingresa el item {item_code} desde allstar_db",
                "Se finalizo la produccion del item, se reviso el estado y ahora hace parte del inventario",
            )

            logger.info(
                "Item %s ingresado a inventario desde allstar_db; orden=%s proceso=5 sincronizado",
                item_code,
                item_payload.get("orden_cliente"),
            )
            return 200
        except Exception as e:
            logger.exception(f"Error agregando item desde allstar_db: {e}")
            return 500

    def _sheet_column_contains(
        self,
        sheet_api: Any,
        sheet_name: str,
        column_range: str,
        expected_value: str,
    ) -> bool:
        result = (
            sheet_api.values()
            .get(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=f"{sheet_name}!{column_range}",
            )
            .execute()
        )
        for row in result.get("values", []):
            if row and str(row[0]).strip() == expected_value:
                return True
        return False

    def _append_inventory_row(self, sheet_api: Any, new_row: list[Any]) -> None:
        sheet_api.values().append(
            spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
            range=f"{self.SHEET_NAME_INV}!A:I",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": [new_row]},
        ).execute()

    async def _get_production_item_from_allstar_db(
        self,
        db: AsyncSession,
        item: int,
    ) -> dict[str, Any] | None:
        item_table, item_columns = await _find_pg_table(
            db,
            schema_name=DATA_SCHEMA,
            candidates=ITEM_TABLE_CANDIDATES,
        )
        order_table, order_columns = await _find_pg_table(
            db,
            schema_name=DATA_SCHEMA,
            candidates=ORDER_TABLE_CANDIDATES,
        )
        if not item_table or not order_table:
            return None

        item_legacy_column = _choose_column(item_columns, ITEM_LEGACY_COLUMN_CANDIDATES)
        item_pk_column = _choose_column(item_columns, ITEM_PK_COLUMN_CANDIDATES) or item_legacy_column
        item_order_column = _choose_column(item_columns, ITEM_ORDER_COLUMN_CANDIDATES)
        item_delivery_column = _choose_column(item_columns, ("fecha_entrega",))
        item_fabric_column = _choose_column(item_columns, ITEM_FABRIC_NAME_COLUMN_CANDIDATES)
        item_fabric_reference_column = _choose_column(
            item_columns,
            ITEM_FABRIC_REFERENCE_COLUMN_CANDIDATES,
        )
        if not item_fabric_column:
            item_fabric_column = _choose_column(item_columns, ITEM_FABRIC_COLUMN_CANDIDATES)
        order_status_column = _choose_column(order_columns, ORDER_STATUS_COLUMN_CANDIDATES)
        order_client_order_column = _choose_column(
            order_columns,
            ORDER_CLIENT_ORDER_COLUMN_CANDIDATES,
        )
        order_client_column = _choose_column(order_columns, ORDER_CLIENT_COLUMN_CANDIDATES)
        order_product_column = _choose_column(order_columns, ORDER_PRODUCT_COLUMN_CANDIDATES)
        order_quantity_column = _choose_column(order_columns, ORDER_QUANTITY_COLUMN_CANDIDATES)
        order_detail_column = _choose_column(order_columns, ORDER_DETAIL_COLUMN_CANDIDATES)
        if not (
            item_legacy_column
            and item_pk_column
            and item_order_column
            and item_delivery_column
            and order_product_column
        ):
            return None

        item_fks = await _get_pg_foreign_keys(
            db,
            schema_name=DATA_SCHEMA,
            table_name=item_table,
        )
        item_order_fk = item_fks.get(item_order_column.lower())
        order_pk_column = (
            item_order_fk["referenced_column"]
            if item_order_fk and item_order_fk["referenced_table"] == order_table
            else _choose_column(
                order_columns,
                ("id", "id_orden_compra", "ordencompra_id", "orden_compra_id", "oc"),
            )
        )
        if not order_pk_column:
            return None

        join_clauses: list[str] = []
        select_expressions: list[str] = [
            f"i.{_quote_identifier(item_legacy_column)}::text AS item_legado",
            f"i.{_quote_identifier(item_pk_column)} AS item_pk_value",
            f"o.{_quote_identifier(order_pk_column)} AS order_pk_value",
        ]
        if order_status_column:
            select_expressions.append(
                f"o.{_quote_identifier(order_status_column)}::text AS order_status"
            )
        else:
            select_expressions.append("NULL::text AS order_status")

        if order_client_order_column:
            select_expressions.append(
                f"o.{_quote_identifier(order_client_order_column)}::text AS orden_cliente"
            )
        else:
            select_expressions.append(
                f"o.{_quote_identifier(order_pk_column)}::text AS orden_cliente"
            )

        if order_quantity_column:
            select_expressions.append(
                f"o.{_quote_identifier(order_quantity_column)}::text AS order_quantity"
            )
        else:
            select_expressions.append("NULL::text AS order_quantity")

        if order_detail_column:
            select_expressions.append(
                f"o.{_quote_identifier(order_detail_column)}::text AS detalle"
            )
        else:
            select_expressions.append("NULL::text AS detalle")

        client_joins, client_expr = await _resolve_lookup_expression(
            db,
            source_alias="o",
            source_column=order_client_column,
            source_table=order_table,
            fallback_tables=CLIENT_TABLE_CANDIDATES,
            fallback_key_candidates=("id", "id_cliente", "cliente_id", "codigo", "codigo_cliente"),
            label_candidates=LOOKUP_LABEL_COLUMN_CANDIDATES,
            join_alias="client_ref",
        )
        join_clauses.extend(client_joins)
        select_expressions.append(
            f"{client_expr or 'NULL::text'} AS cliente"
        )

        product_joins, product_expr = await _resolve_lookup_expression(
            db,
            source_alias="o",
            source_column=order_product_column,
            source_table=order_table,
            fallback_tables=PRODUCT_TABLE_CANDIDATES,
            fallback_key_candidates=("id", "id_producto", "producto_id", "codigo", "codigo_producto", "sku"),
            label_candidates=PRODUCT_NAME_COLUMN_CANDIDATES,
            join_alias="product_ref",
        )
        join_clauses.extend(product_joins)
        select_expressions.append(f"{product_expr or 'o.' + _quote_identifier(order_product_column) + '::text'} AS producto")

        product_cost_expr = "NULL::text"
        product_fabric_expr = None
        product_table_name = None
        product_ref_alias = "product_ref"
        if product_joins:
            order_fks = await _get_pg_foreign_keys(
                db,
                schema_name=DATA_SCHEMA,
                table_name=order_table,
            )
            product_fk = order_fks.get(order_product_column.lower())
            product_table_name = product_fk["referenced_table"] if product_fk else None
        if product_table_name:
            product_columns = await _get_pg_table_columns(
                db,
                schema_name=DATA_SCHEMA,
                table_name=product_table_name,
            )
            product_cost_column = _choose_column(product_columns, PRODUCT_COST_COLUMN_CANDIDATES)
            if product_cost_column:
                product_cost_expr = f"{product_ref_alias}.{_quote_identifier(product_cost_column)}::text"
            product_fabric_column = _choose_column(product_columns, ITEM_FABRIC_NAME_COLUMN_CANDIDATES)
            if product_fabric_column:
                product_fabric_joins, product_fabric_expr = await _resolve_tela_lookup_expression(
                    db,
                    source_alias=product_ref_alias,
                    source_column=product_fabric_column,
                    source_table=product_table_name,
                    join_alias="product_fabric_ref",
                )
                join_clauses.extend(product_fabric_joins)
        select_expressions.append(f"{product_cost_expr} AS valor_producto")

        fabric_joins, fabric_expr = await _resolve_tela_lookup_expression(
            db,
            source_alias="i",
            source_column=item_fabric_column,
            source_table=item_table,
            join_alias="fabric_ref",
        )
        join_clauses.extend(fabric_joins)

        fabric_reference_expr = None
        if (
            item_fabric_reference_column
            and item_fabric_reference_column != item_fabric_column
            and not fabric_expr
        ):
            fabric_reference_joins, fabric_reference_expr = await _resolve_lookup_expression(
                db,
                source_alias="i",
                source_column=item_fabric_reference_column,
                source_table=item_table,
                fallback_tables=FABRIC_REFERENCE_TABLE_CANDIDATES,
                fallback_key_candidates=(
                    "id",
                    "id_referencia_tela",
                    "referencia_tela_id",
                    "id_referenciatela",
                    "codigo",
                    "codigo_referencia_tela",
                ),
                label_candidates=("referencia", "referencia_tela", "nombre", "descripcion", "codigo"),
                join_alias="fabric_reference_ref",
            )
            join_clauses.extend(fabric_reference_joins)

        fabric_parts = []
        if product_fabric_expr:
            fabric_parts.append(f"NULLIF(TRIM(({product_fabric_expr})::text), '')")
        elif fabric_expr:
            fabric_parts.append(f"NULLIF(TRIM(({fabric_expr})::text), '')")
        if fabric_reference_expr:
            fabric_parts.append(f"NULLIF(TRIM(({fabric_reference_expr})::text), '')")

        if len(fabric_parts) > 1:
            select_expressions.append(f"CONCAT_WS(' ', {', '.join(fabric_parts)}) AS tela")
        elif fabric_parts:
            select_expressions.append(f"COALESCE({fabric_parts[0]}, '') AS tela")
        else:
            select_expressions.append("NULL::text AS tela")

        query = text(
            f"""
            SELECT {", ".join(select_expressions)}
            FROM {_quote_identifier(DATA_SCHEMA)}.{_quote_identifier(item_table)} i
            JOIN {_quote_identifier(DATA_SCHEMA)}.{_quote_identifier(order_table)} o
              ON TRIM(i.{_quote_identifier(item_order_column)}::text) = TRIM(o.{_quote_identifier(order_pk_column)}::text)
            {" ".join(join_clauses)}
            WHERE TRIM(i.{_quote_identifier(item_legacy_column)}::text) = :item
            LIMIT 1
            """
        )
        result = await db.execute(query, {"item": str(item)})
        row = result.mappings().first()
        if not row:
            return None

        return {
            "item_legado": row["item_legado"],
            "producto": row["producto"] or "",
            "tela": row["tela"] or "",
            "cliente": row["cliente"] or "",
            "orden_cliente": row["orden_cliente"] or "",
            "detalle": row["detalle"] or "",
            "valor_producto": row["valor_producto"] or "",
            "order_quantity": row["order_quantity"],
            "item_table": item_table,
            "item_legacy_column": item_legacy_column,
            "item_pk_column": item_pk_column,
            "item_pk_value": row["item_pk_value"],
            "item_order_column": item_order_column,
            "item_delivery_column": item_delivery_column,
            "order_table": order_table,
            "order_status_column": order_status_column,
            "order_pk_column": order_pk_column,
            "order_pk_value": row["order_pk_value"],
        }

    async def _mark_item_delivered_today(
        self,
        db: AsyncSession,
        *,
        item_table: str,
        item_legacy_column: str,
        item_delivery_column: str,
        item_code: str,
    ) -> None:
        await db.execute(
            text(
                f"""
                UPDATE {_quote_identifier(DATA_SCHEMA)}.{_quote_identifier(item_table)}
                SET {_quote_identifier(item_delivery_column)} = CURRENT_DATE
                WHERE TRIM({_quote_identifier(item_legacy_column)}::text) = TRIM(:item_code)
                """
            ),
            {"item_code": item_code},
        )
        await db.commit()

    async def _mark_order_process_5_finished_today(
        self,
        db: AsyncSession,
        *,
        item_table: str,
        item_legacy_column: str,
        item_pk_column: str,
        item_pk_value: Any,
        item_code: str,
    ) -> None:
        process_table, process_columns = await _find_pg_table(
            db,
            schema_name=DATA_SCHEMA,
            candidates=ORDER_PROCESS_TABLE_CANDIDATES,
        )
        if not process_table:
            logger.warning("No se encontro tabla ordenproceso para sincronizar item %s", item_code)
            return

        process_item_column = _choose_column(
            process_columns,
            ORDER_PROCESS_ITEM_COLUMN_CANDIDATES,
        )
        process_process_column = _choose_column(
            process_columns,
            ORDER_PROCESS_PROCESS_COLUMN_CANDIDATES,
        )
        process_start_column = _choose_column(
            process_columns,
            ORDER_PROCESS_START_COLUMN_CANDIDATES,
        )
        process_finish_column = _choose_column(
            process_columns,
            ORDER_PROCESS_FINISH_COLUMN_CANDIDATES,
        )
        process_id_column = _choose_column(
            process_columns,
            ORDER_PROCESS_ID_COLUMN_CANDIDATES,
        )
        if not (process_item_column and process_process_column and process_start_column and process_finish_column):
            logger.warning(
                "ordenproceso no tiene columnas requeridas para sincronizar item %s",
                item_code,
            )
            return

        resolved_item_value = item_pk_value
        if resolved_item_value is None:
            item_result = await db.execute(
                text(
                    f"""
                    SELECT {_quote_identifier(item_pk_column)} AS item_value
                    FROM {_quote_identifier(DATA_SCHEMA)}.{_quote_identifier(item_table)}
                    WHERE TRIM({_quote_identifier(item_legacy_column)}::text) = TRIM(:item_code)
                    LIMIT 1
                    """
                ),
                {"item_code": item_code},
            )
            resolved_item_value = item_result.scalar_one_or_none()

        if resolved_item_value is None:
            logger.warning("No se encontro id interno para sincronizar proceso 5 del item %s", item_code)
            return

        selected_process_id = (
            f"{_quote_identifier(process_id_column)} AS process_row_id,"
            if process_id_column
            else "NULL::text AS process_row_id,"
        )
        existing_result = await db.execute(
            text(
                f"""
                SELECT
                    {selected_process_id}
                    {_quote_identifier(process_start_column)} AS fecha_inicio,
                    {_quote_identifier(process_finish_column)} AS fecha_finalizado
                FROM {_quote_identifier(DATA_SCHEMA)}.{_quote_identifier(process_table)}
                WHERE TRIM({_quote_identifier(process_item_column)}::text) = TRIM(CAST(:item_value AS text))
                  AND TRIM({_quote_identifier(process_process_column)}::text) = '5'
                ORDER BY
                    CASE WHEN {_quote_identifier(process_finish_column)} IS NULL THEN 0 ELSE 1 END,
                    {_quote_identifier(process_start_column)} DESC NULLS LAST
                LIMIT 1
                """
            ),
            {"item_value": str(resolved_item_value)},
        )
        existing_row = existing_result.mappings().first()

        if existing_row:
            where_clause = (
                f"{_quote_identifier(process_id_column)} = :process_row_id"
                if process_id_column and existing_row.get("process_row_id") is not None
                else (
                    f"TRIM({_quote_identifier(process_item_column)}::text) = TRIM(CAST(:item_value AS text)) "
                    f"AND TRIM({_quote_identifier(process_process_column)}::text) = '5'"
                )
            )
            params = {
                "item_value": str(resolved_item_value),
                "process_row_id": existing_row.get("process_row_id"),
            }
            await db.execute(
                text(
                    f"""
                    UPDATE {_quote_identifier(DATA_SCHEMA)}.{_quote_identifier(process_table)}
                    SET {_quote_identifier(process_start_column)} = COALESCE({_quote_identifier(process_start_column)}, CURRENT_DATE),
                        {_quote_identifier(process_finish_column)} = COALESCE({_quote_identifier(process_finish_column)}, CURRENT_DATE)
                    WHERE {where_clause}
                    """
                ),
                params,
            )
            await db.commit()
            logger.info("Proceso 5 actualizado para item %s", item_code)
            return

        await db.execute(
            text(
                f"""
                INSERT INTO {_quote_identifier(DATA_SCHEMA)}.{_quote_identifier(process_table)}
                    ({_quote_identifier(process_item_column)},
                     {_quote_identifier(process_process_column)},
                     {_quote_identifier(process_start_column)},
                     {_quote_identifier(process_finish_column)})
                VALUES (:item_value, 5, CURRENT_DATE, CURRENT_DATE)
                """
            ),
            {"item_value": resolved_item_value},
        )
        await db.commit()
        logger.info("Proceso 5 creado y finalizado para item %s", item_code)

    async def _finalize_order_if_complete(
        self,
        db: AsyncSession,
        *,
        item_table: str,
        item_order_column: str,
        item_delivery_column: str,
        order_table: str,
        order_status_column: str | None,
        order_pk_column: str,
        order_pk_value: Any,
        order_quantity: Any,
    ) -> None:
        if not order_status_column:
            return
        try:
            expected_quantity = int(float(str(order_quantity).replace(",", ".").strip()))
        except Exception:
            return
        if expected_quantity <= 0:
            return

        delivered_items_result = await db.execute(
            text(
                f"""
                SELECT COUNT(*)::integer AS delivered_quantity
                FROM {_quote_identifier(DATA_SCHEMA)}.{_quote_identifier(item_table)}
                WHERE TRIM({_quote_identifier(item_order_column)}::text) =
                      TRIM(CAST(:order_pk_value AS text))
                  AND {_quote_identifier(item_delivery_column)} IS NOT NULL
                """
            ),
            {"order_pk_value": str(order_pk_value)},
        )
        delivered_quantity = delivered_items_result.scalar_one() or 0
        if delivered_quantity < expected_quantity:
            return

        await db.execute(
            text(
                f"""
                UPDATE {_quote_identifier(DATA_SCHEMA)}.{_quote_identifier(order_table)}
                SET {_quote_identifier(order_status_column)} = :status
                WHERE {_quote_identifier(order_pk_column)} = :order_pk_value
                """
            ),
            {"status": "finalizado", "order_pk_value": order_pk_value},
        )
        await db.commit()

    def new_item_sync(self, item: int):
        """
        new_item_sync()
        Agrega un nuevo item a la hoja INVENTARIO consultando su informacion desde SQL Server.
            - item:int | codigo del item a agregar (CodItem en SQL Server)
        Retorna 404 si el item no existe en SQL Server, 409 si ya esta en INVENTARIO.
        """
        service = self.get_google_service()

        if not service:
            return 404

        try:
            # 1. Consultar SQL Server para obtener info del producto
            query = """
            SELECT TOP 1
                Item.CodItem,
                Clientes.Cliente,
                Tela.Tela,
                ReferenciaTela.Referencia,
                Item.CodOCCliente,
                Producto.Producto + ' ' + Referencia.Referencia + ' ' + Modelo.Modelo AS [REFERENCIA COMPLETA]
            FROM Item
            INNER JOIN Producto ON Item.CodProducto = Producto.CodProducto
            INNER JOIN Referencia ON Item.CodReferencia = Referencia.CodReferencia
            INNER JOIN Clientes ON Item.CodCliente = Clientes.CodCliente
            INNER JOIN Modelo ON Item.CodModelo = Modelo.CodModelo
            INNER JOIN ReferenciaTela ON Item.CodReferenciaTela = ReferenciaTela.CodReferenciaTela
            INNER JOIN Tela ON Tela.CodTela = Item.CodTela
            WHERE Item.CodItem = ?
            """
            conn = self.get_sql_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(query, (item,))
                sql_row = cursor.fetchone()
            finally:
                conn.close()

            if not sql_row:
                return 404  # Item no existe en SQL Server

            producto = getattr(sql_row, "REFERENCIA COMPLETA", "") or ""
            tela = sql_row.Tela if sql_row.Tela else ""
            referenciatela = sql_row.Referencia if sql_row.Referencia else ""
            cliente = sql_row.Cliente if sql_row.Cliente else ""
            orden = sql_row.CodOCCliente if sql_row.CodOCCliente else "DISPONIBLE"

            tela_completa = f"{tela} {referenciatela}".strip()

            # 2. Verificar si el item YA existe en INVENTARIO
            sheet_api = service.spreadsheets()
            result_inv = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_INV}!A:A",
                )
                .execute()
            )
            existing_values_inv = result_inv.get("values", [])

            for row in existing_values_inv:
                if row and str(row[0]) == str(item):
                    return 409  # Ya existe en INVENTARIO

            # Verificar si el item YA existe en DESPACHADO
            result_dispatch = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_DISPATCH}!A:A",
                )
                .execute()
            )
            existing_values_dispatch = result_dispatch.get("values", [])

            for row in existing_values_dispatch:
                if row and str(row[0]) == str(item):
                    return 409  # Ya existe en DESPACHADO

            # 3. Construir y escribir la nueva fila completa en INVENTARIO
            # A=ITEM B=PRODUCTO C=TELA D=CLIENTE E=ORDEN F=UBICACION G=FILA H=VALOR I=OBS
            new_row = [
                str(item),           # A: ITEM
                producto,            # B: PRODUCTO
                tela_completa,       # C: TELA
                cliente,             # D: CLIENTE
                orden,               # E: ORDEN
                "Bodega 1 / Piso 1", # F: UBICACION
                "1",                 # G: FILA
                "",                  # H: VALOR PRODUCTO
                "",                  # I: OBSERVACIONES PRODUCTO
            ]

            sheet_api.values().append(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=f"{self.SHEET_NAME_INV}!A:I",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [new_row]},
            ).execute()

            # Log en Sheets
            self.sheets_logs_sync(
                str(item),
                "Ingreso Produccion",
                f"Se ingresa el item {item} desde la base de datos",
                "Se finalizo la produccion del item, se reviso el estado y ahora hace parte del inventario",
            )

            return 200
        except Exception as e:
            logger.exception(f"Error agregando item: {e}")
            return 500

    #_________________________________________________________
    #   GET | /return_product/get/{item}
    #_________________________________________________________

    async def get_return_item(self, item: str):
        """
        get_return_item()
        Wrapper asincrono de get_return_item_sync.
            - item:str | valor a buscar en col A de DEVOLUCIONES
        """
        return await run_in_threadpool(self.get_return_item_sync, item)

    def get_return_item_sync(self, item: str):
        """
        get_return_item_sync()
        Busca un item en col A de DEVOLUCIONES y retorna sus datos basicos.
            - item:str | valor a buscar en col A
        Retorna dict con item, product, fabric, client o None si no se encuentra.
        """
        service = self.get_google_service()
        if not service:
            return None

        try:
            sheet_api = service.spreadsheets()
            result = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_RETURNS}!A:D",
                )
                .execute()
            )
            rows = result.get("values", [])
            for row in rows:
                col_a = str(row[0]) if row else ""
                if row and col_a == item:
                    return {
                        "item": row[0],
                        "product": row[1] if len(row) > 1 else "",
                        "fabric": row[2] if len(row) > 2 else "",
                        "client": row[3] if len(row) > 3 else "",
                    }
            logger.warning(f"[get_return_item] '{item}' no encontrado en {len(rows)} filas de DEVOLUCIONES col A.")
            return None
        except Exception as e:
            logger.exception(f"[get_return_item] Error leyendo DEVOLUCIONES: {e}")
            return None

    #_________________________________________________________
    #   GET | /return_product/get_unknows
    #_________________________________________________________

    async def get_unknown_returns(self):
        """
        get_unknown_returns()
        Wrapper asincrono de get_unknown_returns_sync.
        Retorna lista de items en DEVOLUCIONES con Estado 'Por revisar y asignar item'.
        """
        return await run_in_threadpool(self.get_unknown_returns_sync)

    def get_unknown_returns_sync(self):
        """
        get_unknown_returns_sync()
        Retorna una lista de items (col A) de la hoja DEVOLUCIONES
        cuyo Estado (col N) sea exactamente 'Por revisar y asignar item'.
        """
        service = self.get_google_service()
        if not service:
            return None

        try:
            sheet_api = service.spreadsheets()
            result = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_RETURNS}!A:N",
                )
                .execute()
            )
            rows = result.get("values", [])
            unknown_items = []
            for row in rows:
                item_val = row[0] if len(row) > 0 else ""
                estado = row[13] if len(row) > 13 else ""
                if estado == "Por revisar y asignar item" and item_val:
                    unknown_items.append({
                        "item": item_val,
                        "product": row[1] if len(row) > 1 else "",
                        "fabric": row[2] if len(row) > 2 else "",
                        "client": row[3] if len(row) > 3 else "",
                    })
            logger.info(f"[get_unknown_returns] {len(unknown_items)} items 'Por revisar y asignar item'.")
            return unknown_items
        except Exception as e:
            logger.exception(f"[get_unknown_returns] Error leyendo DEVOLUCIONES: {e}")
            return None

    #_________________________________________________________
    #   POST | /return_product/{item}
    #_________________________________________________________

    async def return_product(self, item: str, new_item: str):
        """
        return_product()
        Wrapper asincrono de return_product_sync.
            - item:str     | item original a buscar en col A de DEVOLUCIONES
            - new_item:str | item que se usara en INVENTARIO
        """
        return await run_in_threadpool(self.return_product_sync, item, new_item)

    def return_product_sync(self, item: str, new_item: str):
        """
        return_product_sync()
        Procesa la devolucion de un item: mueve su informacion de DEVOLUCIONES a INVENTARIO.
            - item:str     | item original a buscar en col A de DEVOLUCIONES
            - new_item:str | item que se usara en INVENTARIO (igual a item si es numerico,
                             distinto si el item original empieza con 'DESCONOCIDO')
        Caso DESCONOCIDO: sobreescribe col A y pone Estado='Reintegrado Item nuevo'.
        Caso numerico: solo pone Estado='Reintegrado'.
        """
        service = self.get_google_service()
        if not service:
            return 404

        try:
            sheet_api = service.spreadsheets()
            is_unknown = item.upper().startswith("DESCONOCIDO")

            # 1. Buscar el item en col A de DEVOLUCIONES
            result_dev = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_RETURNS}!A:A",
                )
                .execute()
            )
            dev_col_a = result_dev.get("values", [])

            dev_row_index = -1
            for i, row in enumerate(dev_col_a):
                if row and str(row[0]) == item:
                    dev_row_index = i
                    break

            if dev_row_index == -1:
                return 404  # Item no encontrado en DEVOLUCIONES

            dev_excel_row = dev_row_index + 1

            # 2. Leer fila completa de DEVOLUCIONES
            result_full = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_RETURNS}!A{dev_excel_row}:N{dev_excel_row}",
                )
                .execute()
            )
            dev_rows = result_full.get("values", [])
            dev_data = dev_rows[0] if dev_rows else []

            # DEVOLUCIONES: 
            #               A=ITEM(0) B=PRODUCTO(1) C=TELA(2) D=CLIENTE(3) E=ORDEN(4)
            #               F=SALIDA/REMISION(5) G=FACTURA(6) H=FECHA DE DESPACHO(7)
            #               I=VALOR PRODUCTO(8) J=BODEGA(9) K=FILA(10) L=FECHA DEVOLUCION(11)
            #               M=OBSERVACIONES PRODUCTO(12) N=Estado(13) O=Nota Credito(14)

            # 3. Verificar si el item ya existe en INVENTARIO (evitar duplicados)
            result_inv_check = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_INV}!A:A",
                )
                .execute()
            )
            for existing_row in result_inv_check.get("values", []):
                if existing_row and str(existing_row[0]) == str(new_item):
                    return 409  # Ya existe en INVENTARIO

            # 4. Construir fila para INVENTARIO
            # A=ITEM B=PRODUCTO C=TELA D=CLIENTE E=ORDEN F=UBICACION G=FILA H=VALOR I=OBS
            inv_row = [
                new_item,                     # A: ITEM (new_item en lugar del DESCONOCIDO si aplica)
                self.get_val(dev_data, 1),    # B: PRODUCTO
                self.get_val(dev_data, 2),    # C: TELA
                self.get_val(dev_data, 3),    # D: CLIENTE
                self.get_val(dev_data, 4),    # E: ORDEN
                self.get_val(dev_data, 9),    # F: UBICACION (BODEGA de DEVOLUCIONES col I)
                self.get_val(dev_data, 10),    # G: FILA (col J de DEVOLUCIONES)
                self.get_val(dev_data, 8),    # H: VALOR PRODUCTO (col F de DEVOLUCIONES)
            ]

            sheet_api.values().append(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=f"{self.SHEET_NAME_INV}!A:I",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [inv_row]},
            ).execute()

            # 5. Actualizar DEVOLUCIONES segun el caso
            if is_unknown:
                # Sobreescribir col A con new_item y col N con "Reintegrado Item nuevo"
                sheet_api.values().batchUpdate(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    body={
                        "valueInputOption": "USER_ENTERED",
                        "data": [
                            {
                                "range": f"{self.SHEET_NAME_RETURNS}!A{dev_excel_row}",
                                "values": [[new_item]],
                            },
                            {
                                "range": f"{self.SHEET_NAME_RETURNS}!N{dev_excel_row}",
                                "values": [["Reintegrado Item nuevo"]],
                            },
                        ],
                    },
                ).execute()
            else:
                # Solo actualizar col N con "Reintegrado"
                sheet_api.values().update(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_RETURNS}!N{dev_excel_row}",
                    valueInputOption="USER_ENTERED",
                    body={"values": [["Reintegrado"]]},
                ).execute()

            # Log en Sheets
            if is_unknown:
                actividad = "Reintegro de un item no identificado"
                detalle = f"Al item {item} se le asigno el nuevo item {new_item}"
            else:
                actividad = "Reintegro de un item identificado a inventario"
                detalle = f"El item {item} se reintegro a inventario"
            self.sheets_logs_sync(
                item,
                actividad,
                detalle,
                "Se reviso el correcto estado y el item se reintegro al inventario",
            )

            return 200
        except Exception as e:
            logger.exception(f"Error procesando devolucion: {e}")
            return 500

    #_________________________________________________________
    #   SCHEDULE
    #_________________________________________________________

    async def compare_coditems(self):
        """
        compare_coditems()
        Wrapper asincrono de compare_coditems_sync.
        Ejecuta la sincronizacion de items entre SQL Server y la hoja PRUEBA ACCESS.
        """
        return await run_in_threadpool(self.compare_coditems_sync)

    def compare_coditems_sync(self):
        """
        compare_coditems_sync()
        Sincroniza items activos de SQL Server (ultimos 2 meses) contra la hoja PRUEBA ACCESS.
        Inserta items nuevos al final e actualiza los existentes con batchUpdate.
        Retorna 200 si la sincronizacion fue exitosa, 500 si ocurrio un error.
        """
        try:
            # 1. Traer items activos de SQL (últimos 3 meses)
            query = """
            SELECT
                Item.CodItem, Item.FechaPedido, Item.FechaEntrega, Item.CodOCCliente,
                Item.CodProductoCliente, Clientes.Cliente, Producto.Producto,
                Referencia.Referencia, Modelo.Modelo, Tela.Tela,
                ReferenciaTela.Referencia AS ReferenciaTela, Item.LugarEntrega,
                Item.ValorUnidad,
                Producto.Producto + ' ' + Referencia.Referencia + ' ' + Modelo.Modelo AS [REFERENCIA COMPLETA],
                (Item.Cantidad * Item.ValorUnidad) AS VALOR,
                DATEDIFF(DAY, Item.FechaPedido, GETDATE()) AS [Edad de Producto]
            FROM Item
            INNER JOIN Producto ON Item.CodProducto = Producto.CodProducto
            INNER JOIN Referencia ON Item.CodReferencia = Referencia.CodReferencia
            INNER JOIN Clientes ON Item.CodCliente = Clientes.CodCliente
            INNER JOIN Modelo ON Item.CodModelo = Modelo.CodModelo
            INNER JOIN ReferenciaTela ON Item.CodReferenciaTela = ReferenciaTela.CodReferenciaTela
            INNER JOIN Tela ON Tela.CodTela = Item.CodTela
            WHERE Item.FechaPedido >= DATEADD(MONTH, -2, GETDATE())
            ORDER BY Item.CodItem ASC
            """
            conn = self.get_sql_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(query)
                rows = cursor.fetchall()
            finally:
                conn.close()

            total_sql = len(rows)
            logger.info(
                f"[SYNC] Items encontrados en SQL Server (ultimos 3 meses): {total_sql}"
            )

            if not rows:
                logger.info("[SYNC] No hay items para sincronizar.")
                return 200

            service = self.get_google_service()
            if not service:
                logger.error(
                    "[SYNC] Error: No se pudo obtener el servicio de Google Sheets."
                )
                return 500

            sheet_api = service.spreadsheets()

            # 2. Leer columna A de Sheets y construir diccionario {CodItem: numero_fila}
            result_sheets = (
                sheet_api.values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_ACCES}!A:A",
                )
                .execute()
            )
            sheets_col_a = result_sheets.get("values", [])

            # Fila 1 es header, datos empiezan en fila 2 (índice 1 en la lista)
            coditem_to_row = {}
            for i, row in enumerate(sheets_col_a[1:], start=2):
                if row and row[0]:
                    raw = "".join(filter(str.isdigit, str(row[0]).strip()))
                    if raw:
                        coditem_to_row[int(raw)] = i

            logger.info(f"[SYNC] Items actualmente en Sheets: {len(coditem_to_row)}")

            # 3. Clasificar items de SQL en nuevos o a actualizar
            nuevos = []
            a_actualizar = []  # lista de (sheet_row, row_data)

            for row in rows:
                if row.CodItem not in coditem_to_row:
                    nuevos.append(row)
                else:
                    a_actualizar.append((coditem_to_row[row.CodItem], row))

            logger.info(f"[SYNC] Items nuevos a insertar: {len(nuevos)}")
            logger.info(f"[SYNC] Items existentes a actualizar: {len(a_actualizar)}")

            def build_row_values(row):
                return [
                    row.CodItem,
                    str(row.FechaPedido) if row.FechaPedido else "",
                    str(row.FechaEntrega) if row.FechaEntrega else "",
                    row.CodOCCliente if row.CodOCCliente else "",
                    row.CodProductoCliente if row.CodProductoCliente else "",
                    row.Cliente if row.Cliente else "",
                    row.Producto if row.Producto else "",
                    row.Referencia if row.Referencia else "",
                    row.Modelo if row.Modelo else "",
                    row.Tela if row.Tela else "",
                    row.ReferenciaTela if row.ReferenciaTela else "",
                    row.LugarEntrega if row.LugarEntrega else "",
                    float(row.ValorUnidad) if row.ValorUnidad else 0,
                    getattr(row, "REFERENCIA COMPLETA", "") or "",
                    float(getattr(row, "VALOR", 0)) if getattr(row, "VALOR", 0) else 0,
                    getattr(row, "Edad de Producto", "") or "",
                ]

            # 4. Actualizar items existentes con batchUpdate
            if a_actualizar:
                batch_data = []
                for sheet_row, row in a_actualizar:
                    batch_data.append(
                        {
                            "range": f"{self.SHEET_NAME_ACCES}!A{sheet_row}:P{sheet_row}",
                            "values": [build_row_values(row)],
                        }
                    )

                sheet_api.values().batchUpdate(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    body={"valueInputOption": "USER_ENTERED", "data": batch_data},
                ).execute()
                logger.info(
                    f"[SYNC] {len(a_actualizar)} items actualizados correctamente."
                )
            else:
                logger.info("[SYNC] No hubo items que actualizar.")

            # 5. Insertar items nuevos al final
            if nuevos:
                next_row = len(sheets_col_a) + 1
                values_to_insert = [build_row_values(row) for row in nuevos]

                sheet_api.values().update(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_ACCES}!A{next_row}",
                    valueInputOption="USER_ENTERED",
                    body={"values": values_to_insert},
                ).execute()
                logger.info(
                    f"[SYNC] {len(nuevos)} items nuevos insertados correctamente."
                )
            else:
                logger.info("[SYNC] No hubo items nuevos para insertar.")

            logger.info("[SYNC] Sincronizacion finalizada exitosamente.")
            return 200

        except Exception as e:
            logger.exception(f"[SYNC] Error en sincronizacion: {e}")
            return 500


def get_sheets_service() -> SheetsService:
    return SheetsService()
