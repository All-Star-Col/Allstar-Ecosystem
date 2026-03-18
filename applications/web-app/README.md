# allstar-platform

Frontend del sistema de gestion integral (ERP) para Allstar, construido con React, TypeScript y Vite.

## Ejecucion local

1. Instala dependencias:

```bash
npm install
```

2. Crea el archivo de variables locales manualmente:

```bash
printf 'VITE_API_SERVER=http://localhost:8000\n' > .env.development
```

3. Ajusta `VITE_API_SERVER` en `.env.development` si tu API local corre en otro host/puerto.

4. Inicia el entorno de desarrollo:

```bash
npm run dev
```
