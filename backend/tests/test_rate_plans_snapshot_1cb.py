"""Phase 1C-b: Rate Plans + immutable commercial snapshot on reservations.

Live HTTP tests against the StayOS NestJS API (port 3001 inside container).
Scope: rate plan CRUD/validation, applicability, daily rates, and the
rateSnapshot exposed on GET /properties/:propertyId/stays/:reservationId.
"""

import os
import time
from datetime import date

import pytest
import requests

BASE_URL = os.environ.get("STAYOS_API_URL", "http://localhost:3001/api/v1").rstrip("/")
ADMIN_EMAIL = "admin@stayos.local"
ADMIN_PASSWORD = "Password123!"
DLX = "9f3f0c8f-5f98-473d-8474-d6301d4640a0"
STE = "0f0b435d-80f7-4dda-a3b6-863e21fe7cab"

STATE: dict = {}
SUFFIX = str(int(time.time()))[-6:]


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="session")
def client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        pytest.fail(f"Login failed {resp.status_code}: {resp.text[:400]}")
    data = resp.json()["data"]
    session.headers.update({"Authorization": f"Bearer {data['accessToken']}"})
    STATE["propertyId"] = data["user"]["propertyId"]
    return session


@pytest.fixture(scope="session")
def prop(client):
    return STATE["propertyId"]


@pytest.fixture(scope="session")
def guest_id(client, prop):
    resp = client.get(f"{BASE_URL}/properties/{prop}/guests?limit=1", timeout=30)
    assert resp.status_code == 200, resp.text[:300]
    body = resp.json()
    items = body["data"] if isinstance(body["data"], list) else body["data"].get("items", [])
    assert items, "no seeded guests available"
    return items[0]["id"]


# ---------------------------------------------------------------- helpers
def rates(prop):
    return f"{BASE_URL}/properties/{prop}/rates"


def create_plan(client, prop, code, **overrides):
    payload = {
        "code": code,
        "name": f"QA Plan {code}",
        "mealPlan": "BREAKFAST",
        "refundable": True,
    }
    payload.update(overrides)
    resp = client.post(f"{rates(prop)}/rate-plans", json=payload, timeout=30)
    assert resp.status_code in (200, 201), f"{resp.status_code}: {resp.text[:400]}"
    return resp.json()["data"]


def apply_room_type(client, prop, plan_id, room_type_id, base_rate, base_occ=2,
                    extra_adult="1500.00", extra_child="750.00"):
    resp = client.put(
        f"{rates(prop)}/rate-plans/{plan_id}/room-types",
        json={
            "roomTypeId": room_type_id,
            "baseOccupancy": base_occ,
            "baseRate": base_rate,
            "extraAdultCharge": extra_adult,
            "extraChildCharge": extra_child,
        },
        timeout=30,
    )
    assert resp.status_code in (200, 201), f"{resp.status_code}: {resp.text[:400]}"
    return resp.json()["data"]


def create_reservation(client, prop, guest_id, room_type_id, arrival, departure,
                       adults=2, status="CONFIRMED", rate_plan_id=None, expect_ok=True):
    payload = {
        "guestId": guest_id,
        "roomTypeId": room_type_id,
        "arrivalDate": arrival,
        "departureDate": departure,
        "adults": adults,
        "status": status,
    }
    if rate_plan_id:
        payload["ratePlanId"] = rate_plan_id
    resp = client.post(f"{BASE_URL}/properties/{prop}/reservations", json=payload, timeout=60)
    if expect_ok:
        assert resp.status_code in (200, 201), f"{resp.status_code}: {resp.text[:500]}"
        res = resp.json()["data"]
        res_id = res.get("id") or res.get("reservation", {}).get("id")
        STATE.setdefault("created_reservations", []).append(res_id)
        return res_id
    return resp


def get_stay(client, prop, reservation_id):
    resp = client.get(f"{BASE_URL}/properties/{prop}/stays/{reservation_id}", timeout=30)
    assert resp.status_code == 200, f"{resp.status_code}: {resp.text[:400]}"
    return resp.json()["data"]["reservation"]


