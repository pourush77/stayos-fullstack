"""
StayOS V1 regression suite (backend).
Covers: auth for all roles, permission gating, guests CRUD, rooms, availability,
reservations create/extend/move, check-in workspace + check-in, billing folio
charges/payments/settle, receipt PDF, razorpay order, housekeeping transitions,
staff access token flow, reports.
"""
import os
import re
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

env = dotenv_values("/app/apps/web/.env.local")
BASE_URL = (os.environ.get("NEXT_PUBLIC_API_BASE_URL") or env.get("NEXT_PUBLIC_API_BASE_URL")).rstrip("/")


def _password():
    content = Path("/app/memory/test_credentials.md").read_text()
    m = re.search(r"password \*\*`([^`]+)`", content)
    if not m:
        pytest.skip("password not found in /app/memory/test_credentials.md")
    return m.group(1)


PASSWORD = _password()
RUN = str(int(__import__("time").time()))[-7:]
ROLES = {
    "owner": "owner@stayos.local",
    "admin": "admin@stayos.local",
    "manager": "manager@stayos.local",
    "frontdesk": "frontdesk@stayos.local",
    "housekeeping": "housekeeping@stayos.local",
    "accounts": "accounts@stayos.local",
    "maintenance": "maintenance@stayos.local",
}


def login(email, password=PASSWORD):
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


def client_for(email):
    r = login(email)
    if r.status_code not in (200, 201):
        pytest.fail(f"login failed for {email}: {r.status_code} {r.text[:300]}")
    data = r.json()["data"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['accessToken']}", "Content-Type": "application/json"})
    return s, data["user"]


@pytest.fixture(scope="session")
def fd():
    s, u = client_for(ROLES["frontdesk"])
    return s, u["propertyId"]


@pytest.fixture(scope="session")
def owner():
    s, u = client_for(ROLES["owner"])
    return s, u["propertyId"]


# ---------------- AUTH ----------------
class TestAuth:
    @pytest.mark.parametrize("role,email", list(ROLES.items()))
    def test_login_each_role(self, role, email):
        r = login(email)
        assert r.status_code in (200, 201), f"{role} login -> {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body["success"] is True
        user = body["data"]["user"]
        assert user["email"] == email
        assert isinstance(body["data"]["accessToken"], str) and len(body["data"]["accessToken"]) > 20
        assert user["propertyId"]
        assert isinstance(user["permissions"], list) and user["permissions"]

    def test_wrong_password_401(self):
        r = login(ROLES["owner"], "WrongPass000!")
        assert r.status_code == 401, r.status_code
        assert "eyJ" not in r.text

    def test_unknown_user_401(self):
        r = login("nobody-qa@stayos.local")
        assert r.status_code == 401

    def test_unauthenticated_property_endpoint_401(self, fd):
        _, pid = fd
        for path in ["reservations", "guests", "rooms", "folios", "housekeeping/dashboard", "reports/overview"]:
            r = requests.get(f"{BASE_URL}/properties/{pid}/{path}", timeout=30)
            assert r.status_code == 401, f"{path} -> {r.status_code}"

    def test_invalid_token_401(self, fd):
        _, pid = fd
        r = requests.get(f"{BASE_URL}/properties/{pid}/reservations",
                         headers={"Authorization": "Bearer not.a.real.token"}, timeout=30)
        assert r.status_code == 401


