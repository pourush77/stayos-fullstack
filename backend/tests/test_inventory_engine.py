"""
StayOS Phase-1C-a4: Inventory engine hardening (overbooking rejection / release / reconciliation)

Modules under test:
  stayos-api/src/core/inventory/availability.service.ts
  stayos-api/src/core/inventory/inventory-reconciliation.service.ts
  stayos-api/src/core/inventory/inventory.controller.ts
  stayos-api/src/core/reservations/** (inventory reserve/release wiring)

API: NestJS on http://localhost:3001/api/v1 (per /app/memory/test_credentials.md note)
Tests are order-dependent within a module (sequential run, no xdist).
"""

import os
import subprocess

import pytest
import requests

BASE_URL = os.environ.get("STAYOS_API_URL", "http://localhost:3001/api/v1").rstrip("/")
PROPERTY_ID = "9d0680c0-89b0-41d5-ae06-b08cd7bedeae"
GUEST_ID = "c075dfdb-b379-48aa-bf6e-3eab86b605b7"
SUITE_ROOM_TYPE_ID = "0f0b435d-80f7-4dda-a3b6-863e21fe7cab"  # capacity 5
ADMIN = {"email": "admin@stayos.local", "password": "Password123!"}

ARRIVAL = "2042-06-01"
DEPARTURE = "2042-06-02"
CAPACITY = 5
INVENTORY_UNAVAILABLE = "INVENTORY_UNAVAILABLE"

CREATED = []  # reservation ids created by this module (for cleanup)


# --- helpers -----------------------------------------------------------------
def _psql(sql):
    env = dict(os.environ, PGPASSWORD="StayOS@2026")
    out = subprocess.run(
        ["psql", "-h", "localhost", "-U", "stayos", "-d", "stayos_dev", "-t", "-A", "-c", sql],
        capture_output=True, text=True, env=env, timeout=60,
    )
    if out.returncode != 0:
        pytest.fail(f"psql failed: {out.stderr[:400]}")
    return out.stdout.strip()


def _sold(date_str=ARRIVAL, room_type=SUITE_ROOM_TYPE_ID):
    val = _psql(
        f"SELECT sold FROM room_type_inventory WHERE property_id='{PROPERTY_ID}' "
        f"AND room_type_id='{room_type}' AND date='{date_str}'"
    )
    return None if val == "" else int(val)


def _consuming_count(date_str=ARRIVAL, room_type=SUITE_ROOM_TYPE_ID):
    return int(_psql(
        f"SELECT COUNT(*) FROM reservations WHERE property_id='{PROPERTY_ID}' "
        f"AND room_type_id='{room_type}' AND status IN ('PENDING','CONFIRMED','CHECKED_IN') "
        f"AND arrival_date <= '{date_str}' AND departure_date > '{date_str}'"
    ))


@pytest.fixture(scope="module")
def token():
    res = requests.post(f"{BASE_URL}/auth/login", json=ADMIN, timeout=30)
    if res.status_code not in (200, 201):
        pytest.fail(f"Login failed: {res.status_code} {res.text[:300]}")
    tok = res.json().get("data", {}).get("accessToken")
    if not tok:
        pytest.fail(f"No accessToken in login response: {res.text[:300]}")
    return tok


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


def _create(client, arrival=ARRIVAL, departure=DEPARTURE, room_type=SUITE_ROOM_TYPE_ID):
    return client.post(
        f"{BASE_URL}/properties/{PROPERTY_ID}/reservations",
        json={
            "guestId": GUEST_ID,
            "arrivalDate": arrival,
            "departureDate": departure,
            "adults": 1,
            "roomTypeId": room_type,
        },
        timeout=60,
    )


def _cancel(client, rid):
    return client.patch(
        f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{rid}/cancel",
        json={"reason": "test"}, timeout=60,
    )


def _reconcile(client):
    return client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/inventory/reconciliation", timeout=90)


# --- fixture sanity ----------------------------------------------------------
class TestFixtureBaseline:
    def test_suite_capacity_is_five_active_rooms(self):
        active = int(_psql(
            f"SELECT COUNT(*) FROM rooms WHERE property_id='{PROPERTY_ID}' "
            f"AND room_type_id='{SUITE_ROOM_TYPE_ID}' AND status='ACTIVE'"
        ))
        assert active == CAPACITY, f"expected capacity {CAPACITY}, got {active}"

    def test_target_night_is_clean(self):
        assert _consuming_count() == 0, "target night 2042-06-01 already has consuming reservations"
        sold = _sold()
        assert sold in (None, 0), f"target night already has sold={sold}"