# ---------------------------------------------------------------- rate plan CRUD
class TestRatePlanCrud:
    def test_create_rate_plan(self, client, prop):
        plan = create_plan(client, prop, f"QACRUD{SUFFIX}")
        assert plan["code"] == f"QACRUD{SUFFIX}"
        assert plan["mealPlan"] == "BREAKFAST"
        assert plan["status"] == "ACTIVE"
        assert isinstance(plan["id"], str)
        STATE["crud_plan"] = plan["id"]

    def test_list_rate_plans_contains_created(self, client, prop):
        resp = client.get(f"{rates(prop)}/rate-plans", timeout=30)
        assert resp.status_code == 200
        plans = resp.json()["data"]
        assert any(p["id"] == STATE["crud_plan"] for p in plans)

    def test_get_rate_plan(self, client, prop):
        resp = client.get(f"{rates(prop)}/rate-plans/{STATE['crud_plan']}", timeout=30)
        assert resp.status_code == 200
        plan = resp.json()["data"]
        assert plan["id"] == STATE["crud_plan"]
        assert plan["code"] == f"QACRUD{SUFFIX}"

    def test_patch_rate_plan_status_inactive(self, client, prop):
        resp = client.patch(
            f"{rates(prop)}/rate-plans/{STATE['crud_plan']}",
            json={"name": "QA Renamed Plan", "status": "INACTIVE", "mealPlan": "HALF_BOARD"},
            timeout=30,
        )
        assert resp.status_code == 200, resp.text[:400]
        plan = resp.json()["data"]
        assert plan["status"] == "INACTIVE"
        assert plan["name"] == "QA Renamed Plan"
        # persistence check
        plan2 = client.get(f"{rates(prop)}/rate-plans/{STATE['crud_plan']}", timeout=30).json()["data"]
        assert plan2["status"] == "INACTIVE"
        assert plan2["mealPlan"] == "HALF_BOARD"

    def test_reject_invalid_meal_plan(self, client, prop):
        resp = client.post(
            f"{rates(prop)}/rate-plans",
            json={"code": f"QABAD{SUFFIX}", "name": "Bad meal", "mealPlan": "EP"},
            timeout=30,
        )
        assert resp.status_code == 400, f"expected 400, got {resp.status_code}: {resp.text[:300]}"

    def test_reject_lowercase_code(self, client, prop):
        resp = client.post(
            f"{rates(prop)}/rate-plans",
            json={"code": f"qabad{SUFFIX}", "name": "Bad code"},
            timeout=30,
        )
        assert resp.status_code == 400, f"expected 400, got {resp.status_code}: {resp.text[:300]}"

    def test_reject_code_with_invalid_chars(self, client, prop):
        resp = client.post(
            f"{rates(prop)}/rate-plans",
            json={"code": "QA BAD!", "name": "Bad code"},
            timeout=30,
        )
        assert resp.status_code == 400, f"expected 400, got {resp.status_code}: {resp.text[:300]}"

    def test_duplicate_code_conflict(self, client, prop):
        resp = client.post(
            f"{rates(prop)}/rate-plans",
            json={"code": f"QACRUD{SUFFIX}", "name": "Duplicate code"},
            timeout=30,
        )
        assert resp.status_code in (400, 409), f"expected 400/409, got {resp.status_code}: {resp.text[:300]}"


# ---------------------------------------------------------------- applicability
class TestApplicability:
    def test_upsert_and_list_room_type(self, client, prop):
        plan = create_plan(client, prop, f"QAAPP{SUFFIX}")
        STATE["app_plan"] = plan["id"]
        row = apply_room_type(client, prop, plan["id"], DLX, "5000.00")
        assert row["baseRate"] == "5000.00"
        assert row["baseOccupancy"] == 2
        assert row["extraAdultCharge"] == "1500.00"

        resp = client.get(f"{rates(prop)}/rate-plans/{plan['id']}/room-types", timeout=30)
        assert resp.status_code == 200
        rows = resp.json()["data"]
        assert len(rows) == 1
        assert rows[0]["roomTypeId"] == DLX
        assert rows[0]["baseRate"] == "5000.00"

    def test_upsert_updates_existing(self, client, prop):
        apply_room_type(client, prop, STATE["app_plan"], DLX, "5500.00", extra_adult="1200.00")
        rows = client.get(
            f"{rates(prop)}/rate-plans/{STATE['app_plan']}/room-types", timeout=30
        ).json()["data"]
        assert len(rows) == 1, "upsert must not duplicate rows"
        assert rows[0]["baseRate"] == "5500.00"
        assert rows[0]["extraAdultCharge"] == "1200.00"

    def test_reject_non_numeric_money(self, client, prop):
        resp = client.put(
            f"{rates(prop)}/rate-plans/{STATE['app_plan']}/room-types",
            json={"roomTypeId": DLX, "baseOccupancy": 2, "baseRate": "abc"},
            timeout=30,
        )
        assert resp.status_code == 400, f"expected 400, got {resp.status_code}: {resp.text[:300]}"

    def test_delete_room_type_applicability(self, client, prop):
        resp = client.delete(
            f"{rates(prop)}/rate-plans/{STATE['app_plan']}/room-types/{DLX}", timeout=30
        )
        assert resp.status_code in (200, 204), resp.text[:300]
        rows = client.get(
            f"{rates(prop)}/rate-plans/{STATE['app_plan']}/room-types", timeout=30
        ).json()["data"]
        assert rows == []


