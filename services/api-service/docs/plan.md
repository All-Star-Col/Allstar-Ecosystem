# Plan de Implementacion: Modulo CRUD de Gestion de Usuarios

**Feature:** Administracion de usuarios con acceso exclusivo para rol `admin`
**Fecha:** 2026-03-27
**Estado:** Aprobado para implementacion

---

## Arquitectura elegida

**Service Layer + Dependency Injection centralizada**, coherente con el resto del proyecto.

- La autorizacion admin vive en `deps.py` como una dependencia reutilizable (`require_admin`),
  igual que `get_current_user` y `get_current_active_apps`.
- La logica de base de datos vive en `services/users.py` como funciones async puras.
- Los handlers en `routes/workspace/users/users.py` son delgados: validan la request,
  llaman al servicio, devuelven la response.
- El delete soporta soft (default) y hard (`?hard=true`) en el mismo endpoint.
- El email es obligatorio al crear usuarios desde el panel admin (nuevo schema `UserAdminCreate`).
- El endpoint publico `POST /api/v1/register` no se modifica.

---

## Modulos

### 1. Nuevos schemas en `src/schemas/models.py`

**`UserAdminCreate`**
- Archivo: `src/schemas/models.py`
- Responsabilidad: Contrato de entrada para crear un usuario desde el panel admin.
  Hace obligatorio el campo `email` que en `UserCreate` es opcional.
- Input: `email: str` (obligatorio, validado como email), `username: str`,
  `full_name: str`, `password: str`
- Output: instancia validada lista para pasar a `create_user()`
- No hace: hashing de password, logica de negocio, acceso a BD
- Interactua con: `POST /api/v1/workspace/users` (handler) y `create_user()` (servicio)

**`UserAdminResponse`**
- Archivo: `src/schemas/models.py`
- Responsabilidad: Modelo de respuesta para el panel admin. Expone campos sensibles
  que `User` publico no expone.
- Campos: `id: UUID`, `username: str`, `full_name: Optional[str]`,
  `email: Optional[str]`, `is_active: bool`
- No hace: exponer `password_hash` bajo ningun concepto
- Interactua con: todos los endpoints del modulo admin como `response_model`

**`UserUpdate`**
- Archivo: `src/schemas/models.py`
- Responsabilidad: Contrato de entrada para modificacion parcial. Todos los campos
  son opcionales; el handler rechaza el request si llegan todos en `None`.
- Campos: `full_name: Optional[str]`, `email: Optional[str]`,
  `password: Optional[str]`, `is_active: Optional[bool]`
- No hace: validar que al menos un campo este presente (eso lo hace el handler),
  hashear password
- Interactua con: `PATCH /api/v1/workspace/users/{user_id}` y `update_user()`

**`UserListResponse`**
- Archivo: `src/schemas/models.py`
- Responsabilidad: Wrapper de respuesta paginada para el listado de usuarios.
- Campos: `items: List[UserAdminResponse]`, `total: int`, `limit: int`, `offset: int`
- No hace: calculo de paginacion
- Interactua con: `GET /api/v1/workspace/users`

---

### 2. Nuevas funciones en `src/services/users.py`

**`list_users(db, limit, offset) -> tuple[list[UserAdminResponse], int]`**
- Archivo: `src/services/users.py`
- Responsabilidad: SELECT paginado sobre `auth.users`. Devuelve la lista de usuarios
  y el total de registros para que el handler construya `UserListResponse`.
- Input: `db: AsyncSession`, `limit: int` (1-200), `offset: int` (>= 0)
- Output: `tuple` con lista de `UserAdminResponse` y `total: int`
- No hace: filtrado por criterios distintos a paginacion, logica de autorizacion
- Interactua con: `GET /api/v1/workspace/users`
- Nota de implementacion: ejecutar dos queries o un COUNT en la misma transaccion.
  Usar `ORDER BY created_at DESC` (o `id`) para orden estable y reproducible entre paginas.

**`get_user_by_id(db, user_id) -> UserAdminResponse`**
- Archivo: `src/services/users.py`
- Responsabilidad: SELECT por UUID en `auth.users`. Lanza HTTP 404 si no existe.
- Input: `db: AsyncSession`, `user_id: UUID`
- Output: `UserAdminResponse`
- No hace: verificacion de permisos, logica de negocio
- Interactua con: `GET /api/v1/workspace/users/{user_id}` y `PATCH`, `DELETE`
  (internamente, para confirmar que el usuario existe antes de operar)

