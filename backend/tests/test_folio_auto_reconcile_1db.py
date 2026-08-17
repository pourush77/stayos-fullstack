"""Phase 1D-b HARDENING — INDEPENDENT verification of AUTOMATIC folio
reconciliation wired into the commercial reservation amendment flows.

Scope (strictly this slice):
  * ReservationsService.update()  -> reconcileRoomChargesOnManager
  * ReservationWorkflowService.extendStay() -> postExtensionSnapshotVersion -> reconcile
  * Idempotency / skip-legacy / no-folio / transactional rollback

Self-cleaning: all reservations, folios, snapshots, rate plans and restrictions
created here are removed in the session teardown.
"""

import json
import os
import subprocess
import urllib.error
import urllib.request
from datetime import date, timedelta

import pytest

API = os.environ.get("STAYOS_API_BASE", "http://localhost:3001/api/v1")
PID = "9d0680c0-89b0-41d5-ae06-b08cd7bedeae"
GUEST = "c075dfdb-b379-48aa-bf6e-3eab86b605b7"
DELUXE = "9f3f0c8f-5f98-473d-8474-d6301d4640a0"
ROOM = "506aa477-ca17-4b2f-a9c4-04526f6a962c"
BASE = date(2030, 5, 4)  # far-future, isolated from other suites / prior runs
TAG = "T1RECON"

_STATE = {"rids": [], "plans": [], "restrictions": []}


def d(off):
    return (BASE + timedelta(days=off)).isoformat()


def req(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def psql(sql):
    out = subprocess.run(
        ["psql", "-h", "localhost", "-U", "stayos", "-d", "stayos_dev", "-tAc", sql],
        capture_output=True,
        text=True,
        env={"PGPASSWORD": "StayOS@2026", "PATH": "/usr/bin:/bin"},
    )
    if out.returncode != 0 and out.stderr.strip():
        raise RuntimeError(f"psql failed: {out.stderr.strip()[:300]}")
    return out.stdout.strip()


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="session")
def token():
    status, body = req(
        "POST",
        "/auth/login",
        body={"email": "admin@stayos.local", "password": "Password123!"},
    )
    if status not in (200, 201) or not body.get("data", {}).get("accessToken"):
        pytest.fail(f"Login failed {status}: {str(body)[:300]}")
    return body["data"]["accessToken"]


@pytest.fixture(scope="session", autouse=True)
def _cleanup(token):
    yield
    for rid in _STATE["rids"]:
        req("PATCH", f"/properties/{PID}/reservations/{rid}/cancel", token, {"reason": "cleanup"})
    if _STATE["rids"]:
        il = ",".join(f"'{i}'" for i in _STATE["rids"])
        folios = [x for x in psql(f"select id from folios where reservation_id in ({il})").split("\n") if x]
        if folios:
            fl = ",".join(f"'{x}'" for x in folios)
            psql(
                f"delete from folio_payments where folio_id in ({fl});"
                f"delete from folio_charges where folio_id in ({fl});"
                f"delete from folios where id in ({fl})"
            )
        psql(f"delete from reservation_rate_snapshots where reservation_id in ({il})")
        psql(f"delete from audit_events where entity_id in ({il});delete from activity_events where entity_id in ({il})")
        psql(f"delete from reservations where id in ({il})")
    for dt in _STATE["restrictions"]:
        psql(f"delete from rate_restrictions where property_id='{PID}' and date='{dt}'")
    if _STATE["plans"]:
        pl = ",".join(f"'{p}'" for p in _STATE["plans"])
        psql(f"delete from rate_plan_room_types where rate_plan_id in ({pl})")
        psql(f"delete from room_type_daily_rates where rate_plan_id in ({pl})")
        psql(f"delete from property_policies where rate_plan_id in ({pl})")
        psql(f"delete from rate_plans where id in ({pl})")
    psql(f"delete from room_type_inventory where date>='{d(0)}' and date<='{d(120)}' and sold=0")


