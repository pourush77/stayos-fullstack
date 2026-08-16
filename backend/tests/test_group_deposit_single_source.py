"""Backend tests: property_policies as the AUTHORITATIVE group-deposit source.

Covers:
  GET  /api/v1/properties/:id/policies/GROUP_DEPOSIT   (migrated row)
  PATCH/GET /api/v1/properties/:id                     (compat facade)
  PUT  /api/v1/properties/:id/policies/GROUP_DEPOSIT   (direct policy write)
  GET  /api/v1/properties/:id/operations/group-room-mix-suggestions
"""

import os

import pytest
import requests

BASE_URL = os.environ.get("STAYOS_API_URL", "http://localhost:3001/api/v1")
PROPERTY_ID = os.environ.get("STAYOS_PROPERTY_ID", "9d0680c0-89b0-41d5-ae06-b08cd7bedeae")
EMAIL = "admin@stayos.local"
PASSWORD = "Password123!"

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


@pytest.fixture(scope="module", autouse=True)
def reset_to_none(client):
    """Restore property deposit policy to NONE after the module."""
    yield
    r = patch_property(client, {"groupBookingDepositPolicyType": "NONE"})
    assert r.status_code == 200, f"reset failed {r.status_code}: {r.text[:300]}"


def patch_property(client, body):
    return client.patch(f"{BASE_URL}/properties/{PROPERTY_ID}", json=body, timeout=60)


def get_property(client):
    return client.get(f"{BASE_URL}/properties/{PROPERTY_ID}", timeout=60)


def get_group_policy(client):
    return client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/policies/GROUP_DEPOSIT", timeout=60)


def put_group_policy(client, body):
    return client.put(
        f"{BASE_URL}/properties/{PROPERTY_ID}/policies/GROUP_DEPOSIT", json=body, timeout=60
    )


def get_suggestions(client):
    return client.get(
        f"{BASE_URL}/properties/{PROPERTY_ID}/operations/group-room-mix-suggestions",
        params=SUGGEST_QS,
        timeout=90,
    )


def options_of(payload):
    data = payload.get("data", payload)
    if isinstance(data, dict):
        for key in ("options", "suggestions", "results"):
            if isinstance(data.get(key), list):
                return data[key]
    if isinstance(data, list):
        return data
    return []


# --- migrated data / authoritative source -----------------------------------
class TestMigratedSource:
    def test_group_deposit_policy_row_exists(self, client):
        r = get_group_policy(client)
        assert r.status_code == 200, r.text[:300]
        data = r.json()["data"]
        assert data is not None, "GROUP_DEPOSIT policy row missing (migration backfill failed)"
        assert data["policyType"] == "GROUP_DEPOSIT"
        assert data["propertyId"] == PROPERTY_ID
        assert data["ratePlanId"] is None
        assert data["depositMode"] in ("NONE", "PERCENTAGE", "FIXED_AMOUNT")
        assert "_id" not in data

    def test_legacy_columns_dropped(self, client):
        # facade fields must still be present on the property payload
        r = get_property(client)
        assert r.status_code == 200, r.text[:300]
        prop = r.json()["data"]
        assert "groupBookingDepositPolicyType" in prop
        assert "groupBookingDepositPolicyValue" in prop