# ---------------------------------------------------------------- daily rates
class TestDailyRates:
    def test_create_list_delete_daily_rate(self, client, prop):
        plan = create_plan(client, prop, f"QADR{SUFFIX}")
        apply_room_type(client, prop, plan["id"], DLX, "5000.00")
        resp = client.post(
            f"{rates(prop)}/rate-plans/{plan['id']}/daily-rates",
            json={"roomTypeId": DLX, "stayDate": "2027-05-10", "amount": "6500.00"},
            timeout=30,
        )
        assert resp.status_code in (200, 201), f"{resp.status_code}: {resp.text[:400]}"
        row = resp.json()["data"]
        assert row["amount"] == "6500.00"
        assert str(row["stayDate"]).startswith("2027-05-10")

        listed = client.get(
            f"{rates(prop)}/rate-plans/{plan['id']}/daily-rates", timeout=30
        ).json()["data"]
        assert any(r["id"] == row["id"] for r in listed)

        dele = client.delete(f"{rates(prop)}/daily-rates/{row['id']}", timeout=30)
        assert dele.status_code in (200, 204), dele.text[:300]
        listed2 = client.get(
            f"{rates(prop)}/rate-plans/{plan['id']}/daily-rates", timeout=30
        ).json()["data"]
        assert not any(r["id"] == row["id"] for r in listed2)

    def test_reject_bad_amount(self, client, prop):
        plan_id = STATE["app_plan"]
        resp = client.post(
            f"{rates(prop)}/rate-plans/{plan_id}/daily-rates",
            json={"roomTypeId": DLX, "stayDate": "2027-05-10", "amount": "not-money"},
            timeout=30,
        )
        assert resp.status_code == 400, f"expected 400, got {resp.status_code}: {resp.text[:300]}"


