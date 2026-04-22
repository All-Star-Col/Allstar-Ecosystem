# Operational Workspace Data Model (Observed)

Scope note: modelo inferido de consultas SQL y schemas Pydantic del workspace.

## Workspace apps y autorizacion

### `workspace.apps`
Campos observados en respuesta de app tiles:
- `id`
- `name`
- `description`
- `path`
- `external_url`
- `icon_key`
- `icon_bg_color`
- `badge_color`

### `workspace.role_apps`
Relacion observada:
- `role_id` -> `app_id`

### `auth.user_roles`
Relacion observada para resolver apps por usuario:
- `user_id` -> `role_id`

Evidencia:
- `services/api-service/src/services/apps.py`

## Forms metadata

### `workspace.ui_categorias_tablas`
Campos usados:
- `id`
- `nombre`

### `workspace.ui_config_tablas`
Campos usados:
- `id`
- `nombre_tabla_sql`
- `nombre_tabla_ui`
- `categoria_id`
- `es_visible`
- `table_id` o fallback `id` (Data Viewer)
- opcionales observados: `stable_order_column`, `default_order_column`, `can_update`, `can_insert`, `can_delete`

### `information_schema` / `pg_catalog`
Usadas para inferir:
- columnas
- tipos
- nulabilidad
- pk
- fk
- enums/check constraints

Evidencia:
- `services/api-service/src/services/forms.py`
- `services/api-service/src/services/data_viewer.py`

## Carpentry schema (tablas/vistas observadas en queries)
- Tablas: `proyectos`, `lotes`, `procesos`, `lote_procesos`, `items`, `materiales_catalogo`, `inventario`, `movimientos_inventario`, `registros_produccion`, `registros_produccion_personas`, `registros_produccion_maquinas`, `personas`, `maquinas`.
- Vistas: `vista_estado_proyectos`, `vista_necesidades_materiales`, `vista_carga_activa`, `vista_produccion_semanal`.

Evidencia:
- `services/api-service/src/services/carpentry/*.py`

## Modelos API de workspace observados
- Forms: `CategoriesForms`, `TableForms`, `ColumnTable`, `SubmitForm`, `SubmitFormResponse`.
- Data Viewer: `DataViewerTable`, `DataViewerQueryRequest`, `DataViewerQueryResponse`, `DataViewerRowUpdateRequest`, `DataViewerRowUpdateResponse`.
- Orders: `Order`.

Evidencia:
- `services/api-service/src/schemas/models.py`

## Estado frontend relacionado
- `favorite-apps` y `recent-apps` persisten en `localStorage` para dashboard.

Evidencia:
- `applications/web-app/src/system/dashboard/Dashboard.tsx`

## TBD
- DDL oficial del schema `workspace` y `carpentry`.
- Convenciones de versionado para configuracion `ui_config_tablas`.
