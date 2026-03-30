# Reporte de mejora técnica — API Service (FastAPI)

Fecha: 2026-03-30  
Alcance analizado: estructura completa de `services/api-service` (código en `src/`, pruebas en `tests/`, configuración Docker, documentación local y archivos raíz).

---

## 1) Resumen ejecutivo (claro y directo)

La API tiene una **base sólida por capas** (routes → services → db/core/schemas), pero hoy el principal riesgo está en la **mantenibilidad y confiabilidad** de algunos módulos grandes y en varios comportamientos inconsistentes.

### Prioridades recomendadas
- **P0 (urgente):** corregir inconsistencias funcionales detectadas en `services/users.py`, `services/sheets.py` y scheduler.
- **P1 (alto impacto):** reducir tamaño/acoplamiento de módulos grandes (`data_viewer.py`, `sheets.py`, `schemas/models.py`).
- **P2 (calidad):** fortalecer pruebas, seguridad de endpoints sensibles y limpieza de documentación/configuración.

---

## 2) Qué está bien (mantener)

1. **Arquitectura por capas** clara (`src/api`, `src/services`, `src/core`, `src/db`, `src/schemas`).
2. **Validación robusta en Data Viewer** con Pydantic + allowlist de tablas/columnas.
3. **Logging estructurado** y utilidades compartidas (`src/core/logging_config.py`, `src/api/v1/common/http_helpers.py`).
4. **Uso de ETag** para respuestas de catálogos (`src/services/shared.py`).
5. **Separación de errores de dominio** (ej. `DataViewerError`, `IdentifierValidationError`).

> Para un junior: aquí ya existe un “buen esqueleto”. La mejora no es rehacer todo, sino **ordenar y estabilizar** lo que ya funciona.

---

## 3) Hallazgos principales por prioridad

## P0 — Urgente (riesgo de errores reales en producción)

### 3.1 Inconsistencia en sincronización de Sheets
- **Evidencia:** `src/services/sheets.py` usa `self.SHEET_NAME_ACCES` (atributo no definido).
- **Validación:** `lsp_diagnostics` reporta 3 errores de atributo desconocido.
- **Impacto:** fallas en `compare_coditems_sync` durante lectura/actualización de la hoja objetivo.
- **Mejora:** definir una constante única para nombre de hoja de sincronización (y reutilizarla en todos los puntos).

### 3.2 `services/users.py` con lógica de actualización/eliminación inconsistente
- **Evidencia:**
  - `update_user` construye SQL dinámico frágil (alto riesgo de query mal formada).
  - `delete_user` (rama `hard`) no ejecuta un `DELETE` real.
  - `delete_user` (rama `soft`) usa parámetro diferente al placeholder SQL.
  - `require_admin` (en `src/api/deps.py`) devuelve `None` en lugar de 403 explícito.
- **Impacto:** rutas de administración pueden responder silenciosamente con `null` o no aplicar cambios esperados.
- **Mejora:** endurecer contrato de admin (403 explícito), unificar SQL y parámetros, y validar actualización parcial de forma segura.

### 3.3 Scheduler con intención vs implementación desalineada
- **Evidencia:** `src/core/scheduler.py` programa cada `240` minutos, pero comentarios/logs hablan de “cada 10 minutos”.
- **Impacto:** operación y soporte se confunden; se incumple expectativa funcional.
- **Mejora:** unificar valor real + mensaje/documentación en una sola fuente de verdad.

---

## P1 — Alto impacto (mantenibilidad y velocidad de evolución)

### 3.4 Módulos demasiado grandes (complejidad acumulada)
- **Evidencia (líneas por archivo):**
  - `src/services/data_viewer.py` → **1152**
  - `src/services/sheets.py` → **964**
  - `src/schemas/models.py` → **378**
  - `src/api/v1/routes/workspace/data_viewer/data_viewer.py` → **367**
- **Impacto:** onboarding lento, más riesgo al tocar cambios pequeños, tests más difíciles.
- **Mejora:** dividir por responsabilidad (queries, metadata, export, patch; y en Sheets por casos de uso).

### 3.5 Manejo de excepciones demasiado genérico
- **Evidencia:** múltiples `except Exception` en `forms.py`, `data_viewer.py`, `sheets.py`, `scheduler.py`, rutas Data Viewer.
- **Impacto:** se pierde contexto de errores específicos y se complica depuración.
- **Mejora:** capturar excepciones concretas por capa (infra, validación, dominio) y estandarizar mapeo HTTP.

### 3.6 Endpoints de inventario/sync sin protección de acceso fuerte
- **Evidencia:** rutas de `src/api/v1/routes/sheets/*` no exigen auth.
- **Impacto:** potencial ejecución no autorizada de operaciones sensibles.
- **Mejora:** proteger trigger y operaciones de inventario con JWT/API key/allowlist de red según contexto operativo.

