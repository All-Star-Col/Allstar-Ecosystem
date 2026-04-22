# Operational Workspace PRD (Observed Scope)

## Problema que resuelve
Concentrar en un solo workspace las aplicaciones operativas del usuario autenticado, con visibilidad segun rol.

## Usuarios
- Operadores de negocio autenticados.
- Administradores (consumen perfil/admin users).

## Capacidades implementadas hoy
- Descubrimiento de apps via `/workspace`.
- Navegacion a modulos forms, products, data-viewer y carpentry.
- Carga de metadata y registro de formularios dinamicos.
- Exploracion/edicion tabular avanzada (Data Viewer).
- Operacion modular de carpinteria por acciones backend.

## Historias de usuario observables
1. Como usuario autenticado, veo solo apps permitidas por mi rol.
2. Como operador, puedo registrar datos en tablas configuradas por UI config.
3. Como analista, puedo consultar/exportar/editar filas en Data Viewer.
4. Como usuario de carpinteria, puedo ejecutar acciones por modulo via `invoke`.

## Criterios observables de exito
- Dashboard renderiza `apps` con paths navegables.
- Forms y Data Viewer operan contra tablas permitidas.
- Carpentry responde acciones disponibles y ejecucion.

## Riesgos actuales
- Dependencia de configuracion DB (`workspace.ui_config_tablas`) para forms/data-viewer.
- Endpoint de orders aun sin logica de negocio persistente.

## TBD
- Roadmap oficial de modulo `products` dentro del workspace.
- Definicion funcional de `orders` y su integracion real.
- KPI de productividad de uso por modulo.
