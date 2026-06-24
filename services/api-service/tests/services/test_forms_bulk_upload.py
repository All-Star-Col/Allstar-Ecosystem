import unittest
from datetime import date

from src.services.forms_bulk_upload import _parse_purchase_order_delivery_date


class TestPurchaseOrderDeliveryDate(unittest.TestCase):
    def test_empty_delivery_date_stays_empty(self) -> None:
        self.assertIsNone(_parse_purchase_order_delivery_date(""))

    def test_accepts_iso_date(self) -> None:
        self.assertEqual(
            _parse_purchase_order_delivery_date("2026-07-20"),
            date(2026, 7, 20),
        )

    def test_accepts_day_month_year_date(self) -> None:
        self.assertEqual(
            _parse_purchase_order_delivery_date("20/07/2026"),
            date(2026, 7, 20),
        )


if __name__ == "__main__":
    unittest.main()