# --- reconciliation health-check --------------------------------------------
class TestReconciliationEndpoint:
    def test_requires_auth(self):
        res = requests.get(
            f"{BASE_URL}/properties/{PROPERTY_ID}/inventory/reconciliation", timeout=60
        )
        assert res.status_code == 401, f"expected 401, got {res.status_code} {res.text[:300]}"

    def test_rejects_invalid_property_uuid(self, client):
        res = client.get(f"{BASE_URL}/properties/not-a-uuid/inventory/reconciliation", timeout=60)
        assert res.status_code == 400, f"expected 400, got {res.status_code}"

    def test_response_shape(self, client):
        res = _reconcile(client)
        assert res.status_code == 200, f"{res.status_code} {res.text[:400]}"
        body = res.json()
        assert body["success"] is True
        data = body["data"]
        assert isinstance(data["consistent"], bool)
        assert isinstance(data["countsByType"], dict)
        assert isinstance(data["discrepancies"], list)
        for key in ("MISSING_ROW", "ORPHAN_SOLD", "SOLD_MISMATCH", "CAPACITY_MISMATCH", "OVERSELL"):
            assert key in data["countsByType"], f"missing counter {key}"
            assert isinstance(data["countsByType"][key], int)
        # consistent flag must agree with discrepancy list
        assert data["consistent"] == (len(data["discrepancies"]) == 0)
        assert sum(data["countsByType"].values()) == len(data["discrepancies"])

    def test_is_read_only_identical_counts_across_two_calls(self, client):
        before_rows = _psql(
            "SELECT count(*), coalesce(sum(sold),0), coalesce(sum(capacity),0) "
            f"FROM room_type_inventory WHERE property_id='{PROPERTY_ID}'"
        )
        first = _reconcile(client)
        second = _reconcile(client)
        assert first.status_code == 200 and second.status_code == 200
        c1 = first.json()["data"]["countsByType"]
        c2 = second.json()["data"]["countsByType"]
        assert c1 == c2, f"countsByType changed between calls: {c1} != {c2}"
        assert first.json()["data"]["consistent"] == second.json()["data"]["consistent"]
        after_rows = _psql(
            "SELECT count(*), coalesce(sum(sold),0), coalesce(sum(capacity),0) "
            f"FROM room_type_inventory WHERE property_id='{PROPERTY_ID}'"
        )
        assert before_rows == after_rows, f"ledger mutated by read: {before_rows} -> {after_rows}"


# --- overbooking + release ---------------------------------------------------
class TestOverbookingAndRelease:
    def test_first_five_creates_succeed(self, client):
        for i in range(CAPACITY):
            res = _create(client)
            assert res.status_code in (200, 201), (
                f"create #{i + 1} failed: {res.status_code} {res.text[:400]}"
            )
            rid = res.json()["data"]["id"]
            CREATED.append(rid)
        assert len(CREATED) == CAPACITY
        assert _sold() == CAPACITY, f"ledger sold should be {CAPACITY}, got {_sold()}"
        assert _consuming_count() == CAPACITY

    def test_sixth_create_rejected_with_409_inventory_unavailable(self, client):
        res = _create(client)
        assert res.status_code == 409, f"expected 409, got {res.status_code} {res.text[:400]}"
        body = res.json()
        code = body.get("code") or body.get("error", {}).get("code") or body.get("errorCode")
        assert code == INVENTORY_UNAVAILABLE, f"expected {INVENTORY_UNAVAILABLE}, body={body}"
        # No leaked reservation, no ledger drift
        assert _consuming_count() == CAPACITY, "overbooked reservation leaked into DB"
        assert _sold() == CAPACITY, f"sold drifted to {_sold()} after rejected create"

    def test_repeated_overbooking_attempts_never_exceed_capacity(self, client):
        for _ in range(3):
            res = _create(client)
            assert res.status_code == 409
        assert _consuming_count() == CAPACITY
        assert _sold() == CAPACITY

    def test_cancel_releases_one_unit(self, client):
        rid = CREATED[0]
        res = _cancel(client, rid)
        assert res.status_code == 200, f"cancel failed: {res.status_code} {res.text[:400]}"
        assert res.json()["data"]["status"] == "CANCELLED"
        assert _sold() == CAPACITY - 1, f"expected sold {CAPACITY - 1}, got {_sold()}"
        assert _consuming_count() == CAPACITY - 1

    def test_new_create_succeeds_after_release(self, client):
        res = _create(client)
        assert res.status_code in (200, 201), f"{res.status_code} {res.text[:400]}"
        CREATED.append(res.json()["data"]["id"])
        assert _sold() == CAPACITY
        assert _consuming_count() == CAPACITY

    def test_full_again_after_backfill(self, client):
        res = _create(client)
        assert res.status_code == 409, f"expected 409, got {res.status_code} {res.text[:400]}"
        body = res.json()
        code = body.get("code") or body.get("error", {}).get("code") or body.get("errorCode")
        assert code == INVENTORY_UNAVAILABLE