---

## P2 — Calidad y sostenibilidad

### 3.7 Cobertura de pruebas limitada
- **Evidencia:** 3 tests activos, concentrados en forms y docker paths.
- **Falta cubrir:** `data_viewer`, `sheets`, `users`, `auth`, control de permisos admin.
- **Impacto:** regresiones pasan sin detección temprana.
- **Mejora:** estrategia incremental de pruebas por riesgo (primero P0/P1).

### 3.8 Documentación y estructura con “drift”
- **Evidencia:**
  - `src/README.md` casi vacío.
  - documentación referencia `scripts/ensure_module_loggers.py`, pero carpeta `scripts/` no está presente en el árbol actual.
  - `docs/brief.md` y `docs/plan.md` siguen marcando decisiones abiertas ya parcialmente implementadas.
- **Impacto:** confusión para onboarding y soporte.
- **Mejora:** actualizar docs de estado real (qué está vigente, qué quedó pendiente, qué no aplica).

### 3.9 Configuración sensible acoplada al código
- **Evidencia:** IDs de secretos Bitwarden definidos dentro de `src/core/config.py`.
- **Impacto:** menos flexibilidad entre entornos y más fricción para rotación/operación.
- **Mejora:** mover identificadores de secreto a variables de entorno (manteniendo Bitwarden como fuente).

---

## 4) Evaluación por carpetas (rápida y accionable)

| Carpeta/Archivo | Estado | Mejora concreta |
|---|---|---|
| `src/api/v1/routes/` | Buena separación por dominio | Unificar respuestas de errores y política auth en rutas `sheets/*` |
| `src/services/` | Capa de negocio existente y útil | Partir `data_viewer.py` y `sheets.py`; corregir inconsistencias en `users.py` |
| `src/core/` | Config y logging bien centralizados | Alinear scheduler con documentación; desacoplar IDs sensibles |
| `src/db/` | Sesión async clara | Evaluar configuración de pool y timeouts explícitos |
| `src/schemas/` | Validaciones fuertes | Separar modelos por dominio para reducir archivo monolítico |
| `tests/` | Hay base de pruebas | Expandir cobertura a rutas/servicios críticos |
| `docs/` + raíz | Información útil pero desactualizada en partes | Limpiar documentos y dejar estado “actual” verificable |

---

## 5) Plan recomendado en 3 fases (para ejecutar sin caos)

## Fase 1 (rápida, 1–2 días)
1. Corregir P0 de `users.py`, `sheets.py`, scheduler.
2. Definir política de autorización mínima para `sheets/*`.
3. Agregar tests de regresión de esos puntos críticos.

## Fase 2 (corto plazo, 3–5 días)
1. Refactor de `data_viewer.py` y `sheets.py` por módulos internos.
2. Reducir `except Exception` en caminos críticos.
3. Estándar único de errores/HTTP codes.

## Fase 3 (mejora continua)
1. Reorganizar `schemas/models.py` por dominio.
2. Actualizar documentación técnica “as-is”.
3. Definir baseline de calidad (tests + type checks + linters en CI).

---

## 6) Guía simple para programador junior (cómo priorizar)

Si eres junior, enfócate así:

1. **Primero que no se rompa:** arregla errores claros de lógica/config (P0).
2. **Luego que se entienda mejor:** divide archivos gigantes por responsabilidades.
3. **Después que sea confiable:** agrega pruebas en lo que más se usa y más duele cuando falla.

Regla práctica: **si un cambio toca auth, sync o SQL dinámico, siempre debe venir con test.**

---

## 7) Evidencia de validación usada en este análisis

- Revisión estructural completa de carpetas y archivos en `services/api-service`.
- Lectura de módulos clave (`main`, `core`, `db`, `routes`, `services`, `schemas`, `tests`, `docs`).
- Conteo de tamaño de archivos Python (hotspots de complejidad).
- Diagnóstico estático (`lsp_diagnostics`): 4 hallazgos (3 en `sheets.py`, 1 import no resuelto de APScheduler en entorno de análisis).
- Compilación sintáctica (`python -m compileall src tests`): completada.
- Ejecución de tests no disponible en este entorno por dependencia faltante (`pytest` no instalado globalmente).

---

## Cierre

La API **sí tiene una base profesional**, pero requiere una ronda de estabilización enfocada. Si se ejecutan primero los P0 y luego la división de módulos grandes, el proyecto gana rápidamente en confiabilidad, velocidad de desarrollo y facilidad de mantenimiento para todo el equipo.
