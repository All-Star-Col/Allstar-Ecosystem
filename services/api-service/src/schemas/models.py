import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any, List, Literal
from uuid import UUID
from src.core.logging_config import get_logger

logger = get_logger(__name__)


# _____________________________________________________
#   /api/v1/login | auth
# _____________________________________________________


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# _____________________________________________________
#   /api/v1/register, /api/v1/workspace | users
# _____________________________________________________


class User(BaseModel):
    id: UUID
    username: str
    full_name: Optional[str] = None
    disabled: Optional[bool] = None


class UserCreate(BaseModel):
    email: Optional[str] = None
    username: str
    full_name: str
    password: str


class UserInDB(User):
    password_hash: str


class UserAdminCreate(BaseModel):
    email: str
    username: str
    full_name: str
    password: str


class UserAdminResponse(BaseModel):
    id: UUID
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    is_email_verified: bool


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    password_hash: Optional[str] = None


class UserListResponse(BaseModel):
    users: List[UserAdminResponse]
    total: int
    limit: int
    offset: int


# _____________________________________________________
#   /api/v1/workspace | roles, apps
# _____________________________________________________


class Role(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None


class App(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    path: str
    external_url: Optional[str] = None
    icon_key: str
    icon_bg_color: str
    badge_color: str


class UserRoleResponse(BaseModel):
    user_id: UUID
    role: Role | None = None


class AssignUserRoleRequest(BaseModel):
    role_id: UUID


class RoleAppPermission(BaseModel):
    app_id: str
    app_name: str | None = None
    app_description: str | None = None
    app_path: str | None = None
    can_view: bool = True


class RoleTablePermission(BaseModel):
    table_id: str
    table_name: str | None = None
    table_label: str | None = None
    visible: bool = True
    can_edit: bool = False
    can_create: bool = False
    can_release_order_process: bool = False


class RoleFormPermission(BaseModel):
    table_id: int
    table_name: str | None = None
    form_label: str | None = None
    can_view: bool = True


class RolePermissionsResponse(BaseModel):
    role_id: UUID
    apps: List[RoleAppPermission] = Field(default_factory=list)
    tables: List[RoleTablePermission] = Field(default_factory=list)
    forms: List[RoleFormPermission] = Field(default_factory=list)


class RolePermissionsUpdateRequest(BaseModel):
    apps: List[RoleAppPermission] = Field(default_factory=list)
    tables: List[RoleTablePermission] = Field(default_factory=list)
    forms: List[RoleFormPermission] = Field(default_factory=list)


# _____________________________________________________
#   /api/v1/sheets/inventory | sheets
# _____________________________________________________


class Item_LookupResponse(BaseModel):
    item: int
    excel_row: int
    product: str
    fabric: str
    warehouse: str
    warehouse_row: str
    opt_warehouse: List[str]
    opt_row: List[str]
    opt_conveyor: List[str]


class Returned_Item(BaseModel):
    item: str
    product: str
    fabric: str
    client: str


class DispatchItem(BaseModel):
    dispatch_date: str
    invoice: str
    referral: str
    conveyor: str


class LocationItem(BaseModel):
    new_warehouse: str
    new_row: str
    referral: Optional[str] = None


# _____________________________________________________
#   /api/v1/workspace/forms | forms
# _____________________________________________________


class CategoriesForms(BaseModel):
    id: int
    nombre: str


class ForeignKeyOption(BaseModel):
    value: str
    label: str


class ForeignKeyLookupItem(BaseModel):
    value: str
    label: str


class ForeignKeyLookupResponse(BaseModel):
    items: List[ForeignKeyLookupItem]
    total: int | None = None
    has_more: bool | None = None


class ColumnTable(BaseModel):
    name: str
    type: str
    nullable: bool | None = None
    required: bool | None = None
    max_length: int | None = None
    default_value: str | None = None
    enum_values: List[str] | None = None
    foreign_key: bool | None = None
    foreign_key_table: str | None = None
    foreign_key_value_field: str | None = None
    foreign_key_label_field: str | None = None
    foreign_key_options: List[ForeignKeyOption] | None = None


class TableForms(BaseModel):
    id: int
    name_sql: str
    name_form: str
    category_id: int
    columns: List[ColumnTable]


class TableData(BaseModel):
    column: str = Field(
        min_length=1,
        max_length=63,
        pattern=r"^[A-Za-z_][A-Za-z0-9_]*$",
    )
    value: Any


class SubmitForm(BaseModel):
    # Accept either a plain table name or schema.table (e.g. "tela" or "data.tela")
    table_name: str = Field(
        min_length=1,
        # allow optional schema + dot + table (each identifier up to 63 chars)
        max_length=127,
        pattern=r"^(?:[A-Za-z_][A-Za-z0-9_]*\.)?[A-Za-z_][A-Za-z0-9_]*$",
    )
    data: List[TableData]


class SubmitFormResponse(BaseModel):
    status: str
    correlation_id: str


# _____________________________________________________
#   /api/v1/workspace/data-viewer | data_viewer
# _____________________________________________________

DATA_VIEWER_IDENTIFIER_PATTERN = r"^[A-Za-z_][A-Za-z0-9_]{0,62}$"
DATA_VIEWER_TABLE_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"
_DATA_VIEWER_IDENTIFIER_REGEX = re.compile(DATA_VIEWER_IDENTIFIER_PATTERN)


class DataViewerColumn(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=63,
        pattern=DATA_VIEWER_IDENTIFIER_PATTERN,
    )
    type: str
    nullable: bool | None = None
    visible: bool = True
    editable: bool = True
    required: bool | None = None
    max_length: int | None = Field(default=None, ge=1)
    enum_values: List[str] | None = None
    read_only_reason: str | None = None
    raw_value_column: str | None = None


class DataViewerTable(BaseModel):
    table_id: str = Field(
        min_length=1,
        max_length=64,
        pattern=DATA_VIEWER_TABLE_ID_PATTERN,
    )
    table_name: str
    display_name: str | None = None
    has_pk: bool
    stable_order_column: str | None = Field(
        default=None,
        pattern=DATA_VIEWER_IDENTIFIER_PATTERN,
    )
    default_order_column: str | None = Field(
        default=None,
        pattern=DATA_VIEWER_IDENTIFIER_PATTERN,
    )
    order_error_code: str | None = None
    can_update: bool = False
    can_insert: bool = False
    can_delete: bool = False
    can_release_order_process: bool = False
    pk_columns: List[str] = Field(default_factory=list)
    columns: List[DataViewerColumn]


class DataViewerFilter(BaseModel):
    column: str = Field(
        min_length=1,
        max_length=63,
        pattern=DATA_VIEWER_IDENTIFIER_PATTERN,
    )
    operator: Literal["eq","contains","gt","lt","in","between","is_null","is_not_null"]
    value: Any | None = None
    value_to: Any | None = None


class DataViewerSort(BaseModel):
    column: str = Field(
        min_length=1,
        max_length=63,
        pattern=DATA_VIEWER_IDENTIFIER_PATTERN,
    )
    direction: Literal["asc", "desc"] = "asc"


class DataViewerQueryRequest(BaseModel):
    table_id: str = Field(
        min_length=1,
        max_length=64,
        pattern=DATA_VIEWER_TABLE_ID_PATTERN,
    )
    columns: List[str] | None = None
    filters: List[DataViewerFilter] = Field(default_factory=list)
    sort: DataViewerSort | None = None
    q: str | None = None
    limit: int = Field(default=100, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
    include_total: bool = False

    @field_validator("columns")
    @classmethod
    def validate_columns(cls, value: List[str] | None) -> List[str] | None:
        if value is None:
            return value

        for column in value:
            if not _DATA_VIEWER_IDENTIFIER_REGEX.match(column):
                raise ValueError(f"Invalid column identifier: {column}")
        return value

    @field_validator("q")
    @classmethod
    def validate_q(cls, value: str | None) -> str | None:
        if value is None:
            return value

        trimmed_value = value.strip()
        if not trimmed_value:
            return None
        if len(trimmed_value) > 100:
            raise ValueError("Invalid q length: maximum is 100 characters")
        return trimmed_value


class DataViewerQueryResponse(BaseModel):
    rows: List[dict[str, Any]]
    total_count: int | None = None
    limit: int
    offset: int
    has_more: bool


class DataViewerErrorResponse(BaseModel):
    request_id: str
    detail: str
    code: str


class DataViewerRowUpdateRequest(BaseModel):
    table_id: str = Field(
        min_length=1,
        max_length=64,
        pattern=DATA_VIEWER_TABLE_ID_PATTERN,
    )
    pk: dict[str, Any]
    changes: dict[str, Any]

    @field_validator("pk")
    @classmethod
    def validate_pk(cls, value: dict[str, Any]) -> dict[str, Any]:
        if not value:
            raise ValueError("pk must not be empty")

        for key in value:
            if not _DATA_VIEWER_IDENTIFIER_REGEX.match(key):
                raise ValueError(f"Invalid pk identifier: {key}")
        return value

    @field_validator("changes")
    @classmethod
    def validate_changes(cls, value: dict[str, Any]) -> dict[str, Any]:
        if not value:
            raise ValueError("changes must not be empty")

        for key in value:
            if not _DATA_VIEWER_IDENTIFIER_REGEX.match(key):
                raise ValueError(f"Invalid changes identifier: {key}")
        return value


class DataViewerRowUpdateResponse(BaseModel):
    row: dict[str, Any]
    updated_columns: List[str]


# _____________________________________________________
#   /api/v1/orders | orders
# _____________________________________________________


class EmailOrder(BaseModel):
    id: str
    subject: str | None = None
    text: str | None = None
    to: str
    source_email: str


class Product(BaseModel):
    product_name: str
    quantity: int
    value: float


class Client(BaseModel):
    name: str
    email: str
    telephone: str


class Order(BaseModel):
    OCI: str
    OCC: str
    email_order: EmailOrder
    products: List[Product]
    client: Client