# ---------------------------------------------------------------- PRICED snapshot
class TestPricedSnapshot:
    def test_priced_snapshot_totals(self, client, prop, guest_id):
        plan = create_plan(client, prop, f"QAPRICED{SUFFIX}")
        apply_room_type(client, prop, plan["id"], DLX, "5000.00", base_occ=2,
                        extra_adult="1500.00")
        res_id = create_reservation(
            client, prop, guest_id, DLX, "2027-04-01", "2027-04-03",
            adults=3, status="CONFIRMED", rate_plan_id=plan["id"],
        )
        reservation = get_stay(client, prop, res_id)
        assert reservation["ratePlanId"] == plan["id"]
        snap = reservation["rateSnapshot"]
        assert snap is not None, "rateSnapshot missing on CONFIRMED create"
        assert snap["pricingStatus"] == "PRICED"
        assert snap["ratePlan"]["code"] == f"QAPRICED{SUFFIX}"
        assert snap["nights"] == 2 or len(snap["nights"]) == 2
        occ = snap["occupancy"]
        assert occ["adults"] == 3 and occ["baseOccupancy"] == 2 and occ["extraAdults"] == 1
        totals = snap["totals"]
        assert totals["room"] == "10000.00", totals
        assert totals["extraAdult"] == "3000.00", totals
        assert totals["grandTotal"] == "13000.00", totals
        STATE["immutable_res"] = res_id
        STATE["immutable_snapshot_at"] = snap["snapshotAt"]

    def test_snapshot_policies_resolved(self, client, prop):
        snap = get_stay(client, prop, STATE["immutable_res"])["rateSnapshot"]
        policies = snap.get("policies")
        assert policies, "rateSnapshot.policies empty"
        entries = policies if isinstance(policies, list) else list(policies.values())
        sources = set()
        for entry in entries:
            if isinstance(entry, dict) and "source" in entry:
                sources.add(entry["source"])
        assert sources, f"no policy source found: {policies}"
        assert sources <= {"PROPERTY", "RATE_PLAN"}, sources

    def test_snapshot_not_exposed_on_reservation_detail(self, client, prop):
        resp = client.get(
            f"{BASE_URL}/properties/{prop}/reservations/{STATE['immutable_res']}", timeout=30
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "rateSnapshot" not in data

    def test_snapshot_immutable_on_reread(self, client, prop):
        snap = get_stay(client, prop, STATE["immutable_res"])["rateSnapshot"]
        assert snap["snapshotAt"] == STATE["immutable_snapshot_at"]


# ---------------------------------------------------------------- daily override in snapshot
class TestDailyOverrideSnapshot:
    def test_override_reflected(self, client, prop, guest_id):
        plan = create_plan(client, prop, f"QAOVR{SUFFIX}")
        apply_room_type(client, prop, plan["id"], DLX, "5000.00", base_occ=2)
        resp = client.post(
            f"{rates(prop)}/rate-plans/{plan['id']}/daily-rates",
            json={"roomTypeId": DLX, "stayDate": "2027-04-06", "amount": "6500.00"},
            timeout=30,
        )
        assert resp.status_code in (200, 201), resp.text[:400]
        res_id = create_reservation(
            client, prop, guest_id, DLX, "2027-04-05", "2027-04-07",
            adults=2, rate_plan_id=plan["id"],
        )
        snap = get_stay(client, prop, res_id)["rateSnapshot"]
        nights = snap["nights"]
        assert isinstance(nights, list) and len(nights) == 2, nights
        by_date = {str(n["date"])[:10]: n for n in nights}
        assert by_date["2027-04-05"]["source"] == "BASE_RATE", by_date["2027-04-05"]
        assert by_date["2027-04-05"]["roomRate"] == "5000.00"
        assert by_date["2027-04-06"]["source"] == "DAILY_OVERRIDE", by_date["2027-04-06"]
        assert by_date["2027-04-06"]["roomRate"] == "6500.00"
        assert snap["totals"]["room"] == "11500.00", snap["totals"]


# ---------------------------------------------------------------- default plan fallback
class TestDefaultFallback:
    def test_default_plan_used_when_rate_plan_omitted(self, client, prop, guest_id):
        code = f"QADEF{SUFFIX}"
        # only one default plan is allowed per property; demote any existing one
        existing = client.get(f"{rates(prop)}/rate-plans", timeout=30).json()["data"]
        for p in existing:
            if p.get("isDefault"):
                resp = client.patch(
                    f"{rates(prop)}/rate-plans/{p['id']}", json={"isDefault": False}, timeout=30
                )
                assert resp.status_code == 200, resp.text[:300]
        plan = create_plan(client, prop, code, isDefault=True)
        apply_room_type(client, prop, plan["id"], DLX, "4000.00", base_occ=2)
        STATE["default_plan"] = plan["id"]
        res_id = create_reservation(
            client, prop, guest_id, DLX, "2027-04-10", "2027-04-12", adults=2,
        )
        reservation = get_stay(client, prop, res_id)
        snap = reservation["rateSnapshot"]
        assert snap["pricingStatus"] == "PRICED", snap
        assert snap["ratePlan"]["code"] == code, snap["ratePlan"]
        assert reservation["ratePlanId"] == plan["id"]
        assert snap["totals"]["room"] == "8000.00", snap["totals"]


# ---------------------------------------------------------------- UNPRICED
class TestUnpriced:
    def test_unpriced_when_no_applicable_plan(self, client, prop, guest_id):
        # Ensure no plan (default or otherwise) applies to STE
        plans = client.get(f"{rates(prop)}/rate-plans", timeout=30).json()["data"]
        applicable = []
        for p in plans:
            rows = client.get(
                f"{rates(prop)}/rate-plans/{p['id']}/room-types", timeout=30
            ).json()["data"]
            if any(r["roomTypeId"] == STE for r in rows):
                applicable.append((p, rows))
        for p, rows in applicable:
            resp = client.delete(
                f"{rates(prop)}/rate-plans/{p['id']}/room-types/{STE}", timeout=30
            )
            assert resp.status_code in (200, 204), resp.text[:200]
        res_id = create_reservation(
            client, prop, guest_id, STE, "2027-04-15", "2027-04-17", adults=2,
        )
        reservation = get_stay(client, prop, res_id)
        snap = reservation["rateSnapshot"]
        assert snap is not None, "expected explicit UNPRICED snapshot"
        assert snap["pricingStatus"] == "UNPRICED", snap
        assert snap["reason"] == "NO_APPLICABLE_RATE_PLAN", snap
        assert reservation["ratePlanId"] is None
        assert "totals" not in snap, f"UNPRICED must not fabricate totals: {snap}"


# ---------------------------------------------------------------- PENDING deferral
class TestPendingDeferral:
    def test_pending_has_no_snapshot_then_confirm_freezes(self, client, prop, guest_id):
        code = f"QAPEND{SUFFIX}"
        plan = create_plan(client, prop, code)
        apply_room_type(client, prop, plan["id"], DLX, "3000.00", base_occ=2)
        res_id = create_reservation(
            client, prop, guest_id, DLX, "2027-04-20", "2027-04-22", adults=2,
            status="PENDING", rate_plan_id=plan["id"],
        )
        reservation = get_stay(client, prop, res_id)
        assert reservation["status"] == "PENDING", reservation["status"]
        assert reservation["rateSnapshot"] is None, "PENDING must not be snapshotted"

        resp = client.patch(
            f"{BASE_URL}/properties/{prop}/reservations/{res_id}/confirm", json={}, timeout=60
        )
        assert resp.status_code in (200, 201), f"{resp.status_code}: {resp.text[:400]}"
        reservation = get_stay(client, prop, res_id)
        snap = reservation["rateSnapshot"]
        assert snap is not None and snap["pricingStatus"] == "PRICED", snap
        assert snap["ratePlan"]["code"] == code
        assert snap["totals"]["room"] == "6000.00", snap["totals"]
        first_at = snap["snapshotAt"]
        # immutability across reads
        snap2 = get_stay(client, prop, res_id)["rateSnapshot"]
        assert snap2["snapshotAt"] == first_at


# ---------------------------------------------------------------- rollback
class TestInapplicablePlanRollback:
    def test_inapplicable_plan_fails_and_rolls_back(self, client, prop, guest_id):
        # plan applicable only to DLX, used for an STE reservation
        plan = create_plan(client, prop, f"QAROLL{SUFFIX}")
        apply_room_type(client, prop, plan["id"], DLX, "5000.00")
        before = client.get(
            f"{BASE_URL}/properties/{prop}/reservations?limit=1", timeout=30
        ).json()
        before_total = (before.get("meta") or {}).get("total")
        resp = create_reservation(
            client, prop, guest_id, STE, "2027-04-25", "2027-04-27", adults=2,
            rate_plan_id=plan["id"], expect_ok=False,
        )
        assert resp.status_code in (400, 404), f"expected 400/404, got {resp.status_code}: {resp.text[:400]}"
        after = client.get(
            f"{BASE_URL}/properties/{prop}/reservations?limit=1", timeout=30
        ).json()
        after_total = (after.get("meta") or {}).get("total")
        assert after_total == before_total, f"orphan reservation persisted: {before_total} -> {after_total}"

    def test_inactive_plan_rejected(self, client, prop, guest_id):
        plan = create_plan(client, prop, f"QAINACT{SUFFIX}")
        apply_room_type(client, prop, plan["id"], DLX, "5000.00")
        client.patch(
            f"{rates(prop)}/rate-plans/{plan['id']}", json={"status": "INACTIVE"}, timeout=30
        )
        resp = create_reservation(
            client, prop, guest_id, DLX, "2027-04-28", "2027-04-30", adults=2,
            rate_plan_id=plan["id"], expect_ok=False,
        )
        assert resp.status_code in (400, 404), f"expected 400/404, got {resp.status_code}: {resp.text[:400]}"

    def test_unknown_plan_rejected(self, client, prop, guest_id):
        resp = create_reservation(
            client, prop, guest_id, DLX, "2027-05-01", "2027-05-03", adults=2,
            rate_plan_id="11111111-1111-4111-8111-111111111111", expect_ok=False,
        )
        assert resp.status_code in (400, 404), f"expected 400/404, got {resp.status_code}: {resp.text[:400]}"


# ---------------------------------------------------------------- cleanup
def test_zz_cleanup(client, prop):
    """Cancel reservations created by this suite to release inventory."""
    failures = []
    for res_id in STATE.get("created_reservations", []):
        if not res_id:
            continue
        resp = client.patch(
            f"{BASE_URL}/properties/{prop}/reservations/{res_id}/cancel",
            json={"reason": "QA automated test cleanup"},
            timeout=60,
        )
        if resp.status_code not in (200, 201, 204, 400, 409):
            failures.append((res_id, resp.status_code, resp.text[:150]))
    print(f"cleanup: {len(STATE.get('created_reservations', []))} reservations, failures={failures}")
    assert not failures
