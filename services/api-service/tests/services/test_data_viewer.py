import unittest
from datetime import datetime

from src.services.data_viewer import (
    DataViewerService,
    TableConfig,
    TableMetadata,
    _resolve_view_status_values,
)


def _table_config(**overrides):
    data = {
        "table_id": "ordenproceso_en_proceso",
        "schema_name": "data",
        "table_name": "ordenproceso",
        "full_table_name": "data.ordenproceso",
        "display_name": "Orden proceso en proceso",
        "stable_order_column": None,
        "default_order_column": None,
        "can_update": None,
        "can_insert": None,
        "can_delete": None,
        "view_order_status": None,
        "view_row_status": None,
        "view_item_order_status": None,
    }
    data.update(overrides)
    return TableConfig(**data)


def _table_metadata(config):
    return TableMetadata(
        config=config,
        columns=[],
        allowed_columns={"id", "id_item", "estado"},
        text_columns={"estado"},
        pk_columns=["id"],
        has_pk=True,
        editable_columns=set(),
        can_update=False,
        can_insert=False,
        can_delete=False,
        can_release_order_process=False,
        stable_order_column=None,
        default_order_column=None,
        display_select_sql={},
        column_expression_sql={},
        raw_value_select_sql={},
    )


def _order_purchase_metadata(config):
    return TableMetadata(
        config=config,
        columns=[],
        allowed_columns={"id", "estado_orden_compra"},
        text_columns={"estado_orden_compra"},
        pk_columns=["id"],
        has_pk=True,
        editable_columns=set(),
        can_update=False,
        can_insert=False,
        can_delete=False,
        can_release_order_process=False,
        stable_order_column=None,
        default_order_column=None,
        display_select_sql={},
        column_expression_sql={},
        raw_value_select_sql={},
    )


class TestDataViewerService(unittest.TestCase):
    def test_pending_status_filter_includes_active_order_states(self) -> None:
        values = _resolve_view_status_values("pendiente")

        self.assertIn("pendiente", values)
        self.assertIn("en proceso", values)
        self.assertIn("retrasado", values)

    def test_finalized_status_filter_keeps_finalized_states(self) -> None:
        values = _resolve_view_status_values("finalizado")

        self.assertIn("finalizado", values)
        self.assertIn("finalizada", values)
        self.assertNotIn("pendiente", values)

    def test_row_status_filter_keeps_unfinished_order_process_rows(self) -> None:
        service = DataViewerService(db=object())
        metadata = _table_metadata(_table_config(view_row_status="not_finalized"))

        where_sql, params = service._build_row_status_where_clause(metadata=metadata)

        self.assertIn('"estado" IS NULL', where_sql)
        self.assertIn("NOT IN", where_sql)
        self.assertIn("view_row_status_0", params)

    def test_row_status_filter_selects_finished_order_process_rows(self) -> None:
        service = DataViewerService(db=object())
        metadata = _table_metadata(_table_config(view_row_status="finalized"))

        where_sql, params = service._build_row_status_where_clause(metadata=metadata)

        self.assertIn('"estado"', where_sql)
        self.assertIn(" IN ", where_sql)
        self.assertNotIn("NOT IN", where_sql)
        self.assertIn("finalizado", params.values())

    def test_purchase_order_row_status_uses_purchase_status_columns(self) -> None:
        service = DataViewerService(db=object())
        config = _table_config(
            table_id="ordencompra_finalizadas",
            table_name="ordencompra",
            full_table_name="data.ordencompra",
            display_name="Ordenes de compra finalizadas",
            view_row_status="finalized",
        )
        metadata = _order_purchase_metadata(config)

        where_sql, params = service._build_row_status_where_clause(metadata=metadata)

        self.assertIn('"estado_orden_compra"', where_sql)
        self.assertIn(" IN ", where_sql)
        self.assertIn("finalizado", params.values())

    def test_order_process_fk_id_columns_display_labels_but_keep_row_id(self) -> None:
        config = _table_config()

        self.assertTrue(DataViewerService._should_preserve_raw_fk_id(config, "id"))
        self.assertFalse(DataViewerService._should_preserve_raw_fk_id(config, "id_item"))
        self.assertFalse(DataViewerService._should_preserve_raw_fk_id(config, "proceso_id"))
        self.assertFalse(DataViewerService._should_preserve_raw_fk_id(config, "valor"))

    def test_validate_changes_coerces_timestamp_strings(self) -> None:
        service = DataViewerService(db=object())
        metadata = _table_metadata(_table_config())
        metadata.columns = [
            {"name": "precio", "type": "numeric"},
            {"name": "fecha_modificacion", "type": "timestamp without time zone"},
        ]
        metadata.allowed_columns = {"precio", "fecha_modificacion"}
        metadata.editable_columns = {"precio", "fecha_modificacion"}

        changes = service._validate_changes_payload(
            {
                "precio": 20000,
                "fecha_modificacion": "2026-06-04T07:45:06",
            },
            metadata,
        )

        self.assertEqual(changes["precio"], 20000)
        self.assertEqual(
            changes["fecha_modificacion"],
            datetime(2026, 6, 4, 7, 45, 6),
        )

    def test_other_tables_keep_fk_display_labels(self) -> None:
        config = _table_config(
            table_id="items_en_proceso",
            table_name="item",
            full_table_name="data.item",
            display_name="Items en proceso",
        )

        self.assertFalse(DataViewerService._should_preserve_raw_fk_id(config, "id_item"))


