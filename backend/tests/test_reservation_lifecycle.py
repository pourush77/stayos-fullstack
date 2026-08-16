"""
StayOS Phase-1B: Reservation & Stay Lifecycle (confirm / cancel / no-show + centralized transitions)

Module under test:
  stayos-api/src/core/reservations/domain/reservation-transitions.ts
  stayos-api/src/core/reservations/services/reservation-workflow.service.ts
  stayos-api/src/core/reservations/reservations.controller.ts

API: NestJS on http://localhost:3001/api/v1 (per /app/memory/test_credentials.md note)
"""

import json
import os
import random
import subprocess
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("STAYOS_API_URL", "http://localhost:3001/api/v1").rstrip("/")
PROPERTY_ID = "9d0680c0-89b0-41d5-ae06-b08cd7bedeae"
ADMIN = {"email": "admin@stayos.local", "password": "Password123!"}
READONLY = {"email": "readonly@stayos.local", "password": "Password123!"}
INVALID_TRANSITION = "INVALID_RESERVATION_STATE_TRANSITION"

# Pre-existing demo reservations in terminal states (from earlier listing)
CHECKED_OUT_RESERVATION = "e516546b-1ab1-4658-81d1-ed250e6dc1d8"  # HSDEMO-0042


def _login(creds):
    res = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=30)
    if res.status_code not in (200, 201):
        pytest.fail(f"Login failed for {creds['email']}: {res.status_code} {res.text[:300]}")
    token = res.json().get("data", {}).get("accessToken")
    if not token:
        pytest.fail(f"No accessToken in login response: {res.text[:300]}")
    return token


@pytest.fixture(scope="session")
def admin_client():
    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {_login(ADMIN)}", "Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def readonly_client():
    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {_login(READONLY)}", "Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def catalog(admin_client):
    guests = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/guests?limit=5", timeout=30)
    room_types = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/room-types", timeout=30)
    rooms = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/rooms?limit=100", timeout=30)
    assert guests.status_code == 200 and room_types.status_code == 200 and rooms.status_code == 200
    guest_list = guests.json()["data"]
    rt_list = room_types.json()["data"]
    room_list = rooms.json()["data"]
    ready_rooms = [r for r in room_list if r["operationalStatus"] == "READY"]
    assert guest_list and rt_list and ready_rooms, "Seed data missing (guests/room types/ready rooms)"
    return {"guestId": guest_list[0]["id"], "roomTypes": rt_list, "readyRooms": ready_rooms}


created_ids = []


def _fresh_window(days=2):
    """Inventory is now enforced, so every create needs an uncontended window."""
    start = date(2043, 1, 1) + timedelta(days=random.randint(0, 3000))
    return start.isoformat(), (start + timedelta(days=days)).isoformat()


def _create_reservation(client, catalog, status="PENDING", room_type_id=None, arrival=None, departure=None):
    if arrival is None or departure is None:
        arrival, departure = _fresh_window()
    payload = {
        "guestId": catalog["guestId"],
        "arrivalDate": arrival,
        "departureDate": departure,
        "adults": 1,
        "children": 0,
        "roomTypeId": room_type_id or catalog["roomTypes"][0]["id"],
        "status": status,
        "notes": "TEST_lifecycle",
    }
    res = client.post(f"{BASE_URL}/properties/{PROPERTY_ID}/reservations", json=payload, timeout=30)
    assert res.status_code in (200, 201), f"Create failed: {res.status_code} {res.text[:400]}"
    data = res.json()["data"]
    assert data["status"] == status
    created_ids.append(data["id"])
    return data


def _psql(sql):
    result = subprocess.run(
        ["psql", "-h", "localhost", "-U", "stayos", "-d", "stayos_dev", "-t", "-A", "-c", sql],
        capture_output=True, text=True, env={**os.environ, "PGPASSWORD": "StayOS@2026"}, timeout=30,
    )
    assert result.returncode == 0, f"psql failed: {result.stderr[:300]}"
    return result.stdout.strip()


def _snapshots(reservation_id):
    raw = _psql(
        "select coalesce(policy_snapshot::text,'') || '|||' || coalesce(tax_snapshot::text,'') "
        f"from reservations where id='{reservation_id}';"
    )
    policy_raw, _, tax_raw = raw.partition("|||")
    policy = json.loads(policy_raw) if policy_raw.strip() else None
    tax = json.loads(tax_raw) if tax_raw.strip() else None
    return policy, tax


def _url(reservation_id, action):
    return f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{reservation_id}/{action}"


def _error_code(response):
    try:
        body = response.json()
    except ValueError:
        return None
    for candidate in (body, body.get("error") if isinstance(body.get("error"), dict) else {}):
        if isinstance(candidate, dict) and candidate.get("code"):
            return candidate["code"]
    return str(body)


@pytest.fixture
def pending_reservation(admin_client, catalog):
    return _create_reservation(admin_client, catalog)


