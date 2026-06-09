from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _row_dicts(rows) -> list[dict[str, Any]]:
    return [dict(row) for row in rows.mappings().all()]


async def get_empleados(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT e.id AS "ID",
                   e.nombre AS "Nombre",
                   a.nombre AS "Area",
                   e.estado AS "Estado"
            FROM data.empleado e
            LEFT JOIN data.area a ON a.id = e.id_area
            ORDER BY e.nombre ASC
            """
        )
    )
    return _row_dicts(result)


async def get_procesos(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT p.id AS "ID",
                   p.nombre AS "Nombre",
                   a.nombre AS "Area"
            FROM data.proceso p
            LEFT JOIN data.area a ON a.id = p.id_area
            WHERE p.id BETWEEN 1 AND 5
            ORDER BY p.id ASC
            """
        )
    )
    return _row_dicts(result)


async def get_materiales(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT id AS "ID",
                   nombre AS "Nombre",
                   referencia AS "Referencia",
                   propiedades::TEXT AS "Propiedades",
                   id_unidad_medida AS "Unidad medida",
                   costo AS "Costo"
            FROM data.material
            ORDER BY nombre ASC, referencia ASC NULLS LAST, id ASC
            """
        )
    )
    return _row_dicts(result)


async def get_telas(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT id AS "ID",
                   nombre AS "Nombre",
                   referencia AS "Referencia",
                   concat_ws(' ', nombre, referencia) AS "NombreReferencia",
                   id_unidad_medida AS "Unidad medida",
                   costo AS "Costo"
            FROM data.tela
            ORDER BY nombre ASC, referencia ASC NULLS LAST, id ASC
            """
        )
    )
    return _row_dicts(result)


async def get_pendientes(db: AsyncSession, proceso_id: int) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT op.id AS "ID",
                   op.id_proceso AS "Proceso",
                   op.id_empleado AS "Empleado",
                   op.fecha_inicio AS "Fecha inicio",
                   op.fecha_finalizado AS "Fecha finalizado",
                   op.comentario AS "Comentario",
                   p.nombre AS "ProcesoNombre",
                   i.item_legado AS "Item legado",
                   i.id AS "Item",
                   i.id_orden_compra AS "Orden compra",
                   i.id_cliente AS "Cliente",
                   c.nombre AS "ClienteNombre",
                   oc.oc_cliente AS "OcCliente",
                   pr.nombre AS "Producto",
                   pr.sku AS "ProductoSku",
                   i.detalle AS "Detalle",
                   oc.costo AS "Valor unidad",
                   i.fecha_produccion AS "Fecha produccion",
                   i.fecha_entrega AS "Fecha entrega",
                   i.notas AS "Notas"
            FROM data.ordenproceso op
            LEFT JOIN data.proceso p ON p.id = op.id_proceso
            LEFT JOIN data.item i ON i.id = op.id_item
            LEFT JOIN data.cliente c ON c.id = i.id_cliente
            LEFT JOIN data.ordencompra oc ON oc.id = i.id_orden_compra
            LEFT JOIN data.producto pr ON pr.id = oc.id_producto
            WHERE op.id_proceso = :proceso_id
              AND op.id_proceso BETWEEN 1 AND 5
              AND op.id_empleado IS NULL
              AND op.fecha_finalizado IS NULL
              AND oc.id IS NOT NULL
              AND COALESCE(LOWER(oc.estado), '') <> 'finalizado'
            ORDER BY i.fecha_entrega ASC NULLS LAST, i.item_legado ASC
            LIMIT 300
            """
        ),
        {"proceso_id": proceso_id},
    )
    return _row_dicts(result)


async def get_en_proceso(db: AsyncSession, proceso_id: int) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT op.id AS "ID",
                   op.id_proceso AS "Proceso",
                   op.id_empleado AS "Empleado",
                   op.id_item AS "Item",
                   op.fecha_inicio AS "Fecha inicio",
                   op.fecha_finalizado AS "Fecha finalizado",
                   op.comentario AS "Comentario",
                   p.nombre AS "ProcesoNombre",
                   e.nombre AS "EmpleadoNombre",
                   i.detalle AS "Detalle",
                   i.id_orden_compra AS "OrdenCompra",
                   oc.oc_cliente AS "OcCliente",
                   pr.nombre AS "Producto",
                   pr.sku AS "ProductoSku",
                   i.id_cliente AS "Cliente",
                   c.nombre AS "ClienteNombre",
                   oc.costo AS "ValorUnidad",
                   i.fecha_produccion AS "FechaProduccion",
                   i.fecha_entrega AS "FechaEntrega",
                   i.notas AS "Notas"
            FROM data.ordenproceso op
            LEFT JOIN data.proceso p ON p.id = op.id_proceso
            LEFT JOIN data.empleado e ON e.id = op.id_empleado
            LEFT JOIN data.item i ON i.id = op.id_item
            LEFT JOIN data.ordencompra oc ON oc.id = i.id_orden_compra
            LEFT JOIN data.producto pr ON pr.id = oc.id_producto
            LEFT JOIN data.cliente c ON c.id = i.id_cliente
            WHERE op.id_proceso = :proceso_id
              AND op.id_proceso BETWEEN 1 AND 5
              AND op.id_empleado IS NOT NULL
              AND (op.id_proceso = 5 OR op.fecha_finalizado IS NULL)
              AND oc.id IS NOT NULL
              AND COALESCE(LOWER(oc.estado), '') <> 'finalizado'
            ORDER BY op.fecha_inicio ASC NULLS LAST, op.id ASC
            """
        ),
        {"proceso_id": proceso_id},
    )
    return _row_dicts(result)


