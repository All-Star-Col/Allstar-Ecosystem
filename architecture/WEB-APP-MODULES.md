# WEB-APP MODULES

Objetivo: guia practica para crear/registrar modulos en `applications/web-app` segun el estado observable del repo (2026-04-22).

## 1) Registro de modulos hoy

Flujo real:
1. Se define un modulo en `src/apps/<modulo>/module.config.ts`.
2. Se registra en `src/core/modules.ts` (`export const modules`).
3. `src/core/AppRoutes.tsx` crea rutas con `path={`${module.path}/*`}`.
4. Cada modulo exporta un `App.tsx` con sus rutas internas.

## Modulos registrados actualmente

- `forms` -> `/app/forms`
- `Products` -> `/app/products`
- `data-viewer` -> `/app/data-viewer`
- `carpentry` -> `/app/carpentry`

Referencia:
- `applications/web-app/src/core/modules.ts`

## 2) Estructura minima de un modulo nuevo

Ruta base:
- `applications/web-app/src/apps/<nuevo-modulo>/`

Minimo requerido:
- `App.tsx`
- `module.config.ts`

Opcional (segun complejidad):
- `pages/`
- `components/`
- `api.ts`
- `types.ts`
- `store.ts`
- `*.spec.ts(x)`

## 3) Plantilla minima

## `App.tsx`

```tsx
import { Route, Routes } from "react-router-dom";

function HomePage() {
  return <div className="p-4">Nuevo modulo</div>;
}

export default function NewModuleApp() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
    </Routes>
  );
}
```

## `module.config.ts`

```tsx
import { lazy } from "react";
import type { AppModule } from "@/core/types";

export const NewModule: AppModule = {
  name: "new-module",
  title: "New Module",
  path: "/app/new-module",
  icon: "box",
  component: lazy(() => import("./App")),
};
```

## 4) Registro en `modules.ts`

Editar `applications/web-app/src/core/modules.ts`:
1. Importar el modulo.
2. Agregarlo al array `modules`.

Ejemplo:

```ts
import { NewModule } from "@/apps/new-module/module.config";

export const modules: AppModule[] = [
  FormsModule,
  ProductsModule,
  DataViewerModule,
  CarpentryModule,
  NewModule,
];
```

## 5) Relacion con Dashboard

Punto clave:
- El dashboard no se alimenta desde `modules.ts`.
- `Dashboard.tsx` consulta `GET ${API_SERVER}/workspace` y renderiza `workspaceData.apps`.

Implicacion:
1. Registrar modulo en `modules.ts` habilita la ruta frontend.
2. Para que aparezca en Dashboard, backend debe devolver ese app en `/workspace`.
3. El `app.path` de backend debe coincidir con `module.path` del frontend.

## 6) Configuracion API

- La web usa `API_SERVER = import.meta.env.VITE_API_SERVER`.
- Las llamadas agregan rutas como `/workspace`, `/workspace/forms/*`, `/workspace/data-viewer/*`.

`TBD` operativo:
- El valor exacto de `VITE_API_SERVER` depende del entorno; debe ser consistente con el prefijo real de la API desplegada.

## 7) Checklist rapido

- [ ] Crear `src/apps/<nuevo-modulo>/App.tsx`.
- [ ] Crear `src/apps/<nuevo-modulo>/module.config.ts`.
- [ ] Registrar modulo en `src/core/modules.ts`.
- [ ] Confirmar `path` unico y bajo `/app/...`.
- [ ] Probar navegacion directa a la ruta.
- [ ] Si debe verse en dashboard, confirmar app/path en respuesta de `/workspace`.

## 8) Errores comunes

- Crear carpeta del modulo pero olvidar registro en `modules.ts`.
- `module.path` distinto al path enviado por backend en `/workspace`.
- Reutilizar `path` o `name` de otro modulo.
- Configurar mal `VITE_API_SERVER` y romper consumo de API.