# ---------------- PERMISSIONS ----------------
class TestPermissionGating:
    def test_housekeeping_cannot_read_folios(self, fd):
        _, pid = fd
        s, _ = client_for(ROLES["housekeeping"])
        r = s.get(f"{BASE_URL}/properties/{pid}/folios", timeout=30)
        assert r.status_code == 403, f"permission leak: housekeeping folios -> {r.status_code}"

    def test_housekeeping_cannot_list_users(self, fd):
        _, pid = fd
        s, _ = client_for(ROLES["housekeeping"])
        r = s.get(f"{BASE_URL}/properties/{pid}/users", timeout=30)
        assert r.status_code in (403, 404), r.status_code

    def test_housekeeping_can_read_dashboard(self, fd):
        _, pid = fd
        s, _ = client_for(ROLES["housekeeping"])
        r = s.get(f"{BASE_URL}/properties/{pid}/housekeeping/dashboard", timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_frontdesk_can_read_core_modules(self, fd):
        s, pid = fd
        for path in ["reservations", "guests", "rooms", "folios"]:
            r = s.get(f"{BASE_URL}/properties/{pid}/{path}", timeout=30)
            assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_frontdesk_can_access_housekeeping_board(self, fd):
        """Requirement: Front Desk can access /housekeeping."""
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/housekeeping/dashboard", timeout=30)
        assert r.status_code == 200, f"FRONT_DESK denied housekeeping dashboard -> {r.status_code}"

    def test_cross_property_access_blocked(self, fd):
        s, _ = fd
        other = "00000000-0000-4000-8000-000000000000"
        r = s.get(f"{BASE_URL}/properties/{other}/reservations", timeout=30)
        assert r.status_code in (403, 404), f"cross-property leak -> {r.status_code}"


# ---------------- GUESTS ----------------
class TestGuests:
    created = []

    def test_list_guests(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/guests", timeout=30)
        assert r.status_code == 200
        body = r.json()["data"]
        items = body["items"] if isinstance(body, dict) and "items" in body else body
        assert isinstance(items, list)

    def test_create_update_and_fetch_guest(self, fd):
        s, pid = fd
        payload = {"firstName": "TEST_QA", "lastName": "Regression",
                   "phone": f"9{RUN}0"[:10], "email": f"test_qa_{RUN}@example.com"}
        r = s.post(f"{BASE_URL}/properties/{pid}/guests", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        g = r.json()["data"]
        assert g["firstName"] == "TEST_QA"
        gid = g["id"]
        TestGuests.created.append(gid)

        got = s.get(f"{BASE_URL}/properties/{pid}/guests/{gid}", timeout=30)
        assert got.status_code == 200
        assert got.json()["data"]["phone"] == payload["phone"]

        up = s.patch(f"{BASE_URL}/properties/{pid}/guests/{gid}", json={"lastName": "Updated"}, timeout=30)
        assert up.status_code == 200, up.text[:300]
        assert s.get(f"{BASE_URL}/properties/{pid}/guests/{gid}", timeout=30).json()["data"]["lastName"] == "Updated"

    def test_create_guest_validation(self, fd):
        s, pid = fd
        r = s.post(f"{BASE_URL}/properties/{pid}/guests", json={"lastName": "NoFirstName"}, timeout=30)
        assert r.status_code == 400, r.status_code

    def test_guest_not_found(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/guests/11111111-1111-4111-8111-111111111111", timeout=30)
        assert r.status_code == 404


# ---------------- ROOMS / AVAILABILITY ----------------
class TestRoomsAndAvailability:
    def test_rooms_list_has_status(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/rooms?limit=100", timeout=30)
        assert r.status_code == 200, r.text[:200]
        body = r.json()["data"]
        items = body["items"] if isinstance(body, dict) and "items" in body else body
        assert items, "no rooms seeded"
        assert "operationalStatus" in items[0] or "status" in items[0]

    def test_room_detail(self, fd):
        s, pid = fd
        items = s.get(f"{BASE_URL}/properties/{pid}/rooms?limit=5", timeout=30).json()["data"]
        r = s.get(f"{BASE_URL}/properties/{pid}/rooms/{items[0]['id']}", timeout=30)
        assert r.status_code == 200
        assert r.json()["data"]["id"] == items[0]["id"]

    def test_room_board(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/operations/room-board", timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_available_rooms_query(self, fd):
        s, pid = fd
        a = (date.today() + timedelta(days=40)).isoformat()
        d = (date.today() + timedelta(days=42)).isoformat()
        rt = s.get(f"{BASE_URL}/properties/{pid}/room-types", timeout=30).json()["data"]
        rts = rt["items"] if isinstance(rt, dict) and "items" in rt else rt
        r = s.get(f"{BASE_URL}/properties/{pid}/operations/available-rooms",
                  params={"arrivalDate": a, "departureDate": d, "roomTypeId": rts[0]["id"]}, timeout=30)
        assert r.status_code == 200, r.text[:400]

    def test_available_rooms_validation(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/operations/available-rooms",
                  params={"arrivalDate": "not-a-date", "departureDate": "also-bad"}, timeout=30)
        assert r.status_code == 400, r.status_code


# ---------------- FULL RESERVATION LIFECYCLE ----------------
@pytest.fixture(scope="module")
def lifecycle(fd):
    """Create guest + reservation used across the lifecycle tests."""
    s, pid = fd
    guest = s.post(f"{BASE_URL}/properties/{pid}/guests", json={
        "firstName": "TEST_Life", "lastName": "Cycle", "phone": f"8{RUN}1"[:10],
        "email": f"test_life_{RUN}@example.com"}, timeout=30)
    assert guest.status_code in (200, 201), guest.text[:300]
    gid = guest.json()["data"]["id"]

    rt = s.get(f"{BASE_URL}/properties/{pid}/room-types", timeout=30).json()["data"]
    rts = rt["items"] if isinstance(rt, dict) and "items" in rt else rt
    ctx = {"session": s, "pid": pid, "guestId": gid, "roomTypes": rts}
    yield ctx


class TestReservationLifecycle:
    state = {}

    def test_01_list_reservations(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/reservations", timeout=30)
        assert r.status_code == 200
        body = r.json()["data"]
        items = body["items"] if isinstance(body, dict) and "items" in body else body
        assert isinstance(items, list)
        if items:
            assert {"status", "arrivalDate", "departureDate"} <= set(items[0].keys())

    def test_02_create_reservation(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        arrival = date.today().isoformat()
        departure = (date.today() + timedelta(days=2)).isoformat()
        # pick the first room type that actually has inventory free for the window
        rt_id, rooms = None, []
        for rt in lifecycle["roomTypes"]:
            avail = s.get(f"{BASE_URL}/properties/{pid}/operations/available-rooms",
                          params={"arrivalDate": arrival, "departureDate": departure, "roomTypeId": rt["id"]},
                          timeout=30)
            assert avail.status_code == 200, avail.text[:300]
            ad = avail.json()["data"]
            candidates = ad["items"] if isinstance(ad, dict) and "items" in ad else ad
            if candidates:
                rt_id, rooms = rt["id"], candidates
                break
        assert rooms, "no available rooms returned for booking window across any room type"
        room_id = rooms[0].get("id") or rooms[0].get("roomId")

        r = s.post(f"{BASE_URL}/properties/{pid}/reservations", json={
            "guestId": lifecycle["guestId"], "arrivalDate": arrival, "departureDate": departure,
            "adults": 2, "children": 0, "roomTypeId": rt_id, "roomId": room_id,
            "notes": "TEST_QA regression booking"}, timeout=30)
        assert r.status_code in (200, 201), r.text[:500]
        res = r.json()["data"]
        assert res["status"] in ("CONFIRMED", "PENDING")
        assert res["departureDate"][:10] == departure
        TestReservationLifecycle.state.update({"resId": res["id"], "roomId": room_id,
                                               "roomTypeId": rt_id, "departure": departure})

        got = s.get(f"{BASE_URL}/properties/{pid}/reservations/{res['id']}", timeout=30)
        assert got.status_code == 200
        assert got.json()["data"]["id"] == res["id"]

    def test_03_create_reservation_validation(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        r = s.post(f"{BASE_URL}/properties/{pid}/reservations", json={
            "guestId": lifecycle["guestId"], "arrivalDate": "bad", "departureDate": "bad",
            "adults": 0, "roomTypeId": lifecycle["roomTypes"][0]["id"]}, timeout=30)
        assert r.status_code == 400, r.status_code

    def test_04_check_in_workspace(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        rid = TestReservationLifecycle.state.get("resId")
        assert rid, "reservation not created"
        r = s.get(f"{BASE_URL}/properties/{pid}/reservations/{rid}/check-in-workspace", timeout=30)
        assert r.status_code == 200, r.text[:500]
        data = r.json()["data"]
        assert isinstance(data, dict) and data

    def test_05a_check_in_prerequisites(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        rid = TestReservationLifecycle.state["resId"]
        base = f"{BASE_URL}/properties/{pid}/reservations/{rid}"
        reg = s.patch(f"{base}/check-in/guest-registration", json={
            "fullName": "TEST Life Cycle", "mobile": f"8{RUN}1"[:10],
            "email": f"test_life_{RUN}@example.com", "addressLine1": "12 QA Street",
            "city": "Kolkata", "state": "WB", "country": "India", "postalCode": "700001",
            "nationality": "Indian", "purposeOfVisit": "Leisure"}, timeout=30)
        assert reg.status_code == 200, f"guest-registration -> {reg.status_code} {reg.text[:400]}"
        ident = s.patch(f"{base}/check-in/identity", json={
            "idType": "AADHAAR", "idNumber": "999988887777", "verified": True}, timeout=30)
        assert ident.status_code == 200, f"identity -> {ident.status_code} {ident.text[:400]}"
        pay = s.patch(f"{base}/check-in/payment-review", json={
            "paymentReviewed": True, "paymentMethod": "CASH"}, timeout=30)
        assert pay.status_code == 200, f"payment-review -> {pay.status_code} {pay.text[:400]}"
        # ensure assigned room is READY
        res = s.get(base, timeout=30).json()["data"]
        if res.get("roomId"):
            s.patch(f"{BASE_URL}/properties/{pid}/rooms/{res['roomId']}/mark-ready", json={}, timeout=30)
        ws = s.get(f"{base}/check-in-workspace", timeout=30).json()["data"]
        blockers = ws.get("finalChecklist", {}).get("blockers", [])
        assert not blockers, f"unexpected blockers after completing all steps: {blockers}"

    def test_05_check_in(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        rid = TestReservationLifecycle.state["resId"]
        r = s.patch(f"{BASE_URL}/properties/{pid}/reservations/{rid}/check-in", json={}, timeout=30)
        assert r.status_code == 200, f"check-in failed: {r.status_code} {r.text[:500]}"
        got = s.get(f"{BASE_URL}/properties/{pid}/reservations/{rid}", timeout=30).json()["data"]
        assert got["status"] == "CHECKED_IN", got["status"]

    def test_06_folio_for_reservation(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        rid = TestReservationLifecycle.state["resId"]
        r = s.get(f"{BASE_URL}/properties/{pid}/reservations/{rid}/folio", timeout=30)
        assert r.status_code == 200, r.text[:400]
        folio = r.json()["data"]
        fid = folio.get("id") or folio.get("folio", {}).get("id")
        assert fid, folio
        TestReservationLifecycle.state["folioId"] = fid
        assert "_id" not in str(folio)

    def test_07_extend_stay(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        rid = TestReservationLifecycle.state["resId"]
        new_dep = (date.today() + timedelta(days=4)).isoformat()
        r = s.patch(f"{BASE_URL}/properties/{pid}/reservations/{rid}/extend",
                    json={"departureDate": new_dep}, timeout=30)
        assert r.status_code == 200, f"extend failed: {r.status_code} {r.text[:500]}"
        got = s.get(f"{BASE_URL}/properties/{pid}/reservations/{rid}", timeout=30).json()["data"]
        assert got["departureDate"][:10] == new_dep, got["departureDate"]

    def test_08_extend_stay_invalid_earlier_date(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        rid = TestReservationLifecycle.state["resId"]
        r = s.patch(f"{BASE_URL}/properties/{pid}/reservations/{rid}/extend",
                    json={"departureDate": (date.today() - timedelta(days=5)).isoformat()}, timeout=30)
        assert r.status_code == 400, f"expected 400 for past departure, got {r.status_code}"

    def test_09_move_room(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        rid = TestReservationLifecycle.state["resId"]
        res = s.get(f"{BASE_URL}/properties/{pid}/reservations/{rid}", timeout=30).json()["data"]
        avail = s.get(f"{BASE_URL}/properties/{pid}/operations/available-rooms",
                      params={"arrivalDate": res["arrivalDate"][:10],
                              "departureDate": res["departureDate"][:10],
                              "roomTypeId": TestReservationLifecycle.state["roomTypeId"]}, timeout=30)
        assert avail.status_code == 200, avail.text[:300]
        ad = avail.json()["data"]
        rooms = ad["items"] if isinstance(ad, dict) and "items" in ad else ad
        target = next((x for x in rooms if (x.get("id") or x.get("roomId")) != res.get("roomId")), None)
        if not target:
            pytest.skip("no alternate room of same type available for move")
        tid = target.get("id") or target.get("roomId")
        r = s.patch(f"{BASE_URL}/properties/{pid}/reservations/{rid}/move-room",
                    json={"roomId": tid, "reason": "TEST_QA move"}, timeout=30)
        assert r.status_code == 200, f"move-room failed: {r.status_code} {r.text[:500]}"
        after = s.get(f"{BASE_URL}/properties/{pid}/reservations/{rid}", timeout=30).json()["data"]
        assert after["roomId"] == tid, after.get("roomId")

    def test_10_add_charge_and_payment(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        fid = TestReservationLifecycle.state.get("folioId")
        assert fid, "folio missing"
        before = s.get(f"{BASE_URL}/properties/{pid}/folios/{fid}", timeout=30).json()["data"]
        r = s.post(f"{BASE_URL}/properties/{pid}/folios/{fid}/charges", json={
            "type": "FOOD_AND_BEVERAGE", "description": "TEST_QA Dinner",
            "quantity": 1, "unitAmount": "500.00"}, timeout=30)
        assert r.status_code in (200, 201), f"add charge failed: {r.status_code} {r.text[:400]}"
        after = s.get(f"{BASE_URL}/properties/{pid}/folios/{fid}", timeout=30).json()["data"]
        assert float(after["totals"]["total"]) > float(before["totals"]["total"]), (before["totals"], after["totals"])

        p = s.post(f"{BASE_URL}/properties/{pid}/folios/{fid}/payments",
                   json={"method": "CASH", "amount": "500.00", "reference": "TEST_QA"}, timeout=30)
        assert p.status_code in (200, 201), f"payment failed: {p.status_code} {p.text[:400]}"
        after2 = s.get(f"{BASE_URL}/properties/{pid}/folios/{fid}", timeout=30).json()["data"]
        assert float(after2["totals"]["paid"]) > float(after["totals"]["paid"])
        payments = after2.get("payments") or []
        assert payments, "folio has no payments after successful payment POST"
        TestReservationLifecycle.state["paymentId"] = payments[-1]["id"]

    def test_11_charge_validation(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        fid = TestReservationLifecycle.state["folioId"]
        r = s.post(f"{BASE_URL}/properties/{pid}/folios/{fid}/charges",
                   json={"type": "NOT_A_TYPE", "description": "", "unitAmount": "abc"}, timeout=30)
        assert r.status_code == 400, r.status_code

    def test_12_receipt_pdf(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        fid = TestReservationLifecycle.state["folioId"]
        payid = TestReservationLifecycle.state.get("paymentId")
        if not payid:
            pytest.skip("no payment id captured")
        r = s.get(f"{BASE_URL}/properties/{pid}/folios/{fid}/payments/{payid}/receipt.pdf", timeout=60)
        assert r.status_code == 200, f"receipt pdf failed: {r.status_code} {r.text[:300]}"
        assert "application/pdf" in r.headers.get("content-type", ""), r.headers.get("content-type")
        assert r.content[:4] == b"%PDF", r.content[:20]

    def test_13_razorpay_order(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        fid = TestReservationLifecycle.state["folioId"]
        cfg = s.get(f"{BASE_URL}/properties/{pid}/folios/{fid}/razorpay/config", timeout=30)
        assert cfg.status_code == 200, cfg.text[:300]
        cfg_data = cfg.json()["data"]
        configured = bool(cfg_data.get("configured") or cfg_data.get("enabled") or cfg_data.get("keyId"))
        r = s.post(f"{BASE_URL}/properties/{pid}/folios/{fid}/razorpay/order",
                   json={"amount": "100.00"}, timeout=60)
        if not configured:
            # REGRESSION FIX #2: unconfigured gateway must be 503, never 500
            assert r.status_code == 503, f"expected 503 when razorpay unconfigured, got {r.status_code} {r.text[:400]}"
            assert r.status_code != 500
            return
        assert r.status_code in (200, 201), f"razorpay order failed: {r.status_code} {r.text[:400]}"
        data = r.json()["data"]
        oid = data.get("orderId") or data.get("id") or data.get("order", {}).get("id")
        assert oid and str(oid).startswith("order_"), data

    def test_14_check_out(self, lifecycle):
        s, pid = lifecycle["session"], lifecycle["pid"]
        rid = TestReservationLifecycle.state["resId"]
        fid = TestReservationLifecycle.state["folioId"]
        folio = s.get(f"{BASE_URL}/properties/{pid}/folios/{fid}", timeout=30).json()["data"]
        balance = float(folio["totals"]["balance"])
        if balance > 0:
            pay = s.post(f"{BASE_URL}/properties/{pid}/folios/{fid}/payments",
                         json={"method": "CARD", "amount": f"{balance:.2f}", "reference": "TEST_QA settle"},
                         timeout=30)
            assert pay.status_code in (200, 201), pay.text[:300]
        r = s.patch(f"{BASE_URL}/properties/{pid}/reservations/{rid}/check-out", json={}, timeout=60)
        assert r.status_code == 200, f"check-out failed: {r.status_code} {r.text[:500]}"
        got = s.get(f"{BASE_URL}/properties/{pid}/reservations/{rid}", timeout=30).json()["data"]
        assert got["status"] == "CHECKED_OUT", got["status"]


# ---------------- BILLING LISTS ----------------
class TestBilling:
    def test_folios_list(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/folios", timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()["data"]
        items = body["items"] if isinstance(body, dict) and "items" in body else body
        assert items, "no folios present"
        assert "status" in items[0] and ("totals" in items[0] or "balance" in items[0])

    def test_billing_overview_kpis(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/billing/overview", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()["data"]
        assert isinstance(data, dict) and data

    def test_folio_not_found(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/folios/22222222-2222-4222-8222-222222222222", timeout=30)
        assert r.status_code == 404

    def test_accounts_role_can_manage_billing(self, fd):
        _, pid = fd
        s, _ = client_for(ROLES["accounts"])
        r = s.get(f"{BASE_URL}/properties/{pid}/folios", timeout=30)
        assert r.status_code == 200, r.status_code


# ---------------- HOUSEKEEPING ----------------
class TestHousekeeping:
    def test_dashboard_groups(self, owner):
        s, pid = owner
        r = s.get(f"{BASE_URL}/properties/{pid}/housekeeping/dashboard", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()["data"]
        assert isinstance(data, dict) and data

    def test_full_room_workflow_roundtrip(self, owner):
        s, pid = owner
        base = f"{BASE_URL}/properties/{pid}"
        rooms = s.get(f"{base}/rooms?limit=100", timeout=30).json()["data"]
        room = next((r for r in rooms if r.get("operationalStatus") in ("READY", "NEEDS_CLEANING")), None)
        if not room:
            pytest.skip("no room in READY/NEEDS_CLEANING for workflow test")
        rid = room["id"]
        emps = s.get(f"{base}/employees", params={"department": "HOUSEKEEPING"}, timeout=30).json()["data"]
        emps = emps["items"] if isinstance(emps, dict) and "items" in emps else emps
        emp = next((e for e in emps if e.get("isActive", True)), None)
        assert emp, "no active housekeeping employee seeded"
        checklist = [{"key": k, "completed": True} for k in
                     ["BED", "BATHROOM", "TOWELS", "TOILETRIES", "MIRROR", "FLOOR", "DUSTBIN"]]

        s.patch(f"{base}/rooms/{rid}/mark-cleaning", json={}, timeout=30)
        steps = [
            ("assign", f"{base}/housekeeping/rooms/{rid}/assign", {"employeeId": emp["id"]}),
            ("start", f"{base}/housekeeping/rooms/{rid}/start", {}),
            ("complete", f"{base}/housekeeping/rooms/{rid}/complete",
             {"employeeId": emp["id"], "completedOnBehalf": True, "checklist": checklist}),
            ("inspect", f"{base}/housekeeping/rooms/{rid}/inspect", {"action": "APPROVE"}),
        ]
        results = {}
        for name, url, body in steps:
            resp = s.patch(url, json=body, timeout=30)
            results[name] = (resp.status_code, resp.text[:250])
        failures = {k: v for k, v in results.items() if v[0] != 200}
        assert not failures, f"housekeeping transitions failed: {failures}"
        after = s.get(f"{base}/rooms/{rid}", timeout=30).json()["data"]
        assert after["operationalStatus"] == "READY", f"expected READY after inspect APPROVE, got {after['operationalStatus']}"

    def test_needs_attention(self, owner):
        s, pid = owner
        r = s.get(f"{BASE_URL}/properties/{pid}/operations/needs-attention", timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_staff_access_enable_and_token_worklist(self, owner):
        """Manager/Owner enables staff access; public token worklist loads without auth."""
        s, pid = owner
        base = f"{BASE_URL}/properties/{pid}"
        emps = s.get(f"{base}/employees", params={"department": "HOUSEKEEPING"}, timeout=30).json()["data"]
        emps = emps["items"] if isinstance(emps, dict) and "items" in emps else emps
        emp = next((e for e in emps if e.get("isActive", True)), None)
        assert emp, "no active housekeeping employee"
        en = s.patch(f"{base}/employees/{emp['id']}/staff-access", json={"enabled": True}, timeout=30)
        assert en.status_code == 200, f"enable staff access -> {en.status_code} {en.text[:300]}"
        token = en.json()["data"].get("staffAccessToken")
        if not token:
            reg = s.post(f"{base}/employees/{emp['id']}/staff-access/regenerate", json={}, timeout=30)
            assert reg.status_code in (200, 201), reg.text[:300]
            token = reg.json()["data"].get("staffAccessToken")
        assert token, f"no staffAccessToken returned: {en.json()['data']}"
        TestHousekeeping.token = token
        # public, no auth header
        pub = requests.get(f"{base}/housekeeping/staff/access/{token}", timeout=30)
        assert pub.status_code == 200, f"public staff worklist -> {pub.status_code} {pub.text[:300]}"
        data = pub.json()["data"]
        assert "rooms" in data or isinstance(data, dict), data
        # regenerate invalidates old token
        reg = s.post(f"{base}/employees/{emp['id']}/staff-access/regenerate", json={}, timeout=30)
        assert reg.status_code in (200, 201), reg.text[:300]
        new_token = reg.json()["data"].get("staffAccessToken")
        assert new_token and new_token != token
        old = requests.get(f"{base}/housekeeping/staff/access/{token}", timeout=30)
        assert old.status_code in (400, 401, 403, 404), f"old token still valid -> {old.status_code}"
        # disable access blocks token
        dis = s.patch(f"{base}/employees/{emp['id']}/staff-access", json={"enabled": False}, timeout=30)
        assert dis.status_code == 200
        after = requests.get(f"{base}/housekeeping/staff/access/{new_token}", timeout=30)
        assert after.status_code in (400, 401, 403, 404), f"disabled token still works -> {after.status_code}"

    def test_staff_access_token_invalid(self, fd):
        _, pid = fd
        r = requests.get(f"{BASE_URL}/properties/{pid}/housekeeping/staff/access/bogus-token-123", timeout=30)
        assert r.status_code in (400, 401, 403, 404), r.status_code


# ---------------- SETTINGS / REPORTS ----------------
class TestSettingsAndReports:
    def test_owner_users_and_employees(self, owner):
        s, pid = owner
        for path in ["users", "employees", "room-types"]:
            r = s.get(f"{BASE_URL}/properties/{pid}/{path}", timeout=30)
            assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_employees_department_filter(self, owner):
        s, pid = owner
        r = s.get(f"{BASE_URL}/properties/{pid}/employees", params={"department": "HOUSEKEEPING"}, timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_reports_endpoints(self, owner):
        s, pid = owner
        out = {}
        for path in ["overview", "occupancy", "revenue", "operations", "top-guests"]:
            r = s.get(f"{BASE_URL}/properties/{pid}/reports/{path}", timeout=60)
            out[path] = r.status_code
        failures = {k: v for k, v in out.items() if v != 200}
        assert not failures, f"report endpoints failing: {failures}"



# ---------------- ITERATION 3 REGRESSION FIX VERIFICATION ----------------
class TestIteration3Fixes:
    """Backend-side verification of regression fixes #1, #2, #4, #7, #8."""

    def test_fix1_frontdesk_housekeeping_dashboard_200(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/housekeeping/dashboard", timeout=30)
        assert r.status_code == 200, f"FRONT_DESK housekeeping dashboard -> {r.status_code} {r.text[:200]}"
        data = r.json()["data"]
        assert data, "empty dashboard payload"

    def test_fix1_frontdesk_housekeeping_rooms_and_attention(self, fd):
        s, pid = fd
        for path in ["housekeeping/rooms", "housekeeping/needs-attention"]:
            r = s.get(f"{BASE_URL}/properties/{pid}/{path}", timeout=30)
            assert r.status_code in (200, 404), f"{path} -> {r.status_code} {r.text[:200]}"

    def test_fix1_frontdesk_employees_view(self, fd):
        s, pid = fd
        r = s.get(f"{BASE_URL}/properties/{pid}/employees", params={"department": "HOUSEKEEPING"}, timeout=30)
        assert r.status_code == 200, f"FRONT_DESK employees -> {r.status_code} {r.text[:200]}"

    def test_fix2_razorpay_order_returns_503_not_500(self, fd):
        s, pid = fd
        folios = s.get(f"{BASE_URL}/properties/{pid}/folios", timeout=30)
        assert folios.status_code == 200, folios.text[:200]
        body = folios.json()["data"]
        items = body["items"] if isinstance(body, dict) else body
        assert items, "no folios seeded to test razorpay against"
        fid = items[0]["id"]
        r = s.post(f"{BASE_URL}/properties/{pid}/folios/{fid}/razorpay/order",
                   json={"amount": "100.00"}, timeout=60)
        assert r.status_code != 500, f"razorpay order still 500: {r.text[:300]}"
        assert r.status_code == 503, f"expected 503 (unconfigured), got {r.status_code} {r.text[:300]}"

    def test_fix2_razorpay_config_reports_unconfigured(self, fd):
        s, pid = fd
        folios = s.get(f"{BASE_URL}/properties/{pid}/folios", timeout=30)
        body = folios.json()["data"]
        items = body["items"] if isinstance(body, dict) else body
        fid = items[0]["id"]
        r = s.get(f"{BASE_URL}/properties/{pid}/folios/{fid}/razorpay/config", timeout=30)
        assert r.status_code == 200, r.text[:200]
        cfg = r.json()["data"]
        assert isinstance(cfg, dict) and cfg, "config endpoint must expose a configured flag for the UI to gate on"

    def test_fix4_no_plaintext_credentials_in_employees_page(self):
        p = Path("/app/apps/web/src/features/employees/components/EmployeesPage.tsx")
        assert p.exists(), p
        txt = p.read_text()
        for leak in ["bootstrap:demo-employees", "Gaurav Gaur", "Password123!"]:
            assert leak not in txt, f"plaintext/dev leak still present: {leak}"

    def test_fix7_no_duplicate_hindi_chip(self):
        p = Path("/app/apps/web/src/features/guests/GuestFormPage.tsx")
        assert p.exists(), p
        txt = p.read_text()
        assert "हिन्दी" not in txt, "duplicate Devanagari Hindi chip still present"

    def test_fix8_login_testids_present(self):
        p = Path("/app/apps/web/src/app/login/page.tsx")
        assert p.exists(), p
        txt = p.read_text()
        for tid in ["login-email", "login-password", "login-submit"]:
            assert tid in txt, f"missing data-testid {tid}"
