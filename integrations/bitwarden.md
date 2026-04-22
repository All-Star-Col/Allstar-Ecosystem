# Integracion Bitwarden (Observed)

Este documento describe la integracion observable entre `services/api-service` y Bitwarden para carga de secretos en runtime.

Nota de alcance: se documenta solo lo visible en el repo hoy. Lo no verificable se marca como `TBD`.

## Donde vive

- Configuracion y carga de secretos: `services/api-service/src/core/config.py`
- Uso de settings cargados: `services/api-service/src/db/database.py`, `services/api-service/src/core/auth.py`, `services/api-service/src/services/sheets.py`

## Contrato de runtime

- Variable obligatoria en entorno: `BW_ACCESS_TOKEN`.
- Si `BW_ACCESS_TOKEN` no existe, `Settings.load_secrets_from_bw()` lanza error y la API no inicia.
- `settings = Settings()` se ejecuta en import de `config.py`, asi que la carga ocurre durante bootstrap de la app.

## Flujo de carga de secretos (observado)

1. `Settings` define IDs de secretos Bitwarden (`ID_*`) como UUID.
2. `Settings.__init__()` llama `load_secrets_from_bw()`.
3. `load_secrets_from_bw()`:
   - Normaliza `ENVIRONMENT` a `dev` o `prod` (default: `prod`).
   - Crea `BitwardenClient` con:
     - `identity_url="https://identity.bitwarden.com"`
     - `api_url="https://api.bitwarden.com"`
   - Autentica con `client.auth().login_access_token(BW_ACCESS_TOKEN)`.
   - Resuelve el ID de Postgres segun entorno:
     - `dev` -> `ID_POSTGRES_URL_DATABASE_DEV`
     - `prod` -> `ID_POSTGRES_URL_DATABASE_PROD`
   - Descarga secretos con `client.secrets().get(secret_id)` y setea valores en `Settings`.

## Secretos consumidos desde Bitwarden

Se cargan estos valores:

- `ALGORITHM`
- `POSTGRES_URL_DATABASE`
- `SECRET_KEY`
- `SQLSERVER_URL_DATABASE`
- `SHEETS_INVENTARIO_ALLSTAR`
- `GOOGLE_CREDENTIALS_JSON`

## Configuracion local observada

- Se ejecuta `load_dotenv("keys.dev.env", override=False)`.
- `Settings.Config.env_file` tambien apunta a `keys.dev.env`.
- Si `ENVIRONMENT=dev` y `ID_POSTGRES_URL_DATABASE_DEV` es placeholder/invalido, se lanza error explicito.

## Riesgos y notas observadas

- Los IDs `ID_*` vienen hardcodeados en `config.py`; el valor real queda fuera del repo (Bitwarden).
- Errores en autenticacion Bitwarden o secretos faltantes detienen el proceso al inicio.

## TBD

- Estructura del vault/organizacion en Bitwarden.
- Proceso operativo de rotacion de IDs y secretos.
- Politica de provision de `BW_ACCESS_TOKEN` para desarrollo y CI/CD.
