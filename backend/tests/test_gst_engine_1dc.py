"""Phase 1D-c1 — INDEPENDENT verification of the Indian GST engine.

Scope (strictly this slice):
  * Tax-rule CRUD + validation  (/properties/:pid/rates/tax-rules)
  * ROOM charge GST via frozen per-line tax snapshot (CGST/SGST, HSN/SAC)
  * Tariff-slab selection by PER-NIGHT rate (incl. exact boundary)
  * Ship-empty: no rule => taxAmount 0.00, taxSnapshot null
  * Manual charge auto-GST + explicit taxAmount override (no snapshot)
  * Effective-dated rule resolution by charge date
  * Inter-state IGST (single component, full rate)
  * Folio totals taxBreakdown aggregation + negated REVERSAL snapshot
  * Cents-safe component math (odd 5% => 2.5% halves)

Self-cleaning: all reservations, folios, snapshots, rate plans and tax rules
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
BASE = date(2031, 3, 2)  # far-future, isolated from other suites
TAG = "T1GST"

_STATE = {"rids": [], "plans": [], "rules": []}


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


def cents(v):
    return round(float(v) * 100)


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="session")
def token():
    status, body = req(
        "POST",
        "/auth/login",
        body={"email": "admin@stayos.local", "password": "Password123!"},
    )
    if status not in (200, 201) or not body.get("data", {}).get("accessToken"):
        pytest.fail(f"login failed: {status} {str(body)[:300]}")
    return body["data"]["accessToken"]


def make_plan(token, code, rate, default=False):
    status, body = req(
        "POST",
        f"/properties/{PID}/rates/rate-plans",
        token,
        {"code": code, "name": code, "status": "ACTIVE", "isDefault": default},
    )
    assert status == 201, f"rate-plan create failed {status} {str(body)[:300]}"
    pid = body["data"]["id"]
    _STATE["plans"].append(pid)
    status, body = req(
        "PUT",
        f"/properties/{PID}/rates/rate-plans/{pid}/room-types",
        token,
        {"roomTypeId": DELUXE, "baseOccupancy": 2, "baseRate": rate},
    )
    assert status in (200, 201), f"plan room-type map failed {status} {str(body)[:300]}"
    return pid


def make_rule(token, **kw):
    status, body = req("POST", f"/properties/{PID}/rates/tax-rules", token, kw)
    rid = (body.get("data") or {}).get("id")
    if rid:
        _STATE["rules"].append(rid)
    return status, body


def make_reservation(token, arrival, departure, plan_id):
    status, body = req(
        "POST",
        f"/properties/{PID}/reservations",
        token,
        {
            "guestId": GUEST,
            "roomTypeId": DELUXE,
            "arrivalDate": arrival,
            "departureDate": departure,
            "adults": 2,
            "status": "CONFIRMED",
            "source": "FRONT_DESK",
            "ratePlanId": plan_id,
        },
    )
    assert status == 201, f"reservation create failed {status} {str(body)[:400]}"
    rid = body["data"]["id"]
    _STATE["rids"].append(rid)
    return rid


def get_folio(token, reservation_id):
    status, body = req(
        "GET", f"/properties/{PID}/reservations/{reservation_id}/folio", token
    )
    assert status == 200, f"folio open failed {status} {str(body)[:300]}"
    return body["data"]


def add_charge(token, folio_id, payload):
    return req("POST", f"/properties/{PID}/folios/{folio_id}/charges", token, payload)


def active_room_charges(folio):
    return [
        c
        for c in folio["charges"]
        if c["type"] == "ROOM" and c["status"] == "POSTED" and c["rateSnapshotId"]
    ]


def components(charge):
    snap = charge.get("taxSnapshot") or {}
    return {c["name"]: c["amount"] for c in snap.get("components", [])}


@pytest.fixture(scope="session")
def env(token):
    """Rate plans + the GST rule set under test."""
    plans = {
        "low": make_plan(token, f"{TAG}L", "5000.00", default=True),
        "high": make_plan(token, f"{TAG}H", "9000.00"),
        "edge": make_plan(token, f"{TAG}E", "7500.00"),
    }
    # ROOM tariff slabs
    st, _ = make_rule(
        token,
        name=f"{TAG} Room <=7500",
        chargeType="ROOM",
        hsnSac="996311",
        taxPercentage="12.00",
        slabMinAmount="0.00",
        slabMaxAmount="7500.00",
        effectiveFrom="2026-01-01",
    )
    assert st == 201
    st, _ = make_rule(
        token,
        name=f"{TAG} Room >7500",
        chargeType="ROOM",
        hsnSac="996311",
        taxPercentage="18.00",
        slabMinAmount="7500.01",
        effectiveFrom="2026-01-01",
    )
    assert st == 201
    # F&B 5%
    st, _ = make_rule(
        token,
        name=f"{TAG} F&B",
        chargeType="FOOD_AND_BEVERAGE",
        hsnSac="996331",
        taxPercentage="5.00",
        effectiveFrom="2026-01-01",
    )
    assert st == 201
    # MINIBAR 18% (used for IGST + explicit-override tests)
    st, _ = make_rule(
        token,
        name=f"{TAG} Minibar",
        chargeType="MINIBAR",
        hsnSac="996332",
        taxPercentage="18.00",
        effectiveFrom="2026-01-01",
    )
    assert st == 201
    # SPA effective-dated pair
    st, _ = make_rule(
        token,
        name=f"{TAG} Spa old",
        chargeType="SPA",
        hsnSac="999722",
        taxPercentage="12.00",
        effectiveFrom="2026-01-01",
    )
    assert st == 201
    st, _ = make_rule(
        token,
        name=f"{TAG} Spa new",
        chargeType="SPA",
        hsnSac="999722",
        taxPercentage="5.00",
        effectiveFrom="2026-09-01",
    )
    assert st == 201
    return {"plans": plans}


@pytest.fixture(scope="session", autouse=True)
def cleanup(token):
    yield
    rids = _STATE["rids"]
    if rids:
        idl = ",".join(f"'{i}'" for i in rids)
        psql(f"update reservations set status='CANCELLED' where id in ({idl})")
        folios = [x for x in psql(f"select id from folios where reservation_id in ({idl})").split("\n") if x]
        if folios:
            fl = ",".join(f"'{x}'" for x in folios)
            psql(
                f"delete from folio_payments where folio_id in ({fl});"
                f"delete from folio_charges where folio_id in ({fl});"
                f"delete from folios where id in ({fl})"
            )
        psql(f"delete from reservation_rate_snapshots where reservation_id in ({idl})")
        psql(f"delete from audit_events where entity_id in ({idl});"
             f"delete from activity_events where entity_id in ({idl})")
        psql(f"delete from reservations where id in ({idl})")
    for rule_id in _STATE["rules"]:
        req("DELETE", f"/properties/{PID}/rates/tax-rules/{rule_id}", token)
    psql(f"delete from tax_rules where property_id='{PID}' and name like '{TAG}%'")
    plans = _STATE["plans"]
    if plans:
        pl = ",".join(f"'{p}'" for p in plans)
        psql(
            f"delete from rate_plan_room_types where rate_plan_id in ({pl});"
            f"delete from room_type_daily_rates where rate_plan_id in ({pl});"
            f"delete from property_policies where rate_plan_id in ({pl});"
            f"delete from rate_plans where id in ({pl})"
        )
    psql(f"delete from room_type_inventory where date>='{d(0)}' and date<='{d(60)}' and sold=0")


# ---------------------------------------------------------------- tax-rule CRUD
class TestTaxRuleCrud:
    def test_requires_authentication(self):
        status, _ = req("GET", f"/properties/{PID}/rates/tax-rules")
        assert status == 401

    def test_rejects_percentage_above_100(self, token):
        status, body = make_rule(
            token,
            name=f"{TAG} bad pct",
            chargeType="ROOM",
            taxPercentage="150",
            effectiveFrom="2026-01-01",
        )
        assert status == 400, str(body)[:300]

    def test_rejects_slab_min_above_max(self, token):
        status, body = make_rule(
            token,
            name=f"{TAG} bad slab",
            chargeType="ROOM",
            taxPercentage="12",
            slabMinAmount="8000.00",
            slabMaxAmount="1000.00",
            effectiveFrom="2026-01-01",
        )
        assert status == 400, str(body)[:300]

    def test_rejects_unknown_charge_type(self, token):
        status, _ = make_rule(
            token,
            name=f"{TAG} bad type",
            chargeType="NOT_A_TYPE",
            taxPercentage="12",
            effectiveFrom="2026-01-01",
        )
        assert status == 400

    def test_create_list_update_delete(self, token):
        status, body = make_rule(
            token,
            name=f"{TAG} crud",
            chargeType="MISC",
            hsnSac="998599",
            taxPercentage="12.00",
            effectiveFrom="2026-01-01",
        )
        assert status == 201, str(body)[:300]
        rule = body["data"]
        assert rule["taxPercentage"] == "12.00"
        assert rule["hsnSac"] == "998599"
        assert rule["isActive"] is True

        status, body = req("GET", f"/properties/{PID}/rates/tax-rules", token)
        assert status == 200
        listed = {r["id"]: r for r in body["data"]}
        assert rule["id"] in listed
        assert all(r["propertyId"] == PID for r in body["data"])
        assert all("_id" not in r for r in body["data"])

        status, body = req(
            "PATCH",
            f"/properties/{PID}/rates/tax-rules/{rule['id']}",
            token,
            {"taxPercentage": "5.00", "name": f"{TAG} crud updated"},
        )
        assert status == 200, str(body)[:300]
        assert body["data"]["taxPercentage"] == "5.00"
        assert body["data"]["name"] == f"{TAG} crud updated"

        # persisted
        status, body = req("GET", f"/properties/{PID}/rates/tax-rules", token)
        fetched = [r for r in body["data"] if r["id"] == rule["id"]][0]
        assert fetched["taxPercentage"] == "5.00"

        # invalid update rejected
        status, _ = req(
            "PATCH",
            f"/properties/{PID}/rates/tax-rules/{rule['id']}",
            token,
            {"taxPercentage": "120.00"},
        )
        assert status == 400

        status, _ = req("DELETE", f"/properties/{PID}/rates/tax-rules/{rule['id']}", token)
        assert status in (200, 204)
        status, body = req("GET", f"/properties/{PID}/rates/tax-rules", token)
        assert rule["id"] not in {r["id"] for r in body["data"]}
        _STATE["rules"] = [r for r in _STATE["rules"] if r != rule["id"]]

        status, _ = req("DELETE", f"/properties/{PID}/rates/tax-rules/{rule['id']}", token)
        assert status == 404


# ---------------------------------------------------------------- ROOM GST
class TestRoomChargeGst:
    def test_room_charge_intra_state_split_and_totals(self, token, env):
        rid = make_reservation(token, d(0), d(3), env["plans"]["low"])  # 3 x 5000
        folio = get_folio(token, rid)
        rooms = active_room_charges(folio)
        assert len(rooms) == 1, f"expected 1 snapshot-driven ROOM charge, got {len(rooms)}"
        room = rooms[0]
        assert room["amount"] == "15000.00"
        assert room["taxAmount"] == "1800.00"
        comps = components(room)
        assert comps == {"CGST": "900.00", "SGST": "900.00"}
        assert room["hsnSac"] == "996311"
        snap = room["taxSnapshot"]
        assert snap["totalRate"] == "12.00"
        assert snap["placeOfSupply"] == "INTRA_STATE"
        assert snap["taxableValue"] == "15000.00"
        assert snap["taxRuleId"]
        assert snap["ruleEffectiveFrom"] == "2026-01-01"
        # component sum == line tax (cents-safe)
        assert sum(cents(v) for v in comps.values()) == cents(room["taxAmount"])
        totals = folio["totals"]
        assert totals["tax"] == "1800.00"
        assert totals["taxBreakdown"] == {"cgst": "900.00", "sgst": "900.00", "igst": "0.00"}
        assert cents(totals["taxBreakdown"]["cgst"]) + cents(totals["taxBreakdown"]["sgst"]) + cents(
            totals["taxBreakdown"]["igst"]
        ) == cents(totals["tax"])

    def test_high_slab_selected_by_per_night_rate(self, token, env):
        rid = make_reservation(token, d(10), d(11), env["plans"]["high"])  # 1 x 9000
        room = active_room_charges(get_folio(token, rid))[0]
        assert room["amount"] == "9000.00"
        assert room["taxAmount"] == "1620.00"  # 18%
        assert room["taxSnapshot"]["totalRate"] == "18.00"

    def test_slab_upper_boundary_is_inclusive(self, token, env):
        rid = make_reservation(token, d(20), d(22), env["plans"]["edge"])  # 2 x 7500
        room = active_room_charges(get_folio(token, rid))[0]
        assert room["amount"] == "15000.00"
        # per-night 7500 == slabMax => low slab 12% (NOT 18%) even though the
        # stay total (15000) exceeds 7500 -> proves per-unit basis is used
        assert room["taxSnapshot"]["totalRate"] == "12.00"
        assert room["taxAmount"] == "1800.00"


# ---------------------------------------------------------------- manual charges
class TestManualChargeGst:
    @pytest.fixture(scope="class")
    def folio_id(self, token, env):
        rid = make_reservation(token, d(30), d(31), env["plans"]["low"])
        return get_folio(token, rid)["id"]

    def test_no_rule_means_zero_gst(self, token, folio_id):
        status, body = add_charge(
            token,
            folio_id,
            {"type": "LAUNDRY", "description": f"{TAG} laundry", "unitAmount": "500.00"},
        )
        assert status in (200, 201), str(body)[:300]
        charge = [c for c in body["data"]["charges"] if c["type"] == "LAUNDRY"][0]
        assert charge["taxAmount"] == "0.00"
        assert charge.get("taxSnapshot") is None
        assert charge.get("hsnSac") is None

    def test_fnb_auto_gst_5_percent(self, token, folio_id):
        status, body = add_charge(
            token,
            folio_id,
            {
                "type": "FOOD_AND_BEVERAGE",
                "description": f"{TAG} dinner",
                "unitAmount": "2000.00",
                "quantity": 1,
            },
        )
        assert status in (200, 201)
        charge = [c for c in body["data"]["charges"] if c["type"] == "FOOD_AND_BEVERAGE"][0]
        assert charge["taxAmount"] == "100.00"
        assert components(charge) == {"CGST": "50.00", "SGST": "50.00"}
        assert charge["hsnSac"] == "996331"
        assert charge["taxSnapshot"]["placeOfSupply"] == "INTRA_STATE"

    def test_explicit_tax_amount_overrides_engine(self, token, folio_id):
        status, body = add_charge(
            token,
            folio_id,
            {
                "type": "MINIBAR",  # has an 18% rule configured
                "description": f"{TAG} minibar explicit",
                "unitAmount": "300.00",
                "taxAmount": "36.00",
            },
        )
        assert status in (200, 201)
        charge = [
            c for c in body["data"]["charges"] if c["description"] == f"{TAG} minibar explicit"
        ][0]
        assert charge["taxAmount"] == "36.00"
        assert charge.get("taxSnapshot") is None

    def test_inter_state_single_igst_component(self, token, folio_id):
        status, body = add_charge(
            token,
            folio_id,
            {
                "type": "MINIBAR",
                "description": f"{TAG} minibar igst",
                "unitAmount": "1000.00",
                "placeOfSupply": "INTER_STATE",
            },
        )
        assert status in (200, 201)
        charge = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} minibar igst"][0]
        assert charge["taxAmount"] == "180.00"
        comps = components(charge)
        assert comps == {"IGST": "180.00"}, comps
        assert charge["taxSnapshot"]["placeOfSupply"] == "INTER_STATE"
        assert charge["taxSnapshot"]["components"][0]["rate"] == "18.00"

    def test_effective_dating_picks_rule_by_charge_date(self, token, folio_id):
        status, body = add_charge(
            token,
            folio_id,
            {
                "type": "SPA",
                "description": f"{TAG} spa before",
                "unitAmount": "1000.00",
                "chargedAt": "2026-05-15T10:00:00.000Z",
            },
        )
        assert status in (200, 201)
        before = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} spa before"][0]
        assert before["taxSnapshot"]["totalRate"] == "12.00", before["taxSnapshot"]
        assert before["taxSnapshot"]["ruleEffectiveFrom"] == "2026-01-01"
        assert before["taxAmount"] == "120.00"

        status, body = add_charge(
            token,
            folio_id,
            {
                "type": "SPA",
                "description": f"{TAG} spa after",
                "unitAmount": "1000.00",
                "chargedAt": "2026-09-15T10:00:00.000Z",
            },
        )
        assert status in (200, 201)
        after = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} spa after"][0]
        assert after["taxSnapshot"]["totalRate"] == "5.00", after["taxSnapshot"]
        assert after["taxSnapshot"]["ruleEffectiveFrom"] == "2026-09-01"
        assert after["taxAmount"] == "50.00"
        assert components(after) == {"CGST": "25.00", "SGST": "25.00"}

    def test_cents_safe_odd_rate(self, token, folio_id):
        # 5% on 333.33 -> 2.5% halves = 8.33 each (sum must equal the line tax)
        status, body = add_charge(
            token,
            folio_id,
            {
                "type": "FOOD_AND_BEVERAGE",
                "description": f"{TAG} odd cents",
                "unitAmount": "333.33",
            },
        )
        assert status in (200, 201)
        charge = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} odd cents"][0]
        comps = components(charge)
        assert sum(cents(v) for v in comps.values()) == cents(charge["taxAmount"]), (comps, charge["taxAmount"])
        assert comps["CGST"] == comps["SGST"]

    def test_folio_totals_breakdown_matches_line_snapshots(self, token, folio_id):
        status, body = req("GET", f"/properties/{PID}/folios/{folio_id}", token)
        assert status == 200
        folio = body["data"]
        expected = {"CGST": 0, "SGST": 0, "IGST": 0}
        for charge in folio["charges"]:
            for comp in (charge.get("taxSnapshot") or {}).get("components", []):
                expected[comp["name"]] += cents(comp["amount"])
        tb = folio["totals"]["taxBreakdown"]
        assert cents(tb["cgst"]) == expected["CGST"]
        assert cents(tb["sgst"]) == expected["SGST"]
        assert cents(tb["igst"]) == expected["IGST"]


# ------------------------------------------------- snapshot immutability / reversal
class TestSnapshotFreezeAndReversal:
    def test_rule_change_does_not_alter_historical_charge(self, token, env):
        rid = make_reservation(token, d(40), d(41), env["plans"]["low"])  # 1 x 5000 @12%
        folio = get_folio(token, rid)
        room = active_room_charges(folio)[0]
        assert room["taxAmount"] == "600.00"
        low_rule_id = room["taxSnapshot"]["taxRuleId"]

        # deactivate/repoint the rule -> the frozen snapshot must not move
        status, _ = req(
            "PATCH",
            f"/properties/{PID}/rates/tax-rules/{low_rule_id}",
            token,
            {"taxPercentage": "28.00"},
        )
        assert status == 200
        try:
            again = active_room_charges(get_folio(token, rid))[0]
            assert again["taxAmount"] == "600.00"
            assert again["taxSnapshot"]["totalRate"] == "12.00"
        finally:
            req(
                "PATCH",
                f"/properties/{PID}/rates/tax-rules/{low_rule_id}",
                token,
                {"taxPercentage": "12.00"},
            )

    def test_deleted_rule_keeps_history_and_stops_new_gst(self, token, env):
        status, body = make_rule(
            token,
            name=f"{TAG} temp misc",
            chargeType="MISC",
            hsnSac="998599",
            taxPercentage="18.00",
            effectiveFrom="2026-01-01",
        )
        assert status == 201
        rule_id = body["data"]["id"]
        rid = make_reservation(token, d(45), d(46), env["plans"]["low"])
        folio_id = get_folio(token, rid)["id"]
        status, body = add_charge(
            token,
            folio_id,
            {"type": "MISC", "description": f"{TAG} misc historic", "unitAmount": "1000.00"},
        )
        assert status in (200, 201)
        historic = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} misc historic"][0]
        assert historic["taxAmount"] == "180.00"

        status, _ = req("DELETE", f"/properties/{PID}/rates/tax-rules/{rule_id}", token)
        assert status in (200, 204)
        _STATE["rules"] = [r for r in _STATE["rules"] if r != rule_id]

        status, body = req("GET", f"/properties/{PID}/folios/{folio_id}", token)
        still = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} misc historic"][0]
        assert still["taxAmount"] == "180.00"
        assert still["taxSnapshot"]["taxRuleId"] == rule_id

        status, body = add_charge(
            token,
            folio_id,
            {"type": "MISC", "description": f"{TAG} misc after delete", "unitAmount": "1000.00"},
        )
        after = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} misc after delete"][0]
        assert after["taxAmount"] == "0.00"
        assert after.get("taxSnapshot") is None

    def test_amendment_reversal_negates_snapshot(self, token, env):
        rid = make_reservation(token, d(50), d(53), env["plans"]["low"])  # 3 x 5000 @12%
        folio = get_folio(token, rid)
        assert active_room_charges(folio)[0]["taxAmount"] == "1800.00"

        status, _ = req("PATCH", f"/properties/{PID}/reservations/{rid}", token, {"departureDate": d(54)})
        assert status == 200
        folio = get_folio(token, rid)
        reversals = [c for c in folio["charges"] if c["status"] == "REVERSAL" and c["type"] == "ROOM"]
        assert len(reversals) == 1
        rev = reversals[0]
        assert rev["taxAmount"] == "-1800.00"
        assert components(rev) == {"CGST": "-900.00", "SGST": "-900.00"}
        assert rev["taxSnapshot"]["taxableValue"] == "-15000.00"

        new_room = active_room_charges(folio)[0]
        assert new_room["amount"] == "20000.00"
        assert new_room["taxAmount"] == "2400.00"

        room_cgst = sum(
            cents(comp["amount"])
            for c in folio["charges"]
            if c["type"] == "ROOM"
            for comp in (c.get("taxSnapshot") or {}).get("components", [])
            if comp["name"] == "CGST"
        )
        assert room_cgst == 120000, room_cgst
        tb = folio["totals"]["taxBreakdown"]
        assert cents(tb["cgst"]) + cents(tb["sgst"]) + cents(tb["igst"]) == cents(folio["totals"]["tax"])


# ---------------------------------------------------------------- invariants
class TestInvariantsAfterRun:
    def test_no_inventory_invariant_violations(self):
        violations = int(psql("select count(*) from room_type_inventory where sold<0 or sold>capacity") or 0)
        assert violations == 0, f"{violations} inventory invariant violations"

    def test_no_orphan_tax_snapshot_rows(self):
        # every charge carrying a snapshot must have a scalar taxAmount equal to
        # the sum of its snapshot components (cents-safe DB-level check)
        bad = psql(
            "select count(*) from folio_charges c where c.tax_snapshot is not null and "
            "round(c.tax_amount::numeric,2) <> ("
            "select coalesce(sum((comp->>'amount')::numeric),0) from jsonb_array_elements("
            "(c.tax_snapshot->'components')::jsonb) comp)"
        )
        assert int(bad or 0) == 0, f"{bad} charges where taxAmount != sum(components)"


# ---------------------------------------------------------------- edge cases
class TestRuleResolutionEdgeCases:
    @pytest.fixture(scope="class")
    def folio_id(self, token, env):
        rid = make_reservation(token, d(57), d(58), env["plans"]["low"])
        return get_folio(token, rid)["id"]

    def test_rejects_negative_percentage(self, token):
        status, _ = make_rule(
            token,
            name=f"{TAG} neg",
            chargeType="MISC",
            taxPercentage="-5.00",
            effectiveFrom="2026-01-01",
        )
        assert status == 400

    def test_rejects_three_decimal_percentage(self, token):
        status, _ = make_rule(
            token,
            name=f"{TAG} prec",
            chargeType="MISC",
            taxPercentage="12.345",
            effectiveFrom="2026-01-01",
        )
        assert status == 400

    def test_unknown_property_returns_404(self, token):
        status, _ = req(
            "GET",
            "/properties/11111111-1111-1111-1111-111111111111/rates/tax-rules",
            token,
        )
        assert status in (403, 404), status

    def test_inactive_rule_is_not_applied(self, token, folio_id):
        status, body = make_rule(
            token,
            name=f"{TAG} inactive misc",
            chargeType="MISC",
            taxPercentage="18.00",
            effectiveFrom="2026-01-01",
            isActive=False,
        )
        assert status == 201
        rule_id = body["data"]["id"]
        try:
            status, body = add_charge(
                token,
                folio_id,
                {"type": "MISC", "description": f"{TAG} inactive check", "unitAmount": "1000.00"},
            )
            charge = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} inactive check"][0]
            assert charge["taxAmount"] == "0.00"
            assert charge.get("taxSnapshot") is None
        finally:
            req("DELETE", f"/properties/{PID}/rates/tax-rules/{rule_id}", token)
            _STATE["rules"] = [r for r in _STATE["rules"] if r != rule_id]

    def test_manual_slab_basis_is_per_unit_not_line_total(self, token, folio_id):
        # generic MINIBAR rule (18%) + a high slab rule for >= 5000/unit at 28%.
        status, body = make_rule(
            token,
            name=f"{TAG} minibar slab",
            chargeType="MINIBAR",
            taxPercentage="28.00",
            slabMinAmount="5000.00",
            effectiveFrom="2026-01-01",
        )
        assert status == 201
        rule_id = body["data"]["id"]
        try:
            status, body = add_charge(
                token,
                folio_id,
                {
                    "type": "MINIBAR",
                    "description": f"{TAG} slab basis",
                    "unitAmount": "2000.00",
                    "quantity": 3,  # line total 6000 but per-unit 2000
                },
            )
            charge = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} slab basis"][0]
            assert charge["amount"] == "6000.00"
            assert charge["taxSnapshot"]["totalRate"] == "18.00", charge["taxSnapshot"]
            assert charge["taxAmount"] == "1080.00"
        finally:
            req("DELETE", f"/properties/{PID}/rates/tax-rules/{rule_id}", token)
            _STATE["rules"] = [r for r in _STATE["rules"] if r != rule_id]

    def test_more_specific_slab_rule_wins_tie_break(self, token, folio_id):
        st1, b1 = make_rule(
            token,
            name=f"{TAG} misc generic",
            chargeType="MISC",
            taxPercentage="18.00",
            effectiveFrom="2026-01-01",
        )
        st2, b2 = make_rule(
            token,
            name=f"{TAG} misc slab",
            chargeType="MISC",
            taxPercentage="5.00",
            slabMinAmount="1000.00",
            slabMaxAmount="2000.00",
            effectiveFrom="2026-01-01",
        )
        assert st1 == 201 and st2 == 201
        ids = [b1["data"]["id"], b2["data"]["id"]]
        try:
            status, body = add_charge(
                token,
                folio_id,
                {"type": "MISC", "description": f"{TAG} tiebreak in slab", "unitAmount": "1500.00"},
            )
            in_slab = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} tiebreak in slab"][0]
            assert in_slab["taxSnapshot"]["totalRate"] == "5.00", in_slab["taxSnapshot"]
            status, body = add_charge(
                token,
                folio_id,
                {"type": "MISC", "description": f"{TAG} tiebreak out slab", "unitAmount": "3000.00"},
            )
            out_slab = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} tiebreak out slab"][0]
            assert out_slab["taxSnapshot"]["totalRate"] == "18.00", out_slab["taxSnapshot"]
        finally:
            for rid_ in ids:
                req("DELETE", f"/properties/{PID}/rates/tax-rules/{rid_}", token)
            _STATE["rules"] = [r for r in _STATE["rules"] if r not in ids]

    def test_effective_from_boundary_day_uses_new_rule(self, token, folio_id):
        status, body = add_charge(
            token,
            folio_id,
            {
                "type": "SPA",
                "description": f"{TAG} spa boundary",
                "unitAmount": "1000.00",
                "chargedAt": "2026-09-01T00:30:00.000Z",
            },
        )
        charge = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} spa boundary"][0]
        assert charge["taxSnapshot"]["ruleEffectiveFrom"] == "2026-09-01", charge["taxSnapshot"]
        assert charge["taxAmount"] == "50.00"

    def test_zero_amount_charge_has_no_snapshot(self, token, folio_id):
        status, body = add_charge(
            token,
            folio_id,
            {"type": "FOOD_AND_BEVERAGE", "description": f"{TAG} zero amount", "unitAmount": "0.00"},
        )
        assert status in (200, 201), str(body)[:300]
        charge = [c for c in body["data"]["charges"] if c["description"] == f"{TAG} zero amount"][0]
        assert charge["taxAmount"] == "0.00"
        assert charge.get("taxSnapshot") is None


class TestTaxRuleRbac:
    @pytest.fixture(scope="class")
    def readonly_token(self):
        status, body = req(
            "POST",
            "/auth/login",
            body={"email": "readonly@stayos.local", "password": "Password123!"},
        )
        if status not in (200, 201):
            pytest.skip("readonly user unavailable")
        return body["data"]["accessToken"]

    def test_readonly_can_list(self, readonly_token):
        status, _ = req("GET", f"/properties/{PID}/rates/tax-rules", readonly_token)
        assert status == 200

    def test_readonly_cannot_create(self, readonly_token):
        status, _ = req(
            "POST",
            f"/properties/{PID}/rates/tax-rules",
            readonly_token,
            {
                "name": f"{TAG} rbac",
                "chargeType": "MISC",
                "taxPercentage": "12.00",
                "effectiveFrom": "2026-01-01",
            },
        )
        assert status == 403, status
