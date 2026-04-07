import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

# Mock database settings before importing modules that depend on them
with (
    patch(
        "src.core.config.settings.POSTGRES_URL_DATABASE",
        "postgresql+asyncpg://user:pass@localhost/db",
    ),
    patch(
        "src.core.config.settings.SQLSERVER_URL_DATABASE",
        "mssql+pyodbc://user:pass@localhost/db",
    ),
):
    from src.api.v1.routes.workspace.forms.forms import get_forms_service, router
    from src.db.database import get_db

from src.schemas.models import User
from src.services.forms import IdentifierValidationError


class FakeFormsService:
    def __init__(self) -> None:
        self.submit_calls = 0
        self.raise_identifier_error = False

    async def submit_form(self, submit_data):  # pragma: no cover - simple test double
        self.submit_calls += 1
        if self.raise_identifier_error:
            raise IdentifierValidationError("Invalid table identifier: unknown_table")
        return "corr-123"


class TestWorkspaceFormsAuthAndValidation(unittest.TestCase):
    def setUp(self) -> None:
        self.fake_forms_service = FakeFormsService()
        self.app = FastAPI()
        self.app.include_router(router, prefix="/api/v1/workspace/forms")

        async def override_get_db():
            yield object()

        self.app.dependency_overrides[get_db] = override_get_db
        self.app.dependency_overrides[get_forms_service] = lambda: (
            self.fake_forms_service
        )
        self.client = TestClient(self.app)
        self.submit_payload = {
            "table_name": "orders",
            "data": [{"column": "customer_id", "value": 100}],
        }

    def _auth_header(self) -> dict[str, str]:
        token = jwt.encode({"sub": "alice"}, "test-secret", algorithm="HS256")
        return {"Authorization": f"Bearer {token}"}

    def test_submit_without_token_returns_401_and_skips_service(self) -> None:
        response = self.client.post(
            "/api/v1/workspace/forms/submit", json=self.submit_payload
        )

        self.assertEqual(401, response.status_code)
        self.assertEqual(0, self.fake_forms_service.submit_calls)

    def test_submit_with_invalid_token_returns_401_and_skips_service(self) -> None:
        response = self.client.post(
            "/api/v1/workspace/forms/submit",
            json=self.submit_payload,
            headers={"Authorization": "Bearer invalid-token"},
        )

        self.assertEqual(401, response.status_code)
        self.assertEqual(0, self.fake_forms_service.submit_calls)

    def test_submit_with_valid_token_returns_success_shape(self) -> None:
        async def fake_get_user(_db, username):
            return User(
                id=uuid4(), username=username, full_name="Alice", disabled=False
            )

        with (
            patch("src.api.deps.settings.SECRET_KEY", "test-secret"),
            patch("src.api.deps.settings.ALGORITHM", "HS256"),
            patch(
                "src.core.config.settings.POSTGRES_URL_DATABASE",
                "postgresql://user:pass@localhost/db",
            ),
            patch(
                "src.core.config.settings.SQLSERVER_URL_DATABASE",
                "mssql+pyodbc://user:pass@localhost/db",
            ),
            patch("src.api.deps.get_user", fake_get_user),
        ):
            response = self.client.post(
                "/api/v1/workspace/forms/submit",
                json=self.submit_payload,
                headers=self._auth_header(),
            )

        self.assertEqual(200, response.status_code)
        self.assertEqual(
            {"status": "success", "correlation_id": "corr-123"}, response.json()
        )
        self.assertEqual(1, self.fake_forms_service.submit_calls)

    def test_submit_maps_identifier_error_to_422(self) -> None:
        async def fake_get_user(_db, username):
            return User(
                id=uuid4(), username=username, full_name="Alice", disabled=False
            )

        self.fake_forms_service.raise_identifier_error = True

        with (
            patch("src.api.deps.settings.SECRET_KEY", "test-secret"),
            patch("src.api.deps.settings.ALGORITHM", "HS256"),
            patch(
                "src.core.config.settings.POSTGRES_URL_DATABASE",
                "postgresql://user:pass@localhost/db",
            ),
            patch(
                "src.core.config.settings.SQLSERVER_URL_DATABASE",
                "mssql+pyodbc://user:pass@localhost/db",
            ),
            patch("src.api.deps.get_user", fake_get_user),
        ):
            response = self.client.post(
                "/api/v1/workspace/forms/submit",
                json=self.submit_payload,
                headers=self._auth_header(),
            )

        self.assertEqual(422, response.status_code)
        self.assertEqual(
            "Invalid table identifier: unknown_table", response.json()["detail"]
        )
        self.assertEqual(1, self.fake_forms_service.submit_calls)


if __name__ == "__main__":
    unittest.main()
