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

_EXTERNAL_LOCATIONS = {"Tienda Bucaramanga", "Nihao Principal", "Tienda Unicentro"}


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
            now = datetime.now()
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

    async def new_item(self, item: int):
        """
        new_item()
        Wrapper asincrono de new_item_sync.
            - item:int | codigo del item a agregar en INVENTARIO
        """
        return await run_in_threadpool(self.new_item_sync, item)

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
            cliente = sql_row.Cliente if sql_row.Cliente else ""

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

            # 3. Construir y escribir la nueva fila completa en INVENTARIO
            # A=ITEM B=PRODUCTO C=TELA D=CLIENTE E=ORDEN F=UBICACION G=FILA H=VALOR I=OBS
            new_row = [
                str(item),           # A: ITEM
                producto,            # B: PRODUCTO
                tela,                # C: TELA
                cliente,             # D: CLIENTE
                "DISPONIBLE",        # E: ORDEN
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

            # DEVOLUCIONES: A=ITEM(0) B=PRODUCTO(1) C=TELA(2) D=CLIENTE(3) E=ORDEN(4)
            #               F=VALOR_PRODUCTO(5) G=SALIDA/REMISION(6) H=FACTURA(7)
            #               I=BODEGA(8) J=FILA(9) K=FECHA_DESPACHO(10) L=OBS_PRODUCTO(11)
            #               M=Estado(12) N=Nota_Credito(13)

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
                self.get_val(dev_data, 8),    # F: UBICACION (BODEGA de DEVOLUCIONES col I)
                self.get_val(dev_data, 9),    # G: FILA (col J de DEVOLUCIONES)
                self.get_val(dev_data, 5),    # H: VALOR PRODUCTO (col F de DEVOLUCIONES)
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
                # Sobreescribir col A con new_item y col M con "Reintegrado Item nuevo"
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
                                "range": f"{self.SHEET_NAME_RETURNS}!M{dev_excel_row}",
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