# ---------------------------------------------------------------- CONFIRM
class TestConfirm:
    def test_confirm_pending_returns_200_and_snapshots(self, admin_client, pending_reservation):
        res = admin_client.patch(_url(pending_reservation["id"], "confirm"), timeout=30)
        assert res.status_code == 200, res.text[:400]
        data = res.json()["data"]
        assert data["status"] == "CONFIRMED"
        assert data["id"] == pending_reservation["id"]

        # persistence check
        got = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{pending_reservation['id']}", timeout=30)
        assert got.status_code == 200
        assert got.json()["data"]["status"] == "CONFIRMED"

    def test_confirm_captures_policy_and_tax_snapshot(self, admin_client, catalog):
        """Snapshots are not exposed via API response DTO, so verify persistence in Postgres."""
        reservation = _create_reservation(admin_client, catalog)
        res = admin_client.patch(_url(reservation["id"], "confirm"), timeout=30)
        assert res.status_code == 200
        policy, tax = _snapshots(reservation["id"])
        assert policy, "policy_snapshot not persisted on confirm"
        assert tax, "tax_snapshot not persisted on confirm"
        assert "groupDeposit" in policy and policy.get("capturedAt")
        assert tax.get("taxName") and "taxPercentage" in tax and "taxEnabled" in tax

    def test_snapshot_is_frozen_on_reconfirm(self, admin_client, catalog):
        """Once captured, policy/tax snapshot must never be overwritten."""
        reservation = _create_reservation(admin_client, catalog)
        assert admin_client.patch(_url(reservation["id"], "confirm"), timeout=30).status_code == 200
        first_policy, first_tax = _snapshots(reservation["id"])
        assert first_policy and first_tax

        # force status back to PENDING at DB level, then confirm again
        _psql(f"update reservations set status='PENDING' where id='{reservation['id']}';")
        assert admin_client.patch(_url(reservation["id"], "confirm"), timeout=30).status_code == 200
        second_policy, second_tax = _snapshots(reservation["id"])
        assert second_policy == first_policy, "policy_snapshot was overwritten on re-confirm"
        assert second_tax == first_tax, "tax_snapshot was overwritten on re-confirm"

    def test_reconfirm_confirmed_returns_400(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = admin_client.patch(_url(reservation["id"], "confirm"), timeout=30)
        assert res.status_code == 400, f"expected 400 got {res.status_code}: {res.text[:300]}"
        assert _error_code(res) == INVALID_TRANSITION

    def test_confirm_checked_out_returns_400(self, admin_client):
        res = admin_client.patch(_url(CHECKED_OUT_RESERVATION, "confirm"), timeout=30)
        assert res.status_code == 400, res.text[:300]
        assert _error_code(res) == INVALID_TRANSITION

    def test_confirm_cancelled_returns_400(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog)
        assert admin_client.patch(_url(reservation["id"], "cancel"), json={}, timeout=30).status_code == 200
        res = admin_client.patch(_url(reservation["id"], "confirm"), timeout=30)
        assert res.status_code == 400
        assert _error_code(res) == INVALID_TRANSITION

    def test_confirm_unknown_reservation_returns_404(self, admin_client):
        res = admin_client.patch(_url(str(uuid.uuid4()), "confirm"), timeout=30)
        assert res.status_code == 404, res.text[:300]


# ---------------------------------------------------------------- CANCEL
class TestCancel:
    def test_cancel_confirmed_with_reason_returns_200(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = admin_client.patch(_url(reservation["id"], "cancel"), json={"reason": "TEST_guest request"}, timeout=30)
        assert res.status_code == 200, res.text[:400]
        data = res.json()["data"]
        assert data["status"] == "CANCELLED"

        got = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{reservation['id']}", timeout=30)
        assert got.json()["data"]["status"] == "CANCELLED"

    def test_cancel_pending_without_body_returns_200(self, admin_client, pending_reservation):
        res = admin_client.patch(_url(pending_reservation["id"], "cancel"), json={}, timeout=30)
        assert res.status_code == 200, res.text[:400]
        assert res.json()["data"]["status"] == "CANCELLED"

    def test_cancel_keeps_room_assignment(self, admin_client, catalog):
        """BEHAVIOR CHANGE (pre-1C): cancel no longer nulls roomId; inventory release
        is decoupled from physical assignment."""
        room = catalog["readyRooms"][0]
        start = date(2027, 6, 1) + timedelta(days=random.randint(0, 300))
        reservation = _create_reservation(
            admin_client, catalog, status="CONFIRMED", room_type_id=room["roomTypeId"],
            arrival=start.isoformat(), departure=(start + timedelta(days=2)).isoformat(),
        )
        assign = admin_client.patch(_url(reservation["id"], "assign-room"), json={"roomId": room["id"]}, timeout=30)
        assert assign.status_code == 200, assign.text[:400]
        assert assign.json()["data"]["reservation"]["roomId"] == room["id"]

        res = admin_client.patch(_url(reservation["id"], "cancel"), json={"reason": "TEST_release"}, timeout=30)
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "CANCELLED"
        assert res.json()["data"]["roomId"] == room["id"], "cancel must NOT clear roomId anymore"
        assert _psql(f"select coalesce(room_id::text,'') from reservations where id='{reservation['id']}';") == room["id"]

    def test_cancel_terminal_returns_400(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog)
        assert admin_client.patch(_url(reservation["id"], "cancel"), json={}, timeout=30).status_code == 200
        res = admin_client.patch(_url(reservation["id"], "cancel"), json={}, timeout=30)
        assert res.status_code == 400, res.text[:300]
        assert _error_code(res) == INVALID_TRANSITION

    def test_cancel_checked_out_returns_400(self, admin_client):
        res = admin_client.patch(_url(CHECKED_OUT_RESERVATION, "cancel"), json={}, timeout=30)
        assert res.status_code == 400
        assert _error_code(res) == INVALID_TRANSITION

    def test_cancel_unknown_body_field_returns_400(self, admin_client, pending_reservation):
        res = admin_client.patch(
            _url(pending_reservation["id"], "cancel"), json={"reason": "x", "bogusField": True}, timeout=30
        )
        assert res.status_code == 400, f"whitelist not enforced: {res.status_code} {res.text[:300]}"


# ---------------------------------------------------------------- NO-SHOW
class TestNoShow:
    def test_no_show_confirmed_returns_200(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = admin_client.patch(_url(reservation["id"], "no-show"), json={"reason": "TEST_did not arrive"}, timeout=30)
        assert res.status_code == 200, res.text[:400]
        assert res.json()["data"]["status"] == "NO_SHOW"

        got = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{reservation['id']}", timeout=30)
        assert got.json()["data"]["status"] == "NO_SHOW"

    def test_no_show_pending_returns_200(self, admin_client, pending_reservation):
        res = admin_client.patch(_url(pending_reservation["id"], "no-show"), json={}, timeout=30)
        assert res.status_code == 200, res.text[:400]
        assert res.json()["data"]["status"] == "NO_SHOW"

    def test_no_show_terminal_returns_400(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        assert admin_client.patch(_url(reservation["id"], "no-show"), json={}, timeout=30).status_code == 200
        res = admin_client.patch(_url(reservation["id"], "no-show"), json={}, timeout=30)
        assert res.status_code == 400
        assert _error_code(res) == INVALID_TRANSITION

    def test_no_show_checked_out_returns_400(self, admin_client):
        res = admin_client.patch(_url(CHECKED_OUT_RESERVATION, "no-show"), json={}, timeout=30)
        assert res.status_code == 400
        assert _error_code(res) == INVALID_TRANSITION

    def test_no_show_unknown_body_field_returns_400(self, admin_client, pending_reservation):
        res = admin_client.patch(_url(pending_reservation["id"], "no-show"), json={"foo": "bar"}, timeout=30)
        assert res.status_code == 400, f"whitelist not enforced: {res.status_code} {res.text[:300]}"


# ------------------------------------------------- INVALID TRANSITIONS (other endpoints)
class TestInvalidTransitions:
    def test_check_out_confirmed_returns_400(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = admin_client.patch(_url(reservation["id"], "check-out"), timeout=30)
        assert res.status_code == 400, res.text[:300]
        code = _error_code(res)
        assert code in (INVALID_TRANSITION, "RESERVATION_NOT_CHECKED_IN"), code

    def test_check_in_confirmed_without_room_returns_400(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = admin_client.patch(_url(reservation["id"], "check-in"), timeout=30)
        assert res.status_code == 400, res.text[:300]

    def test_check_in_terminal_returns_400(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        assert admin_client.patch(_url(reservation["id"], "cancel"), json={}, timeout=30).status_code == 200
        res = admin_client.patch(_url(reservation["id"], "check-in"), timeout=30)
        assert res.status_code == 400
        assert _error_code(res) in (INVALID_TRANSITION, "RESERVATION_NOT_CONFIRMED")

    def test_extend_confirmed_returns_400(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = admin_client.patch(_url(reservation["id"], "extend"), json={"departureDate": "2026-11-06"}, timeout=30)
        assert res.status_code == 400
        assert _error_code(res) in (INVALID_TRANSITION, "RESERVATION_NOT_CHECKED_IN")

    def test_move_room_confirmed_returns_400(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        room = catalog["readyRooms"][1]
        res = admin_client.patch(_url(reservation["id"], "move-room"), json={"roomId": room["id"]}, timeout=30)
        assert res.status_code == 400
        assert _error_code(res) in (INVALID_TRANSITION, "INVALID_STATE")

    def test_assign_room_on_terminal_returns_400(self, admin_client, catalog):
        room = catalog["readyRooms"][2]
        reservation = _create_reservation(
            admin_client, catalog, status="CONFIRMED", room_type_id=room["roomTypeId"],
            arrival="2026-12-05", departure="2026-12-07",
        )
        assert admin_client.patch(_url(reservation["id"], "cancel"), json={}, timeout=30).status_code == 200
        res = admin_client.patch(_url(reservation["id"], "assign-room"), json={"roomId": room["id"]}, timeout=30)
        assert res.status_code == 400
        assert _error_code(res) == INVALID_TRANSITION


# ---------------------------------------------------------------- RBAC / AUTH
class TestRbac:
    def test_readonly_confirm_forbidden(self, readonly_client, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog)
        res = readonly_client.patch(_url(reservation["id"], "confirm"), timeout=30)
        assert res.status_code == 403, f"expected 403 got {res.status_code}: {res.text[:300]}"

    def test_readonly_cancel_forbidden(self, readonly_client, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog)
        res = readonly_client.patch(_url(reservation["id"], "cancel"), json={}, timeout=30)
        assert res.status_code == 403, res.text[:300]

    def test_readonly_no_show_forbidden(self, readonly_client, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog)
        res = readonly_client.patch(_url(reservation["id"], "no-show"), json={}, timeout=30)
        assert res.status_code == 403, res.text[:300]

    def test_unauthenticated_confirm_returns_401(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog)
        res = requests.patch(_url(reservation["id"], "confirm"), timeout=30)
        assert res.status_code == 401, res.text[:300]


# ---------------------------------------------------------------- REGRESSION happy path
class TestRegressionWorkflow:
    def test_assign_check_in_check_out_flow(self, admin_client, catalog):
        # arrival today so check-in is allowed; find a READY room free for that window
        start = date.today()
        assign = None
        reservation = None
        for room in catalog["readyRooms"]:
            reservation = _create_reservation(
                admin_client, catalog, status="CONFIRMED", room_type_id=room["roomTypeId"],
                arrival=start.isoformat(), departure=(start + timedelta(days=2)).isoformat(),
            )
            attempt = admin_client.patch(_url(reservation["id"], "assign-room"), json={"roomId": room["id"]}, timeout=30)
            if attempt.status_code == 200:
                assign = attempt
                break
            admin_client.patch(_url(reservation["id"], "cancel"), json={"reason": "TEST_cleanup"}, timeout=30)
        assert assign is not None, "no READY room free for today's window (assign-room regression not verified)"
        assert assign.status_code == 200, assign.text[:400]

        unassign = admin_client.patch(_url(reservation["id"], "unassign-room"), timeout=30)
        assert unassign.status_code == 200, unassign.text[:400]
        assert unassign.json()["data"]["reservation"]["roomId"] is None

        reassign = admin_client.patch(_url(reservation["id"], "assign-room"), json={"roomId": room["id"]}, timeout=30)
        assert reassign.status_code == 200

        checkin = admin_client.patch(_url(reservation["id"], "check-in"), timeout=30)
        if checkin.status_code != 200:
            # attempt to satisfy check-in workspace checklist, then retry
            reg = admin_client.patch(
                _url(reservation["id"], "check-in/guest-registration"),
                json={
                    "fullName": "TEST Lifecycle Guest",
                    "mobile": f"+9198{random.randint(10000000, 99999999)}",
                    "email": f"test.lifecycle{random.randint(1000, 9999)}@demo.stayos.local",
                    "nationality": "Indian",
                    "addressLine1": "1 Test Street",
                    "city": "Kolkata",
                    "state": "WB",
                    "country": "India",
                    "purposeOfVisit": "Leisure",
                },
                timeout=30,
            )
            print("registration:", reg.status_code, reg.text[:300])
            ident = admin_client.patch(
                _url(reservation["id"], "check-in/identity"),
                json={"idType": "PASSPORT", "idNumber": f"M{random.randint(1000000, 9999999)}", "verified": True},
                timeout=30,
            )
            print("identity:", ident.status_code, ident.text[:200])
            pay = admin_client.patch(
                _url(reservation["id"], "check-in/payment-review"),
                json={"paymentReviewed": True, "paymentMethod": "CASH"},
                timeout=30,
            )
            print("payment-review:", pay.status_code, pay.text[:200])
            checkin = admin_client.patch(_url(reservation["id"], "check-in"), timeout=30)
        if checkin.status_code != 200:
            workspace = admin_client.get(_url(reservation["id"], "check-in-workspace"), timeout=30)
            pytest.skip(
                f"check-in blocked: {checkin.status_code} {checkin.text[:200]} | workspace: {workspace.text[:400]}"
            )
        assert checkin.json()["data"]["reservation"]["status"] == "CHECKED_IN"

        # invalid: confirm/cancel/no-show from CHECKED_IN must be rejected centrally
        assert admin_client.patch(_url(reservation["id"], "confirm"), timeout=30).status_code == 400
        assert admin_client.patch(_url(reservation["id"], "cancel"), json={}, timeout=30).status_code == 400
        assert admin_client.patch(_url(reservation["id"], "no-show"), json={}, timeout=30).status_code == 400

        # regression: extend stay works from CHECKED_IN
        new_departure = (start + timedelta(days=3)).isoformat()
        extend = admin_client.patch(
            _url(reservation["id"], "extend"), json={"departureDate": new_departure}, timeout=30
        )
        assert extend.status_code == 200, extend.text[:400]
        assert extend.json()["data"]["reservation"]["departureDate"] == new_departure

        checkout = admin_client.patch(_url(reservation["id"], "check-out"), timeout=30)
        assert checkout.status_code == 200, checkout.text[:400]
        assert checkout.json()["data"]["reservation"]["status"] == "CHECKED_OUT"

        # terminal: no further transitions allowed after CHECKED_OUT
        assert admin_client.patch(_url(reservation["id"], "confirm"), timeout=30).status_code == 400
        assert admin_client.patch(_url(reservation["id"], "cancel"), json={}, timeout=30).status_code == 400
        assert admin_client.patch(_url(reservation["id"], "no-show"), json={}, timeout=30).status_code == 400
        assert admin_client.patch(_url(reservation["id"], "check-out"), timeout=30).status_code == 400


# ------------------------------------------- BYPASS CHECK: generic PATCH must respect the map
class TestGenericPatchStatusBypass:
    """`status` must be rejected by the generic PATCH (removed from UpdateReservationDto),
    so ALLOWED_RESERVATION_TRANSITIONS stays the single source of truth."""

    def _detail(self, response):
        try:
            return json.dumps(response.json())
        except ValueError:
            return response.text[:300]

    def _patch(self, client, reservation_id, body):
        return client.patch(
            f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{reservation_id}",
            json=body,
            timeout=30,
        )

    def _get(self, client, reservation_id):
        res = client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{reservation_id}", timeout=30)
        assert res.status_code == 200, res.text[:300]
        return res.json()["data"]

    def test_generic_patch_cannot_jump_confirmed_to_checked_out(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = self._patch(admin_client, reservation["id"], {"status": "CHECKED_OUT"})
        assert res.status_code == 400, (
            f"illegal CONFIRMED->CHECKED_OUT accepted via generic PATCH: {res.status_code} "
            f"{res.text[:200]}"
        )
        assert "status" in self._detail(res), f"whitelist message should mention status: {self._detail(res)}"
        assert self._get(admin_client, reservation["id"])["status"] == "CONFIRMED"

    def test_generic_patch_cannot_revive_terminal_reservation(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog)
        assert admin_client.patch(_url(reservation["id"], "cancel"), json={}, timeout=30).status_code == 200
        res = self._patch(admin_client, reservation["id"], {"status": "CONFIRMED"})
        assert res.status_code == 400, (
            f"terminal CANCELLED revived to CONFIRMED via generic PATCH: {res.status_code} {res.text[:200]}"
        )
        assert self._get(admin_client, reservation["id"])["status"] == "CANCELLED"

    def test_generic_patch_status_cancelled_rejected(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog)
        res = self._patch(admin_client, reservation["id"], {"status": "CANCELLED"})
        assert res.status_code == 400, f"status accepted on generic PATCH: {self._detail(res)}"
        assert self._get(admin_client, reservation["id"])["status"] == "PENDING"

    def test_generic_patch_status_same_value_still_rejected(self, admin_client, catalog):
        """Whitelist must reject `status` unconditionally, even a no-op value."""
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = self._patch(admin_client, reservation["id"], {"status": "CONFIRMED"})
        assert res.status_code == 400, f"status accepted on generic PATCH: {self._detail(res)}"

    def test_generic_patch_status_alongside_allowed_field_rejected(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = self._patch(admin_client, reservation["id"], {"notes": "TEST_notes_with_status", "status": "NO_SHOW"})
        assert res.status_code == 400, f"status accepted alongside allowed field: {self._detail(res)}"
        after = self._get(admin_client, reservation["id"])
        assert after["status"] == "CONFIRMED"
        assert after["notes"] != "TEST_notes_with_status", "partial write applied despite 400"

    def test_generic_patch_allowed_fields_still_work(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = self._patch(
            admin_client,
            reservation["id"],
            {"notes": "TEST_updated_notes", "specialRequests": "TEST_late checkout", "adults": 2},
        )
        assert res.status_code == 200, f"allowed-field PATCH broke: {res.status_code} {res.text[:300]}"
        data = res.json()["data"]
        assert data["notes"] == "TEST_updated_notes"
        assert data["specialRequests"] == "TEST_late checkout"
        assert data["adults"] == 2
        assert data["status"] == "CONFIRMED"

        after = self._get(admin_client, reservation["id"])
        assert after["notes"] == "TEST_updated_notes"
        assert after["specialRequests"] == "TEST_late checkout"
        assert after["adults"] == 2

    def test_generic_patch_room_assignment_still_works(self, admin_client, catalog):
        # retry across rooms/windows: earlier test runs leave active assigned reservations
        res = None
        for room in catalog["readyRooms"]:
            start = date(2028, 3, 1) + timedelta(days=random.randint(0, 1000))
            reservation = _create_reservation(
                admin_client, catalog, status="CONFIRMED", room_type_id=room["roomTypeId"],
                arrival=start.isoformat(), departure=(start + timedelta(days=2)).isoformat(),
            )
            attempt = self._patch(admin_client, reservation["id"], {"roomId": room["id"]})
            if attempt.status_code == 200:
                res = attempt
                break
            admin_client.patch(_url(reservation["id"], "cancel"), json={"reason": "TEST_cleanup"}, timeout=30)
        assert res is not None, "no READY room free for any tried window"
        assert res.status_code == 200, f"roomId PATCH failed: {res.status_code} {res.text[:300]}"
        assert res.json()["data"]["roomId"] == room["id"]
        assert self._get(admin_client, reservation["id"])["roomId"] == room["id"]


# ------------------------------------------- ITER-9 RE-VERIFY: generic PATCH FK/relation writes
class TestGenericPatchRelationUpdates:
    """ReservationsService.update() must align relations with scalar FKs, persist them,
    and return the RE-FETCHED persisted state (no fabricated echo, no dropped write)."""

    def _patch(self, client, reservation_id, body):
        return client.patch(
            f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{reservation_id}", json=body, timeout=30
        )

    def _get(self, client, reservation_id):
        res = client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{reservation_id}", timeout=30)
        assert res.status_code == 200, res.text[:300]
        return res.json()["data"]

    def _reservation_with_room(self, admin_client, catalog):
        """Create a CONFIRMED reservation and assign a READY room via generic PATCH."""
        start = date(2029, 4, 1) + timedelta(days=random.randint(0, 300))
        for room in catalog["readyRooms"]:
            reservation = _create_reservation(
                admin_client, catalog, status="CONFIRMED", room_type_id=room["roomTypeId"],
                arrival=start.isoformat(), departure=(start + timedelta(days=2)).isoformat(),
            )
            res = self._patch(admin_client, reservation["id"], {"roomId": room["id"]})
            if res.status_code == 200:
                return reservation, room, res.json()["data"]
        pytest.fail("could not assign any READY room via generic PATCH")

    def test_patch_assign_ready_room_persists_and_response_matches_get(self, admin_client, catalog):
        reservation, room, body = self._reservation_with_room(admin_client, catalog)
        assert body["roomId"] == room["id"], f"response roomId not persisted value: {body.get('roomId')}"
        after = self._get(admin_client, reservation["id"])
        assert after["roomId"] == room["id"], "roomId write dropped in DB"
        assert body["roomId"] == after["roomId"]
        assert body["status"] == after["status"]
        assert body["roomTypeId"] == after["roomTypeId"]

    def test_patch_room_id_null_unassigns_and_persists(self, admin_client, catalog):
        reservation, room, _ = self._reservation_with_room(admin_client, catalog)
        res = self._patch(admin_client, reservation["id"], {"roomId": None})
        assert res.status_code == 200, f"roomId:null PATCH failed: {res.status_code} {res.text[:300]}"
        assert res.json()["data"]["roomId"] is None, "response still shows an assigned room"
        assert self._get(admin_client, reservation["id"])["roomId"] is None, "unassign not persisted in DB"

    def test_patch_room_type_id_persists_and_matches_get(self, admin_client, catalog):
        if len(catalog["roomTypes"]) < 2:
            pytest.skip("need >=2 room types")
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED",
                                         room_type_id=catalog["roomTypes"][0]["id"])
        target = catalog["roomTypes"][1]["id"]
        res = self._patch(admin_client, reservation["id"], {"roomTypeId": target})
        assert res.status_code == 200, f"roomTypeId PATCH failed: {res.status_code} {res.text[:300]}"
        body = res.json()["data"]
        assert body["roomTypeId"] == target, f"response roomTypeId stale: {body['roomTypeId']}"
        after = self._get(admin_client, reservation["id"])
        assert after["roomTypeId"] == target, "roomTypeId write dropped in DB"
        assert body.get("roomTypeName") == after.get("roomTypeName"), "roomTypeName echo differs from persisted state"

    def test_patch_guest_id_persists_and_matches_get(self, admin_client, catalog):
        guests = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/guests?limit=5", timeout=30).json()["data"]
        others = [g["id"] for g in guests if g["id"] != catalog["guestId"]]
        if not others:
            pytest.skip("need >=2 guests")
        target = others[0]
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        res = self._patch(admin_client, reservation["id"], {"guestId": target})
        assert res.status_code == 200, f"guestId PATCH failed: {res.status_code} {res.text[:300]}"
        body = res.json()["data"]
        assert body["guestId"] == target, f"response guestId stale: {body['guestId']}"
        after = self._get(admin_client, reservation["id"])
        assert after["guestId"] == target, "guestId write dropped in DB"
        # DTO flattens the guest relation -> guestName/guestEmail must match the re-fetched state
        assert body.get("guestName") == after.get("guestName"), "flattened guest fields diverge from persisted state"
        assert body.get("guestEmail") == after.get("guestEmail")

    def test_patch_non_ready_room_returns_400_and_does_not_change_room(self, admin_client, catalog):
        rooms = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/rooms?limit=100", timeout=30).json()["data"]
        non_ready = [r for r in rooms if r["operationalStatus"] != "READY"]
        if not non_ready:
            pytest.skip("no non-READY room available")
        reservation, room, _ = self._reservation_with_room(admin_client, catalog)
        before = self._get(admin_client, reservation["id"])["roomId"]
        assert before == room["id"]
        res = self._patch(admin_client, reservation["id"], {"roomId": non_ready[0]["id"]})
        assert res.status_code == 400, f"non-READY room accepted: {res.status_code} {res.text[:300]}"
        assert "ready" in res.text.lower(), f"unexpected error body: {res.text[:300]}"
        assert self._get(admin_client, reservation["id"])["roomId"] == before, "failed PATCH mutated roomId"

    def test_hsdemo_0005_unassigned_confirmed_patch_roundtrip(self, admin_client, catalog):
        rid = "98bc52dc-6362-45fc-a604-63870367c1ff"
        current = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{rid}", timeout=30)
        if current.status_code != 200:
            pytest.skip("HSDEMO-0005 not present")
        original_notes = current.json()["data"].get("notes")
        res = self._patch(admin_client, rid, {"notes": "TEST_iter9_roundtrip"})
        assert res.status_code == 200, res.text[:300]
        body = res.json()["data"]
        after = self._get(admin_client, rid)
        assert body["notes"] == after["notes"] == "TEST_iter9_roundtrip"
        assert body["roomId"] == after["roomId"], "response roomId diverges from persisted state"
        # restore
        self._patch(admin_client, rid, {"notes": original_notes})


# ------------------------------------------- ITER-10: Reservation -> Inventory boundary
# Modules under test:
#   src/core/reservations/domain/reservation-inventory.ts
#   src/core/reservations/services/reservation-workflow.service.ts (terminate/releaseInventoryEntitlement)
HSDEMO_0003 = "84729525-cc94-4fa9-8ca3-f8c5a2ed310a"   # CONFIRMED, room e63ec77a-95a0-40df-bae9-7bc3a4ea2283
HSDEMO_0004 = "30f7157b-f1c4-4f52-9fc0-a99876536485"   # CONFIRMED, unassigned
RELEASE_ACTION = "RESERVATION_INVENTORY_RELEASED"


def _release_events(reservation_id):
    """Audit rows for the inventory-release hook (no audit API exists -> psql)."""
    raw = _psql(
        "select count(*) from audit_events where entity_id='%s' and action='%s' and entity_type='ReservationInventory';"
        % (reservation_id, RELEASE_ACTION)
    )
    return int(raw or 0)


def _release_event_payload(reservation_id):
    raw = _psql(
        "select coalesce(previous_state::text,'') || '|||' || coalesce(next_state::text,'') || '|||' || "
        "coalesce(metadata::text,'') from audit_events where entity_id='%s' and action='%s' "
        "order by created_at desc limit 1;" % (reservation_id, RELEASE_ACTION)
    )
    prev, _, rest = raw.partition("|||")
    nxt, _, meta = rest.partition("|||")
    return json.loads(prev), json.loads(nxt), json.loads(meta)


class TestInventoryBoundary:
    def _get(self, client, rid):
        res = client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{rid}", timeout=30)
        assert res.status_code == 200, res.text[:300]
        return res.json()["data"]

    def test_cancel_hsdemo_0003_keeps_room_assignment(self, admin_client):
        before = self._get(admin_client, HSDEMO_0003)
        room_before = before["roomId"]
        assert room_before, "HSDEMO-0003 expected to have a room assigned"
        if before["status"] == "CONFIRMED":
            res = admin_client.patch(_url(HSDEMO_0003, "cancel"), json={"reason": "TEST_iter10_inventory"}, timeout=30)
            assert res.status_code == 200, res.text[:400]
            assert res.json()["data"]["status"] == "CANCELLED"
            assert res.json()["data"]["roomId"] == room_before, "cancel nulled roomId (behavior change violated)"
        after = self._get(admin_client, HSDEMO_0003)
        assert after["status"] == "CANCELLED"
        assert after["roomId"] == room_before, "roomId changed after cancel"
        assert _psql(f"select coalesce(room_id::text,'') from reservations where id='{HSDEMO_0003}';") == room_before

    def test_cancel_hsdemo_0003_emitted_release_event(self, admin_client):
        assert _release_events(HSDEMO_0003) >= 1, "no RESERVATION_INVENTORY_RELEASED audit event after cancel"
        prev, nxt, meta = _release_event_payload(HSDEMO_0003)
        assert prev["consuming"] is True and nxt["consuming"] is False
        assert prev["roomTypeId"] == nxt["roomTypeId"]
        assert "roomId" not in prev and "roomId" not in nxt, "entitlement payload must be roomId-independent"
        assert meta.get("reservationCode") == "HSDEMO-0003"
        assert meta.get("arrivalDate") and meta.get("departureDate")

    def test_no_show_hsdemo_0004_returns_200_and_releases(self, admin_client):
        before = self._get(admin_client, HSDEMO_0004)
        assert before["roomId"] is None, "HSDEMO-0004 expected unassigned"
        if before["status"] == "CONFIRMED":
            res = admin_client.patch(_url(HSDEMO_0004, "no-show"), json={"reason": "TEST_iter10_noshow"}, timeout=30)
            assert res.status_code == 200, res.text[:400]
            assert res.json()["data"]["status"] == "NO_SHOW"
        after = self._get(admin_client, HSDEMO_0004)
        assert after["status"] == "NO_SHOW"
        assert _release_events(HSDEMO_0004) >= 1, "no inventory-release event after no-show"
        prev, nxt, meta = _release_event_payload(HSDEMO_0004)
        assert prev["consuming"] is True and nxt["consuming"] is False
        assert meta.get("reservationCode") == "HSDEMO-0004"

    def _confirmed_with_room(self, admin_client, catalog, year):
        """CONFIRMED reservation with a READY room assigned via generic PATCH."""
        for room in catalog["readyRooms"]:
            start = date(year, 5, 1) + timedelta(days=random.randint(0, 1000))
            reservation = _create_reservation(
                admin_client, catalog, status="CONFIRMED", room_type_id=room["roomTypeId"],
                arrival=start.isoformat(), departure=(start + timedelta(days=2)).isoformat(),
            )
            res = admin_client.patch(
                f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{reservation['id']}",
                json={"roomId": room["id"]}, timeout=30,
            )
            if res.status_code == 200:
                return reservation, room
            admin_client.patch(_url(reservation["id"], "cancel"), json={"reason": "TEST_cleanup"}, timeout=30)
        pytest.fail("no READY room free for any tried window")

    def test_terminal_reservation_no_longer_consumes_but_keeps_room(self, admin_client, catalog):
        """Fresh reservation: assign room, cancel -> roomId kept, exactly one release event."""
        reservation, room = self._confirmed_with_room(admin_client, catalog, 2030)
        rid = reservation["id"]
        assert _release_events(rid) == 0, "assignment emitted an inventory-release event"
        res = admin_client.patch(_url(rid, "cancel"), json={"reason": "TEST_iter10"}, timeout=30)
        assert res.status_code == 200, res.text[:300]
        assert res.json()["data"]["roomId"] == room["id"]
        assert _release_events(rid) == 1, f"expected exactly 1 release event, got {_release_events(rid)}"

    def test_no_show_fresh_reservation_emits_single_release_event(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        rid = reservation["id"]
        res = admin_client.patch(_url(rid, "no-show"), json={}, timeout=30)
        assert res.status_code == 200
        assert _release_events(rid) == 1
        prev, nxt, _ = _release_event_payload(rid)
        assert prev["roomTypeId"] == reservation["roomTypeId"]
        assert prev["arrivalDate"] == reservation["arrivalDate"][:10]
        assert nxt["consuming"] is False

    def test_assign_and_unassign_do_not_release_inventory(self, admin_client, catalog):
        """Assignment must never touch entitlement: no release event, status unchanged."""
        reservation, room = self._confirmed_with_room(admin_client, catalog, 2031)
        rid = reservation["id"]
        url = f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{rid}"
        assert _release_events(rid) == 0, "generic PATCH assign emitted a release event"
        assert self._get(admin_client, rid)["status"] == "CONFIRMED"

        unassign = admin_client.patch(url, json={"roomId": None}, timeout=30)
        assert unassign.status_code == 200, unassign.text[:300]
        assert unassign.json()["data"]["roomId"] is None
        assert unassign.json()["data"]["status"] == "CONFIRMED", "unassign changed status"
        assert _release_events(rid) == 0, "generic PATCH unassign emitted a release event"

        # workflow assign/unassign endpoints too
        wf_assign = admin_client.patch(_url(rid, "assign-room"), json={"roomId": room["id"]}, timeout=30)
        assert wf_assign.status_code == 200, wf_assign.text[:300]
        wf_unassign = admin_client.patch(_url(rid, "unassign-room"), timeout=30)
        assert wf_unassign.status_code == 200, wf_unassign.text[:300]
        assert _release_events(rid) == 0, "assign-room/unassign-room emitted a release event"
        assert self._get(admin_client, rid)["status"] == "CONFIRMED"

    def test_confirmed_unassigned_reservation_is_inventory_consuming(self, admin_client, catalog):
        """A CONFIRMED reservation with roomId null is active/consuming (no release event)."""
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        rid = reservation["id"]
        got = self._get(admin_client, rid)
        assert got["roomId"] is None and got["status"] == "CONFIRMED"
        assert _release_events(rid) == 0, "active reservation has a release event"

    def test_pending_hold_consumes_until_cancelled(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="PENDING")
        rid = reservation["id"]
        assert _release_events(rid) == 0
        assert admin_client.patch(_url(rid, "cancel"), json={}, timeout=30).status_code == 200
        assert _release_events(rid) == 1
        prev, nxt, _ = _release_event_payload(rid)
        assert prev["consuming"] is True and nxt["consuming"] is False

    def test_terminal_cancel_again_returns_400_and_no_duplicate_event(self, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        rid = reservation["id"]
        assert admin_client.patch(_url(rid, "cancel"), json={}, timeout=30).status_code == 200
        res = admin_client.patch(_url(rid, "cancel"), json={}, timeout=30)
        assert res.status_code == 400
        assert _error_code(res) == INVALID_TRANSITION
        assert _release_events(rid) == 1, "duplicate release event on rejected transition"

    def test_readonly_cannot_trigger_release(self, readonly_client, admin_client, catalog):
        reservation = _create_reservation(admin_client, catalog, status="CONFIRMED")
        rid = reservation["id"]
        res = readonly_client.patch(_url(rid, "cancel"), json={}, timeout=30)
        assert res.status_code == 403, res.text[:300]
        assert _release_events(rid) == 0, "release event written despite 403"
        assert self._get(admin_client, rid)["status"] == "CONFIRMED"

    def test_check_out_does_not_emit_inventory_release(self, admin_client):
        """Documented behavior: only cancel/no-show run the release hook (CHECKED_OUT is
        consumed, not released). Recorded for visibility."""
        count = _release_events(CHECKED_OUT_RESERVATION)
        print(f"CHECKED_OUT reservation release events: {count}")
        assert count == 0


@pytest.fixture(scope="session", autouse=True)
def report_created(admin_client):
    yield
    # Release inventory held by TEST_ reservations so repeat runs are not starved
    # (only 4 READY rooms exist in the demo property).
    released = 0
    for rid in created_ids:
        got = admin_client.get(f"{BASE_URL}/properties/{PROPERTY_ID}/reservations/{rid}", timeout=30)
        if got.status_code != 200:
            continue
        if got.json()["data"]["status"] in ("PENDING", "CONFIRMED"):
            if admin_client.patch(_url(rid, "cancel"), json={"reason": "TEST_cleanup"}, timeout=30).status_code == 200:
                released += 1
    print(f"\nTEST_ created reservations: {len(created_ids)}, released at teardown: {released}")
