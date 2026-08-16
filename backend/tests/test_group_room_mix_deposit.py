"""Backend tests: group booking deposit policy normalization via real endpoints.

Module under test: stayos-api/src/core/operations/services/group-booking-deposit-policy.ts
Endpoints:
  GET   /api/v1/properties/:id/operations/group-room-mix-suggestions
  PATCH /api/v1/properties/:id
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("STAYOS_API_URL", "http://localhost:3001/api/v1")
PROPERTY_ID = "9d0680c0-89b0-41d5-ae06-b08cd7bedeae"
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
        pytest.fail(f"No accessToken in login response: {r.text[:400]}")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def get_suggestions(client):
    return client.get(
        f"{BASE_URL}/properties/{PROPERTY_ID}/operations/group-room-mix-suggestions",
        params=SUGGEST_QS,
        timeout=60,
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


def patch_policy(client, body):
    return client.patch(f"{BASE_URL}/properties/{PROPERTY_ID}", json=body, timeout=30)


def reset_to_none(client):
    r = patch_policy(client, {"groupBookingDepositPolicyType": "NONE"})
    assert r.status_code == 200, f"reset to NONE failed {r.status_code}: {r.text[:400]}"


@pytest.fixture(scope="module", autouse=True)
def restore_policy(client):
    yield
    reset_to_none(client)


class TestGroupRoomMixDepositNone:
    def test_none_policy_returns_200_with_zero_deposit(self, client):
        reset_to_none(client)
        r = get_suggestions(client)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:600]}"
        opts = options_of(r.json())
        assert len(opts) > 0, f"no options returned: {r.text[:600]}"
        for opt in opts:
            dep = opt.get("deposit")
            assert dep is not None, f"missing deposit in option: {opt}"
            assert dep["policyType"] == "NONE"
            assert Number(dep["policyValue"]) == 0
            assert dep["required"] is False
            assert Number(dep["suggestedAmount"]) == 0


def Number(v):
    return float(v)


class TestPolicyRegressions:
    def test_percentage_policy_produces_positive_deposit(self, client):
        r = patch_policy(
            client,
            {"groupBookingDepositPolicyType": "PERCENTAGE", "groupBookingDepositPolicyValue": 20},
        )
        assert r.status_code == 200, f"PATCH PERCENTAGE failed {r.status_code}: {r.text[:400]}"

        g = client.get(f"{BASE_URL}/properties/{PROPERTY_ID}", timeout=30)
        assert g.status_code == 200
        prop = g.json().get("data", g.json())
        assert prop["groupBookingDepositPolicyType"] == "PERCENTAGE"
        assert Number(prop["groupBookingDepositPolicyValue"]) == 20

        s = get_suggestions(client)
        assert s.status_code == 200, f"expected 200, got {s.status_code}: {s.text[:600]}"
        opts = options_of(s.json())
        assert len(opts) > 0
        for opt in opts:
            dep = opt["deposit"]
            assert dep["policyType"] == "PERCENTAGE"
            assert Number(dep["policyValue"]) == 20
            assert dep["required"] is True
            assert Number(dep["suggestedAmount"]) > 0
            # percentage of estimated total
            total = None
            for key in ("estimatedGrandTotal", "grandTotal", "estimatedTotal"):
                if key in opt:
                    total = Number(opt[key])
                    break
            if total is not None and total > 0:
                assert abs(Number(dep["suggestedAmount"]) - round(total * 0.2)) <= 1, (
                    f"deposit {dep['suggestedAmount']} not 20% of {total}"
                )

        # back to NONE
        reset_to_none(client)
        s2 = get_suggestions(client)
        assert s2.status_code == 200, f"expected 200 after reset, got {s2.status_code}: {s2.text[:400]}"
        for opt in options_of(s2.json()):
            assert opt["deposit"]["policyType"] == "NONE"
            assert Number(opt["deposit"]["suggestedAmount"]) == 0
            assert opt["deposit"]["required"] is False

    def test_fixed_amount_policy_persists(self, client):
        r = patch_policy(
            client,
            {"groupBookingDepositPolicyType": "FIXED_AMOUNT", "groupBookingDepositPolicyValue": 5000},
        )
        assert r.status_code == 200, f"PATCH FIXED_AMOUNT failed {r.status_code}: {r.text[:400]}"

        g = client.get(f"{BASE_URL}/properties/{PROPERTY_ID}", timeout=30)
        assert g.status_code == 200
        prop = g.json().get("data", g.json())
        assert prop["groupBookingDepositPolicyType"] == "FIXED_AMOUNT"
        assert Number(prop["groupBookingDepositPolicyValue"]) == 5000

        s = get_suggestions(client)
        assert s.status_code == 200, f"expected 200, got {s.status_code}: {s.text[:600]}"
        for opt in options_of(s.json()):
            dep = opt["deposit"]
            assert dep["policyType"] == "FIXED_AMOUNT"
            assert Number(dep["policyValue"]) == 5000
            assert Number(dep["suggestedAmount"]) > 0

        reset_to_none(client)
        g2 = client.get(f"{BASE_URL}/properties/{PROPERTY_ID}", timeout=30)
        prop2 = g2.json().get("data", g2.json())
        assert prop2["groupBookingDepositPolicyType"] == "NONE"

    def test_invalid_percentage_rejected(self, client):
        r = patch_policy(
            client,
            {"groupBookingDepositPolicyType": "PERCENTAGE", "groupBookingDepositPolicyValue": 150},
        )
        assert r.status_code in (400, 422), f"expected 400/422 for 150%, got {r.status_code}: {r.text[:300]}"

    def test_none_with_positive_value_rejected(self, client):
        r = patch_policy(
            client,
            {"groupBookingDepositPolicyType": "NONE", "groupBookingDepositPolicyValue": 500},
        )
        assert r.status_code in (400, 422), f"expected 400/422 for NONE+500, got {r.status_code}: {r.text[:300]}"
        reset_to_none(client)