# --- facade write -> read via policies --------------------------------------
class TestFacadeSingleSource:
    def test_patch_percentage_reflected_in_property_and_policy(self, client):
        r = patch_property(
            client,
            {"groupBookingDepositPolicyType": "PERCENTAGE", "groupBookingDepositPolicyValue": 20},
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        body = r.json()["data"]
        assert body["groupBookingDepositPolicyType"] == "PERCENTAGE"
        assert float(body["groupBookingDepositPolicyValue"]) == 20

        prop = get_property(client).json()["data"]
        assert prop["groupBookingDepositPolicyType"] == "PERCENTAGE"
        assert float(prop["groupBookingDepositPolicyValue"]) == 20

        policy = get_group_policy(client).json()["data"]
        assert policy["depositMode"] == "PERCENTAGE"
        assert float(policy["depositValue"]) == 20

    def test_direct_policy_put_visible_through_facade(self, client):
        r = put_group_policy(client, {"depositMode": "FIXED_AMOUNT", "depositValue": 2500})
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        policy = r.json()["data"]
        assert policy["depositMode"] == "FIXED_AMOUNT"
        assert float(policy["depositValue"]) == 2500

        prop = get_property(client).json()["data"]
        assert prop["groupBookingDepositPolicyType"] == "FIXED_AMOUNT"
        assert float(prop["groupBookingDepositPolicyValue"]) == 2500


# --- validation through the facade ------------------------------------------
class TestFacadeValidation:
    def test_percentage_over_100_rejected(self, client):
        r = patch_property(
            client,
            {"groupBookingDepositPolicyType": "PERCENTAGE", "groupBookingDepositPolicyValue": 101},
        )
        assert r.status_code == 400, f"{r.status_code}: {r.text[:300]}"
        assert r.json()["success"] is False

    def test_fixed_amount_zero_rejected(self, client):
        r = patch_property(
            client,
            {"groupBookingDepositPolicyType": "FIXED_AMOUNT", "groupBookingDepositPolicyValue": 0},
        )
        assert r.status_code == 400, f"{r.status_code}: {r.text[:300]}"

    def test_invalid_attempts_did_not_mutate_policy(self, client):
        policy = get_group_policy(client).json()["data"]
        assert policy["depositMode"] != "PERCENTAGE" or float(policy["depositValue"]) != 101

    def test_fixed_amount_5000_accepted_and_reflected(self, client):
        r = patch_property(
            client,
            {
                "groupBookingDepositPolicyType": "FIXED_AMOUNT",
                "groupBookingDepositPolicyValue": 5000,
            },
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        prop = get_property(client).json()["data"]
        assert prop["groupBookingDepositPolicyType"] == "FIXED_AMOUNT"
        assert float(prop["groupBookingDepositPolicyValue"]) == 5000
        policy = get_group_policy(client).json()["data"]
        assert policy["depositMode"] == "FIXED_AMOUNT"
        assert float(policy["depositValue"]) == 5000

    def test_none_without_value_accepted_and_zeroed(self, client):
        r = patch_property(client, {"groupBookingDepositPolicyType": "NONE"})
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        prop = get_property(client).json()["data"]
        assert prop["groupBookingDepositPolicyType"] == "NONE"
        # NOTE: facade returns null (legacy column used to return 0) for NONE
        assert float(prop["groupBookingDepositPolicyValue"] or 0) == 0
        policy = get_group_policy(client).json()["data"]
        assert policy["depositMode"] == "NONE"
        assert float(policy["depositValue"] or 0) == 0


# --- group-room-mix resolves from property_policies -------------------------
class TestGroupRoomMixUsesPolicies:
    def test_percentage_reflected_in_suggestions(self, client):
        assert (
            patch_property(
                client,
                {
                    "groupBookingDepositPolicyType": "PERCENTAGE",
                    "groupBookingDepositPolicyValue": 20,
                },
            ).status_code
            == 200
        )
        r = get_suggestions(client)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        options = options_of(r.json())
        assert options, "no options returned"
        for opt in options:
            dep = opt["deposit"]
            assert dep["policyType"] == "PERCENTAGE", dep
            assert float(dep["policyValue"]) == 20, dep
            assert float(dep["suggestedAmount"]) > 0, dep

    def test_none_reflected_in_suggestions_no_400(self, client):
        assert (
            patch_property(client, {"groupBookingDepositPolicyType": "NONE"}).status_code == 200
        )
        r = get_suggestions(client)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        options = options_of(r.json())
        assert options, "no options returned"
        for opt in options:
            dep = opt["deposit"]
            assert dep["policyType"] == "NONE", dep
            assert float(dep["suggestedAmount"]) == 0, dep

    def test_direct_policy_put_reflected_in_suggestions(self, client):
        assert (
            put_group_policy(client, {"depositMode": "FIXED_AMOUNT", "depositValue": 2500}).status_code
            == 200
        )
        r = get_suggestions(client)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        for opt in options_of(r.json()):
            dep = opt["deposit"]
            assert dep["policyType"] == "FIXED_AMOUNT", dep
            assert float(dep["policyValue"]) == 2500, dep
            assert float(dep["suggestedAmount"]) > 0, dep


# --- DTO-level facade validation, atomicity, RBAC ---------------------------
class TestFacadeEdgeCases:
    def test_value_without_type_rejected(self, client):
        r = patch_property(client, {"groupBookingDepositPolicyValue": 30})
        assert r.status_code == 400, f"{r.status_code}: {r.text[:300]}"

    def test_none_with_value_rejected(self, client):
        r = patch_property(
            client,
            {"groupBookingDepositPolicyType": "NONE", "groupBookingDepositPolicyValue": 10},
        )
        assert r.status_code == 400, f"{r.status_code}: {r.text[:300]}"

    def test_invalid_type_rejected(self, client):
        r = patch_property(client, {"groupBookingDepositPolicyType": "FOO"})
        assert r.status_code == 400, f"{r.status_code}: {r.text[:300]}"

    def test_patch_is_atomic_when_policy_write_fails(self, client):
        """A rejected deposit policy must not persist the other property fields."""
        before = get_property(client).json()["data"]
        original_name = before["name"]
        r = patch_property(
            client,
            {
                "name": "TEST_ATOMIC_ROLLBACK",
                "groupBookingDepositPolicyType": "PERCENTAGE",
                "groupBookingDepositPolicyValue": 101,
            },
        )
        assert r.status_code == 400, f"{r.status_code}: {r.text[:300]}"
        after = get_property(client).json()["data"]
        if after["name"] != original_name:
            # restore before failing so later tests / app state stay clean
            patch_property(client, {"name": original_name})
        assert after["name"] == original_name, (
            "Property base fields were persisted even though the deposit policy was rejected"
        )

    def test_readonly_cannot_patch_deposit(self, client):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        lr = s.post(
            f"{BASE_URL}/auth/login",
            json={"email": "readonly@stayos.local", "password": PASSWORD},
            timeout=30,
        )
        assert lr.status_code in (200, 201), lr.text[:300]
        s.headers.update({"Authorization": f"Bearer {lr.json()['data']['accessToken']}"})
        r = s.patch(
            f"{BASE_URL}/properties/{PROPERTY_ID}",
            json={"groupBookingDepositPolicyType": "PERCENTAGE", "groupBookingDepositPolicyValue": 55},
            timeout=60,
        )
        assert r.status_code == 403, f"{r.status_code}: {r.text[:300]}"
        policy = get_group_policy(client).json()["data"]
        assert not (policy["depositMode"] == "PERCENTAGE" and float(policy["depositValue"] or 0) == 55)

    def test_unauthenticated_policy_read_rejected(self, client):
        r = requests.get(f"{BASE_URL}/properties/{PROPERTY_ID}/policies/GROUP_DEPOSIT", timeout=30)
        assert r.status_code == 401, f"{r.status_code}: {r.text[:200]}"
