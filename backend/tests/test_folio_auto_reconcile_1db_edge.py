"""Phase 1D-b HARDENING — EDGE-CASE addendum for AUTOMATIC folio reconciliation.

Documents ACTUAL behaviour for cases outside the happy path:
  * commercial amendment that produces an UNPRICED new snapshot version
    (room-type change with no applicable ACTIVE rate plan)
  * commercial amendment when the folio is NOT OPEN (CLOSED)
  * audit attribution (created_by_user_id) on auto-generated REVERSAL/repost rows

Self-cleaning.
"""

from test_folio_auto_reconcile_1db import (  # noqa: F401 - fixtures imported for pytest
    PID,
    TAG,
    _cleanup,
    active_pricing_status,
    active_version,
    d,
    folio,
    live_room_charges,
    make_reservation,
    psql,
    req,
    token,
)
from test_folio_auto_reconcile_1db import _STATE  # noqa: F401

import pytest

SUITE = "0f0b435d-80f7-4dda-a3b6-863e21fe7cab"


@pytest.fixture(scope="module")
def plans(token):
    """Idempotent get-or-create of the ACTIVE Deluxe plan used by this module."""
    code = f"{TAG}A"
    existing = psql(f"select id from rate_plans where code='{code}' and property_id='{PID}'")
    if existing:
        return {code: existing}
    status, body = req(
        "POST",
        f"/properties/{PID}/rates/rate-plans",
        token,
        {"code": code, "name": code, "status": "ACTIVE", "isDefault": True},
    )
    assert status == 201, f"rate-plan create failed {status}: {str(body)[:300]}"
    plan_id = body["data"]["id"]
    _STATE["plans"].append(plan_id)
    s2, b2 = req(
        "PUT",
        f"/properties/{PID}/rates/rate-plans/{plan_id}/room-types",
        token,
        {"roomTypeId": PID and "9f3f0c8f-5f98-473d-8474-d6301d4640a0", "baseOccupancy": 2, "baseRate": "5000.00"},
    )
    assert s2 in (200, 201), f"applicability failed {s2}: {str(b2)[:300]}"
    return {code: plan_id}


def _plan_a(plans):
    return plans[f"{TAG}A"]


class TestUnpricedAmendment:
    """A room-type change to a type with NO applicable ACTIVE rate plan is
    REJECTED (400) upstream, so the folio can never silently drift onto an
    UNPRICED snapshot version via this path."""

    def test_room_type_change_without_applicable_plan_is_rejected(self, token, plans):
        rid = make_reservation(token, d(80), d(82), _plan_a(plans))
        f = folio(token, rid)
        before = live_room_charges(f)[0]
        rows_before = len(f["charges"])
        ver_before = active_version(rid)

        st, body = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"roomTypeId": SUITE})
        print(f"[edge] room-type change with non-applicable plan -> HTTP {st}")
        assert st == 400, f"expected 400 guard, got {st}: {str(body)[:300]}"
        f = folio(token, rid)
        live = live_room_charges(f)
        assert len(f["charges"]) == rows_before
        assert live and live[0]["id"] == before["id"] and live[0]["amount"] == before["amount"]
        assert active_version(rid) == ver_before


class TestNonOpenFolio:
    """reconcileRoomChargesOnManager returns early when the folio is not OPEN."""

    def test_settled_folio_not_reconciled(self, token, plans):
        rid = make_reservation(token, d(86), d(88), _plan_a(plans))
        f = folio(token, rid)
        fid = f["id"]
        rows_before = len(f["charges"])
        amount_before = live_room_charges(f)[0]["amount"]
        psql(f"update folios set status='SETTLED' where id='{fid}'")
        assert psql(f"select status from folios where id='{fid}'") == "SETTLED"

        st, body = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"departureDate": d(89)})
        print(f"[edge] amendment on SETTLED folio -> HTTP {st}")
        assert st in (200, 400, 409, 422), f"unexpected status {st}: {str(body)[:300]}"
        rows_after = int(psql(f"select count(*) from folio_charges where folio_id='{fid}'"))
        amt_after = psql(
            f"select amount from folio_charges where folio_id='{fid}' and status='POSTED' and type='ROOM'"
        )
        assert rows_after == rows_before, "non-OPEN folio was mutated by reconcile"
        assert amt_after == amount_before
        psql(f"update folios set status='OPEN' where id='{fid}'")


class TestAuditAttribution:
    """Auto-reconcile is invoked without an actor id; record what lands in
    created_by_user_id for the REVERSAL and repost rows."""

    def test_reversal_and_repost_actor_attribution(self, token, plans):
        rid = make_reservation(token, d(92), d(94), _plan_a(plans))
        fid = folio(token, rid)["id"]
        print(
            f"[edge] before amend: v={active_version(rid)} pricing={active_pricing_status(rid)} "
            f"rows={psql(f'select count(*) from folio_charges where folio_id=' + chr(39) + fid + chr(39))}"
        )
        st, body = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"departureDate": d(95)})
        assert st == 200, f"amendment failed {st}: {str(body)[:300]}"
        print(f"[edge] after amend: v={active_version(rid)} pricing={active_pricing_status(rid)}")
        rows = psql(
            "select status||'='||coalesce(created_by_user_id::text,'NULL') from folio_charges "
            f"where folio_id='{fid}' order by created_at"
        )
        print(f"[edge] charge actor attribution: {rows.splitlines()}")
        assert "REVERSAL" in rows, f"no REVERSAL row produced by auto-reconcile: {rows}"
        reversal_actor = psql(
            f"select coalesce(created_by_user_id::text,'NULL') from folio_charges where folio_id='{fid}' and status='REVERSAL'"
        )
        repost_actor = psql(
            f"select coalesce(created_by_user_id::text,'NULL') from folio_charges where folio_id='{fid}' and status='POSTED' and type='ROOM'"
        )
        # Observed behaviour pinned so a future change is caught (reported as a
        # minor audit-attribution gap: the amending user is not recorded).
        assert reversal_actor == "NULL", f"reversal actor unexpectedly {reversal_actor}"
        assert repost_actor == "NULL", f"repost actor unexpectedly {repost_actor}"
