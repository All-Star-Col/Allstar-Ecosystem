<div align="center">
  <img src="assets/Logo Blanco.png" alt="ALL STAR COLOMBIA Logo" height="180">
</div>

## 1. Identificación del proyecto

>- **Nombre del proyecto:** Sistema de control de inventarios (PDA)
>- **Área Beneficiaria:** Producción e inventarios
>- **Responsable técnico:** Collin Andrey Sanchez, Juan David Beltran y Miguel Angel Cera
>- **Fecha de creación:** 20/01/2026
>- **Estado actual:** En producción activa — v3.5 (Build 16)

---

## 2. Resumen ejecutivo

El proyecto digitaliza el control de inventario físico de All Star Colombia. Antes de este sistema el proceso era completamente manual, sin trazabilidad dedicada y con tiempos de revisión prolongados, generando desorden y pérdidas. Hoy los operarios de bodega usan una PDA con lector de código de barras/QR para escanear, ubicar, despachar e ingresar productos en tiempo real.

---

## 3. Objetivo del proyecto

### 3.1 Objetivo principal

Digitalizar y centralizar el control del inventario de All Star Colombia para reducir pérdidas, aumentar la trazabilidad y eliminar el registro manual.

### 3.2 Objetivos secundarios

- Registrar cada movimiento de inventario con fecha, hora y operario.
- Reducir el tiempo de revisión de inventario.
- Proveer trazabilidad completa de despachos y devoluciones.

---

## 4. Alcance y límites

### 4.1 Qué incluye el sistema

| Funcionalidad | Descripción |
|--------------|-------------|
| **Consultar** | Busca un item en inventario y muestra sus datos y opciones. |
| **Ubicar** | Actualiza la ubicación (bodega/fila) de un item. Registra movimiento en log. |
| **Despachar** | Mueve un item a DESPACHADO con fecha, transportador y factura. Operación destructiva. |
| **Ingreso desde producción** | Agrega un item nuevo consultando SQL Server automáticamente. |
| **Devoluciones** | Reintegra items devueltos (conocidos o desconocidos) al inventario activo. |

### 4.2 Qué NO incluye el sistema

- Módulo de impresión de etiquetas (en diseño).
- Dashboard BI ni reportes automáticos.
- Información interna de producción (solo se consulta SQL Server de lectura).

### 4.3 Suposiciones clave

- Los operarios están capacitados y autorizados antes de usar la PDA.
- El despacho se registra únicamente cuando el producto ya está físicamente en el transporte.
- La red Tailscale (VPN) debe estar activa en la PDA para que la app funcione.

---

## 5. Estado del proyecto

| Versión | Estado | Descripción |
|---------|--------|-------------|
| v1.0 | Producción | Primera release funcional con Firebase |
| v2.0 | Producción | Auto-update vía Firebase App Distribution |
| v3.0 | Producción | Integración con Tailscale (detección automática de VPN) |
| v3.2 | Producción | Módulo de devoluciones (hoja DEVOLUCIONES) |
| **v3.3** | **Activa** | Refactoring MVVM completo, corrección de bugs críticos |

---

## 6. Arquitectura general del sistema

### 6.1 Descripción de alto nivel

```
┌─────────────────────────────────────────────────────────┐
│                 PDA / App Android                        │
│          Kotlin + Jetpack Compose (minSdk 24)           │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP sobre Tailscale VPN
                       │ Base URL: https://api-vm.tail6cef8e.ts.net
                       ▼
┌─────────────────────────────────────────────────────────┐
│               Backend API (FastAPI)                      │
│       Python — prefijo: /api/v1/sheets/inventory        │
└────────────────┬────────────────────┬───────────────────┘
                 │                    │
       Google Sheets API        SQL Server (interno)
       (inventario, despachado,  (catálogo de productos,
        devoluciones, logs)       telas, clientes, órdenes)
```

### 6.2 Componentes principales