@pytest.fixture(scope="session")
def plans(token):
    """Seed two ACTIVE rate plans applicable to Deluxe so snapshots are PRICED."""
    made = {}
    for code, rate, is_default in ((f"{TAG}A", "5000.00", True), (f"{TAG}B", "7000.00", False)):
        status, body = req(
            "POST",
            f"/properties/{PID}/rates/rate-plans",
            token,
            {"code": code, "name": code, "status": "ACTIVE", "isDefault": is_default},
        )
        assert status == 201, f"rate-plan create failed {status}: {str(body)[:300]}"
        plan_id = body["data"]["id"]
        _STATE["plans"].append(plan_id)
        s2, b2 = req(
            "PUT",
            f"/properties/{PID}/rates/rate-plans/{plan_id}/room-types",
            token,
            {"roomTypeId": DELUXE, "baseOccupancy": 2, "baseRate": rate},
        )
        assert s2 in (200, 201), f"room-type applicability failed {s2}: {str(b2)[:300]}"
        made[code] = plan_id
    return made


# ---------------------------------------------------------------- helpers
def make_reservation(token, arrival, departure, plan_id, status="CONFIRMED"):
    st, body = req(
        "POST",
        f"/properties/{PID}/reservations",
        token,
        {
            "guestId": GUEST,
            "roomTypeId": DELUXE,
            "arrivalDate": arrival,
            "departureDate": departure,
            "adults": 2,
            "status": status,
            "source": "FRONT_DESK",
            "ratePlanId": plan_id,
        },
    )
    assert st == 201, f"reservation create failed {st}: {str(body)[:400]}"
    rid = body["data"]["id"]
    _STATE["rids"].append(rid)
    return rid


def folio(token, rid):
    st, body = req("GET", f"/properties/{PID}/reservations/{rid}/folio", token)
    assert st == 200, f"folio fetch failed {st}: {str(body)[:300]}"
    return body["data"]


def live_room_charges(f):
    return [
        c
        for c in f["charges"]
        if c["type"] == "ROOM" and c["status"] == "POSTED" and c["rateSnapshotId"] is not None
    ]


def active_version(rid):
    return psql(
        f"select version from reservation_rate_snapshots where reservation_id='{rid}' and status='ACTIVE'"
    )


def active_pricing_status(rid):
    return psql(
        "select snapshot->>'pricingStatus' from reservation_rate_snapshots "
        f"where reservation_id='{rid}' and status='ACTIVE'"
    )


# ============================================================ TESTS
class TestSnapshotPricingPrecondition:
    """Guard: the seeded ACTIVE rate plan must make snapshots PRICED, else the
    whole reconcile slice would silently no-op and the suite proves nothing."""

    def test_priced_snapshot_precondition(self, token, plans):
        rid = make_reservation(token, d(0), d(2), plans[f"{TAG}A"])
        assert active_pricing_status(rid) == "PRICED"
        assert active_version(rid) == "1"
        f = folio(token, rid)
        live = live_room_charges(f)
        assert len(live) == 1
        assert live[0]["amount"] == "10000.00"
        assert live[0]["rateSnapshotVersion"] == 1


