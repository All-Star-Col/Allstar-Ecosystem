# Production Data Model (Observed)

Scope note: modelo derivado de SQL consultado y payloads usados en rutas/servicios de produccion.

## Sincronizacion SQL Server -> Google Sheets

### SQL Server (fuente)
Consulta de `compare_coditems_sync` usa campos:
- `Item.CodItem`
- `Item.FechaPedido`
- `Item.FechaEntrega`
- `Item.CodOCCliente`
- `Item.CodProductoCliente`
- `Clientes.Cliente`
- `Producto.Producto`
- `Referencia.Referencia`
- `Modelo.Modelo`
- `Tela.Tela`
- `ReferenciaTela.Referencia`
- `Item.LugarEntrega`
- `Item.ValorUnidad`
- derivados `REFERENCIA COMPLETA`, `VALOR`, `Edad de Producto`

Evidencia:
- `services/api-service/src/services/sheets.py` (`compare_coditems_sync`)

### Google Sheets (target)
- Trigger sincroniza contra hoja referenciada como `self.SHEET_NAME_ACCES` y rango `A:P`.
- El atributo `SHEET_NAME_ACCES` se usa pero no se inicializa en `__init__` de `SheetsService`.

Evidencia:
- `services/api-service/src/services/sheets.py`

## Carpentry production tables observadas
- `registros_produccion`
- `registros_produccion_personas`
- `registros_produccion_maquinas`
- `lotes`
- `procesos`
- `personas`
- `maquinas`
- `materiales_catalogo`
- `movimientos_inventario`

Evidencia:
- `services/api-service/src/services/carpentry/produccion.py`

## Payload de registro de produccion (carpentry)
Campos observados en `produccion.registrar`:
- `fecha`
- `lote_id`
- `proceso_id`
- `persona_ids` / `persona_id`
- `maquina_ids` / `maquina_id`
- `piezas_procesadas`
- `horas_reales`
- `material_consumido`
- `material_id`
- `novedad`
- `tiene_bloqueo`
- `motivo_bloqueo`

## Frontend products state shape (operacional)
Estado local observable incluye:
- correo seleccionado
- cliente
- productos del pedido
- archivos adjuntos
- estados AI (`processing/completed/error`)
- estado de submit (`idle/loading/success/error`)

Evidencia:
- `applications/web-app/src/apps/products/components/ProductionFormWizard.tsx`

## TBD
- Contrato persistente backend de `products` (no implementado en `api-service`).
- DDL exacta y constraints del schema de produccion/carpinteria.
