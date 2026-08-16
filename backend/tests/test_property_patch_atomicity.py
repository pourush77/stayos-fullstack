"""Phase-1A: atomic Property PATCH (base fields + GROUP_DEPOSIT policy) and
DTO shape-only validation / normalizer business rules.

Covers:
  PATCH /api/v1/properties/:id                      (combined atomic update)
  GET   /api/v1/properties/:id                      (compat facade)
  GET   /api/v1/properties/:id/policies/GROUP_DEPOSIT
  GET   /api/v1/properties/:id/operations/group-room-mix-suggestions
"""

import os

import pytest
import requests

BASE_URL = os.environ.get("STAYOS_API_URL", "http://localhost:3001/api/v1")
PROPERTY_ID = os.environ.get("STAYOS_PROPERTY_ID", "9d0680c0-89b0-41d5-ae06-b08cd7bedeae")
EMAIL = "admin@stayos.local"
PASSWORD = "Password123!"
ORIGINAL_NAME = "Hillston Resort"

SUGGEST_QS = {
    "adults": 2,
    "children": 0,
    "arrivalDate": "2026-08-16",
    "departureDate": "2026-08-17",
    "preference": "BEST_FIT",
}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    if r.status_code not in (200, 201):
        pytest.fail(f"Login failed {r.status_code}: {r.text[:400]}")
    token = (r.json().get("data") or {}).get("accessToken")
    if not token:
        pytest.fail(f"No accessToken: {r.text[:400]}")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def patch_property(client, body):
    return client.patch(f"{BASE_URL}/properties/{PROPERTY_ID}", json=body, timeout=60)


def get_property(client):
    return client.get(f"{BASE_URL}/properties/{PROPERTY_ID}", timeout=60)


def prop_data(client):
    r = get_property(client)
    assert r.status_code == 200, f"GET property failed {r.status_code}: {r.text[:300]}"
    return r.json()["data"]


def get_group_policy(client):
    return client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/policies/GROUP_DEPOSIT", timeout=60)


def policy_data(client):
    r = get_group_policy(client)
    assert r.status_code == 200, f"GET policy failed {r.status_code}: {r.text[:300]}"
    return r.json()["data"]


def suggestions(client):
    r = client.get(
        f"{BASE_URL}/properties/{PROPERTY_ID}/operations/group-room-mix-suggestions",
        params=SUGGEST_QS,
        timeout=60,
    )
    return r


@pytest.fixture(scope="module", autouse=True)
def restore_state(client):
    """Restore deposit=NONE and original property name after the module."""
    yield
    r = patch_property(client, {"groupBookingDepositPolicyType": "NONE", "name": ORIGINAL_NAME})
    assert r.status_code == 200, f"reset failed {r.status_code}: {r.text[:300]}"
    data = prop_data(client)
    assert data["name"] == ORIGINAL_NAME
    assert data["groupBookingDepositPolicyType"] == "NONE"


