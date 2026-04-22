# Production PRD (Observed Scope)

## Problema que resuelve
Sostener el flujo operativo de produccion combinando sincronizacion automatica de datos, registro de ejecucion en planta y captura de ordenes desde correos.

## Usuarios
- Operacion de produccion/planta.
- Coordinacion de pedidos.
- Soporte de seguimiento (reportes/resumen diario en carpinteria).

## Capacidades implementadas hoy
- Trigger backend de sincronizacion SQL Server -> Google Sheets.
- Job programado para ejecutar trigger periodicamente.
- Registro, historial y resumen de produccion via acciones carpinteria.
- Wizard frontend para procesar correos y crear ordenes con endpoints externos.

## Flujos observables
1. Scheduler dispara `/sheets/trigger/production`.
2. Servicio sincroniza items recientes hacia hoja de acceso.
3. Usuario carpinteria registra produccion (`produccion.registrar`) y consulta resumen/historial.
4. Usuario products procesa correo y envia orden a `/api/ordenes/produccion` (servicio externo al api-service).

## Criterios observables de exito
- Trigger responde estado de sincronizacion.
- Acciones `produccion.*` retornan datos/errores controlados.
- Wizard de products completa flujo de submit sin errores de integracion.

## Riesgos actuales
- Dependencia de endpoints externos no versionados dentro del repo.
- Inconsistencia entre comentario y frecuencia real del scheduler.
- Referencia a `SHEET_NAME_ACCES` no inicializada en servicio de sincronizacion.

## TBD
- Arquitectura objetivo del backend de `products`.
- Definicion de SLO para sincronizacion y latencia de actualizacion.
- Reglas de reconciliacion entre registros de produccion y capas de inventario.