class TestProductNameRecalculation(unittest.IsolatedAsyncioTestCase):
    async def test_cleared_referencia_1_ignores_legacy_column(self) -> None:
        class LabelService(DataViewerService):
            async def _lookup_catalog_label(
                self,
                *,
                table_name,
                entity_id,
                include_tela_reference=False,
            ):
                labels = {
                    ("base", 1): "PUFF",
                    ("referencia", 99): "NEIVA",
                    ("tela", 3): "OTRO BLANCO",
                }
                return labels.get((table_name, entity_id), "")

        service = LabelService(db=object())

        product_name = await service._build_product_name_from_components(
            {
                "id_base": 1,
                "id_referencia": 99,
                "id_referencia_1": None,
                "id_tela": 3,
            }
        )

        self.assertEqual(product_name, "PUFF OTRO BLANCO")

    async def test_fetch_product_row_by_pk_reads_component_columns(self) -> None:
        class FakeResult:
            def mappings(self):
                return self

            def first(self):
                return {
                    "id": 356,
                    "id_base": 1,
                    "id_referencia_1": None,
                    "id_tela": 3,
                    "nombre": "PUFF OTRO BLANCO",
                }

        class FakeDb:
            def __init__(self):
                self.sql = ""

            async def execute(self, statement, params):
                self.sql = str(statement)
                self.params = params
                return FakeResult()

        fake_db = FakeDb()
        service = DataViewerService(db=fake_db)
        config = _table_config(
            table_id="producto",
            table_name="producto",
            full_table_name="data.producto",
            display_name="Productos",
        )
        metadata = _table_metadata(config)
        metadata.columns = [
            {"name": "id"},
            {"name": "id_base"},
            {"name": "id_referencia_1"},
            {"name": "id_tela"},
            {"name": "nombre"},
        ]
        metadata.allowed_columns = {
            "id",
            "id_base",
            "id_referencia_1",
            "id_tela",
            "nombre",
        }
        metadata.pk_columns = ["id"]

        row = await service._fetch_row_by_pk(
            table_config=config,
            metadata=metadata,
            normalized_pk={"id": 356},
        )

        self.assertEqual(row["id_base"], 1)
        self.assertIn('"id_base"', fake_db.sql)
        self.assertIn('"id_referencia_1"', fake_db.sql)
        self.assertIn('"id_tela"', fake_db.sql)
        self.assertIn('"nombre"', fake_db.sql)

    async def test_catalog_change_refreshes_related_product_names(self) -> None:
        class FakeResult:
            def __init__(self, rows):
                self.rows = rows

            def mappings(self):
                return self

            def all(self):
                return self.rows

        class FakeDb:
            def __init__(self):
                self.update_sql = ""

            async def execute(self, statement, params=None):
                sql = str(statement)
                table_name = (params or {}).get("table_name")
                if "information_schema.columns" in sql:
                    if table_name == "producto":
                        return FakeResult(
                            [
                                {"column_name": "id", "data_type": "integer"},
                                {"column_name": "nombre", "data_type": "text"},
                                {"column_name": "id_base", "data_type": "integer"},
                                {"column_name": "id_modelo", "data_type": "integer"},
                                {"column_name": "id_referencia_1", "data_type": "integer"},
                                {"column_name": "id_referencia_2", "data_type": "integer"},
                                {"column_name": "id_referencia_3", "data_type": "integer"},
                                {"column_name": "id_tela", "data_type": "integer"},
                            ]
                        )
                    if table_name == "tela":
                        return FakeResult(
                            [
                                {"column_name": "id", "data_type": "integer"},
                                {"column_name": "nombre", "data_type": "text"},
                                {"column_name": "referencia", "data_type": "text"},
                            ]
                        )
                    return FakeResult(
                        [
                            {"column_name": "id", "data_type": "integer"},
                            {"column_name": "nombre", "data_type": "text"},
                        ]
                    )

                self.update_sql = sql
                return FakeResult([{"refreshed": 1}, {"refreshed": 1}])

        fake_db = FakeDb()
        service = DataViewerService(db=fake_db)
        config = _table_config(
            table_id="referencia",
            table_name="referencia",
            full_table_name="data.referencia",
            display_name="Referencias",
        )

        refreshed_count = await service._refresh_product_names_after_catalog_change(
            table_config=config,
            normalized_pk={"id": 12},
            normalized_changes={"nombre": "40X40X45"},
        )

        self.assertEqual(refreshed_count, 2)
        self.assertIn('UPDATE "data"."producto" p', fake_db.update_sql)
        self.assertIn('p."id_referencia_1" = :catalog_id', fake_db.update_sql)
        self.assertIn('p."id_referencia_2" = :catalog_id', fake_db.update_sql)
        self.assertIn('p."id_referencia_3" = :catalog_id', fake_db.update_sql)
        self.assertIn('ref."referencia"::text', fake_db.update_sql)


if __name__ == "__main__":
    unittest.main()
