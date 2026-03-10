import os
import pyodbc
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from fastapi.concurrency import run_in_threadpool
from typing import List, Tuple, Optional, Any
import json


from src.core.config import settings
from src.core.logging_config import get_logger

logger = get_logger(__name__)


class SheetsService:
    def __init__(self):
        self.scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        self._service = None
        self.GOOGLE_SHEETS_CREDENTIALS_PATH: str = (
            "core/Sheets.json"  # Valor por defecto
        )
        self.SHEET_NAME_INV: str = "Inv. All Star"
        self.SHEET_NAME_OPT: str = "Complementos"
        self.SHEET_NAME_ACCES: str = "PRUEBA ACCESS"

    def get_sql_connection(self):
        """Retorna una conexión síncrona a SQL Server usando el connection string de settings."""
        return pyodbc.connect(settings.SQLSERVER_URL_DATABASE)

    def get_google_service(self):
        if self._service:
            return self._service

        try:
            if not settings.GOOGLE_CREDENTIALS_JSON:
                logger.error("No hay credenciales configuradas")
                return None

            creds_dict = json.loads(settings.GOOGLE_CREDENTIALS_JSON)

            creds = service_account.Credentials.from_service_account_info(
                creds_dict, scopes=self.scopes
            )

            self._service = build("sheets", "v4", credentials=creds)
            return self._service

        except Exception as e:
            logger.exception(f"Error construyendo servicio Google: {e}")
            return None

    def get_val(self, row_data, idx):
        return row_data[idx] if idx < len(row_data) else ""

    async def get_item(self, item: int, opt_request: bool = True):
        return await run_in_threadpool(self.get_item_sync, item, opt_request)

    def get_item_sync(self, item: int, opt_request: bool):
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
            prod = self.get_val(row_data, 1)
            tela = self.get_val(row_data, 2)
            bodega = self.get_val(row_data, 7)
            fila = self.get_val(row_data, 8)

            if opt_request:
                ranges_opts = [
                    f"{self.SHEET_NAME_OPT}!A2:A",
                    f"{self.SHEET_NAME_OPT}!C2:C",
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

                return excel_row, prod, tela, bodega, fila, opt_warehouse, opt_row

            return excel_row, prod, tela, bodega, fila
        except HttpError as err:
            logger.exception(f"Ocurrio un error HTTP: {err}")
            return None

    async def update_location(
        self, row: int, new_warehouse: str, new_row: str, referral: Optional[str] = None
    ):
        return await run_in_threadpool(
            self.update_location_sync, row, new_warehouse, new_row, referral
        )

    def update_location_sync(
        self, row: int, new_warehouse: str, new_row: str, referral: Optional[str] = None
    ):
        service = self.get_google_service()

        if not service:
            return 404

        try:
            # Update warehouse and row (H:I)
            range_update = f"{self.SHEET_NAME_INV}!H{row}:I{row}"
            body = {"values": [[new_warehouse, new_row]]}
            service.spreadsheets().values().update(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=range_update,
                valueInputOption="USER_ENTERED",
                body=body,
            ).execute()

            # Update referral if provided (Column M)
            if referral:
                range_referral = f"{self.SHEET_NAME_INV}!M{row}"
                body_referral = {"values": [[referral]]}
                service.spreadsheets().values().update(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=range_referral,
                    valueInputOption="USER_ENTERED",
                    body=body_referral,
                ).execute()

            return 200
        except Exception as e:
            logger.exception(f"Error actualizando ubicacion o referral: {e}")
            return 500

    async def ship_product(
        self, row: int, shipping_date: str, referral_number: str, invoice_number: str
    ):
        return await run_in_threadpool(
            self.ship_product_sync, row, shipping_date, referral_number, invoice_number
        )

    def ship_product_sync(
        self, row: int, shipping_date: str, referral_number: str, invoice_number: str
    ):
        service = self.get_google_service()

        if not service:
            return 404

        try:
            range_update = f"{self.SHEET_NAME_INV}!M{row}:O{row}"
            body = {"values": [[referral_number, invoice_number, shipping_date]]}
            service.spreadsheets().values().update(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=range_update,
                valueInputOption="USER_ENTERED",
                body=body,
            ).execute()
            return 200
        except Exception as e:
            logger.exception(f"Error actualizando despacho: {e}")
            return 500

    async def new_item(self, item: int):
        return await run_in_threadpool(self.new_item_sync, item)

    def new_item_sync(self, item: int):
        service = self.get_google_service()

        if not service:
            return 404

        try:
            # 1. Verificar si el item existe en BASE ACCESS (SHEET_NAME_ACCES)
            search_range = f"{self.SHEET_NAME_ACCES}!A:A"
            result = (
                service.spreadsheets()
                .values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR, range=search_range
                )
                .execute()
            )
            values = result.get("values", [])

            item_exists_in_base = False
            for row in values:
                if row and str(row[0]) == str(item):
                    item_exists_in_base = True
                    break

            if not item_exists_in_base:
                return 404  # No existe en BASE ACCESS

            # 2. Verificar si el item YA existe en INV (SHEET_NAME_INV)
            range_check = f"{self.SHEET_NAME_INV}!A:A"
            result_inv = (
                service.spreadsheets()
                .values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR, range=range_check
                )
                .execute()
            )
            existing_values_inv = result_inv.get("values", [])

            for row in existing_values_inv:
                if row and str(row[0]) == str(item):
                    return 409  # Ya existe en el inventario (Conflict/Error 404 solicitado modificado a 404 manual en ruta si prefieren)

            # 3. Determinar la siguiente fila y la fecha de hoy
            next_row = len(existing_values_inv) + 1
            from datetime import datetime

            today_date = datetime.now().strftime("%d-%m-%Y")

            # 4. Escribir el item en columna A (1) y la fecha en columna J (10)
            # Como J es la columna 10, podemos usar un rango que cubra A:J si queremos ser eficientes,
            # o hacer actualizaciones separadas. Actualizaremos A y J.

            # Columna A
            range_item = f"{self.SHEET_NAME_INV}!A{next_row}"
            body_item = {"values": [[item]]}
            service.spreadsheets().values().update(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=range_item,
                valueInputOption="USER_ENTERED",
                body=body_item,
            ).execute()

            # Columna J
            range_date = f"{self.SHEET_NAME_INV}!J{next_row}"
            body_date = {"values": [[today_date]]}
            service.spreadsheets().values().update(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=range_date,
                valueInputOption="USER_ENTERED",
                body=body_date,
            ).execute()

            return 200
        except Exception as e:
            logger.exception(f"Error agregando item: {e}")
            return 500

    async def compare_coditems(self):
        return await run_in_threadpool(self._compare_coditems_sync)

    def _get_last_50_coditems_sync(self):
        query = """
        SELECT TOP 50
            Item.CodItem, Item.FechaPedido, Item.FechaEntrega, Item.CodOCCliente,
            Item.CodProductoCliente, Clientes.Cliente, Producto.Producto,
            Referencia.Referencia, Modelo.Modelo, Tela.Tela,
            ReferenciaTela.Referencia AS ReferenciaTela, Item.LugarEntrega,
            Item.ValorUnidad, Producto.Producto + ' - ' + Referencia.Referencia AS [REFERENCIA COMPLETA],
            (Item.Cantidad * Item.ValorUnidad) AS VALOR, DATEDIFF(DAY, Item.FechaPedido, GETDATE()) AS [Edad de Producto]
        FROM Item
        INNER JOIN Producto ON Item.CodProducto = Producto.CodProducto
        INNER JOIN Referencia ON Item.CodReferencia = Referencia.CodReferencia
        INNER JOIN Clientes ON Item.CodCliente = Clientes.CodCliente
        INNER JOIN Modelo ON Item.CodModelo = Modelo.CodModelo
        INNER JOIN ReferenciaTela ON Item.CodReferenciaTela = ReferenciaTela.CodReferenciaTela
        INNER JOIN Tela ON Tela.CodTela = Item.CodTela
        ORDER BY Item.CodItem DESC;
        """
        conn = self.get_sql_connection()
        cursor = conn.cursor()
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()
        coditems = [row.CodItem for row in rows]
        return coditems, rows

    def _get_coditems_from_sheets_sync(self):
        service = self.get_google_service()
        if not service:
            return []
        result = (
            service.spreadsheets()
            .values()
            .get(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=f"{self.SHEET_NAME_ACCES}!A:A",
            )
            .execute()
        )
        values = result.get("values", [])
        coditems = []
        for row in values[1:]:
            if row and row[0]:
                raw = str(row[0]).strip()
                clean = "".join(filter(str.isdigit, raw))
                if clean:
                    coditems.append(int(clean))
        return sorted(coditems, reverse=True)[:100]

    def _append_to_sheets_sync(self, data_rows):
        service = self.get_google_service()
        if not service:
            return False
        try:
            result_read = (
                service.spreadsheets()
                .values()
                .get(
                    spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                    range=f"{self.SHEET_NAME_ACCES}!A:A",
                )
                .execute()
            )
            next_row = len(result_read.get("values", [])) + 1

            values_to_insert = []
            for row in data_rows:
                row_values = [
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
                values_to_insert.append(row_values)

            range_target = f"{self.SHEET_NAME_ACCES}!A{next_row}"
            body = {"values": values_to_insert}
            service.spreadsheets().values().update(
                spreadsheetId=settings.SHEETS_INVENTARIO_ALLSTAR,
                range=range_target,
                valueInputOption="USER_ENTERED",
                body=body,
            ).execute()
            return True
        except Exception as e:
            logger.exception(f"Error en append_to_sheets: {e}")
            return False

    def _compare_coditems_sync(self):
        try:
            # 1. Traer items activos de SQL (últimos 3 meses)
            query = """
            SELECT
                Item.CodItem, Item.FechaPedido, Item.FechaEntrega, Item.CodOCCliente,
                Item.CodProductoCliente, Clientes.Cliente, Producto.Producto,
                Referencia.Referencia, Modelo.Modelo, Tela.Tela,
                ReferenciaTela.Referencia AS ReferenciaTela, Item.LugarEntrega,
                Item.ValorUnidad,
                Producto.Producto + ' - ' + Referencia.Referencia + ' - ' + Tela.Tela AS [REFERENCIA COMPLETA],
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
            cursor = conn.cursor()
            cursor.execute(query)
            rows = cursor.fetchall()
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