| Componente | Tipo | Detalle |
|------------|------|---------|
| Dispositivo PDA | Hardware | Android 7.0+ con lector QR/barras |
| Aplicación Android | Software | Kotlin + Jetpack Compose (MVVM) |
| Backend API | Software | FastAPI (Python) |
| Tailscale | Software | VPN mesh WireGuard para conexión segura |
| Google Sheets | Software | Base de datos principal del inventario |
| SQL Server | Software | Catálogo interno de productos (solo lectura) |
| Firebase App Distribution | Software | Distribución y auto-actualización de APK |

### 6.3 Flujo general de información

| Fuente | Destino | Detalle |
|--------|---------|---------|
| PDA (escaneo) | App Android | Código de barras / QR del item |
| App Android | Backend API | Peticiones HTTP (GET/POST/PATCH) vía Tailscale |
| Backend API | Google Sheets | Lectura y escritura del inventario |
| Backend API | SQL Server | Consulta de datos de producción (solo lectura) |
| Backend API | App Android | Respuesta JSON con datos del item u opciones |

### 6.4 Diagramas

Documentación detallada de endpoints y modelos en `docs/CONTEXT.md`.
Arquitectura técnica completa en `docs/ARCHITECTURE.md`.

---

## 7. Entradas del sistema

| Entrada | Tipo | Fuente | Descripción |
|---------|------|--------|-------------|
| Código de item | Int/String | Escáner PDA o teclado táctil | Código numérico del producto |
| Selección de bodega | String | Dropdown en app | Bodega y fila de destino |
| Datos de despacho | String | Formulario en app | Transportador, remisión, factura |
| Selección de modo | Enum | Botones Ubicar/Despachar | Modo de operación elegido |

---

## 8. Procesamiento / lógica funcional

### Flujo lógico principal

1. Operario enciende la PDA y abre la app.
2. La app verifica conexión Tailscale cada 2 segundos (indicador verde/rojo).
3. Operario escanea o ingresa el código del item.
4. La app consulta el backend (`GET /get/{item}`) y obtiene datos + opciones.
5. Operario selecciona **Ubicar** o **Despachar**:
   - **Ubicar**: selecciona bodega/fila, confirma → `PATCH /location/{row}`.
   - **Despachar**: ingresa transportador/remisión/factura, confirma → `PATCH /dispatch/{row}`.
6. El backend escribe en Google Sheets y registra en el Log de auditoría.
7. La app muestra confirmación.

### Flujo de Ingreso desde producción

1. Operario ingresa código del item sin existencia en inventario.
2. Presiona "Traer de Producción" → `POST /new/{item}`.
3. El backend consulta SQL Server, inserta el item en INVENTARIO con ubicación por defecto.

### Flujo de Devoluciones

1. Operario presiona "Devolución → Inventario" (con o sin código escaneado).
2. Si hay código: busca el item en DEVOLUCIONES (`GET /return_product/get/{item}`).
3. Si no hay código: lista todos los "desconocidos" pendientes (`GET /return_product/get_unknows`).
4. Operario confirma → `POST /return_product/{item}` reintegra el item a INVENTARIO.

### Reglas de negocio

- El despacho se registra **únicamente** cuando el producto está físicamente en el transporte.
- Cada movimiento queda trazado con fecha, hora, tipo y email del servicio.
- El despacho es **irreversible**: elimina la fila de INVENTARIO físicamente.
- Si la bodega destino es externa (Tienda, Nihao), se requiere número de remisión.
- Solo operarios capacitados y autorizados deben operar la PDA.

### Manejo de errores

En caso de error en el registro de la base de datos, generar ticket a `Automation@allstarcol.com`.

---

## 9. Salidas del sistema

| Salida | Destino | Descripción |
|--------|---------|-------------|
| Actualización de ubicación | Google Sheets (INVENTARIO) | Columnas UBICACION y FILA actualizadas |
| Registro de despacho | Google Sheets (DESPACHADO) | Fila copiada con datos de despacho |
| Log de auditoría | Google Sheets (Logs) | Registro de cada movimiento con fecha/hora |
| Nuevo item | Google Sheets (INVENTARIO) | Item insertado desde producción |
| Reintegro de devolución | Google Sheets (INVENTARIO/DEVOLUCIONES) | Item movido de vuelta al inventario |

