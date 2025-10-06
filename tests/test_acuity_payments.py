
import os
import sys
import types
import json
from unittest import mock

os.environ.setdefault("TESTING", "1")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test_secret_key")
os.environ.setdefault("DB_POOL_SIZE", "5")
os.environ.setdefault("DB_MAX_OVERFLOW", "5")

# Prepare a mock module for src.backend.app.db before import
mock_db_module = types.ModuleType("src.backend.app.db")
mock_engine = mock.MagicMock()
mock_session_local = mock.MagicMock()
mock_db_module.engine = mock_engine
mock_db_module.SessionLocal = mock_session_local
mock_db_module.create_engine = mock.MagicMock(return_value=mock_engine)
mock_db_module.sessionmaker = mock.MagicMock(return_value=mock_session_local)
mock_db_module._timestamp_expr = mock.MagicMock()

sys.modules.setdefault("src.backend.app.db", mock_db_module)

import pytest

from src.backend.app.integrations.booking_acuity import (
    _collect_appointment_payments,
    _collect_orders_payments,
    _get_entry,
    import_appointments,
)

TENANT_ID = "00000000-0000-0000-0000-000000000000"


def test_get_entry_initialization():
    ledger = {}
    entry = _get_entry(ledger, "contact-1")
    assert entry["first"] == 0
    assert entry["last"] == 0
    assert entry["txn_count"] == 0
    assert entry["lifetime_cents"] == 0
    assert "_txn_ids" in entry and isinstance(entry["_txn_ids"], set)
    assert "_order_ids" in entry and isinstance(entry["_order_ids"], set)


def test_collect_appointment_payments_updates_ledger():
    ledger = {}
    contact_id = "contact-1"
    client = mock.MagicMock()
    response = mock.MagicMock()
    response.status_code = 200
    response.json.return_value = [
        {"amount": "25.50", "created": "2025-01-01 12:00:00", "transactionID": "txn-1"},
        {"amount": "10", "created": "2025-01-02 12:00:00", "transactionID": "txn-2"},
    ]
    client.get.return_value = response

    _collect_appointment_payments(ledger, contact_id, client, "https://acuityscheduling.com/api/v1", "999")

    entry = ledger[contact_id]
    assert entry["txn_count"] == 2
    assert entry["lifetime_cents"] == 3550
    assert entry["first"] <= entry["last"]
    assert entry["_txn_ids"] == {"txn-1", "txn-2"}


def test_collect_orders_payments_updates_ledger():
    ledger = {}
    email_map = {"jane@example.com": "contact-1"}
    client = mock.MagicMock()
    response = mock.MagicMock()
    response.status_code = 200
    response.json.return_value = [
        {"id": 1, "email": "jane@example.com", "total": "18.25", "time": "2025-02-01 10:00:00"},
        {"id": 2, "email": "jane@example.com", "total": "5.00", "time": "2025-02-02 10:00:00"},
    ]
    client.get.return_value = response

    _collect_orders_payments(ledger, client, "https://acuityscheduling.com/api/v1", email_map)

    entry = ledger["contact-1"]
    assert entry["txn_count"] == 2
    assert entry["lifetime_cents"] == 2325
    assert entry["_order_ids"] == {"1", "2"}


@mock.patch("src.backend.app.integrations.booking_acuity._collect_orders_payments")
@mock.patch("src.backend.app.integrations.booking_acuity._collect_appointment_payments")
@mock.patch("src.backend.app.integrations.booking_acuity.httpx.Client")
@mock.patch("src.backend.app.integrations.booking_acuity._with_conn")
@mock.patch("src.backend.app.integrations.booking_acuity._fetch_acuity_token", return_value="test-token")
def test_import_appointments_calls_payment_helpers(
    mock_fetch_token,
    mock_with_conn,
    mock_http_client,
    mock_collect_appt,
    mock_collect_orders,
):
    conn_ctx = mock.MagicMock()
    mock_with_conn.return_value.__enter__.return_value = conn_ctx

    client_instance = mock.MagicMock()
    mock_http_client.return_value.__enter__.return_value = client_instance

    clients_resp = mock.MagicMock()
    clients_resp.status_code = 200
    clients_resp.json.return_value = [
        {
            "id": "1",
            "firstName": "Jane",
            "lastName": "Doe",
            "email": "jane@example.com",
        }
    ]
    client_instance.get.return_value = clients_resp

    import_appointments(TENANT_ID)

    assert mock_collect_appt.called
    assert mock_collect_orders.called
    assert conn_ctx.execute.called
