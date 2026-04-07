import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from src.api.v1.routes.workspace.forms.forms import get_forms_service, router
from src.db.database import get_db
from src.schemas.models import ColumnTable, TableForms, User
from src.services.forms import IdentifierValidationError


class FakeFormsService:
    def __init__(self) -> None:
        self.lookup_args = None
        self.raise_lookup_identifier_error = False

    async def get_tables(self):  # pragma: no cover - simple test double
        return [
            TableForms(
                id=10,
                name_sql="productos",
                name_form="Productos",
                category_id=1,
                columns=[
                    ColumnTable(
                        name="id_base",
                        type="integer",
                        nullable=False,
                        required=True,
                        foreign_key=True,
                        foreign_key_table="bases",
                        foreign_key_value_field="id",
                        foreign_key_label_field="nombre",
                        foreign_key_options=None,
                    )
                ],
            )
        ]

    async def get_table(self, table_name: str):  # pragma: no cover - simple test double
        return TableForms(
            id=10,
            name_sql=table_name,
            name_form="Productos",
            category_id=1,
            columns=[
                ColumnTable(
                    name="id_base",
                    type="integer",
                    nullable=False,
                    required=True,
                    foreign_key=True,
                    foreign_key_table="bases",
                    foreign_key_value_field="id",
                    foreign_key_label_field="nombre",
                    foreign_key_options=None,
                )
            ],
        )

    async def get_foreign_key_lookup(
        self,
        *,
        table_name: str,
        column_name: str,
        q: str | None,
        limit: int,
        offset: int,
    ):
        if self.raise_lookup_identifier_error:
            raise IdentifierValidationError("Column is not a foreign key: descripcion")

        self.lookup_args = {
            "table_name": table_name,
            "column_name": column_name,
            "q": q,
            "limit": limit,
            "offset": offset,
        }
        if table_name == "productos" and column_name == "id_tela":
            return {
                "items": [
                    {"value": "11", "label": "Algodon - REF-11"},
                    {"value": "12", "label": "Algodon"},
                    {"value": "13", "label": "REF-13"},
                ],
                "total": None,
                "has_more": False,
            }
        return {
            "items": [{"value": "1", "label": "Base A"}],
            "total": None,
            "has_more": False,
        }


class TestWorkspaceFormsTablesEndpoint(unittest.TestCase):
    def setUp(self) -> None:
        self.fake_forms_service = FakeFormsService()
        self.app = FastAPI()
        self.app.include_router(router, prefix="/api/v1/workspace/forms")

        async def override_get_db():
            yield object()

        self.app.dependency_overrides[get_db] = override_get_db
        self.app.dependency_overrides[get_forms_service] = lambda: self.fake_forms_service
        self.client = TestClient(self.app)

    def _auth_header(self) -> dict[str, str]:
        token = jwt.encode({"sub": "alice"}, "test-secret", algorithm="HS256")
        return {"Authorization": f"Bearer {token}"}

    def test_tables_endpoint_returns_lightweight_metadata(self) -> None:
        async def fake_get_user(_db, username):
            return User(id=uuid4(), username=username, full_name="Alice", disabled=False)

        with (
            patch("src.api.deps.settings.SECRET_KEY", "test-secret"),
            patch("src.api.deps.settings.ALGORITHM", "HS256"),
            patch("src.api.deps.get_user", fake_get_user),
        ):
            response = self.client.get(
                "/api/v1/workspace/forms/tables",
                headers=self._auth_header(),
            )

        self.assertEqual(200, response.status_code)
        self.assertIn("ETag", response.headers)
        body = response.json()
        self.assertTrue(body[0]["columns"][0]["foreign_key"])
        self.assertIsNone(body[0]["columns"][0]["foreign_key_options"])

    def test_table_detail_endpoint_returns_single_table(self) -> None:
        async def fake_get_user(_db, username):
            return User(id=uuid4(), username=username, full_name="Alice", disabled=False)

        with (
            patch("src.api.deps.settings.SECRET_KEY", "test-secret"),
            patch("src.api.deps.settings.ALGORITHM", "HS256"),
            patch("src.api.deps.get_user", fake_get_user),
        ):
            response = self.client.get(
                "/api/v1/workspace/forms/tables/productos",
                headers=self._auth_header(),
            )

        self.assertEqual(200, response.status_code)
        self.assertEqual("productos", response.json()["name_sql"])

    def test_lookup_endpoint_returns_limited_items(self) -> None:
        async def fake_get_user(_db, username):
            return User(id=uuid4(), username=username, full_name="Alice", disabled=False)

        with (
            patch("src.api.deps.settings.SECRET_KEY", "test-secret"),
            patch("src.api.deps.settings.ALGORITHM", "HS256"),
            patch("src.api.deps.get_user", fake_get_user),
        ):
            response = self.client.get(
                "/api/v1/workspace/forms/lookups/productos/id_base?q=bas&limit=1&offset=0",
                headers=self._auth_header(),
            )

        self.assertEqual(200, response.status_code)
        self.assertEqual([{"value": "1", "label": "Base A"}], response.json()["items"])
        self.assertEqual(
            {
                "table_name": "productos",
                "column_name": "id_base",
                "q": "bas",
                "limit": 1,
                "offset": 0,
            },
            self.fake_forms_service.lookup_args,
        )

    def test_lookup_endpoint_maps_identifier_error_to_422(self) -> None:
        self.fake_forms_service.raise_lookup_identifier_error = True

        async def fake_get_user(_db, username):
            return User(id=uuid4(), username=username, full_name="Alice", disabled=False)

        with (
            patch("src.api.deps.settings.SECRET_KEY", "test-secret"),
            patch("src.api.deps.settings.ALGORITHM", "HS256"),
            patch("src.api.deps.get_user", fake_get_user),
        ):
            response = self.client.get(
                "/api/v1/workspace/forms/lookups/productos/descripcion",
                headers=self._auth_header(),
            )

        self.assertEqual(422, response.status_code)
        self.assertEqual("Column is not a foreign key: descripcion", response.json()["detail"])

    def test_lookup_endpoint_tela_returns_composite_labels(self) -> None:
        async def fake_get_user(_db, username):
            return User(id=uuid4(), username=username, full_name="Alice", disabled=False)

        with (
            patch("src.api.deps.settings.SECRET_KEY", "test-secret"),
            patch("src.api.deps.settings.ALGORITHM", "HS256"),
            patch("src.api.deps.get_user", fake_get_user),
        ):
            response = self.client.get(
                "/api/v1/workspace/forms/lookups/productos/id_tela?limit=3",
                headers=self._auth_header(),
            )

        self.assertEqual(200, response.status_code)
        self.assertEqual(
            [
                {"value": "11", "label": "Algodon - REF-11"},
                {"value": "12", "label": "Algodon"},
                {"value": "13", "label": "REF-13"},
            ],
            response.json()["items"],
        )


if __name__ == "__main__":
    unittest.main()
