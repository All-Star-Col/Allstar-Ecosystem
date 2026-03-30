# Brief: Modulo CRUD de Gestion de Usuarios

**Estado:** Pendiente de aprobacion
**Fecha:** 2026-03-27
**Servicio:** api-service (FastAPI / Python 3.12 / PostgreSQL async)

---

## 1. Que se va a construir

Un modulo de administracion de usuarios accesible unicamente por un usuario con rol `admin`.
El modulo expone endpoints REST para:

- Listar todos los usuarios registrados en el sistema.
- Consultar el detalle de un usuario por su ID.
- Crear un nuevo usuario (con email, username, full_name y password).
- Modificar datos de un usuario existente (full_name, email, password, estado activo/inactivo).
- Eliminar un usuario: se soportan dos modalidades, soft delete (marcar `is_active = false`)
  y hard delete (borrar el registro de la base de datos), la eleccion entre ambas queda
  pendiente de decision (ver seccion 6).

Ningun endpoint del modulo es accesible por usuarios con rol distinto a `admin`.
El JWT del solicitante es el mecanismo de identificacion; el rol se verifica consultando
`auth.user_roles` + `auth.roles` antes de ejecutar cualquier operacion.

---

## 2. Que ya existe y se puede reutilizar

| Componente | Archivo | Que aporta |
|---|---|---|
| `get_user()` | `src/services/users.py:15` | Busca un usuario por username; devuelve `UserInDB` o `None` |
| `create_user()` | `src/services/users.py:38` | INSERT en `auth.users` con hash de password; maneja conflicto de username |
| `get_password_hash()` | `src/core/security.py:11` | Genera hash bcrypt de una password en texto plano |
| `get_current_user()` | `src/api/deps.py:15` | Dependencia FastAPI que decodifica el JWT y devuelve el `User` activo |
| `get_role()` | `src/services/roles.py:9` | Consulta el rol de un usuario por username via JOIN en `auth.roles` |
| `UserCreate` | `src/schemas/models.py:30` | Modelo Pydantic para creacion de usuario (email, username, full_name, password) |
| `User` | `src/schemas/models.py:24` | Modelo de respuesta publica de usuario (sin password_hash) |
| `Role` | `src/schemas/models.py:43` | Modelo de rol con id, name, description |
| `get_db()` | `src/db/database.py` | Dependencia que provee sesion async de PostgreSQL |
| `build_error_response()` | `src/api/v1/common/http_helpers.py` | Shape uniforme de errores con request_id |

---

## 3. Que falta implementar

### En `src/services/users.py`
- `list_users()` — SELECT paginado sobre `auth.users`, devuelve lista de `User`.
- `get_user_by_id()` — SELECT por UUID, devuelve `User` o lanza 404.
- `update_user()` — UPDATE parcial (full_name, email, password, is_active) con `updated_at = NOW()`.
- `delete_user()` — segun decision de diseno: UPDATE `is_active = false` (soft) o DELETE fisico (hard).

### En `src/schemas/models.py`
- `UserUpdate` — modelo Pydantic para los campos modificables (todos opcionales).
- `UserAdminResponse` — modelo de respuesta que incluye `email` e `is_active`, para uso exclusivo del admin.
- `UserListResponse` — wrapper de lista paginada (items + total).

### En `src/api/deps.py`
- `require_admin()` — dependencia que llama a `get_current_user()` + `get_role()` y lanza HTTP 403
  si el rol no es `admin`. Todos los endpoints del modulo la usan via `Depends(require_admin)`.

### En `src/api/v1/routes/workspace/` (nuevo sub-modulo)
- `users/users.py` — router con los cinco endpoints:
  - `GET  /api/v1/workspace/users` — listar usuarios
  - `GET  /api/v1/workspace/users/{user_id}` — detalle de usuario
  - `POST /api/v1/workspace/users` — crear usuario (reutiliza `create_user()`)
  - `PATCH /api/v1/workspace/users/{user_id}` — modificar usuario
  - `DELETE /api/v1/workspace/users/{user_id}` — eliminar usuario

### En `src/main.py`
- Registrar el nuevo router bajo el prefijo `/api/v1`.

---

## 4. Decisiones de diseno clave

### Admin-only: como se verifica el rol
`get_role()` ya existe en `src/services/roles.py` y hace el JOIN correcto sobre
`auth.roles` + `auth.user_roles`. La nueva dependencia `require_admin()` en `deps.py`
lo llama despues de `get_current_user()` y lanza HTTP 403 si `role.name != "admin"`.
Esto mantiene la logica de autorizacion centralizada en la capa de dependencias,
sin contaminar los handlers ni los servicios.

### Soft delete vs hard delete
El campo `is_active` ya existe en `auth.users` y `get_user()` ya lo interpreta
(mapea `disabled = not is_active`). Hacer soft delete es la opcion de menor riesgo:
preserva el historial y permite reactivar cuentas. Hard delete es irreversible y
rompe cualquier foreign key que referencie `auth.users.id` desde otras tablas.
Esta decision esta marcada como abierta (ver seccion 6).

### Un usuario no puede eliminarse a si mismo
El endpoint DELETE debe verificar que `current_user.id != user_id`. Si coinciden,
devuelve HTTP 400 con mensaje claro. Esto previene que el unico admin del sistema
se elimine accidentalmente.

### Separacion de modelos de respuesta
`User` (modelo existente) no expone `email` ni `is_active`. Para el admin se necesita
`UserAdminResponse` que si los incluye, sin exponer nunca `password_hash`.

### Paginacion en listado
El endpoint de listado acepta `limit` y `offset` como query params, consistente con
el patron ya usado en `data_viewer`. Limite maximo sugerido: 200.

---

## 5. Que NO entra en el scope

- Gestion de roles (asignar o quitar roles a usuarios): es un modulo separado.
- Gestion de permisos de apps por usuario (`workspace.role_apps`): fuera de alcance.
- Recuperacion de password via email: fuera de alcance.
- Autenticacion de dos factores: fuera de alcance.
- Audit log persistente de operaciones admin: fuera de alcance en esta iteracion
  (el logging estructurado existente cubre la trazabilidad minima).
- El endpoint `POST /api/v1/register` existente no se modifica ni se elimina.

---

## 6. Preguntas abiertas

1. **Soft delete o hard delete como comportamiento por defecto del endpoint DELETE?**
   Opciones: (a) siempre soft delete, (b) siempre hard delete,
   (c) parametro `?hard=true` que permite ambos. La recomendacion inicial es (a)
   dado que `is_active` ya existe, pero requiere confirmacion.

2. **El endpoint `POST /api/v1/register` debe quedar restringido o eliminado?**
   Actualmente cualquiera puede registrarse sin autenticacion. Con este modulo admin,
   puede tener sentido desactivarlo o protegerlo. Queda fuera del scope del brief
   pero es una decision de arquitectura pendiente.

3. **Debe `require_admin` vivir en `deps.py` o en un archivo separado `admin_deps.py`?**
   Pregunta de organizacion de codigo menor, pero impacta la estructura del proyecto.

4. **El campo `email` en `UserCreate` es `Optional[str]`. Debe volverse obligatorio
   para usuarios creados desde el panel admin?** Hoy el registro publico lo acepta
   como opcional; puede tener sentido endurecerlo en el contexto admin.
