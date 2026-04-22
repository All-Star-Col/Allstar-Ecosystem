# Domains

## OVERVIEW
`domains/` contiene documentacion por bounded context del ecosistema Allstar.

Cada carpeta de dominio debe mantener exactamente este set de 5 archivos:

- `domain.md`
- `data-model.md`
- `api-contract.md`
- `frontend-behavior.md`
- `PRD.md`

## WHERE TO LOOK
| Dominio | Carpeta | Fuentes de evidencia recomendadas |
|---|---|---|
| Authentication & Access | `authentication-access/` | `services/api-service/src/api/v1/routes/login`, `register`, `workspace`, `users`; `applications/web-app/src/system/login`, `src/core/auth`, `src/system/profile` |
| Operational Workspace | `operational-workspace/` | `services/api-service/src/api/v1/routes/workspace/*`, `services/api-service/src/services/forms.py`, `data_viewer.py`, `carpentry/*`; `applications/web-app/src/system/dashboard`, `src/apps/forms`, `src/apps/data-viewer`, `src/apps/carpentry` |
| Inventory | `inventory/` | `services/api-service/src/api/v1/routes/sheets/inventory`, `services/api-service/src/services/sheets.py` |
| Production | `production/` | `services/api-service/src/api/v1/routes/sheets/sheets.py`, `src/core/scheduler.py`, `services/carpentry/produccion.py`; `applications/web-app/src/apps/products`, `src/apps/carpentry/pages/ProduccionPage.jsx` |

## CONVENTIONS
- Documenta solo comportamiento observable en archivos inspeccionados.
- Cuando no haya evidencia suficiente, usa `TBD` en lugar de suposiciones.
- Conserva el contexto local del dominio y enlaza a rutas reales del repo cuando sea util.
- Evita duplicar especificaciones completas entre dominios; referencia documentos hermanos cuando aplique.
- Manten el texto orientado a estado actual del repositorio, no a arquitectura futura.

## ANTI-PATTERNS
- No inventar tablas, endpoints, payloads o workflows no inspeccionados.
- No mezclar detalles de despliegue/infra en docs de dominio.
- No romper el patron de 5 archivos por dominio.
- No mover contenido entre dominios solo por organizacion estetica.
