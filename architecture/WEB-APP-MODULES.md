# WEB-APP-MODULES.md

## Objetivo
Guía para agregar una nueva aplicacion/modulo en `applications/web-app` de forma consistente con la arquitectura actual.

Fecha de referencia (estado observado): 2026-04-08.

---

## 1. Como funciona hoy el registro de modulos

1. Los modulos frontend se definen en `src/apps/<modulo>/module.config.ts`.
2. Todos se registran en `src/core/modules.ts` (array `modules`).
3. `src/core/AppRoutes.tsx` recorre `modules` y crea rutas con:
   `path={`${module.path}/*`}` y `element={<module.component />}`.
4. Cada modulo expone un `App.tsx` como entrypoint (puede tener sub-rutas internas o una sola vista).

Conclusión:
- Sí, agregar un modulo es relativamente simple.
- Pero no es solo crear carpeta: hay que registrar `module.config` en `modules.ts` y validar ruta.

---

## 2. Estructura recomendada de un modulo nuevo

Ruta base:
`applications/web-app/src/apps/<nuevo-modulo>/`

Archivos minimos obligatorios:
- `App.tsx`
- `module.config.ts`

Carpetas/archivos opcionales (segun complejidad):
- `pages/`
- `components/`
- `api.ts`
- `types.ts`
- `store.ts`
- `*.spec.ts` (tests)

---

## 3. Plantilla minima

## 3.1 `App.tsx`

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

## 3.2 `module.config.ts`

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

---

## 4. Registro en `modules.ts`

Editar:
`applications/web-app/src/core/modules.ts`

1. Importar el config nuevo.
2. Agregarlo al array `modules`.

Ejemplo:

```ts
import { NewModule } from "@/apps/new-module/module.config";

export const modules: AppModule[] = [
  FormsModule,
  ProductsModule,
  DataViewerModule,
  NewModule,
];
```

---

## 5. Composicion interna recomendada

Si es modulo pequeño:
- `App.tsx` + `module.config.ts` + 1 o 2 componentes.

Si es modulo mediano/grande:
- `pages/` para vistas principales.
- `components/` para piezas de UI.
- `api.ts` para llamadas HTTP.
- `types.ts` para contratos tipados.
- `store.ts` si requiere estado compartido.
- `*.spec.ts` para pruebas.

Patron observado en modulos actuales:
- `forms` y `products` usan `Routes` internas.
- `data-viewer` usa una vista principal sin sub-rutas.

---

## 6. Paso clave que suele confundirse: Dashboard

El Dashboard NO se alimenta de `modules.ts`.

`Dashboard.tsx` consume `GET /workspace` (backend) y pinta `workspaceData.apps`.
Cada tile navega usando `app.path`.

Esto implica:
1. Registrar en `modules.ts` habilita la ruta frontend.
2. Para que aparezca en Dashboard, el backend debe devolver ese app en `/workspace`.
3. El `path` que devuelva backend debe coincidir con tu `module.path`.

Si no aparece en Dashboard pero la ruta existe, revisa configuración de apps/roles en backend.

---

## 7. Checklist rapido para crear un modulo

- [ ] Crear `src/apps/<nuevo-modulo>/App.tsx`.
- [ ] Crear `src/apps/<nuevo-modulo>/module.config.ts`.
- [ ] Agregar import y registro en `src/core/modules.ts`.
- [ ] Usar `path` unico y con prefijo `/app/...`.
- [ ] Verificar que no colisione con rutas existentes.
- [ ] Si debe salir en Dashboard, confirmar app/path en respuesta de `/workspace`.
- [ ] Ejecutar `npm run dev` y probar ruta directa.

---

## 8. Errores comunes

- Definir `path` sin `/app/` y romper navegación.
- Registrar módulo en carpeta pero olvidar `modules.ts`.
- Poner un `module.path` distinto al `path` que entrega backend en dashboard.
- Repetir `name` o `path` de otro módulo.

---

## 9. Estado observable actual de modulos

Modulos registrados hoy:
- `forms` -> `/app/forms`
- `products` -> `/app/products`
- `data-viewer` -> `/app/data-viewer`

Archivos de referencia:
- `applications/web-app/src/core/modules.ts`
- `applications/web-app/src/core/AppRoutes.tsx`
- `applications/web-app/src/apps/forms/module.config.ts`
- `applications/web-app/src/apps/products/module.config.ts`
- `applications/web-app/src/apps/data-viewer/module.config.ts`