async def asignar_proceso(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    proceso = int(payload["proceso"])
    if proceso < 1 or proceso > 5:
        raise ValueError("Solo se permite asignar procesos del 1 al 5.")

    result = await db.execute(
        text(
            """
            UPDATE data.ordenproceso
            SET id_empleado = :empleado,
                fecha_inicio = COALESCE(fecha_inicio, CURRENT_DATE),
                comentario = COALESCE(:comentario, comentario)
            WHERE id_item = :item
              AND id_proceso = :proceso
              AND id_empleado IS NULL
              AND fecha_finalizado IS NULL
            RETURNING id
            """
        ),
        {
            "proceso": proceso,
            "empleado": payload["empleado"],
            "item": payload["item"],
            "comentario": payload.get("comentario"),
        },
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError("No existe una orden proceso pendiente para ese item y proceso.")

    await db.commit()
    return {
        "message": "Proceso asignado correctamente.",
        "orden_proceso_id": row["id"] if row else None,
    }


async def finalizar_proceso(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    finished_at = datetime.now().isoformat(timespec="seconds")
    result = await db.execute(
        text(
            """
            UPDATE data.ordenproceso
            SET fecha_finalizado = CURRENT_DATE,
                comentario = COALESCE(:comentario, comentario)
            WHERE id = :orden_proceso_id
              AND id_proceso BETWEEN 1 AND 5
              AND id_empleado IS NOT NULL
              AND fecha_finalizado IS NULL
            RETURNING id, id_item, id_proceso
            """
        ),
        {
            "orden_proceso_id": payload["orden_proceso_id"],
            "comentario": payload.get("comentario"),
        },
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError("No existe una orden proceso activa para finalizar.")

    siguiente_proceso = row["id_proceso"] + 1 if row["id_proceso"] < 5 else None
    siguiente_row = None
    if siguiente_proceso is not None:
        siguiente_result = await db.execute(
            text(
                """
                INSERT INTO data.ordenproceso (id_proceso, id_item)
                SELECT :siguiente_proceso, :item
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM data.ordenproceso
                    WHERE id_item = :item
                      AND id_proceso = :siguiente_proceso
                      AND fecha_finalizado IS NULL
                )
                RETURNING id
                """
            ),
            {
                "siguiente_proceso": siguiente_proceso,
                "item": row["id_item"],
            },
        )
        siguiente_row = siguiente_result.mappings().first()

    await db.commit()
    return {
        "message": "Proceso finalizado correctamente.",
        "orden_proceso_id": row["id"],
        "fecha_finalizado": finished_at,
        "siguiente_proceso": siguiente_proceso,
        "siguiente_creado": siguiente_row is not None,
        "siguiente_orden_proceso_id": siguiente_row["id"] if siguiente_row else None,
    }


async def registrar_consumo_material(
    db: AsyncSession,
    payload: dict[str, Any],
) -> dict[str, Any]:
    await db.execute(
        text(
            """
            INSERT INTO data.historialconsumomaterial (
                item, id_material, id_proceso, cantidad, fecha_registro
            )
            VALUES (:item, :material, :proceso, :cantidad, NOW())
            """
        ),
        payload,
    )
    await db.commit()
    return {"message": "Consumo de material registrado correctamente."}


async def registrar_consumo_tela(
    db: AsyncSession,
    payload: dict[str, Any],
) -> dict[str, Any]:
    await db.execute(
        text(
            """
            INSERT INTO data.historialconsumotela (
                item, id_tela, id_proceso, cantidad, fecha_registro
            )
            VALUES (:item, :tela, :proceso, :cantidad, NOW())
            """
        ),
        payload,
    )
    await db.commit()
    return {"message": "Consumo de tela registrado correctamente."}