**`update_user(db, user_id, data: UserUpdate) -> UserAdminResponse`**
- Archivo: `src/services/users.py`
- Responsabilidad: UPDATE parcial de los campos presentes en `data` sobre el registro
  con ese UUID. Actualiza `updated_at = NOW()` siempre.
  Si `data.password` viene presente, lo hashea antes de persistir usando `get_password_hash()`.
- Input: `db: AsyncSession`, `user_id: UUID`, `data: UserUpdate`
- Output: `UserAdminResponse` con los datos actualizados (SELECT despues del UPDATE)
- No hace: verificar que el usuario existe (el handler llama a `get_user_by_id` antes),
  logica de autorizacion
- Interactua con: `PATCH /api/v1/workspace/users/{user_id}`, `get_password_hash()`
- Nota de implementacion: construir el SET dinamicamente solo con los campos que no
  son `None` en `data`. Nunca interpolar nombres de columna directamente: usar un
  diccionario de columnas permitidas y construir la lista desde ahi, igual que hace
  `data_viewer.py` con sus columnas editables.

**`delete_user(db, user_id, hard: bool = False) -> None`**
- Archivo: `src/services/users.py`
- Responsabilidad: Eliminar o deshabilitar un usuario.
  - Si `hard=False`: `UPDATE auth.users SET is_active = false, updated_at = NOW() WHERE id = $1`
  - Si `hard=True`: `DELETE FROM auth.users WHERE id = $1`
  Lanza HTTP 404 si no existe. Lanza HTTP 409 si el hard delete falla por foreign key.
- Input: `db: AsyncSession`, `user_id: UUID`, `hard: bool`
- Output: `None` (el handler devuelve HTTP 204)
- No hace: verificar que el usuario no sea el propio admin que llama (eso lo hace el handler),
  logica de autorizacion
- Interactua con: `DELETE /api/v1/workspace/users/{user_id}`

---

### 3. Nueva dependencia en `src/api/deps.py`

**`require_admin(current_user, db) -> User`**
- Archivo: `src/api/deps.py`
- Responsabilidad: Verificar que el usuario autenticado tiene rol `admin`.
  Llama a `get_current_user()` (via `Depends`) para obtener el usuario ya verificado,
  luego llama a `get_role(db, current_user.username)`. Si el rol no es `admin`,
  lanza HTTP 403 con mensaje claro.
- Input: `current_user: User = Depends(get_current_user)`, `db: AsyncSession = Depends(get_db)`
- Output: el mismo `User` recibido (lo pasa a traves para que el handler lo use si necesita
  saber quien es el admin que opera)
- No hace: crear sesiones de DB propias, logica de negocio, formateo de respuestas
- Interactua con: todos los endpoints de `routes/workspace/users/users.py` via `Depends(require_admin)`

---

### 4. Nuevo router en `src/api/v1/routes/workspace/users/users.py`

Archivo nuevo: `src/api/v1/routes/workspace/users/users.py`

Cinco endpoints, todos con `Depends(require_admin)`:

**`GET /users` — listar usuarios**
- Query params: `limit: int = 100` (max 200), `offset: int = 0`
- Llama a: `list_users(db, limit, offset)`
- Response model: `UserListResponse`
- HTTP 200

**`GET /users/{user_id}` — detalle de usuario**
- Path param: `user_id: UUID`
- Llama a: `get_user_by_id(db, user_id)` — lanza 404 si no existe
- Response model: `UserAdminResponse`
- HTTP 200

**`POST /users` — crear usuario**
- Body: `UserAdminCreate`
- Llama a: `create_user(db, data)` — reutiliza la funcion existente.
  Nota: `create_user` espera `UserCreate`. El handler debe construir un `UserCreate`
  desde el `UserAdminCreate` recibido, o `UserAdminCreate` debe ser compatible.
  Ver nota de implementacion en la seccion de schemas.
- Response model: `UserAdminResponse`
- HTTP 201
- Lanza 409 si el username ya existe (lo maneja `create_user`)

**`PATCH /users/{user_id}` — modificar usuario**
- Path param: `user_id: UUID`
- Body: `UserUpdate`
- Validacion en el handler: si todos los campos de `UserUpdate` son `None`, devolver
  HTTP 422 con mensaje "No fields to update".
- Llama a: `get_user_by_id(db, user_id)` para confirmar existencia, luego `update_user(db, user_id, data)`
- Response model: `UserAdminResponse`
- HTTP 200

**`DELETE /users/{user_id}` — eliminar usuario**
- Path param: `user_id: UUID`
- Query param: `hard: bool = False`
- Validacion en el handler: si `current_user.id == user_id`, devolver HTTP 400
  con mensaje "Cannot delete your own account".
