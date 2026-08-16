"""
Backend tests for StayOS Phase-1 Property/Policy foundation (NestJS API on :3001).

Covers:
  - PUT/GET /api/v1/properties/:id/policies[/:policyType]  (deposit + charge policies)
  - Strict per-type validation, whitelist rejection, invalid enum in URL
  - PUT/GET /api/v1/properties/:id/billing-config
  - GET /api/v1/properties/:id -> businessDayCutOffTime
  - RBAC: settings.manage required for PUT, view perms enough for GET
"""

import os

import pytest
import requests

BASE_URL = os.environ.get("STAYOS_API_URL", "http://localhost:3001/api/v1")
PROPERTY_ID = os.environ.get("STAYOS_PROPERTY_ID", "9d0680c0-89b0-41d5-ae06-b08cd7bedeae")
ADMIN = {"email": "admin@stayos.local", "password": "Password123!"}
READONLY = {"email": "readonly@stayos.local", "password": "Password123!"}


def _login(creds):
    resp = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=30)
    if resp.status_code not in (200, 201):
        pytest.fail(f"Login failed for {creds['email']}: {resp.status_code} {resp.text[:300]}")
    token = resp.json().get("data", {}).get("accessToken")
    if not token:
        pytest.fail(f"No accessToken in login response: {resp.text[:300]}")
    return token


@pytest.fixture(scope="module")
def admin_client():
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_login(ADMIN)}",
    })
    return session


@pytest.fixture(scope="module")
def readonly_client():
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_login(READONLY)}",
    })
    return session


def _policy_url(policy_type=None):
    base = f"{BASE_URL}/properties/{PROPERTY_ID}/policies"
    return f"{base}/{policy_type}" if policy_type else base


def _data(resp):
    body = resp.json()
    assert body.get("success") is True, f"Expected success wrapper, got {body}"
    return body["data"]


def _assert_validation_error(resp):
    assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text[:400]}"
    body = resp.json()
    assert body.get("success") is False
    assert body.get("error", {}).get("code") == "VALIDATION_ERROR", body


# --- Deposit policies ---------------------------------------------------------
class TestDepositPolicies:
    def test_group_deposit_fixed_amount(self, admin_client):
        resp = admin_client.put(
            _policy_url("GROUP_DEPOSIT"),
            json={"depositMode": "FIXED_AMOUNT", "depositValue": 5000},
        )
        assert resp.status_code == 200, resp.text[:400]
        data = _data(resp)
        assert data["policyType"] == "GROUP_DEPOSIT"
        assert data["depositMode"] == "FIXED_AMOUNT"
        assert data["depositValue"] == 5000
        assert data["chargeMode"] is None
        assert data["chargeValue"] is None
        assert data["cancellationCutoffHours"] is None
        assert data["graceMinutes"] is None
        assert data["isActive"] is True
        assert data["ratePlanId"] is None
        assert isinstance(data["id"], str)

        # GET verifies persistence
        got = _data(admin_client.get(_policy_url("GROUP_DEPOSIT")))
        assert got["depositMode"] == "FIXED_AMOUNT"
        assert got["depositValue"] == 5000
        assert got["id"] == data["id"]

    def test_individual_deposit_percentage(self, admin_client):
        resp = admin_client.put(
            _policy_url("INDIVIDUAL_DEPOSIT"),
            json={"depositMode": "PERCENTAGE", "depositValue": 20},
        )
        assert resp.status_code == 200, resp.text[:400]
        data = _data(resp)
        assert data["depositMode"] == "PERCENTAGE"
        assert data["depositValue"] == 20
        assert data["chargeMode"] is None

        got = _data(admin_client.get(_policy_url("INDIVIDUAL_DEPOSIT")))
        assert got["depositMode"] == "PERCENTAGE" and got["depositValue"] == 20

    def test_percentage_above_100_rejected(self, admin_client):
        resp = admin_client.put(
            _policy_url("INDIVIDUAL_DEPOSIT"),
            json={"depositMode": "PERCENTAGE", "depositValue": 101},
        )
        _assert_validation_error(resp)
        # previous valid value untouched
        got = _data(admin_client.get(_policy_url("INDIVIDUAL_DEPOSIT")))
        assert got["depositValue"] == 20

    def test_deposit_mode_none_without_value(self, admin_client):
        resp = admin_client.put(_policy_url("INDIVIDUAL_DEPOSIT"), json={"depositMode": "NONE"})
        assert resp.status_code == 200, resp.text[:400]
        data = _data(resp)
        assert data["depositMode"] == "NONE"
        assert data["depositValue"] == 0
        # restore percentage for idempotent state
        admin_client.put(
            _policy_url("INDIVIDUAL_DEPOSIT"),
            json={"depositMode": "PERCENTAGE", "depositValue": 20},
        )

    def test_deposit_mode_required(self, admin_client):
        resp = admin_client.put(_policy_url("GROUP_DEPOSIT"), json={"depositValue": 100})
        _assert_validation_error(resp)