---

## 10. Módulos del sistema

### 10.1 App Android (Kotlin + Jetpack Compose)

- **MainActivity**: pantalla de escaneo, consulta, ingreso desde producción y devoluciones.
- **StockActivity**: formulario de ubicación y despacho.
- **MainViewModel**: lógica de negocio y estado de la pantalla principal (MVVM).
- **StockViewModel**: lógica de negocio y estado del formulario de stock (MVVM).
- **InventoryApi**: capa de acceso HTTP con las 7 funciones suspend.
- **ApiClient**: singleton OkHttpClient con BASE_URL centralizada.
- **Models**: `ItemInfo` y `ReturnedItem` (modelos de datos compartidos).

### 10.2 Backend API (FastAPI + Python)

Prefijo base: `/api/v1/sheets/inventory`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/get/{item}` | Consulta item en INVENTARIO |
| POST | `/new/{item}` | Agrega item nuevo desde producción (SQL Server) |
| PATCH | `/location/{row}` | Actualiza ubicación del item |
| PATCH | `/dispatch/{row}` | Despacha item (destructivo) |
| GET | `/return_product/get/{item}` | Busca item en DEVOLUCIONES |
| GET | `/return_product/get_unknows` | Lista desconocidos en DEVOLUCIONES |
| POST | `/return_product/{item}` | Reintegra item de DEVOLUCIONES a INVENTARIO |

### 10.3 Dependencias entre módulos

- La app depende del backend para todas las operaciones de inventario.
- El backend depende de Google Sheets (persistencia) y SQL Server (catálogo, solo lectura).
- La app requiere Tailscale activo para alcanzar el servidor.

---

## 11. Integraciones externas

| Sistema | Protocolo | Consideraciones |
|---------|-----------|-----------------|
| Tailscale | VPN WireGuard | La app bloquea operaciones si no hay VPN activa |
| Google Sheets | API REST (OAuth2) | Base de datos principal del inventario |
| SQL Server | Red LAN interna | Solo lectura para catálogo de productos |
| Firebase App Distribution | HTTPS | Distribución de APK y auto-actualización |

---

## 12. Herramientas y tecnologías

#### Lenguajes de programación

- Kotlin (app Android)
- Python (backend FastAPI)

#### Frameworks y librerías

| Librería | Uso |
|----------|-----|
| Jetpack Compose + Material3 | UI declarativa Android |
| OkHttp 4.12 | Cliente HTTP para llamadas API |
| AndroidX Lifecycle (ViewModel) | Arquitectura MVVM |
| Firebase App Distribution | Auto-actualización de APK |
| Firebase Analytics | Analítica básica |
| FastAPI (Python) | Backend API REST |

#### Servicios externos

- Tailscale (VPN mesh)
- Google Sheets API
- Firebase (App Distribution + Analytics)

#### Plataformas y herramientas

- Android Studio (desarrollo Android)
- Visual Studio Code (desarrollo backend)
- Google Sheets (base de datos principal)

---

## 13. Requerimientos de software

- **App Android**: Android 7.0+ (API 24), Tailscale instalado en la PDA.
- **Backend**: Python 3.10+, FastAPI, cliente Google Sheets API, pyodbc (SQL Server).
- **Distribución**: Firebase App Distribution (testers autorizados).
- **Red**: Tailscale activo en PDA y servidor para comunicación interna.

---

## 14. Requerimientos de hardware

- **PDA**: dispositivo Android 7.0+ con lector de código de barras o QR, Wi-Fi.
- **Servidor**: máquina con acceso a red interna (LAN) y conectada a Tailscale.
- **Restricciones físicas**: uso en planta/bodega, se recomienda protección contra golpes/polvo.

---

## 15. Instalación y configuración

1. **Backend**: desplegar servidor FastAPI con credenciales de Google Sheets y SQL Server.
2. **Tailscale**: configurar nodo Tailscale en el servidor (`100.89.244.92`).
3. **App Android**: distribuir APK vía Firebase App Distribution a testers autorizados.
4. **PDA**: instalar Tailscale, unirse a la red del servidor, instalar la APK.
5. **Validación**: consultar un item, ubicar, despachar y verificar el registro en Sheets.

---

## 16. Uso operativo

- **Flujo normal**: encender PDA → verificar VPN (indicador verde) → escanear item → seleccionar operación → confirmar.
- **Sin VPN**: la app muestra indicador rojo y bloquea las operaciones.
- **Errores frecuentes**: item no encontrado (404), item ya existente (409), timeout de red → reintentar o verificar conexión Tailscale.

---

## 17. Seguridad y control

- Todo el tráfico va cifrado sobre Tailscale (WireGuard), nunca expuesto a internet.
- Solo testers autorizados en Firebase App Distribution pueden instalar la app.
- Los despachos son irreversibles y quedan trazados con fecha, hora y email del servicio.
- Los errores de registro se escalan vía ticket a `Automation@allstarcol.com`.

---

## 18. Mantenimiento y soporte

- **Actualizaciones**: la app verifica automáticamente nuevas versiones al iniciar (Firebase App Distribution).
- **Puntos críticos**: conectividad Tailscale, estado del servidor FastAPI, cuota de Google Sheets API.
- **Ante fallos**: generar ticket a `Automation@allstarcol.com` con descripción del error y código de item afectado.

---

## 19. Escalabilidad y evolución

- **Pendiente**: módulo de impresión de etiquetas (en diseño).
- **Posibles mejoras**: dashboard BI, reportes automáticos, alertas en tiempo real, modo offline.
- **Límites actuales**: dependencia de conectividad Tailscale y de la API de Google Sheets.

---

## 20. Versionado y cambios

- **Convención**: `MAJOR.MINOR.PATCH` (SemVer) en rama `main` con formato `V:x.x.x | descripción`.
- **Convención en ramas**: `tipo(scope): descripcion` (feat, fix, refactor, docs, ci, chore).

| Versión | Cambio principal |
|---------|-----------------|
| v1.0 | Primera release funcional con Firebase |
| v2.0 | Auto-update vía Firebase App Distribution |
| v3.0 | Integración con Tailscale (detección automática) |
| v3.2 | Módulo de devoluciones (hoja DEVOLUCIONES) |
| v3.3 | Refactoring MVVM completo, separación de capas, corrección de bugs críticos |

---

## 21. Roadmap

- **Fase actual (v3.x)**: estabilización, refactoring MVVM, corrección de bugs.
- **Fase 4**: módulo de impresión de etiquetas desde PDA.
- **Fase 5**: reportes automáticos y panel de control (dashboard BI).
- **Fase 6**: integración con ERP y auditoría avanzada.

---

## 22. Documentación relacionada

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Estructura técnica detallada del sistema.
- [CONTEXT.md](docs/CONTEXT.md) — Contrato completo de la API backend (endpoints, modelos, errores).
- [GIT.md](docs/GIT.md) — Convenciones de ramas y commits del repositorio.
- [TASKS.md](docs/TASKS.md) — Tareas activas y sprints del proyecto.

---

## 23. Autores y contacto

- Collin Andrey Sanchez — Responsable técnico.
- Juan David Beltran — Responsable técnico.
- Miguel Angel Cera - Responsable técnico.
- Contacto interno: `Automation@allstarcol.com`

---

## 24. Licencia y uso interno

Uso interno exclusivo de All Star Colombia.
No se permite distribución externa sin aprobación.

---

## 25. Observaciones finales

El sistema está en producción activa desde v1.0. La arquitectura fue migrada a MVVM en v3.3 para mejorar mantenibilidad y testabilidad. Cualquier ajuste a los endpoints debe reflejarse en `docs/CONTEXT.md` antes de modificar el código de la app.
