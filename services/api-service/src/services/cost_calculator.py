from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging_config import get_logger
from src.schemas.cost_calculator import (
    CostCalculatorBreakdownMaterial,
    CostCalculatorBreakdownResponse,
    CostCalculatorBreakdownUpsertRequest,
    CostCalculatorMaterialCreateRequest,
    CostCalculatorMaterialSummary,
    CostCalculatorProductDetail,
    CostCalculatorProductSummary,
)

logger = get_logger(__name__)

DATA_SCHEMA = "data"
MATERIAL_SLOTS = range(1, 11)


class CostCalculatorError(Exception):
    status_code = 422


class CostCalculatorNotFoundError(CostCalculatorError):
    status_code = 404


class CostCalculatorValidationError(CostCalculatorError):
    status_code = 422


class CostCalculatorDBError(CostCalculatorError):
    status_code = 500


def _to_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return default


def _to_optional_int(value: Any) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _build_tela_label(nombre: Any, referencia: Any) -> str | None:
    parts = [str(value).strip() for value in (nombre, referencia) if str(value or "").strip()]
    return " ".join(parts) if parts else None


def _product_detail_from_row(row: dict[str, Any]) -> CostCalculatorProductDetail:
    return CostCalculatorProductDetail(
        id=int(row["id"]),
        nombre=str(row.get("nombre") or ""),
        costo=row.get("costo"),
        id_tela=_to_optional_int(row.get("id_tela")),
        tela_nombre=row.get("tela_nombre"),
        tela_referencia=row.get("tela_referencia"),
        tela_label=_build_tela_label(row.get("tela_nombre"), row.get("tela_referencia")),
        tela_costo=row.get("tela_costo"),
    )


class CostCalculatorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._columns_cache: dict[str, set[str]] = {}

    async def list_products(
        self,
        *,
        query: str | None = None,
        limit: int = 50,
    ) -> list[CostCalculatorProductSummary]:
        search = (query or "").strip()
        params: dict[str, Any] = {"limit": limit, "pattern": f"%{search}%"}
        where_sql = "WHERE p.nombre ILIKE :pattern" if search else ""

        result = await self.db.execute(
            text(
                f"""
                SELECT p.id, p.nombre, p.costo
                FROM {DATA_SCHEMA}.producto p
                {where_sql}
                ORDER BY p.nombre ASC NULLS LAST, p.id ASC
                LIMIT :limit
                """
            ),
            params,
        )
        return [
            CostCalculatorProductSummary(
                id=int(row["id"]),
                nombre=str(row.get("nombre") or ""),
                costo=row.get("costo"),
            )
            for row in result.mappings().all()
        ]

    async def get_product(self, product_id: int) -> CostCalculatorProductDetail:
        row = await self._fetch_product_row(product_id)
        if not row:
            raise CostCalculatorNotFoundError("El producto no existe.")
        return _product_detail_from_row(row)

    async def update_manual_cost(
        self,
        *,
        product_id: int,
        new_cost: Decimal,
    ) -> CostCalculatorProductDetail:
        await self.get_product(product_id)
        try:
            await self.db.execute(
                text(
                    f"""
                    UPDATE {DATA_SCHEMA}.producto
                    SET costo = :new_cost
                    WHERE id = :product_id
                    """
                ),
                {"new_cost": new_cost, "product_id": product_id},
            )
            await self.db.commit()
            return await self.get_product(product_id)
        except Exception as error:
            await self.db.rollback()
            logger.exception("cost_calculator.update_manual_cost failed: %s", error)
            raise CostCalculatorDBError("No se pudo actualizar el costo del producto.") from error

    async def list_materials(
        self,
        *,
        query: str | None = None,
        limit: int = 50,
    ) -> list[CostCalculatorMaterialSummary]:
        search = (query or "").strip()
        params: dict[str, Any] = {"limit": limit, "pattern": f"%{search}%"}
        where_sql = "WHERE m.nombre ILIKE :pattern" if search else ""
        estado_select = (
            "m.estado"
            if await self._has_column("material", "estado")
            else "NULL::text AS estado"
        )

        result = await self.db.execute(
            text(
                f"""
                SELECT m.id, m.nombre, m.costo, {estado_select}
                FROM {DATA_SCHEMA}.material m
                {where_sql}
                ORDER BY m.nombre ASC NULLS LAST, m.id ASC
                LIMIT :limit
                """
            ),
            params,
        )
        return [
            CostCalculatorMaterialSummary(
                id=int(row["id"]),
                nombre=str(row.get("nombre") or ""),
                costo=row.get("costo"),
                estado=row.get("estado"),
            )
            for row in result.mappings().all()
        ]

    async def create_material(
        self,
        payload: CostCalculatorMaterialCreateRequest,
    ) -> CostCalculatorMaterialSummary:
        existing = await self._fetch_material_by_name(payload.nombre)
        if existing:
            return CostCalculatorMaterialSummary(
                id=int(existing["id"]),
                nombre=str(existing.get("nombre") or ""),
                costo=existing.get("costo"),
                estado=existing.get("estado"),
            )

        try:
            has_estado = await self._has_column("material", "estado")
            columns = ["nombre", "costo"]
            values = [":nombre", ":costo"]
            returning = "id, nombre, costo, NULL::text AS estado"
            params: dict[str, Any] = {"nombre": payload.nombre, "costo": payload.costo}
            if has_estado:
                columns.append("estado")
                values.append(":estado")
                returning = "id, nombre, costo, estado"
                params["estado"] = True

            result = await self.db.execute(
                text(
                    f"""
                    INSERT INTO {DATA_SCHEMA}.material ({", ".join(columns)})
                    VALUES ({", ".join(values)})
                    RETURNING {returning}
                    """
                ),
                params,
            )
            await self.db.commit()
            row = result.mappings().first()
            if not row:
                raise CostCalculatorDBError("No se pudo crear el material.")
            return CostCalculatorMaterialSummary(
                id=int(row["id"]),
                nombre=str(row.get("nombre") or ""),
                costo=row.get("costo"),
                estado=row.get("estado"),
            )
        except CostCalculatorError:
            await self.db.rollback()
            raise
        except Exception as error:
            await self.db.rollback()
            logger.exception("cost_calculator.create_material failed: %s", error)
            raise CostCalculatorDBError("No se pudo crear el material.") from error

    async def get_breakdown(self, product_id: int) -> CostCalculatorBreakdownResponse:
        product = await self.get_product(product_id)
        breakdown = await self._fetch_breakdown_row(product_id)
        if not breakdown:
            return CostCalculatorBreakdownResponse(exists=False, product=product)
        return await self._build_breakdown_response(product=product, breakdown=breakdown)

    async def upsert_breakdown(
        self,
        *,
        product_id: int,
        payload: CostCalculatorBreakdownUpsertRequest,
    ) -> CostCalculatorBreakdownResponse:
        product = await self.get_product(product_id)
        normalized_materials = await self._normalize_material_inputs(payload)
        existing = await self._fetch_breakdown_row(product_id)

        params: dict[str, Any] = {
            "product_id": product_id,
            "cantidad_tela": payload.cantidad_tela,
            "costo_mano_obra": payload.costo_mano_obra,
        }
        for slot in MATERIAL_SLOTS:
            material = normalized_materials[slot - 1] if slot <= len(normalized_materials) else None
            params[f"id_material{slot}"] = material["material_id"] if material else None
            params[f"cantidad{slot}"] = material["cantidad"] if material else None

        try:
            if existing:
                set_columns = [
                    *(f"id_material{slot} = :id_material{slot}" for slot in MATERIAL_SLOTS),
                    *(f"cantidad{slot} = :cantidad{slot}" for slot in MATERIAL_SLOTS),
                    "cantidad_tela = :cantidad_tela",
                    "costo_mano_obra = :costo_mano_obra",
                    "updated_at = NOW()",
                ]
                params["despiece_id"] = existing["id"]
                result = await self.db.execute(
                    text(
                        f"""
                        UPDATE {DATA_SCHEMA}.despiece
                        SET {", ".join(set_columns)}
                        WHERE id = :despiece_id
                        RETURNING *
                        """
                    ),
                    params,
                )
            else:
                columns = [
                    "id_producto",
                    *(f"id_material{slot}" for slot in MATERIAL_SLOTS),
                    *(f"cantidad{slot}" for slot in MATERIAL_SLOTS),
                    "cantidad_tela",
                    "costo_mano_obra",
                ]
                values = [
                    ":product_id",
                    *(f":id_material{slot}" for slot in MATERIAL_SLOTS),
                    *(f":cantidad{slot}" for slot in MATERIAL_SLOTS),
                    ":cantidad_tela",
                    ":costo_mano_obra",
                ]
                result = await self.db.execute(
                    text(
                        f"""
                        INSERT INTO {DATA_SCHEMA}.despiece ({", ".join(columns)})
                        VALUES ({", ".join(values)})
                        RETURNING *
                        """
                    ),
                    params,
                )

            await self.db.commit()
            row = result.mappings().first()
            if not row:
                raise CostCalculatorDBError("No se pudo guardar el despiece.")
            return await self._build_breakdown_response(product=product, breakdown=dict(row))
        except CostCalculatorError:
            await self.db.rollback()
            raise
        except Exception as error:
            await self.db.rollback()
            logger.exception("cost_calculator.upsert_breakdown failed: %s", error)
            raise CostCalculatorDBError("No se pudo guardar el despiece.") from error

    async def update_labor_cost(
        self,
        *,
        product_id: int,
        costo_mano_obra: Decimal,
    ) -> CostCalculatorBreakdownResponse:
        product = await self.get_product(product_id)
        breakdown = await self._fetch_breakdown_row(product_id)
        if not breakdown:
            raise CostCalculatorNotFoundError("Este producto no tiene despiece registrado.")

        try:
            result = await self.db.execute(
                text(
                    f"""
                    UPDATE {DATA_SCHEMA}.despiece
                    SET costo_mano_obra = :costo_mano_obra,
                        updated_at = NOW()
                    WHERE id = :despiece_id
                    RETURNING *
                    """
                ),
                {
                    "costo_mano_obra": costo_mano_obra,
                    "despiece_id": breakdown["id"],
                },
            )
            await self.db.commit()
            row = result.mappings().first()
            if not row:
                raise CostCalculatorDBError("No se pudo actualizar la mano de obra.")
            return await self._build_breakdown_response(product=product, breakdown=dict(row))
        except CostCalculatorError:
            await self.db.rollback()
            raise
        except Exception as error:
            await self.db.rollback()
            logger.exception("cost_calculator.update_labor_cost failed: %s", error)
            raise CostCalculatorDBError("No se pudo actualizar la mano de obra.") from error

    async def apply_calculated_cost(self, product_id: int) -> tuple[CostCalculatorProductDetail, CostCalculatorBreakdownResponse]:
        breakdown = await self.get_breakdown(product_id)
        if not breakdown.exists:
            raise CostCalculatorNotFoundError("Este producto no tiene despiece registrado.")

        try:
            await self.db.execute(
                text(
                    f"""
                    UPDATE {DATA_SCHEMA}.producto
                    SET costo = :new_cost
                    WHERE id = :product_id
                    """
                ),
                {"new_cost": breakdown.costo_calculado, "product_id": product_id},
            )
            await self.db.commit()
            product = await self.get_product(product_id)
            refreshed_breakdown = await self.get_breakdown(product_id)
            return product, refreshed_breakdown
        except CostCalculatorError:
            await self.db.rollback()
            raise
        except Exception as error:
            await self.db.rollback()
            logger.exception("cost_calculator.apply_calculated_cost failed: %s", error)
            raise CostCalculatorDBError("No se pudo aplicar el costo calculado.") from error

    async def _fetch_product_row(self, product_id: int) -> dict[str, Any] | None:
        result = await self.db.execute(
            text(
                f"""
                SELECT
                    p.id,
                    p.nombre,
                    p.costo,
                    p.id_tela,
                    t.nombre AS tela_nombre,
                    t.referencia AS tela_referencia,
                    t.costo AS tela_costo
                FROM {DATA_SCHEMA}.producto p
                LEFT JOIN {DATA_SCHEMA}.tela t
                  ON TRIM(t.id::text) = TRIM(p.id_tela::text)
                WHERE p.id = :product_id
                LIMIT 1
                """
            ),
            {"product_id": product_id},
        )
        row = result.mappings().first()
        return dict(row) if row else None

    async def _fetch_material_by_name(self, nombre: str) -> dict[str, Any] | None:
        estado_select = (
            "estado"
            if await self._has_column("material", "estado")
            else "NULL::text AS estado"
        )
        result = await self.db.execute(
            text(
                f"""
                SELECT id, nombre, costo, {estado_select}
                FROM {DATA_SCHEMA}.material
                WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:nombre))
                LIMIT 1
                """
            ),
            {"nombre": nombre},
        )
        row = result.mappings().first()
        return dict(row) if row else None

    async def _fetch_material_by_id(self, material_id: int) -> dict[str, Any] | None:
        estado_select = (
            "estado"
            if await self._has_column("material", "estado")
            else "NULL::text AS estado"
        )
        result = await self.db.execute(
            text(
                f"""
                SELECT id, nombre, costo, {estado_select}
                FROM {DATA_SCHEMA}.material
                WHERE TRIM(id::text) = :material_id
                LIMIT 1
                """
            ),
            {"material_id": str(material_id)},
        )
        row = result.mappings().first()
        return dict(row) if row else None

    async def _get_table_columns(self, table_name: str) -> set[str]:
        key = table_name.lower()
        if key not in self._columns_cache:
            result = await self.db.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = :schema_name
                      AND table_name = :table_name
                    """
                ),
                {"schema_name": DATA_SCHEMA, "table_name": key},
            )
            self._columns_cache[key] = {
                str(row["column_name"]).lower()
                for row in result.mappings().all()
                if row.get("column_name")
            }
        return self._columns_cache[key]

    async def _has_column(self, table_name: str, column_name: str) -> bool:
        columns = await self._get_table_columns(table_name)
        return column_name.lower() in columns

    async def _fetch_breakdown_row(self, product_id: int) -> dict[str, Any] | None:
        result = await self.db.execute(
            text(
                f"""
                SELECT *
                FROM {DATA_SCHEMA}.despiece
                WHERE TRIM(id_producto::text) = :product_id
                ORDER BY updated_at DESC NULLS LAST, id DESC
                LIMIT 1
                """
            ),
            {"product_id": str(product_id)},
        )
        row = result.mappings().first()
        return dict(row) if row else None

    async def _normalize_material_inputs(
        self,
        payload: CostCalculatorBreakdownUpsertRequest,
    ) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        seen: set[int] = set()
        for item in payload.materials[:10]:
            if item.material_id in seen and item.cantidad == 0:
                continue
            material = await self._fetch_material_by_id(item.material_id)
            if not material:
                raise CostCalculatorValidationError(
                    f"El material {item.material_id} no existe."
                )
            seen.add(item.material_id)
            normalized.append(
                {
                    "material_id": int(material["id"]),
                    "cantidad": item.cantidad,
                }
            )
        return normalized

    async def _build_breakdown_response(
        self,
        *,
        product: CostCalculatorProductDetail,
        breakdown: dict[str, Any],
    ) -> CostCalculatorBreakdownResponse:
        material_rows: list[CostCalculatorBreakdownMaterial] = []
        total_materials = Decimal("0")

        for slot in MATERIAL_SLOTS:
            material_id = _to_optional_int(breakdown.get(f"id_material{slot}"))
            cantidad = _to_decimal(breakdown.get(f"cantidad{slot}"))
            if not material_id or cantidad == 0:
                continue

            material = await self._fetch_material_by_id(material_id)
            if not material:
                raise CostCalculatorValidationError(
                    f"El material {material_id} usado en el despiece no existe."
                )

            unit_cost = _to_decimal(material.get("costo"))
            line_total = cantidad * unit_cost
            total_materials += line_total
            material_rows.append(
                CostCalculatorBreakdownMaterial(
                    position=slot,
                    material_id=int(material["id"]),
                    material_nombre=str(material.get("nombre") or ""),
                    cantidad=cantidad,
                    costo_unitario=unit_cost,
                    costo_total=line_total,
                )
            )

        cantidad_tela = _to_decimal(breakdown.get("cantidad_tela"))
        tela_unit_cost = _to_decimal(product.tela_costo)
        tela_total = cantidad_tela * tela_unit_cost
        labor_cost = _to_decimal(breakdown.get("costo_mano_obra"))
        calculated_cost = total_materials + tela_total + labor_cost

        return CostCalculatorBreakdownResponse(
            exists=True,
            product=product,
            despiece_id=_to_optional_int(breakdown.get("id")),
            materials=material_rows,
            cantidad_tela=cantidad_tela,
            tela_costo_unitario=tela_unit_cost,
            tela_costo_total=tela_total,
            costo_mano_obra=labor_cost,
            costo_total_materiales=total_materials,
            costo_calculado=calculated_cost,
        )