- Llama a: `delete_user(db, user_id, hard=hard)`
- Response: HTTP 204 sin body
- Lanza 404 si no existe, 409 si hard delete falla por FK

---

### 5. Registro del router en `src/main.py`

- Importar el nuevo router desde `src/api/v1/routes/workspace/users/users.py`
- Registrar con `app.include_router(users_router, prefix="/api/v1/workspace", tags=["Workspace"])`
- No se toca ningun otro router existente

---

### 6. Restriccion del registro publico

- El endpoint `POST /api/v1/register` en `src/api/v1/routes/register/register.py`
  se protege agregando `Depends(require_admin)` a su firma.
- El endpoint publico queda disponible mientras se migra, pero solo admins podran usarlo.
- No se elimina ni se crea un nuevo archivo.
- Este es el unico cambio en archivos existentes fuera de `deps.py` y `models.py`.

---

## Flujo de datos

### Ejemplo: PATCH /api/v1/workspace/users/{user_id}

1. El request llega con el JWT en el header `Authorization: Bearer <token>`.
2. FastAPI ejecuta `Depends(require_admin)` antes de entrar al handler.
3. `require_admin` llama a `get_current_user()`, que decodifica el JWT y retorna el `User` activo.
4. `require_admin` llama a `get_role(db, current_user.username)`.
5. Si el rol no es `admin`, se lanza HTTP 403 y el request termina aqui.
6. Si el rol es `admin`, `require_admin` devuelve el `User` al handler.
7. El handler recibe el body como `UserUpdate` (Pydantic valida los tipos y formatos).
8. El handler verifica que al menos un campo de `UserUpdate` no sea `None`. Si todos son `None`, devuelve HTTP 422.
9. El handler llama a `get_user_by_id(db, user_id)`. Si no existe, se lanza HTTP 404.
10. El handler llama a `update_user(db, user_id, data)`.
11. `update_user` construye el UPDATE dinamico, hashea password si viene, ejecuta la query.
12. `update_user` hace SELECT del registro actualizado y devuelve `UserAdminResponse`.
13. El handler devuelve HTTP 200 con el `UserAdminResponse`.

### Ejemplo: DELETE /api/v1/workspace/users/{user_id}?hard=true

1-6. Igual que arriba (verificacion de admin).
7. El handler compara `current_user.id == user_id`. Si coinciden, HTTP 400.
8. El handler llama a `delete_user(db, user_id, hard=True)`.
9. `delete_user` ejecuta `DELETE FROM auth.users WHERE id = $1`.
10. Si la BD lanza error de FK, `delete_user` captura y relanza HTTP 409.
11. El handler devuelve HTTP 204 sin body.

---

## Orden de implementacion

El orden respeta las dependencias entre capas: no se puede implementar una capa
superior sin que la inferior este lista.

1. **Schemas** (`src/schemas/models.py`)
   Agregar `UserAdminCreate`, `UserAdminResponse`, `UserUpdate`, `UserListResponse`.
   Sin dependencias externas. Verificar con un test manual de importacion que los
   modelos cargan sin error antes de continuar.

2. **Servicios** (`src/services/users.py`)
   Implementar en este orden:
   a. `get_user_by_id` — la mas simple, base para las demas
   b. `list_users` — SELECT paginado, independiente
   c. `update_user` — depende de `get_password_hash` (ya existe) y de tener claro el schema `UserUpdate`
   d. `delete_user` — la mas delicada por el manejo de FK en hard delete

3. **Dependencia** (`src/api/deps.py`)
   Agregar `require_admin`. Depende de que `get_role()` ya existe y de que `get_current_user()`
   ya existe. No requiere tocar nada mas.

4. **Router** (`src/api/v1/routes/workspace/users/users.py`)
   Crear el archivo y el directorio. Implementar los cinco endpoints en orden de
   complejidad creciente: GET list, GET by id, POST, PATCH, DELETE.
   En cada endpoint verificar que `require_admin` esta en la firma antes de hacer
   cualquier otra cosa.

5. **Registro en main** (`src/main.py`)
   Importar y registrar el nuevo router. Verificar con `/docs` que los cinco
   endpoints aparecen bajo el tag "Workspace" y con los paths correctos.

6. **Restriccion del registro publico** (`src/api/v1/routes/register/register.py`)
   Agregar `Depends(require_admin)` al endpoint existente. Hacer este paso al final
   para no bloquear el flujo de pruebas manuales durante el desarrollo del modulo.

---

## Puntos de falla a manejar

**1. Usuario sin rol asignado en `auth.user_roles`**
`get_role()` devuelve `None` si el usuario no tiene ningun rol. `require_admin` debe
manejar el caso `role is None` con HTTP 403, no con un AttributeError en `role.name`.