# --- concurrency: last unit must be sold exactly once -----------------------
CONC_ARRIVAL = "2042-06-10"
CONC_DEPARTURE = "2042-06-11"


class TestConcurrentLastUnit:
    def test_fill_to_one_remaining(self, client):
        assert _consuming_count(CONC_ARRIVAL) == 0, "concurrency night not clean"
        for _ in range(CAPACITY - 1):
            res = _create(client, CONC_ARRIVAL, CONC_DEPARTURE)
            assert res.status_code in (200, 201), f"{res.status_code} {res.text[:300]}"
            CREATED.append(res.json()["data"]["id"])
        assert _sold(CONC_ARRIVAL) == CAPACITY - 1

    def test_parallel_creates_sell_last_unit_once(self, token):
        import concurrent.futures

        def attempt(_):
            s = requests.Session()
            s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
            r = _create(s, CONC_ARRIVAL, CONC_DEPARTURE)
            return r.status_code, r.text

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(attempt, range(5)))

        successes = [r for r in results if r[0] in (200, 201)]
        conflicts = [r for r in results if r[0] == 409]
        others = [r for r in results if r[0] not in (200, 201, 409)]
        for status, text in successes:
            import json as _json
            CREATED.append(_json.loads(text)["data"]["id"])
        assert others == [], f"unexpected statuses in concurrent burst: {[(s, t[:200]) for s, t in others]}"
        assert len(successes) == 1, (
            f"expected exactly 1 success for the last unit, got {len(successes)} "
            f"(statuses={[r[0] for r in results]})"
        )
        assert len(conflicts) == 4
        assert _sold(CONC_ARRIVAL) == CAPACITY, f"sold={_sold(CONC_ARRIVAL)} after burst"
        assert _consuming_count(CONC_ARRIVAL) == CAPACITY


# --- lifecycle regression ----------------------------------------------------
class TestLifecycleRegression:
    def test_create_confirm_cancel(self, client):
        res = _create(client, arrival="2042-07-10", departure="2042-07-11")
        assert res.status_code in (200, 201), f"create: {res.status_code} {res.text[:400]}"
        created = res.json()["data"]
        rid = created["id"]
        CREATED.append(rid)
        sold_after_create = _sold("2042-07-10")
        assert sold_after_create == 1, f"expected sold 1, got {sold_after_create}"

        confirm = client.patch(
            f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{rid}/confirm", json={}, timeout=60
        )
        if created["status"] == "PENDING":
            assert confirm.status_code == 200, f"confirm: {confirm.status_code} {confirm.text[:400]}"
            assert confirm.json()["data"]["status"] == "CONFIRMED"
        else:
            # Creates land directly in CONFIRMED, so an explicit confirm is a
            # no-op transition and must be rejected (documented behaviour).
            assert created["status"] == "CONFIRMED", f"unexpected create status {created['status']}"
            assert confirm.status_code == 400, f"confirm: {confirm.status_code} {confirm.text[:400]}"
            assert (
                confirm.json()["error"]["code"] == "INVALID_RESERVATION_STATE_TRANSITION"
            ), confirm.text[:300]
        assert _sold("2042-07-10") == 1, "confirm must not double-consume inventory"

        cancel = _cancel(client, rid)
        assert cancel.status_code == 200, f"cancel: {cancel.status_code} {cancel.text[:400]}"
        assert cancel.json()["data"]["status"] == "CANCELLED"
        assert _sold("2042-07-10") == 0, f"cancel must release, sold={_sold('2042-07-10')}"


# --- cleanup -----------------------------------------------------------------
class TestCleanup:
    def test_cancel_all_created_reservations(self, client):
        failures = []
        for rid in CREATED:
            res = _cancel(client, rid)
            if res.status_code not in (200, 400):  # 400 = already terminal (cancelled earlier)
                failures.append((rid, res.status_code, res.text[:200]))
        assert not failures, f"cleanup failures: {failures}"
        assert _consuming_count() == 0, "test-night still has consuming reservations"
        assert _sold() == 0, f"test-night ledger not fully released, sold={_sold()}"
        assert _consuming_count(CONC_ARRIVAL) == 0
        assert _sold(CONC_ARRIVAL) == 0, f"concurrency-night sold={_sold(CONC_ARRIVAL)}"

    def test_no_residual_discrepancies_for_test_night(self, client):
        res = _reconcile(client)
        assert res.status_code == 200
        residual = [
            d for d in res.json()["data"]["discrepancies"]
            if d["date"] in (ARRIVAL, CONC_ARRIVAL, "2042-07-10")
        ]
        assert residual == [], f"test data left drift: {residual}"
