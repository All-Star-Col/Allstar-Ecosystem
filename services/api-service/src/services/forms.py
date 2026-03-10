from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


from src.schemas.models import SubmitForm, CategoriesForms, TableForms, ColumnTable
from src.core.logging_config import get_logger
logger = get_logger(__name__)


class DBCommunicationError(Exception):
    """Falla real de comunicación/almacenamiento."""

    pass


class IdentifierValidationError(Exception):
    def __init__(self, detail: str, invalid_fields: List[str] | None = None):
        self.detail = detail
        self.invalid_fields = invalid_fields or []
        super().__init__(detail)


async def get_categories(db: AsyncSession) -> List[Dict[str, Any]]:
    """
    Consulta la tabla workspace.ui_categorias_tablas y retorna id, nombre.
    """
    try:
        query = text("SELECT id, nombre FROM workspace.ui_categorias_tablas")

        result = await db.execute(query)

        return [dict(row) for row in result.mappings()]
    except Exception as e:
        raise DBCommunicationError(f"Error obteniendo categorias: {e}")


async def get_tables(db: AsyncSession) -> List[Dict[str, Any]]:
    """
    Obtiene tablas visibles de workspace.ui_config_tablas y sus columnas del schema access.
    """
    try:
        # Nota: El inspector de SQLAlchemy 2.0 para async requiere un poco de cuidado
        # o podemos usar una conexión sincrónica temporal si es estrictamente necesario,
        # pero intentaremos hacerlo con consultas SQL directas si es posible para mantener el async.

        # 1. Obtener tablas configuradas
        query_config = text(
            """
            SELECT id, nombre_tabla_sql, nombre_tabla_ui, categoria_id
            FROM workspace.ui_config_tablas
            WHERE es_visible = true
        """
        )
        result_config = await db.execute(query_config)
        tables_config = result_config.mappings().all()

        results = []
        for t in tables_config:
            table_name = t["nombre_tabla_sql"]

            # 2. Obtener columnas del schema 'access' usando Information Schema (más compatible con async)
            query_cols = text(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'access'
                AND table_name = :table_name
            """
            )
            result_cols = await db.execute(
                query_cols, {"table_name": table_name.lower()}
            )
            columns = result_cols.mappings().all()

            if not columns:
                continue

            col_data = []
            for col in columns:
                col_data.append({"name": col["column_name"], "type": col["data_type"]})

            results.append(
                {
                    "id": t["id"],
                    "name_sql": t["nombre_tabla_sql"],
                    "name_form": t["nombre_tabla_ui"],
                    "category_id": t["categoria_id"],
                    "columns": col_data,
                }
            )

        return results
    except Exception as e:
        raise DBCommunicationError(f"Error obteniendo tablas: {e}")


async def new_tabledata(db: AsyncSession, submit_form: SubmitForm) -> str:
    """
    Inserta datos dinámicamente en la tabla especificada.
    """
    correlation_id = f"tb_{int(datetime.now(timezone.utc).timestamp())}"
    table_name = submit_form.table_name.lower()

    await validate_submit_identifiers(db, submit_form)

    # Construir diccionario de columnas y valores
    row_data = {item.column: item.value for item in submit_form.data}

    if not row_data:
        raise DBCommunicationError("No hay datos para insertar")

    try:
        columns = ", ".join(row_data.keys())
        placeholders = ", ".join([f":{key}" for key in row_data.keys()])

        # Ojo: Validar que table_name sea seguro o venga de una lista permitida (get_tables)
        query = text(f"INSERT INTO access.{table_name} ({columns}) VALUES ({placeholders})")

        await db.execute(query, row_data)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise DBCommunicationError(f"No se pudo insertar en {table_name}: {e}")

    return correlation_id


async def get_allowed_tables(db: AsyncSession) -> set[str]:
    try:
        query = text(
            """
            SELECT nombre_tabla_sql
            FROM workspace.ui_config_tablas
            WHERE es_visible = true
            """
        )
        result = await db.execute(query)
        return {
            row["nombre_tabla_sql"].lower()
            for row in result.mappings()
            if row["nombre_tabla_sql"]
        }
    except Exception as e:
        raise DBCommunicationError(f"No se pudo obtener tablas permitidas: {e}")


async def get_allowed_columns(db: AsyncSession, table_name: str) -> set[str]:
    try:
        query = text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'access'
            AND table_name = :table_name
            """
        )
        result = await db.execute(query, {"table_name": table_name.lower()})
        return {
            row["column_name"].lower()
            for row in result.mappings()
            if row["column_name"]
        }
    except Exception as e:
        raise DBCommunicationError(f"No se pudo obtener columnas permitidas: {e}")


async def validate_submit_identifiers(db: AsyncSession, submit_form: SubmitForm) -> None:
    table_name = submit_form.table_name.lower()
    allowed_tables = await get_allowed_tables(db)

    if table_name not in allowed_tables:
        raise IdentifierValidationError(f"Invalid table identifier: {submit_form.table_name}")

    allowed_columns = await get_allowed_columns(db, table_name)
    submitted_columns = [item.column for item in submit_form.data]
    invalid_columns = sorted(
        {
            column
            for column in submitted_columns
            if column.lower() not in allowed_columns
        }
    )

    if invalid_columns:
        invalid_columns_text = ", ".join(invalid_columns)
        raise IdentifierValidationError(
            f"Invalid column identifiers: {invalid_columns_text}",
            invalid_fields=invalid_columns,
        )


class FormsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_categories(self) -> List[CategoriesForms]:
        data = await get_categories(self.db)
        return [CategoriesForms(**item) for item in data]

    async def get_tables(self) -> List[TableForms]:
        data = await get_tables(self.db)
        return [
            TableForms(
                id=item["id"],
                name_sql=item["name_sql"],
                name_form=item["name_form"],
                category_id=item["category_id"],
                columns=[ColumnTable(**col) for col in item["columns"]],
            )
            for item in data
        ]

    async def submit_form(self, submit_data: SubmitForm) -> str:
        return await new_tabledata(self.db, submit_data)
