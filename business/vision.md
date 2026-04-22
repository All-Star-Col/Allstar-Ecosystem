# Allstar Platform Vision

Scope note: esta vision esta redactada con base en el estado observable del repositorio actual. Cuando no existe evidencia suficiente, se marca `TBD`.

## Vision

Consolidar una plataforma interna modular que permita a los equipos de Allstar ejecutar operaciones diarias desde un workspace autenticado, con acceso por rol e integraciones confiables hacia los sistemas de datos que la operacion ya utiliza.

## Direccion funcional observable

1. Punto unico de acceso para empleados
- El flujo inicia en autenticacion (`/login`) y continua en `dashboard` con apps habilitadas por rol.

2. Experiencia modular en lugar de herramientas aisladas
- El frontend integra modulos bajo una misma experiencia (`/app/forms`, `/app/products`, `/app/data-viewer`, `/app/carpentry`).

3. Integracion de sistemas sin duplicar operacion
- El backend orquesta PostgreSQL, SQL Server y Google Sheets para habilitar procesos existentes sin requerir reemplazo total inmediato.

4. Gobierno de acceso desde backend
- Los permisos se resuelven por rol y se reflejan en la composicion del workspace retornado al cliente.

5. Operacion preparada para entorno interno
- Secrets gestionados via Bitwarden.
- Despliegue de API automatizado con GitHub Actions + Docker + Tailscale SSH.

## Principios de evolucion recomendados (alineados al estado actual)

- Observabilidad primero: toda nueva capacidad debe quedar trazable en codigo/docs y en flujo de despliegue.
- Contratos explicitos: cada modulo debe exponer endpoints y modelos versionables.
- Seguridad por defecto: mantener autenticacion JWT y control por rol como base minima.
- Interoperabilidad gradual: evolucionar integraciones externas sin romper la operacion vigente.

## TBD

- Meta temporal oficial (roadmap anual/trimestral) para evolucion de la plataforma.
- Definicion formal de "exito" por dominio (inventario, produccion, acceso, etc.).
- Alcance futuro de cliente movil y su relacion con el web app.
- Objetivos de rendimiento/SLA publicados para frontend y API.
