from pydantic import BaseModel, Field
from typing import Optional, Any, List
from uuid import UUID
from src.core.logging_config import get_logger
logger = get_logger(__name__)



# -----------------------------
# Models
# -----------------------------

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    id: UUID
    username: str
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class Role(BaseModel):
    id: int
    name: str
    description :Optional[str] = None

class UserCreate(BaseModel):
    email: Optional[str] = None
    username: str
    full_name: str
    password: str

class UserInDB(User):
    password_hash: str

class App(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    path: str
    external_url: Optional[str] = None
    icon_key: str
    icon_bg_color: str
    badge_color: str

# Sheets Services Schemas
class Item_LookupResponse(BaseModel):
    item: int
    excel_row: int
    product: str
    fabric: str
    warehouse: str
    warehouse_row: str
    opt_warehouse: Optional[List[str]] = None
    opt_row: Optional[List[str]] = None

class DispatchItem(BaseModel):
    dispatch_date: str
    invoice: str
    referral: str

class LocationItem(BaseModel):
    new_warehouse: str
    new_row: str
    referral: Optional[str] = None

# Forms Schemas
class CategoriesForms(BaseModel):
    id: int
    nombre: str

class ColumnTable(BaseModel):
    name: str
    type: str

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
    table_name: str = Field(
        min_length=1,
        max_length=63,
        pattern=r"^[A-Za-z_][A-Za-z0-9_]*$",
    )
    data: List[TableData]

class SubmitFormResponse(BaseModel):
    status: str
    correlation_id: str

class EmailOrder(BaseModel):
    id: str
    subject: str | None  = None
    text: str | None = None
    to: str
    source_email: str

class Product(BaseModel):
    product_name : str
    quantity : int
    value : float

class Client(BaseModel):
    name : str
    email : str
    telephone : str

class Order(BaseModel):
    OCI : str
    OCC : str
    email_order : EmailOrder
    products : List[Product]
    client : Client