# --- Charge policies ----------------------------------------------------------
class TestChargePolicies:
    def test_cancellation_first_night_with_cutoff(self, admin_client):
        resp = admin_client.put(
            _policy_url("CANCELLATION"),
            json={"chargeMode": "FIRST_NIGHT", "cancellationCutoffHours": 24},
        )
        assert resp.status_code == 200, resp.text[:400]
        data = _data(resp)
        assert data["chargeMode"] == "FIRST_NIGHT"
        assert data["cancellationCutoffHours"] == 24
        assert data["depositMode"] is None
        assert data["depositValue"] is None

        got = _data(admin_client.get(_policy_url("CANCELLATION")))
        assert got["chargeMode"] == "FIRST_NIGHT" and got["cancellationCutoffHours"] == 24

    def test_cancellation_percentage_over_100_rejected(self, admin_client):
        resp = admin_client.put(
            _policy_url("CANCELLATION"),
            json={"chargeMode": "PERCENTAGE", "chargeValue": 150},
        )
        _assert_validation_error(resp)

    def test_first_night_not_allowed_for_fee_policies(self, admin_client):
        resp = admin_client.put(_policy_url("EARLY_CHECK_IN"), json={"chargeMode": "FIRST_NIGHT"})
        _assert_validation_error(resp)

    def test_late_checkout_fixed_amount_with_grace(self, admin_client):
        resp = admin_client.put(
            _policy_url("LATE_CHECKOUT"),
            json={"chargeMode": "FIXED_AMOUNT", "chargeValue": 750, "graceMinutes": 60},
        )
        assert resp.status_code == 200, resp.text[:400]
        data = _data(resp)
        assert data["chargeMode"] == "FIXED_AMOUNT"
        assert data["chargeValue"] == 750
        assert data["graceMinutes"] == 60
        assert data["depositMode"] is None

        got = _data(admin_client.get(_policy_url("LATE_CHECKOUT")))
        assert got["chargeValue"] == 750 and got["graceMinutes"] == 60

    def test_no_show_first_night_allowed(self, admin_client):
        resp = admin_client.put(_policy_url("NO_SHOW"), json={"chargeMode": "FIRST_NIGHT"})
        assert resp.status_code == 200, resp.text[:400]
        data = _data(resp)
        assert data["chargeMode"] == "FIRST_NIGHT"
        assert data["chargeValue"] == 0

    def test_charge_mode_required(self, admin_client):
        resp = admin_client.put(_policy_url("EARLY_CHECK_IN"), json={"chargeValue": 500})
        _assert_validation_error(resp)

    def test_percentage_requires_value(self, admin_client):
        resp = admin_client.put(_policy_url("EARLY_CHECK_IN"), json={"chargeMode": "PERCENTAGE"})
        _assert_validation_error(resp)