**2. Hard delete con foreign keys activas**
Si otras tablas referencian `auth.users.id` (por ejemplo, `auth.user_roles`),
`DELETE FROM auth.users` fallara con una excepcion de integridad referencial de asyncpg.
`delete_user` debe capturar `asyncpg.ForeignKeyViolationError` (o la excepcion
equivalente de SQLAlchemy) y relanzar HTTP 409 con un mensaje que explique el problema,
no dejar que llegue como HTTP 500.

**3. PATCH con body vacio o todos los campos en None**
Pydantic acepta `{}` como body valido para `UserUpdate` porque todos los campos son opcionales.
El handler debe verificar explicitamente que al menos un campo no sea `None` antes de
llamar al servicio. Si no lo hace, `update_user` intentaria construir un `SET` vacio
y la query SQL fallaria con error de sintaxis.

**4. Auto-eliminacion del admin**
La verificacion `current_user.id == user_id` debe hacerse antes de cualquier llamada
al servicio. Si se hace despues de `get_user_by_id`, se hace una query innecesaria
antes de rechazar el request.

**5. Race condition en username unico**
`create_user` ya maneja el `ON CONFLICT (username) DO NOTHING` y lanza HTTP 409
si `rowcount == 0`. No hay que duplicar esta logica en el handler.

**6. Password en logs**
`update_user` recibe un `UserUpdate` que puede contener una password en texto plano.
Nunca loggear el objeto `data` completo. Loggear solo `user_id` y la lista de campos
modificados (sin sus valores).

**7. Paginacion con offset mayor al total**
Si `offset >= total`, `list_users` debe devolver `items: []` y `total: N` (el total real),
no un error. El handler no debe rechazar este caso.

---

## Criterios de exito

Para que el Senior Reviewer apruebe la implementacion:

- [ ] `GET /api/v1/workspace/users` devuelve HTTP 403 con un JWT de usuario no-admin.
- [ ] `GET /api/v1/workspace/users` devuelve HTTP 200 con lista paginada y campo `total` correcto con JWT admin.
- [ ] `GET /api/v1/workspace/users/{id_inexistente}` devuelve HTTP 404.
- [ ] `POST /api/v1/workspace/users` sin campo `email` devuelve HTTP 422 (campo obligatorio).
- [ ] `POST /api/v1/workspace/users` con `username` duplicado devuelve HTTP 409.
- [ ] `POST /api/v1/workspace/users` crea el usuario y la respuesta nunca contiene `password_hash`.
- [ ] `PATCH /api/v1/workspace/users/{id}` con body `{}` devuelve HTTP 422.
- [ ] `PATCH /api/v1/workspace/users/{id}` con `password` nuevo actualiza el hash en BD (verificable haciendo login con la nueva password).
- [ ] `DELETE /api/v1/workspace/users/{id}` (sin `?hard=true`) deja el registro en BD con `is_active = false`.
- [ ] `DELETE /api/v1/workspace/users/{id}?hard=true` elimina el registro fisicamente de `auth.users`.
- [ ] `DELETE /api/v1/workspace/users/{id_propio_admin}` devuelve HTTP 400.
- [ ] `POST /api/v1/register` con JWT de no-admin devuelve HTTP 403.
- [ ] Ningun endpoint del modulo es accesible sin JWT (HTTP 401).
- [ ] Ningun endpoint expone `password_hash` en ninguna respuesta.
- [ ] Los cinco endpoints aparecen en `/docs` bajo el tag "Workspace".

---

## Preguntas abiertas

1. **Compatibilidad de `UserAdminCreate` con `create_user()`**
   `create_user()` espera `UserCreate`. Durante la implementacion, decidir si
   `UserAdminCreate` hereda de `UserCreate` (sobreescribiendo `email` como obligatorio)
   o si el handler construye un `UserCreate` a partir del `UserAdminCreate`. Ambas
   opciones son validas; la herencia es mas limpia pero requiere entender como Pydantic
   maneja la sobreescritura de campos opcionales a obligatorios.

2. **Reactivacion de usuarios deshabilitados**
   Soft delete deja el usuario con `is_active = false`. El endpoint PATCH ya puede
   reactivarlo con `{"is_active": true}`, pero no hay ninguna indicacion explicita
   en el plan. Confirmar con el equipo si esto es el comportamiento esperado o si
   se necesita un endpoint dedicado de reactivacion.

3. **Formato del error 409 en hard delete por FK**
   El mensaje del 409 deberia indicar que hay datos relacionados, pero sin exponer
   detalles internos de la BD. Definir el mensaje exacto durante la implementacion.
