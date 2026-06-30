from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


def _validate_non_negative(value: Decimal | None, field_name: str) -> Decimal:
    resolved = value if value is not None else Decimal("0")
    if resolved < 0:
        raise ValueError(f"{field_name} no puede ser negativo")
    return resolved


class CostCalculatorProductSummary(BaseModel):
    id: int
    nombre: str
    costo: Decimal | None = None


class CostCalculatorProductDetail(CostCalculatorProductSummary):
    id_tela: int | None = None
    tela_nombre: str | None = None
    tela_referencia: str | None = None
    tela_label: str | None = None
    tela_costo: Decimal | None = None


class CostCalculatorProductListResponse(BaseModel):
    items: list[CostCalculatorProductSummary]


class CostCalculatorManualCostRequest(BaseModel):
    new_cost: Decimal = Field(..., description="Nuevo costo del producto")

    @field_validator("new_cost")
    @classmethod
    def validate_new_cost(cls, value: Decimal) -> Decimal:
        return _validate_non_negative(value, "Nuevo costo")


class CostCalculatorLaborCostRequest(BaseModel):
    costo_mano_obra: Decimal = Decimal("0")

    @field_validator("costo_mano_obra")
    @classmethod
    def validate_labor_cost(cls, value: Decimal) -> Decimal:
        return _validate_non_negative(value, "Costo mano de obra")


class CostCalculatorMaterialSummary(BaseModel):
    id: int
    nombre: str
    costo: Decimal | None = None
    estado: bool | str | None = None


class CostCalculatorMaterialListResponse(BaseModel):
    items: list[CostCalculatorMaterialSummary]


class CostCalculatorMaterialCreateRequest(BaseModel):
    nombre: str
    costo: Decimal = Decimal("0")

    @field_validator("nombre")
    @classmethod
    def validate_nombre(cls, value: str) -> str:
        resolved = value.strip()
        if not resolved:
            raise ValueError("El nombre del material es obligatorio")
        return resolved

    @field_validator("costo")
    @classmethod
    def validate_cost(cls, value: Decimal) -> Decimal:
        return _validate_non_negative(value, "Costo material")


class CostCalculatorBreakdownMaterialInput(BaseModel):
    material_id: int
    cantidad: Decimal = Decimal("0")

    @field_validator("cantidad")
    @classmethod
    def validate_quantity(cls, value: Decimal) -> Decimal:
        return _validate_non_negative(value, "Cantidad material")


class CostCalculatorBreakdownUpsertRequest(BaseModel):
    materials: list[CostCalculatorBreakdownMaterialInput] = Field(default_factory=list, max_length=10)
    cantidad_tela: Decimal = Decimal("0")
    costo_mano_obra: Decimal = Decimal("0")

    @field_validator("cantidad_tela")
    @classmethod
    def validate_fabric_quantity(cls, value: Decimal) -> Decimal:
        return _validate_non_negative(value, "Cantidad tela")

    @field_validator("costo_mano_obra")
    @classmethod
    def validate_labor_cost(cls, value: Decimal) -> Decimal:
        return _validate_non_negative(value, "Costo mano de obra")


class CostCalculatorBreakdownMaterial(BaseModel):
    position: int
    material_id: int
    material_nombre: str
    cantidad: Decimal
    costo_unitario: Decimal
    costo_total: Decimal


class CostCalculatorBreakdownResponse(BaseModel):
    exists: bool
    product: CostCalculatorProductDetail
    despiece_id: int | None = None
    materials: list[CostCalculatorBreakdownMaterial] = Field(default_factory=list)
    cantidad_tela: Decimal = Decimal("0")
    tela_costo_unitario: Decimal = Decimal("0")
    tela_costo_total: Decimal = Decimal("0")
    costo_mano_obra: Decimal = Decimal("0")
    costo_total_materiales: Decimal = Decimal("0")
    costo_calculado: Decimal = Decimal("0")


class CostCalculatorApplyCostResponse(BaseModel):
    status: str
    product: CostCalculatorProductDetail
    breakdown: CostCalculatorBreakdownResponse