# --- Strict cross-field / whitelist validation --------------------------------
class TestStrictValidation:
    def test_deposit_policy_rejects_charge_field(self, admin_client):
        resp = admin_client.put(
            _policy_url("GROUP_DEPOSIT"),
            json={"depositMode": "FIXED_AMOUNT", "depositValue": 5000, "chargeMode": "PERCENTAGE"},
        )
        _assert_validation_error(resp)

    def test_no_show_rejects_cancellation_cutoff(self, admin_client):
        resp = admin_client.put(
            _policy_url("NO_SHOW"),
            json={"chargeMode": "FIRST_NIGHT", "cancellationCutoffHours": 24},
        )
        _assert_validation_error(resp)

    def test_charge_policy_rejects_deposit_field(self, admin_client):
        resp = admin_client.put(
            _policy_url("CANCELLATION"),
            json={"chargeMode": "FIRST_NIGHT", "depositMode": "PERCENTAGE"},
        )
        _assert_validation_error(resp)

    def test_cancellation_rejects_grace_minutes(self, admin_client):
        resp = admin_client.put(
            _policy_url("CANCELLATION"),
            json={"chargeMode": "FIRST_NIGHT", "graceMinutes": 30},
        )
        _assert_validation_error(resp)

    def test_unknown_field_rejected(self, admin_client):
        resp = admin_client.put(
            _policy_url("GROUP_DEPOSIT"),
            json={"depositMode": "FIXED_AMOUNT", "depositValue": 5000, "bogusField": "x"},
        )
        _assert_validation_error(resp)

    def test_invalid_policy_type_in_url(self, admin_client):
        resp = admin_client.put(_policy_url("FOO"), json={"depositMode": "NONE"})
        assert resp.status_code == 400, resp.text[:300]

    def test_invalid_policy_type_in_url_get(self, admin_client):
        resp = admin_client.get(_policy_url("FOO"))
        assert resp.status_code == 400, resp.text[:300]

    def test_invalid_property_uuid(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/properties/not-a-uuid/policies")
        assert resp.status_code == 400, resp.text[:300]

    def test_unknown_rate_plan_id_should_not_500(self, admin_client):
        """A non-existent ratePlanId must be rejected with 4xx, not a DB FK 500."""
        resp = admin_client.put(
            _policy_url("GROUP_DEPOSIT"),
            json={"depositMode": "NONE", "ratePlanId": "00000000-0000-4000-8000-000000000000"},
        )
        assert resp.status_code < 500, (
            f"Unhandled FK violation -> {resp.status_code}: {resp.text[:300]}"
        )

    def test_get_missing_policy_returns_null(self, admin_client):
        """EARLY_CHECK_IN is not persisted; API returns 200 + data:null (documented behaviour)."""
        resp = admin_client.get(_policy_url("EARLY_CHECK_IN"))
        assert resp.status_code == 200, resp.text[:300]
        assert resp.json()["data"] is None

    def test_unknown_property_id(self, admin_client):
        resp = admin_client.get(
            f"{BASE_URL}/properties/00000000-0000-4000-8000-000000000000/policies"
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text[:300]}"


# --- Listing ------------------------------------------------------------------
class TestPolicyListing:
    def test_list_policies(self, admin_client):
        resp = admin_client.get(_policy_url())
        assert resp.status_code == 200, resp.text[:400]
        data = _data(resp)
        assert isinstance(data, list) and len(data) >= 4
        types = {p["policyType"] for p in data}
        for expected in ["GROUP_DEPOSIT", "INDIVIDUAL_DEPOSIT", "CANCELLATION", "LATE_CHECKOUT"]:
            assert expected in types, f"{expected} missing from {types}"
        for policy in data:
            assert "_id" not in policy
            assert policy["propertyId"] == PROPERTY_ID


# --- Billing config -----------------------------------------------------------
class TestBillingConfig:
    def test_upsert_and_get(self, admin_client):
        payload = {
            "invoicePrefix": "INV-",
            "nextInvoiceNumber": 1,
            "resetSequenceYearly": True,
            "financialYearStartMonth": 4,
            "defaultHsnSac": "996311",
        }
        url = f"{BASE_URL}/properties/{PROPERTY_ID}/billing-config"
        resp = admin_client.put(url, json=payload)
        assert resp.status_code == 200, resp.text[:400]
        data = _data(resp)
        assert data["invoicePrefix"] == "INV-"
        assert data["nextInvoiceNumber"] == 1
        assert data["resetSequenceYearly"] is True
        assert data["financialYearStartMonth"] == 4
        assert data["defaultHsnSac"] == "996311"

        got = _data(admin_client.get(url))
        assert got["invoicePrefix"] == "INV-"
        assert got["nextInvoiceNumber"] == 1
        assert got["financialYearStartMonth"] == 4
        assert got["defaultHsnSac"] == "996311"
        assert got["propertyId"] == PROPERTY_ID

    def test_invalid_financial_year_month(self, admin_client):
        resp = admin_client.put(
            f"{BASE_URL}/properties/{PROPERTY_ID}/billing-config",
            json={
                "invoicePrefix": "INV-",
                "nextInvoiceNumber": 1,
                "resetSequenceYearly": True,
                "financialYearStartMonth": 13,
            },
        )
        _assert_validation_error(resp)

    def test_invalid_next_invoice_number(self, admin_client):
        resp = admin_client.put(
            f"{BASE_URL}/properties/{PROPERTY_ID}/billing-config",
            json={
                "invoicePrefix": "INV-",
                "nextInvoiceNumber": 0,
                "resetSequenceYearly": True,
                "financialYearStartMonth": 4,
            },
        )
        _assert_validation_error(resp)

    def test_unknown_field_rejected(self, admin_client):
        resp = admin_client.put(
            f"{BASE_URL}/properties/{PROPERTY_ID}/billing-config",
            json={
                "invoicePrefix": "INV-",
                "nextInvoiceNumber": 1,
                "resetSequenceYearly": True,
                "financialYearStartMonth": 4,
                "bogus": 1,
            },
        )
        _assert_validation_error(resp)

    def test_invalid_prefix_characters(self, admin_client):
        resp = admin_client.put(
            f"{BASE_URL}/properties/{PROPERTY_ID}/billing-config",
            json={
                "invoicePrefix": "INV_#!",
                "nextInvoiceNumber": 1,
                "resetSequenceYearly": True,
                "financialYearStartMonth": 4,
            },
        )
        _assert_validation_error(resp)

    def test_config_persisted_after_invalid_attempts(self, admin_client):
        got = _data(admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/billing-config"))
        assert got["nextInvoiceNumber"] == 1 and got["financialYearStartMonth"] == 4


# --- Business date ------------------------------------------------------------
class TestBusinessDay:
    def test_property_exposes_business_day_cutoff(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}")
        assert resp.status_code == 200, resp.text[:400]
        data = _data(resp)
        assert "businessDayCutOffTime" in data, f"keys: {sorted(data.keys())}"
        assert isinstance(data["businessDayCutOffTime"], str)
        assert data["businessDayCutOffTime"] == "00:00:00"


# --- RBAC ---------------------------------------------------------------------
class TestRbac:
    def test_readonly_cannot_put_policy(self, readonly_client):
        resp = readonly_client.put(
            _policy_url("GROUP_DEPOSIT"), json={"depositMode": "NONE"}
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text[:300]}"

    def test_readonly_can_get_policies(self, readonly_client):
        resp = readonly_client.get(_policy_url())
        assert resp.status_code == 200, resp.text[:300]
        assert isinstance(_data(resp), list)

    def test_readonly_cannot_put_billing_config(self, readonly_client):
        resp = readonly_client.put(
            f"{BASE_URL}/properties/{PROPERTY_ID}/billing-config",
            json={
                "invoicePrefix": "RO-",
                "nextInvoiceNumber": 9,
                "resetSequenceYearly": False,
                "financialYearStartMonth": 1,
            },
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text[:300]}"

    def test_readonly_can_get_billing_config(self, readonly_client):
        resp = readonly_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/billing-config")
        assert resp.status_code == 200, resp.text[:300]

    def test_unauthenticated_rejected(self):
        resp = requests.get(_policy_url(), timeout=30)
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text[:200]}"
