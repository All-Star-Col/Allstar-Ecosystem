# Merge Review Report — API-SERVICES `src` → Allstar `api-service/src`

## Compared paths

- **Source:** `/home/automation/Escritorio/PROYECTOS/API-SERVICES/src`
- **Destination:** `/home/automation/Escritorio/PROYECTOS/Allstar-Ecosystem/services/api-service/src`

## Correction note (important)

An earlier analysis incorrectly reported **5 source-only files**.

The corrected/authoritative comparison:

- Used **relative file paths from the `src/` root only**.
- **Excluded directories** from file counts.
- **Excluded `__pycache__` content** from file-level comparison.

Authoritative result:

- **source-only:** 0
- **destination-only:** 1
- **identical:** 30
- **differing:** 14

## Summary

- Source-only files: **0**
- Destination-only files: **1**
- Common files: **44**
- Identical files: **30**
- Differing files: **14**

## Destination-only files

- `README.md`

## Differing files (merge mode + compact diff excerpt)

### 1) `api/deps.py`
- **Merge mode:** Clean copy from source

```diff
@@ -40,5 +40,4 @@
     current_user: User = Depends(get_current_user),
     db: AsyncSession = Depends(get_db)
 ) -> list[App]:
-    # Ahora sí, pasamos el ID correctamente
     return await get_user_apps_from_db(db, str(current_user.id))
```

### 2) `api/v1/routes/sheets/inventory/inventory.py`
- **Merge mode:** Manual merge required

```diff
@@ -1,156 +1,74 @@
-from fastapi import APIRouter, HTTPException, Depends, Query
-from typing import List, Optional
+from fastapi import APIRouter, HTTPException, Depends
+from typing import TypedDict, Tuple, List
```

### 3) `api/v1/routes/sheets/sheets.py`
- **Merge mode:** Manual merge required

```diff
@@ -1,29 +1,33 @@
-from fastapi import APIRouter, HTTPException, Depends
-from typing import List
+...
```

### 4) `api/v1/routes/workspace/orders/orders.py`
- **Merge mode:** Manual merge required

```diff
@@ -1,15 +1,17 @@
-from typing import Annotated
-from fastapi.security import OAuth2PasswordRequestForm
-from src.core.auth import authenticate_user, create_access_token
+from src.api.deps import get_current_user
+from src.schemas.models import Order, User
...
-async def post_order(order: Annotated[Order, None] , db : AsyncSession = Depends(get_db)):
+async def post_order(
+    order: Order,
+    _current_user: User = Depends(get_current_user),
+    _db: AsyncSession = Depends(get_db),
+):
```

### 5) `api/v1/routes/workspace/workspace.py`
- **Merge mode:** Clean copy from source

```diff
@@ -16,9 +16,7 @@
 async def workspace(
     current_user: User = Depends(get_current_user),
     apps:List[App] = Depends(get_current_active_apps),
-    db: AsyncSession = Depends(get_db)
 ):
```

### 6) `core/auth.py`
- **Merge mode:** Manual merge required

```diff
@@ -14,7 +14,7 @@
-oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
+oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login")
```

### 7) `core/config.py`
- **Merge mode:** Manual merge required

```diff
@@ -1,97 +1,128 @@
-import os
-from dotenv import load_dotenv
-from pydantic_settings import BaseSettings
+...
```

### 8) `core/scheduler.py`
- **Merge mode:** Manual merge required

```diff
@@ -1,19 +1,22 @@
-@scheduler.scheduled_job("interval", minutes=240)
+@scheduler.scheduled_job('interval', minutes=10)
...
-async with httpx.AsyncClient() as client:
+timeout = httpx.Timeout(10.0, connect=5.0)
+async with httpx.AsyncClient(timeout=timeout) as client:
```

### 9) `main.py`
- **Merge mode:** Manual merge required

```diff
@@ -12,10 +12,10 @@
-from src.api.v1.routes.workspace.data_viewer import router as data_viewer_router
...
-app.include_router(data_viewer_router,prefix="/api/v1/workspace/data-viewer",tags=["Workspace"])
```

### 10) `schemas/models.py`
- **Merge mode:** Manual merge required

```diff
@@ -1,15 +1,14 @@
-import re
-from pydantic import BaseModel, Field, field_validator
-from typing import Optional, Any, List, Literal
+from pydantic import BaseModel, Field
+from typing import Optional, Any, List
```

### 11) `services/apps.py`
- **Merge mode:** Clean copy from source

```diff
@@ -15,7 +15,6 @@
 if role_row is None:
     return []
-
```

### 12) `services/forms.py`
- **Merge mode:** Manual merge required

```diff
@@ -1,26 +1,14 @@
-import re
-...
-IN_CHECK_PATTERN = re.compile(...)
-ANY_ARRAY_CHECK_PATTERN = re.compile(...)
+...
```

### 13) `services/shared.py`
- **Merge mode:** Manual merge required

```diff
@@ -1,32 +1,35 @@
-from fastapi import HTTPException, Request, status
+from fastapi import Request
...
```

### 14) `services/sheets.py`
- **Merge mode:** Manual merge required

```diff
@@ -5,56 +5,40 @@
-_EXTERNAL_LOCATIONS = {"Tienda Bucaramanga", "Nihao Principal", "Tienda Unicentro"}
+...
```

## Final action summary

### Clean copy from source (3)
- `api/deps.py`
- `api/v1/routes/workspace/workspace.py`
- `services/apps.py`

### Manual merge required (11)
- `api/v1/routes/sheets/inventory/inventory.py`
- `api/v1/routes/sheets/sheets.py`
- `api/v1/routes/workspace/orders/orders.py`
- `core/auth.py`
- `core/config.py`
- `core/scheduler.py`
- `main.py`
- `schemas/models.py`
- `services/forms.py`
- `services/shared.py`
- `services/sheets.py`
