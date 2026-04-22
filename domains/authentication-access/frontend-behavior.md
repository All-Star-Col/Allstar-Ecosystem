# Authentication & Access Frontend Behavior (Observed)

## Flujo de login
1. Usuario ingresa correo/contrasena en `LoginCard`.
2. Frontend envia `POST {API_SERVER}/login` con `application/x-www-form-urlencoded`.
3. Si 200, guarda `access_token` en:
   - `localStorage` cuando "Recordar sesion" esta activo.
   - `sessionStorage` en caso contrario.
4. Redirige a `/dashboard`.

Evidencia:
- `applications/web-app/src/system/login/components/LoginCard.tsx`

## Guardas de ruta
- `RequireGuest`: evita que usuarios autenticados vuelvan a login.
- `RequireAuth`:
  - Verifica token local.
  - Llama `GET {API_SERVER}/workspace` para validar sesion.
  - Si `401/403`, limpia token y redirige a `/login`.

Evidencia:
- `applications/web-app/src/core/auth/RequireAuth.tsx`
- `applications/web-app/src/core/auth/auth.service.ts`

## Perfil administrativo
- Ruta: `/dashboard/profile`.
- Bootstrapping:
  - Consulta `/workspace`.
  - Si `is_admin` es falso, redirige a `/dashboard`.
- Si admin:
  - Lista usuarios con `/workspace/users/`.
  - Crea/edita usuarios via `/workspace/users`.

Evidencia:
- `applications/web-app/src/system/profile/Profile.tsx`
- `applications/web-app/src/system/profile/profile.api.ts`

## Senales UX observadas
- Link "Olvidaste tu contrasena" apunta a `/404` (no hay flujo funcional visible).
- Errores backend se muestran inline en login.

## TBD
- Flujo frontend para recovery de cuenta.
- Manejo de expiracion silenciosa/renovacion de token.
- Politica de cierre de sesion remoto en multiples dispositivos.
