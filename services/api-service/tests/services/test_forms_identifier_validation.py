import unittest
from unittest.mock import AsyncMock, patch

from src.schemas.models import SubmitForm
from src.services.forms import IdentifierValidationError, validate_submit_identifiers


class TestFormsIdentifierValidation(unittest.IsolatedAsyncioTestCase):
    async def test_accepts_allowed_table_and_columns(self) -> None:
        submit_form = SubmitForm(
            table_name="orders",
            data=[
                {"column": "customer_id", "value": 100},
                {"column": "notes", "value": "ok"},
            ],
        )

        with (
            patch("src.services.forms.get_allowed_tables", new=AsyncMock(return_value={"orders"})),
            patch(
                "src.services.forms.get_allowed_columns",
                new=AsyncMock(return_value={"customer_id", "notes"}),
            ),
        ):
            await validate_submit_identifiers(db=object(), submit_form=submit_form)

    async def test_rejects_unknown_table(self) -> None:
        submit_form = SubmitForm(
            table_name="unknown_table",
            data=[{"column": "customer_id", "value": 100}],
        )

        with patch(
            "src.services.forms.get_allowed_tables", new=AsyncMock(return_value={"orders"})
        ):
            with self.assertRaises(IdentifierValidationError) as raised_error:
                await validate_submit_identifiers(db=object(), submit_form=submit_form)

        self.assertIn("Invalid table identifier", raised_error.exception.detail)
        self.assertEqual([], raised_error.exception.invalid_fields)

    async def test_rejects_unknown_column(self) -> None:
        submit_form = SubmitForm(
            table_name="orders",
            data=[
                {"column": "customer_id", "value": 100},
                {"column": "bad_column", "value": "x"},
            ],
        )

        with (
            patch("src.services.forms.get_allowed_tables", new=AsyncMock(return_value={"orders"})),
            patch(
                "src.services.forms.get_allowed_columns",
                new=AsyncMock(return_value={"customer_id"}),
            ),
        ):
            with self.assertRaises(IdentifierValidationError) as raised_error:
                await validate_submit_identifiers(db=object(), submit_form=submit_form)

        self.assertIn("Invalid column identifiers", raised_error.exception.detail)
        self.assertEqual(["bad_column"], raised_error.exception.invalid_fields)


if __name__ == "__main__":
    unittest.main()
