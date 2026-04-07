import unittest
from unittest.mock import AsyncMock, patch

from src.services import forms
from src.services.forms import IdentifierValidationError


class _FakeMappingsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return _FakeMappingsResult(self._rows)


class TestFormsTablesMetadata(unittest.IsolatedAsyncioTestCase):
    async def test_get_tables_returns_lightweight_fk_metadata(self) -> None:
        with (
            patch(
                "src.services.forms._get_visible_table_configs",
                new=AsyncMock(
                    return_value=[
                        {
                            "id": 2,
                            "nombre_tabla_sql": "productos",
                            "nombre_tabla_ui": "Productos",
                            "categoria_id": 20,
                        }
                    ]
                ),
            ),
            patch(
                "src.services.forms._get_foreign_key_metadata",
                new=AsyncMock(
                    return_value={
                        ("productos", "id_base"): {
                            "referenced_schema": "data",
                            "referenced_table": "bases",
                            "referenced_column": "id",
                        }
                    }
                ),
            ),
            patch(
                "src.services.forms._get_enum_values_by_udt",
                new=AsyncMock(return_value={}),
            ),
            patch(
                "src.services.forms._build_fk_reference_cache",
                new=AsyncMock(
                    return_value={
                        ("data", "bases", "id"): {
                            "value_field": "id",
                            "label_field": "nombre",
                        }
                    }
                ),
            ),
            patch(
                "src.services.forms._get_table_columns",
                new=AsyncMock(
                    return_value=[
                        {
                            "column_name": "id_base",
                            "data_type": "integer",
                            "is_nullable": "NO",
                            "character_maximum_length": None,
                            "column_default": None,
                            "udt_name": "int4",
                        }
                    ]
                ),
            ),
        ):
            result = await forms.get_tables(db=object())

        self.assertEqual(1, len(result))
        fk_column = result[0]["columns"][0]
        self.assertTrue(fk_column["foreign_key"])
        self.assertEqual("bases", fk_column["foreign_key_table"])
        self.assertEqual("id", fk_column["foreign_key_value_field"])
        self.assertEqual("nombre", fk_column["foreign_key_label_field"])
        self.assertIsNone(fk_column["foreign_key_options"])

    async def test_get_table_returns_one_table_metadata(self) -> None:
        with (
            patch(
                "src.services.forms._get_visible_table_configs",
                new=AsyncMock(
                    return_value=[
                        {
                            "id": 3,
                            "nombre_tabla_sql": "ordenes",
                            "nombre_tabla_ui": "Ordenes",
                            "categoria_id": 30,
                        }
                    ]
                ),
            ),
            patch(
                "src.services.forms._get_foreign_key_metadata",
                new=AsyncMock(return_value={}),
            ),
            patch(
                "src.services.forms._get_enum_values_by_udt",
                new=AsyncMock(return_value={"estado_orden": ["PENDIENTE", "HECHO"]}),
            ),
            patch(
                "src.services.forms._build_fk_reference_cache",
                new=AsyncMock(return_value={}),
            ),
            patch(
                "src.services.forms._get_table_columns",
                new=AsyncMock(
                    return_value=[
                        {
                            "column_name": "estado",
                            "data_type": "USER-DEFINED",
                            "is_nullable": "NO",
                            "character_maximum_length": None,
                            "column_default": None,
                            "udt_name": "estado_orden",
                        }
                    ]
                ),
            ),
        ):
            result = await forms.get_table(db=object(), table_name="ordenes")

        self.assertEqual("ordenes", result["name_sql"])
        self.assertEqual(["PENDIENTE", "HECHO"], result["columns"][0]["enum_values"])
        self.assertFalse(result["columns"][0]["foreign_key"])

    async def test_get_foreign_key_lookup_returns_limited_items(self) -> None:
        db = object()
        lookup_query = AsyncMock(
            return_value=(
                [
                    {"value": "1", "label": "Base A"},
                    {"value": "2", "label": "Base B"},
                ],
                True,
            )
        )

        with (
            patch(
                "src.services.forms.get_allowed_tables",
                new=AsyncMock(return_value={"productos"}),
            ),
            patch(
                "src.services.forms.get_allowed_columns",
                new=AsyncMock(return_value={"id_base"}),
            ),
            patch(
                "src.services.forms._get_foreign_key_metadata",
                new=AsyncMock(
                    return_value={
                        ("productos", "id_base"): {
                            "referenced_schema": "data",
                            "referenced_table": "bases",
                            "referenced_column": "id",
                        }
                    }
                ),
            ),
            patch(
                "src.services.forms._build_fk_reference_cache",
                new=AsyncMock(
                    return_value={
                        ("data", "bases", "id"): {
                            "value_field": "id",
                            "label_field": "nombre",
                        }
                    }
                ),
            ),
            patch(
                "src.services.forms._query_foreign_key_lookup",
                new=lookup_query,
            ),
        ):
            result = await forms.get_foreign_key_lookup(
                db=db,
                table_name="productos",
                column_name="id_base",
                q="bas",
                limit=2,
                offset=0,
            )

        self.assertEqual(2, len(result["items"]))
        self.assertTrue(result["has_more"])
        lookup_query.assert_awaited_once_with(
            db,
            schema_name="data",
            table_name="bases",
            value_field="id",
            label_field="nombre",
            search_q="bas",
            limit=2,
            offset=0,
            label_mode="single",
            label_components=None,
        )

    async def test_get_foreign_key_lookup_rejects_non_fk_column(self) -> None:
        with (
            patch(
                "src.services.forms.get_allowed_tables",
                new=AsyncMock(return_value={"productos"}),
            ),
            patch(
                "src.services.forms.get_allowed_columns",
                new=AsyncMock(return_value={"descripcion"}),
            ),
            patch(
                "src.services.forms._get_foreign_key_metadata",
                new=AsyncMock(return_value={}),
            ),
        ):
            with self.assertRaises(IdentifierValidationError) as error:
                await forms.get_foreign_key_lookup(
                    db=object(),
                    table_name="productos",
                    column_name="descripcion",
                )

        self.assertIn("not a foreign key", error.exception.detail)

    async def test_fk_reference_cache_uses_value_field_as_fallback_label(self) -> None:
        with patch(
            "src.services.forms._get_table_columns",
            new=AsyncMock(
                return_value=[
                    {
                        "column_name": "id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "character_maximum_length": None,
                        "column_default": None,
                        "udt_name": "int4",
                    }
                ]
            ),
        ):
            cache = await forms._build_fk_reference_cache(
                db=object(),
                foreign_keys={
                    ("productos", "id_base"): {
                        "referenced_schema": "data",
                        "referenced_table": "bases",
                        "referenced_column": "id",
                    }
                },
            )

        self.assertEqual(
            {
                "value_field": "id",
                "label_field": "id",
                "label_mode": "single",
                "label_components": None,
            },
            cache[("data", "bases", "id")],
        )

    async def test_fk_reference_cache_builds_tela_composite_strategy(self) -> None:
        with patch(
            "src.services.forms._get_table_columns",
            new=AsyncMock(
                return_value=[
                    {"column_name": "id", "data_type": "integer"},
                    {"column_name": "nombre", "data_type": "text"},
                    {"column_name": "referencia", "data_type": "text"},
                ]
            ),
        ):
            cache = await forms._build_fk_reference_cache(
                db=object(),
                foreign_keys={
                    ("productos", "id_tela"): {
                        "referenced_schema": "data",
                        "referenced_table": "tela",
                        "referenced_column": "id",
                    }
                },
            )

        self.assertEqual(
            {
                "value_field": "id",
                "label_field": "nombre + referencia",
                "label_mode": "tela_composite",
                "label_components": ("nombre", "referencia"),
            },
            cache[("data", "tela", "id")],
        )

    async def test_tela_lookup_query_returns_composite_and_fallback_labels(self) -> None:
        db = AsyncMock()
        db.execute = AsyncMock(
            return_value=_FakeResult(
                [
                    {"value": "1", "label": "Algodon - REF-01"},
                    {"value": "2", "label": "Algodon"},
                    {"value": "3", "label": "REF-03"},
                ]
            )
        )

        result_items, has_more = await forms._query_foreign_key_lookup(
            db=db,
            schema_name="data",
            table_name="tela",
            value_field="id",
            label_field="nombre",
            search_q=None,
            limit=20,
            offset=0,
            label_mode="tela_composite",
            label_components=("nombre", "referencia"),
        )

        self.assertFalse(has_more)
        self.assertEqual(
            [
                {"value": "1", "label": "Algodon - REF-01"},
                {"value": "2", "label": "Algodon"},
                {"value": "3", "label": "REF-03"},
            ],
            result_items,
        )

        query_text = db.execute.await_args.args[0].text
        self.assertIn("CONCAT_WS(' - '", query_text)
        self.assertIn("COALESCE(NULLIF(", query_text)


if __name__ == "__main__":
    unittest.main()
