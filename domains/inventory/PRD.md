# Inventory PRD (Observed Scope)

## Problema que resuelve
Mantener trazabilidad operativa de items de inventario, despachos y devoluciones usando Google Sheets como superficie de operacion.

## Usuarios esperados (inferidos por flujo)
- Operacion logistica/inventario.
- Soporte de bodega y despachos.

## Capacidades implementadas hoy
- Consulta de item con opciones de ubicacion/transportador.
- Alta de item desde SQL Server.
- Movimiento de ubicacion.
- Despacho (move + delete de fila origen).
- Reintegro de devoluciones (incluyendo caso `DESCONOCIDO`).
- Registro de logs operativos en hoja `Logs`.

## Flujos principales
1. Alta de item (`POST /new/{item}`) despues de cierre/produccion.
2. Movimiento de ubicacion (`PATCH /location/{row}`).
3. Despacho (`PATCH /dispatch/{row}`).
4. Devolucion y reintegro (`POST /return_product/{item}`).

## Criterios observables de exito
- Endpoints retornan `status: OK` y actualizan hojas objetivo.
- Se evitan duplicados de item en inventario/despachado.
- Se registra actividad en hoja `Logs` para eventos clave.

## Riesgos actuales observables
- Dependencia fuerte de estructura exacta de hojas.
- Operacion sin auth explicita en rutas.
- Manejo de errores por codigo numerico interno (404/409/500) sin trazabilidad formal publica.

## TBD
- Reglas de autorizacion y auditoria formal.
- KPI objetivo (tiempo de registro, exactitud, tasa de errores).
- Mecanismo de conciliacion automatica de inconsistencias entre fuentes.
