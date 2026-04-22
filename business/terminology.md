# Terminology

Glosario operativo del repositorio (basado en estado observable).

## Producto y composicion

- Allstar Platform / Allstar Ecosystem: sistema interno documentado en este monorepo con frontend (`applications/web-app`) y backend (`services/api-service`).
- Web app: cliente React + TypeScript + Vite que consume la API y monta dashboard + modulos.
- API service: servicio FastAPI bajo prefijo `/api/v1` que centraliza auth, workspace e integraciones externas.
- Workspace: respuesta de `GET /api/v1/workspace` con identidad del usuario y lista de apps habilitadas.
- App de workspace: entrada de aplicacion retornada por backend con metadatos como `path`, `icon_key` y `external_url`.

## Acceso y seguridad

- OAuth2 password flow: mecanismo usado en login para recibir credenciales (`username`/`password`) y emitir token.
- JWT access token: token bearer con `sub` (username) y expiracion (`exp`) usado para rutas protegidas.
- Bearer token: cabecera `Authorization: Bearer <token>` requerida por endpoints privados.
- Usuario activo: usuario con `auth.users.is_active = true`; usuarios inactivos son rechazados.
- Admin: usuario cuyo rol tiene `code = 'ADMIN'`; habilita endpoints de gestion de usuarios.

## Workspace y modulos frontend

- Dashboard: pantalla principal (`/dashboard`) que consulta `workspace` y renderiza apps disponibles.
- Profile: pantalla `/dashboard/profile` con datos de sesion y funciones administrativas segun rol.
- Forms module: modulo en `/app/forms` para formularios dinamicos respaldados por metadata SQL.
- Products module: modulo en `/app/products` incluido en el registro de modulos frontend.
- Data Viewer module: modulo en `/app/data-viewer` para consulta, exportacion y edicion de datos.
- Carpentry module: modulo en `/app/carpentry` para acciones de carpinteria via endpoints bajo `/api/v1/workspace/carpentry`.

## Datos (PostgreSQL)

- `auth.users`: tabla de usuarios (credenciales hash, estado activo, timestamps).
- `auth.roles`: tabla de roles.
- `auth.user_roles`: relacion usuario-rol.
- `workspace.apps`: catalogo de apps disponibles para workspace.
- `workspace.role_apps`: relacion rol-app para resolver accesos del workspace.
- `workspace.ui_categorias_tablas`: categorias visibles para formularios.
- `workspace.ui_config_tablas`: configuracion de tablas visibles para formularios/data entry.
- Esquema `data`: esquema objetivo de inserciones dinamicas de formularios (`submit`).
- `information_schema`: fuente para validar columnas/tipos al construir formularios dinamicos.

## Data Viewer (backend)

- Data Viewer table: definicion de tabla operativa con metadata de columnas, PK y permisos (`can_update`, `can_insert`, `can_delete`).
- Query request: payload con tabla/filtros/orden/paginacion para `POST /api/v1/workspace/data-viewer/query`.
- Export CSV: descarga por `POST /api/v1/workspace/data-viewer/export`.
- Row patch: actualizacion de filas por `PATCH /api/v1/workspace/data-viewer/rows`.

## Integraciones externas

- Bitwarden: origen de secretos de runtime cargados al iniciar la API mediante `BW_ACCESS_TOKEN`.
- Google Sheets service account: credenciales JSON usadas para construir cliente Sheets API.
- Spreadsheet de inventario: id tomado de `SHEETS_INVENTARIO_ALLSTAR`.
- Hojas operativas observables: `INVENTARIO`, `Complementos`, `DESPACHADO`, `DEVOLUCIONES`, `Logs`.
- SQL Server upstream: base consultada por `pyodbc` para sincronizacion de items.

## Operacion y despliegue

- Trigger de produccion: `POST /api/v1/sheets/trigger/production` para lanzar sincronizacion SQL Server -> Sheets.
- Scheduler interno: job APScheduler que invoca el trigger de produccion (intervalo configurado en codigo: 240 minutos).
- Deploy API pipeline: workflow `.github/workflows/deploy-api.yml` (build/push Docker + despliegue en VM via Tailscale SSH).
- Deploy frontend pipeline: workflow `.github/workflows/azure-static-web-apps-purple-water-03112dc0f.yml`.

## Terminos con definicion parcial (TBD)

- Nombre funcional definitivo de la hoja destino de sincronizacion "access/base" (`PRUEBA ACCESS` aparece en comentarios, pero el atributo operativo visible es `SHEET_NAME_ACCES`, no definido en constructor).
- Taxonomia oficial de modulos por dominio de negocio (solo se observan nombres tecnicos actuales).
