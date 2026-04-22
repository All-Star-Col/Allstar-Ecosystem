# Authentication & Access Domain

Scope note: este documento describe solo comportamiento observable en el repositorio actual.

## Objetivo del dominio
Gestionar autenticacion, resolucion de identidad y autorizacion de acceso a funcionalidades del workspace.

## Responsabilidades observadas
- Emitir JWT con credenciales usuario/contrasena (`POST /api/v1/login`).
- Crear usuario y emitir JWT (`POST /api/v1/register`).
- Resolver sesion autenticada y aplicaciones habilitadas por rol (`GET /api/v1/workspace`).
- Restringir endpoints administrativos de usuarios a rol `ADMIN` (via `require_admin`).
- Mantener guardas de sesion en frontend (`RequireAuth`, `RequireGuest`).

## Componentes observados
- Backend:
  - `services/api-service/src/api/v1/routes/login/login.py`
  - `services/api-service/src/api/v1/routes/register/register.py`
  - `services/api-service/src/api/v1/routes/workspace/workspace.py`
  - `services/api-service/src/api/deps.py`
  - `services/api-service/src/core/auth.py`
  - `services/api-service/src/services/users.py`
  - `services/api-service/src/services/roles.py`
  - `services/api-service/src/services/apps.py`
- Frontend:
  - `applications/web-app/src/system/login/components/LoginCard.tsx`
  - `applications/web-app/src/core/auth/auth.service.ts`
  - `applications/web-app/src/core/auth/RequireAuth.tsx`
  - `applications/web-app/src/system/profile/Profile.tsx`

## Limites del dominio
- El dominio no implementa flujo de refresh token.
- El dominio no expone logout server-side; el frontend limpia token localmente.
- La gestion funcional de modulos del workspace se documenta en `domains/operational-workspace/`.

## TBD
- Politica de recuperacion de contrasena y verificacion de correo.
- Regla de asignacion de roles al registrar usuarios.
- Estrategia de revocacion de tokens activos.
