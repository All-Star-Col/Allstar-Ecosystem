# Authentication & Access PRD (Observed Scope)

## Problema que resuelve
Permitir acceso controlado al ecosistema Allstar, diferenciando usuarios autenticados y privilegios administrativos.

## Usuarios
- Usuario operativo autenticado.
- Usuario administrador (`role_code = ADMIN`).

## Capacidades implementadas hoy
- Inicio de sesion con usuario/contrasena.
- Registro de usuario.
- Resolucion de apps habilitadas por rol.
- Guardas frontend para proteger rutas privadas.
- Administracion basica de usuarios para admins (listar/crear/editar/borrado soft/hard).

## Flujos principales
1. Login exitoso -> token -> acceso dashboard.
2. Token invalido/inexistente -> redireccion a login.
3. Admin entra a perfil -> gestiona usuarios.
4. No admin intenta perfil -> redireccion a dashboard.

## Criterios observables de exito
- API devuelve token valido en login/register.
- `GET /workspace` devuelve `apps` y metadatos de rol.
- Rutas privadas quedan bloqueadas sin token.
- Endpoints de usuarios solo operan cuando `require_admin` devuelve usuario.

## Fuera de alcance actual
- Recuperacion de contrasena.
- MFA.
- Revocacion/rotacion de tokens.
- SSO corporativo.

## TBD
- Politica de onboarding inicial (quien asigna rol al usuario nuevo).
- Requisitos de auditoria y trazabilidad de cambios de usuario.
- Requisitos no funcionales de seguridad (tiempo de expiracion por tipo de sesion, bloqueo por intentos, etc.).
