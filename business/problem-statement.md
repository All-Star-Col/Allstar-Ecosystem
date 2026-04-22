# Problem Statement

Scope note: este documento describe solo comportamiento observable en el repositorio actual. Cuando no hay evidencia directa en codigo o docs inspeccionados, se marca como `TBD`.

## Contexto actual

El repositorio documenta y mantiene una plataforma interna con dos artefactos ejecutables principales:

- `applications/web-app` (React + TypeScript + Vite).
- `services/api-service` (FastAPI).

En terminos operativos, el sistema actua como una capa de acceso y operacion para procesos internos de Allstar, conectando usuarios autenticados con modulos de trabajo y con sistemas externos (PostgreSQL, SQL Server, Google Sheets, Bitwarden).

## Problemas operativos que hoy resuelve

1. Controlar acceso autenticado para empleados
- Login y registro emiten JWT (`/api/v1/login`, `/api/v1/register`).
- Las rutas protegidas validan token bearer y estado de usuario activo.

2. Entregar un workspace por rol
- `GET /api/v1/workspace` retorna identidad del usuario y lista de apps habilitadas.
- La lista de apps se calcula desde `auth.user_roles` + `workspace.role_apps` + `workspace.apps`.

3. Operar modulos internos desde un shell unico
- El frontend monta modulos bajo `/app/*`: `forms`, `products`, `data-viewer`, `carpentry`.
- El dashboard usa la respuesta de workspace para mostrar accesos y apps por usuario.

4. Capturar datos operativos con formularios dinamicos
- El backend expone catalogos de categorias/tablas y metadatos de columnas para formularios.
- Los envios usan validacion de identificadores SQL y columnas permitidas.
- La insercion dinamica se ejecuta sobre el esquema PostgreSQL `data` (no hardcode por tabla en codigo).

5. Consultar y actualizar tablas operativas con Data Viewer
- Endpoints para listar tablas, consultar con filtros/paginacion, exportar CSV y actualizar filas.
- El acceso sigue modelo autenticado de workspace.

6. Ejecutar operacion de inventario en Google Sheets
- Endpoints de inventario para consultar item, agregar item, mover ubicacion, despachar y procesar devoluciones.
- Tambien existen endpoints para devoluciones pendientes y devoluciones por item.

7. Sincronizar periodicamente SQL Server -> Google Sheets
- Existe trigger HTTP `/api/v1/sheets/trigger/production`.
- Existe scheduler interno (APScheduler) que llama ese trigger de forma periodica.

8. Administrar usuarios desde el backend
- Endpoints bajo `/api/v1/workspace/users` para listar, crear, editar y eliminar usuarios.
- El acceso administrativo depende de rol `ADMIN`.

## Restricciones observables e implicaciones

- El API depende de secretos de Bitwarden al iniciar (`BW_ACCESS_TOKEN` requerido).
- Las integraciones de datos son mixtas:
  - PostgreSQL para auth/workspace/forms.
  - SQL Server como fuente upstream para sincronizacion.
  - Google Sheets como superficie operativa de inventario.
- El despliegue de API se ejecuta via GitHub Actions, Docker Hub y conexion a VM por Tailscale SSH.

## Riesgos/lagunas observables (tecnicos)

- En `src/core/scheduler.py` el intervalo configurado es `240` minutos, mientras comentarios/mensajes mencionan "cada 10 minutos".
- En `src/services/sheets.py`, la sincronizacion referencia `self.SHEET_NAME_ACCES`, atributo que no se observa definido en el constructor de `SheetsService`.
- Existe router de ordenes (`/api/v1/workspace/orders/orders`) que hoy solo devuelve el payload recibido (sin persistencia visible).

## TBD de negocio

- KPI de negocio esperados (tiempo ahorrado, reduccion de errores, throughput).
- Alcance exacto por area/departamento y responsables de proceso.
- Priorizacion oficial entre modulos (`forms`, `products`, `data-viewer`, `carpentry`).
- Politicas formales de ciclo de vida de roles/permisos y aprobaciones operativas.