class TestUpdateAmendmentAutoReconcile:
    """PATCH /reservations/:id — date change + rate-plan change auto-reconcile."""

    def test_date_change_reverses_and_reposts(self, token, plans):
        rid = make_reservation(token, d(5), d(7), plans[f"{TAG}A"])  # 2N -> 10000
        f = folio(token, rid)
        original = live_room_charges(f)[0]
        assert original["amount"] == "10000.00"
        before_rows = len(f["charges"])

        st, body = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"departureDate": d(8)})
        assert st == 200, f"amendment failed {st}: {str(body)[:400]}"

        assert active_version(rid) == "2"
        f = folio(token, rid)
        reversed_rows = [c for c in f["charges"] if c["status"] == "REVERSED"]
        reversal_rows = [c for c in f["charges"] if c["status"] == "REVERSAL"]
        live = live_room_charges(f)

        # history preserved: original flipped, not deleted
        assert len(reversed_rows) == 1 and reversed_rows[0]["id"] == original["id"]
        # reversal row negates the original and keeps the OLD snapshot linkage
        assert len(reversal_rows) == 1
        rev = reversal_rows[0]
        assert rev["reversalOfChargeId"] == original["id"]
        assert rev["amount"] == "-10000.00"
        assert rev["rateSnapshotId"] == original["rateSnapshotId"]
        assert rev["rateSnapshotVersion"] == original["rateSnapshotVersion"]
        # repost at the NEW active version
        assert len(live) == 1
        assert live[0]["rateSnapshotVersion"] == 2
        assert live[0]["amount"] == "15000.00"
        assert live[0]["quantity"] == 3
        assert live[0]["id"] != original["id"]
        assert live[0]["rateSnapshotId"] != original["rateSnapshotId"]
        # exactly 2 new rows (reversal + repost)
        assert len(f["charges"]) == before_rows + 2
        # totals reflect only the live amount (reversed pair nets to zero)
        assert float(f["totals"]["subtotal"]) == pytest.approx(15000.00, abs=0.01)
        assert float(f["totals"]["balance"]) == pytest.approx(
            15000.00 + float(f["totals"]["tax"]), abs=0.01
        )

    def test_rate_plan_change_reconciles_to_new_rate(self, token, plans):
        rid = make_reservation(token, d(12), d(14), plans[f"{TAG}A"])  # 2N @5000 -> 10000
        assert live_room_charges(folio(token, rid))[0]["amount"] == "10000.00"

        st, body = req(
            "PATCH", f"/properties/{PID}/reservations/{rid}", token, {"ratePlanId": plans[f"{TAG}B"]}
        )
        assert st == 200, f"rate-plan amendment failed {st}: {str(body)[:400]}"
        assert active_version(rid) == "2"
        f = folio(token, rid)
        live = live_room_charges(f)
        assert len(live) == 1
        assert live[0]["amount"] == "14000.00"  # 2N @7000
        assert live[0]["rateSnapshotVersion"] == 2
        assert len([c for c in f["charges"] if c["status"] == "REVERSED"]) == 1
        assert float(f["totals"]["subtotal"]) == pytest.approx(14000.00, abs=0.01)

    def test_operational_only_edit_no_reconcile(self, token, plans):
        rid = make_reservation(token, d(18), d(20), plans[f"{TAG}A"])
        f = folio(token, rid)
        rows_before, ver_before = len(f["charges"]), active_version(rid)

        st, _ = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"notes": "T1 operational memo"})
        assert st == 200
        f = folio(token, rid)
        assert len(f["charges"]) == rows_before
        assert active_version(rid) == ver_before
        assert len([c for c in f["charges"] if c["status"] in ("REVERSED", "REVERSAL")]) == 0

    def test_commercial_noop_is_idempotent(self, token, plans):
        rid = make_reservation(token, d(24), d(26), plans[f"{TAG}A"])
        f = folio(token, rid)
        rows_before, ver_before = len(f["charges"]), active_version(rid)

        # re-send identical commercial values twice
        for _ in range(2):
            st, _ = req(
                "PATCH",
                f"/properties/{PID}/reservations/{rid}",
                token,
                {"adults": 2, "arrivalDate": d(24), "departureDate": d(26), "ratePlanId": plans[f"{TAG}A"]},
            )
            assert st == 200
        f = folio(token, rid)
        assert len(f["charges"]) == rows_before, "commercial no-op created extra folio rows"
        assert active_version(rid) == ver_before, "commercial no-op bumped the snapshot version"

    def test_manual_endpoint_is_noop_after_auto_reconcile(self, token, plans):
        """Auto-reconcile must leave nothing for the manual endpoint to do."""
        rid = make_reservation(token, d(30), d(32), plans[f"{TAG}A"])
        st, _ = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"departureDate": d(33)})
        assert st == 200
        f = folio(token, rid)
        rows_after_auto = len(f["charges"])
        st, body = req(
            "POST", f"/properties/{PID}/reservations/{rid}/folio/reconcile-room-charges", token, {}
        )
        assert st in (200, 201), f"manual reconcile failed {st}: {str(body)[:300]}"
        assert len(folio(token, rid)["charges"]) == rows_after_auto


