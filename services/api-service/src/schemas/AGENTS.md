# SCHEMAS MODULE KNOWLEDGE

## OVERVIEW
Pydantic models and validation helpers for auth, users/roles/apps, forms, data viewer, sheets inventory, and orders.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Auth tokens/users | `models.py` (Token, User*, TokenData) | Basic auth shapes and admin/user CRUD payloads |
| Workspace roles/apps | `models.py` (Role, App) | IDs as UUID/str; basic metadata |
| Sheets inventory | `models.py` (Item_LookupResponse, Returned_Item, DispatchItem, LocationItem) | Response payloads for inventory endpoints |
| Forms | `models.py` (CategoriesForms, TableForms, SubmitForm*, TableData) | Identifier regex `^[A-Za-z_][A-Za-z0-9_]*$`; column/table names length ≤63 |
| Data Viewer | `models.py` (DataViewer*) | Identifier regex `^[A-Za-z_][A-Za-z0-9_]{0,62}$`; table_id pattern `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`; validators enforce non-empty PK/changes |
| Orders | `models.py` (EmailOrder, Product, Client, Order) | Simple nested order payload |

## CONVENTIONS
- All models inherit from `pydantic.BaseModel`; use `Field` constraints for length/patterns.
- Identifier patterns are centralized constants (DATA_VIEWER_IDENTIFIER_PATTERN, DATA_VIEWER_TABLE_ID_PATTERN); keep regex unchanged unless coordinated with services/routes.
- Validators (`@field_validator`) trim/validate lists and strings; preserve them when extending models.
- Logging available via `get_logger(__name__)`; keep imports if adding validators.

## ANTI-PATTERNS
- Do not relax identifier regexes or remove validators; services rely on strict validation for SQL safety.
- Do not bypass models with ad-hoc dicts in routes/services; keep request/response shapes typed here.
- Do not introduce circular imports with services/core; keep schemas framework-agnostic.

## NOTES
- Data Viewer responses include optional `total_count` and paging flags; maintain shape for frontend compatibility.
- Form/table names are validated twice (regex + allowlist in services); keep Pydantic constraints aligned with service logic.
