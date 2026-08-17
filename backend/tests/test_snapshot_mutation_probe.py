"""Probe: inspect full PRICED snapshot payload and check immutability across
an allowed subsequent reservation mutation (date/occupancy change)."""

import json
import os
import time

import requests

BASE_URL = os.environ.get("STAYOS_API_URL", "http://localhost:3001/api/v1").rstrip("/")
DLX = "9f3f0c8f-5f98-473d-8474-d6301d4640a0"
SUF = str(int(time.time()))[-6:]


def test_snapshot_shape_and_mutation_immutability(capsys):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    login = s.post(
        f"{BASE_URL}/auth/login",
        json={"email": "admin@stayos.local", "password": "Password123!"},
        timeout=30,
    ).json()["data"]
    s.headers.update({"Authorization": f"Bearer {login['accessToken']}"})
    prop = login["user"]["propertyId"]
    guests = s.get(f"{BASE_URL}/properties/{prop}/guests?limit=1", timeout=30).json()["data"]
    guest_id = (guests if isinstance(guests, list) else guests["items"])[0]["id"]

    plan = s.post(
        f"{BASE_URL}/properties/{prop}/rates/rate-plans",
        json={"code": f"QAPROBE{SUF}", "name": "QA Probe", "mealPlan": "BREAKFAST"},
        timeout=30,
    ).json()["data"]
    s.put(
        f"{BASE_URL}/properties/{prop}/rates/rate-plans/{plan['id']}/room-types",
        json={"roomTypeId": DLX, "baseOccupancy": 2, "baseRate": "5000.00",
              "extraAdultCharge": "1500.00", "extraChildCharge": "700.00"},
        timeout=30,
    )
    create = s.post(
        f"{BASE_URL}/properties/{prop}/reservations",
        json={"guestId": guest_id, "roomTypeId": DLX, "arrivalDate": "2027-06-01",
              "departureDate": "2027-06-03", "adults": 2, "children": 1, "childAges": [7],
              "status": "CONFIRMED", "ratePlanId": plan["id"]},
        timeout=60,
    )
    assert create.status_code in (200, 201), create.text[:500]
    res_id = create.json()["data"]["id"]

    snap1 = s.get(f"{BASE_URL}/properties/{prop}/stays/{res_id}", timeout=30).json()["data"]["reservation"]["rateSnapshot"]
    print("SNAPSHOT:", json.dumps(snap1, indent=2)[:3000])

    # allowed subsequent mutation: change occupancy via PATCH reservation
    patch = s.patch(
        f"{BASE_URL}/properties/{prop}/reservations/{res_id}",
        json={"adults": 3},
        timeout=60,
    )
    print("PATCH adults status:", patch.status_code, patch.text[:250])
    snap2 = s.get(f"{BASE_URL}/properties/{prop}/stays/{res_id}", timeout=30).json()["data"]["reservation"]["rateSnapshot"]
    print("snapshotAt before/after:", snap1["snapshotAt"], snap2["snapshotAt"])
    print("totals before/after:", snap1["totals"], snap2["totals"])
    assert snap2 == snap1, "rate snapshot mutated by reservation PATCH"

    # re-confirm attempt should not re-snapshot
    reconf = s.patch(f"{BASE_URL}/properties/{prop}/reservations/{res_id}/confirm", json={}, timeout=60)
    print("re-confirm status:", reconf.status_code, reconf.text[:200])
    snap3 = s.get(f"{BASE_URL}/properties/{prop}/stays/{res_id}", timeout=30).json()["data"]["reservation"]["rateSnapshot"]
    assert snap3 == snap1, "rate snapshot changed after re-confirm"

    s.patch(f"{BASE_URL}/properties/{prop}/reservations/{res_id}/cancel",
            json={"reason": "QA probe cleanup"}, timeout=60)
    snap4 = s.get(f"{BASE_URL}/properties/{prop}/stays/{res_id}", timeout=30).json()["data"]["reservation"]["rateSnapshot"]
    assert snap4 == snap1, "rate snapshot changed after cancel"