class TestLegacyAndNoFolio:
    def test_legacy_manual_charge_untouched(self, token, plans):
        rid = make_reservation(token, d(36), d(38), plans[f"{TAG}A"])
        f = folio(token, rid)
        # legacy row: rate_snapshot_id NULL (pre-snapshot / manual posting)
        psql(
            "insert into folio_charges (folio_id, type, status, description, quantity, unit_amount, "
            f"amount, tax_amount, charged_at) values ('{f['id']}','MISC','POSTED','{TAG} legacy minibar',"
            "1,'500.00','500.00','0.00',now())"
        )
        st, _ = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"departureDate": d(39)})
        assert st == 200
        f = folio(token, rid)
        legacy = [c for c in f["charges"] if c["description"] == f"{TAG} legacy minibar"]
        assert len(legacy) == 1
        assert legacy[0]["status"] == "POSTED"
        assert legacy[0]["rateSnapshotId"] is None
        assert legacy[0]["amount"] == "500.00"
        live = live_room_charges(f)
        assert len(live) == 1 and live[0]["amount"] == "15000.00"
        assert float(f["totals"]["subtotal"]) == pytest.approx(15500.00, abs=0.01)

    def test_amendment_without_folio_creates_no_folio(self, token, plans):
        rid = make_reservation(token, d(42), d(44), plans[f"{TAG}A"], status="PENDING")
        # PENDING reservations have no folio yet
        assert psql(f"select count(*) from folios where reservation_id='{rid}'") == "0"
        st, body = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"departureDate": d(45)})
        assert st == 200, f"amendment failed {st}: {str(body)[:400]}"
        assert psql(f"select count(*) from folios where reservation_id='{rid}'") == "0"


class TestExtendStayAutoReconcile:
    def test_extend_stay_reconciles_folio(self, token, plans):
        rid = make_reservation(token, d(48), d(50), plans[f"{TAG}A"])
        f = folio(token, rid)
        original = live_room_charges(f)[0]
        assert original["amount"] == "10000.00"
        psql(
            f"update reservations set status='CHECKED_IN', room_id='{ROOM}', inventory_reserved=false where id='{rid}'"
        )
        st, body = req("PATCH", f"/properties/{PID}/reservations/{rid}/extend", token, {"departureDate": d(51)})
        assert st == 200, f"extendStay failed {st}: {str(body)[:400]}"
        assert active_version(rid) == "2"
        f = folio(token, rid)
        live = live_room_charges(f)
        assert len(live) == 1
        assert live[0]["amount"] == "15000.00"
        assert live[0]["quantity"] == 3
        assert live[0]["rateSnapshotVersion"] == 2
        reversed_rows = [c for c in f["charges"] if c["status"] == "REVERSED"]
        reversal_rows = [c for c in f["charges"] if c["status"] == "REVERSAL"]
        assert len(reversed_rows) == 1 and reversed_rows[0]["id"] == original["id"]
        assert len(reversal_rows) == 1 and reversal_rows[0]["amount"] == "-10000.00"
        assert float(f["totals"]["subtotal"]) == pytest.approx(15000.00, abs=0.01)


class TestTransactionalRollback:
    def test_restriction_rejection_rolls_back_everything(self, token, plans):
        rid = make_reservation(token, d(54), d(56), plans[f"{TAG}A"])
        f = folio(token, rid)
        rows_before = len(f["charges"])
        amount_before = live_room_charges(f)[0]["amount"]
        ver_before = active_version(rid)
        dep_before = psql(f"select departure_date from reservations where id='{rid}'")

        # stop-sell the newly-added night for an extension to d(57)
        st, body = req(
            "PUT",
            f"/properties/{PID}/rates/restrictions",
            token,
            {"roomTypeId": DELUXE, "dateFrom": d(56), "dateTo": d(56), "stopSell": True},
        )
        assert st in (200, 201), f"restriction setup failed {st}: {str(body)[:300]}"
        _STATE["restrictions"].append(d(56))

        st, body = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"departureDate": d(57)})
        assert st == 422, f"expected 422 RESTRICTION_VIOLATION, got {st}: {str(body)[:300]}"

        f = folio(token, rid)
        assert len(f["charges"]) == rows_before, "folio rows changed despite rollback"
        assert live_room_charges(f)[0]["amount"] == amount_before
        assert active_version(rid) == ver_before, "snapshot version bumped despite rollback"
        assert psql(f"select departure_date from reservations where id='{rid}'") == dep_before


class TestInventoryInvariant:
    def test_no_inventory_violations(self):
        assert psql("select count(*) from room_type_inventory where sold<0 or sold>capacity") == "0"