class TestCombinedAtomicCommit:
    """Both base field and deposit policy commit together."""

    def test_combined_patch_commits_name_and_percentage_policy(self, client):
        new_name = "Hillston Resort ATOMIC"
        r = patch_property(
            client,
            {
                "name": new_name,
                "groupBookingDepositPolicyType": "PERCENTAGE",
                "groupBookingDepositPolicyValue": 15,
            },
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        body = r.json()
        assert body["success"] is True
        assert body["data"]["name"] == new_name

        data = prop_data(client)
        assert data["name"] == new_name
        assert data["groupBookingDepositPolicyType"] == "PERCENTAGE"
        assert float(data["groupBookingDepositPolicyValue"]) == 15.0

        pol = policy_data(client)
        assert pol["policyType"] == "GROUP_DEPOSIT"
        assert pol["depositMode"] == "PERCENTAGE"
        assert float(pol["depositValue"]) == 15.0
        assert pol["isActive"] is True

    def test_suggestions_reflect_percentage_policy(self, client):
        r = suggestions(client)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        options = r.json()["data"]["options"]
        assert options, "no room-mix options returned"
        for opt in options:
            dep = opt.get("deposit")
            assert dep is not None, f"missing deposit in option: {str(opt)[:300]}"
            assert dep["policyType"] == "PERCENTAGE", dep
            assert float(dep["suggestedAmount"]) > 0, dep

    def test_fixed_amount_commit(self, client):
        r = patch_property(
            client,
            {"groupBookingDepositPolicyType": "FIXED_AMOUNT", "groupBookingDepositPolicyValue": 5000},
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = prop_data(client)
        assert data["groupBookingDepositPolicyType"] == "FIXED_AMOUNT"
        assert float(data["groupBookingDepositPolicyValue"]) == 5000.0
        pol = policy_data(client)
        assert pol["depositMode"] == "FIXED_AMOUNT"
        assert float(pol["depositValue"]) == 5000.0

    def test_none_clears_value_and_suggestions_zero(self, client):
        r = patch_property(client, {"groupBookingDepositPolicyType": "NONE"})
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = prop_data(client)
        assert data["groupBookingDepositPolicyType"] == "NONE"
        assert float(data["groupBookingDepositPolicyValue"] or 0) == 0.0
        pol = policy_data(client)
        assert pol["depositMode"] == "NONE"
        assert float(pol["depositValue"]) == 0.0

        s = suggestions(client)
        assert s.status_code == 200, f"{s.status_code}: {s.text[:400]}"
        options = s.json()["data"]["options"]
        assert options, "no room-mix options returned"
        for opt in options:
            dep = opt["deposit"]
            assert dep["policyType"] == "NONE", dep
            assert float(dep["suggestedAmount"]) == 0.0, dep
            assert dep["required"] is False, dep


class TestNormalizerBusinessRules:
    """Business rules now enforced by the shared normalizer inside the transaction."""

    @pytest.mark.parametrize(
        "body",
        [
            {"groupBookingDepositPolicyType": "PERCENTAGE", "groupBookingDepositPolicyValue": 101},
            {"groupBookingDepositPolicyType": "PERCENTAGE", "groupBookingDepositPolicyValue": 0},
            {"groupBookingDepositPolicyType": "FIXED_AMOUNT", "groupBookingDepositPolicyValue": 0},
            {"groupBookingDepositPolicyType": "FIXED_AMOUNT", "groupBookingDepositPolicyValue": -10},
            {"groupBookingDepositPolicyType": "NONE", "groupBookingDepositPolicyValue": 10},
            {"groupBookingDepositPolicyType": "PERCENTAGE"},
        ],
        ids=["pct-101", "pct-0", "fixed-0", "fixed-negative", "none-with-value", "pct-missing-value"],
    )
    def test_invalid_deposit_rejected(self, client, body):
        r = patch_property(client, body)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"
        payload = r.json()
        assert payload.get("success") is False
        assert (payload.get("error") or {}).get("code") == "VALIDATION_ERROR", payload

    def test_value_without_type_rejected(self, client):
        r = patch_property(client, {"groupBookingDepositPolicyValue": 20})
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"
        assert (r.json().get("error") or {}).get("code") == "VALIDATION_ERROR"


class TestAtomicRollback:
    """An invalid deposit must roll back the base field update in the same PATCH."""

    def test_rollback_leaves_name_and_policy_unchanged(self, client):
        before = prop_data(client)
        before_name = before["name"]
        before_pol = policy_data(client)

        r = patch_property(
            client,
            {
                "name": "ROLLBACK_TEST_NAME",
                "groupBookingDepositPolicyType": "PERCENTAGE",
                "groupBookingDepositPolicyValue": 101,
            },
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"

        after = prop_data(client)
        assert after["name"] == before_name, "base name was committed despite invalid deposit"
        assert after["name"] != "ROLLBACK_TEST_NAME"
        assert after["groupBookingDepositPolicyType"] == before["groupBookingDepositPolicyType"]

        after_pol = policy_data(client)
        assert after_pol["depositMode"] == before_pol["depositMode"]
        assert float(after_pol["depositValue"]) == float(before_pol["depositValue"])


class TestDtoShapeValidation:
    """Shape/type validation still handled by the DTO."""

    def test_non_numeric_deposit_value_rejected(self, client):
        before_name = prop_data(client)["name"]
        r = patch_property(
            client,
            {
                "name": "SHAPE_TEST_NAME",
                "groupBookingDepositPolicyType": "PERCENTAGE",
                "groupBookingDepositPolicyValue": "abc",
            },
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"
        assert (r.json().get("error") or {}).get("code") == "VALIDATION_ERROR"
        assert prop_data(client)["name"] == before_name

    def test_invalid_enum_rejected(self, client):
        r = patch_property(client, {"groupBookingDepositPolicyType": "HALF"})
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"

    def test_unknown_field_rejected(self, client):
        r = patch_property(client, {"totallyUnknownField": "x"})
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"
        assert (r.json().get("error") or {}).get("code") == "VALIDATION_ERROR"

    def test_numeric_string_value_accepted(self, client):
        r = patch_property(
            client,
            {"groupBookingDepositPolicyType": "PERCENTAGE", "groupBookingDepositPolicyValue": "25"},
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        assert float(prop_data(client)["groupBookingDepositPolicyValue"]) == 25.0


class TestAuthorization:
    def test_readonly_cannot_patch(self):
        s = requests.Session()
        r = s.post(
            f"{BASE_URL}/auth/login",
            json={"email": "readonly@stayos.local", "password": PASSWORD},
            timeout=30,
        )
        assert r.status_code in (200, 201), f"readonly login failed: {r.text[:300]}"
        token = r.json()["data"]["accessToken"]
        s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        resp = s.patch(
            f"{BASE_URL}/properties/{PROPERTY_ID}",
            json={"groupBookingDepositPolicyType": "NONE"},
            timeout=60,
        )
        assert resp.status_code == 403, f"expected 403, got {resp.status_code}: {resp.text[:300]}"

    def test_unauthenticated_patch_rejected(self):
        resp = requests.patch(
            f"{BASE_URL}/properties/{PROPERTY_ID}",
            json={"groupBookingDepositPolicyType": "NONE"},
            timeout=60,
        )
        assert resp.status_code == 401, f"expected 401, got {resp.status_code}"
