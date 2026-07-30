"""
StayOS verification suite for the git-flatten fix of /app/stayos-api.
Covers: (1) git repo structure state, (2) no data loss / files staged,
(3) runtime health of Postgres+Nest+Next, (4) auth + billing (folios) endpoints.
Read-only: no commits, no file mutation under /app/stayos-api.
"""
import os
import re
import subprocess
from pathlib import Path

import pytest
import requests

REPO = "/app"
API_LOCAL = "http://localhost:8001/api/v1"
PREVIEW = "https://74a8720a-4322-499a-bf79-47af279c926d.preview.emergentagent.com"
FRONTEND = "http://localhost:3000"


def git(*args):
    return subprocess.run(["git", "-C", REPO, *args], capture_output=True, text=True)


def creds():
    content = Path("/app/memory/test_credentials.md").read_text()
    pwd = re.search(r"password \*\*`([^`]+)`", content)
    assert pwd, "password not found in test_credentials.md"
    return pwd.group(1)


PASSWORD = creds()


# ---------------- Git structure ----------------
class TestGitFlatten:
    def test_nested_git_dir_removed(self):
        assert not Path("/app/stayos-api/.git").exists()
        found = subprocess.run(
            ["bash", "-lc", "find /app/stayos-api -name .git -not -path '*/node_modules/*'"],
            capture_output=True, text=True).stdout.strip()
        assert found == "", f"nested git dirs still present: {found}"

    def test_module_cache_removed(self):
        assert not Path("/app/.git/modules/stayos-api").exists()

    def test_no_gitlink_entries(self):
        out = git("ls-files", "--stage", "stayos-api/").stdout.splitlines()
        assert len(out) > 100, f"only {len(out)} entries staged"
        assert not [line for line in out if line.startswith("160000")], "gitlink (submodule) entry still present"
        assert all(line.split()[0] in ("100644", "100755") for line in out)

    def test_status_shows_added_and_old_gitlink_deleted(self):
        out = git("status", "--short", "stayos-api", "stayos-api/").stdout.splitlines()
        assert "D  stayos-api" in out, "old submodule gitlink not staged as deleted"
        assert sum(1 for line in out if line.startswith("A  stayos-api/")) > 100

    @pytest.mark.parametrize("path", [
        "stayos-api/package.json",
        "stayos-api/src/main.ts",
        "stayos-api/src/app.module.ts",
        "stayos-api/src/core/billing/billing.controller.ts",
        "stayos-api/src/database/migrations/1783924200000-CreateBillingTables.ts",
        "stayos-api/scripts/bootstrap-billing.js",
    ])
    def test_key_files_staged_and_on_disk(self, path):
        assert Path(REPO, path).is_file(), f"{path} missing on disk"
        assert git("ls-files", "--error-unmatch", path).returncode == 0, f"{path} not staged"

    @pytest.mark.parametrize("path", ["stayos-api/.env", "stayos-api/node_modules", "stayos-api/dist"])
    def test_sensitive_or_generated_not_tracked(self, path):
        assert git("ls-files", path).stdout.strip() == "", f"{path} must not be tracked"

    def test_no_untracked_leftovers(self):
        out = git("status", "--short", "--untracked-files=all", "stayos-api/").stdout.splitlines()
        assert not [line for line in out if line.startswith("??")]


# ---------------- Runtime ----------------
class TestRuntime:
    def test_supervisor_services_running(self):
        out = subprocess.run(["sudo", "supervisorctl", "status"], capture_output=True, text=True).stdout
        for svc in ("postgres", "stayos_api", "frontend"):
            line = [ln for ln in out.splitlines() if ln.startswith(svc)]
            assert line and "RUNNING" in line[0], f"{svc} not running: {line}"

    def test_health_local_and_preview(self):
        for url in (f"{API_LOCAL}/health", f"{PREVIEW}/api/v1/health"):
            r = requests.get(url, timeout=30)
            assert r.status_code == 200, url
            assert r.json()["status"] == "ok"

    @pytest.mark.parametrize("route", ["/login", "/billing"])
    def test_frontend_routes(self, route):
        assert requests.get(f"{FRONTEND}{route}", timeout=30).status_code == 200


# ---------------- Auth + Billing ----------------
def login(email):
    r = requests.post(f"{API_LOCAL}/auth/login", json={"email": email, "password": PASSWORD}, timeout=30)
    assert r.status_code in (200, 201), f"{email} login failed {r.status_code}: {r.text[:300]}"
    d = r.json()["data"]
    assert d["accessToken"] and d["refreshToken"]
    assert d["user"]["email"] == email
    assert d["user"]["propertyId"]
    return d


class TestAuthAndBilling:
    def test_admin_login(self):
        d = login("admin@stayos.local")
        assert d["user"]["role"] == "ADMIN"
        assert "billing.view" in d["user"]["permissions"]

    def test_accounts_login_and_folios(self):
        d = login("accounts@stayos.local")
        pid = d["user"]["propertyId"]
        r = requests.get(f"{API_LOCAL}/properties/{pid}/folios",
                         headers={"Authorization": f"Bearer {d['accessToken']}"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["success"] is True
        folios = body["data"]
        assert isinstance(folios, list) and len(folios) >= 4, f"expected >=4 seeded folios, got {len(folios)}"
        f0 = folios[0]
        for key in ("id", "folioNumber", "status", "totals", "guest", "charges"):
            assert key in f0, f"missing {key} in folio payload"
        assert f0["propertyId"] == pid

    def test_folios_requires_auth(self):
        d = login("admin@stayos.local")
        pid = d["user"]["propertyId"]
        r = requests.get(f"{API_LOCAL}/properties/{pid}/folios", timeout=30)
        assert r.status_code == 401, f"unauthenticated access returned {r.status_code}"

    def test_invalid_credentials_rejected(self):
        r = requests.post(f"{API_LOCAL}/auth/login",
                          json={"email": "admin@stayos.local", "password": "WrongPass000!"}, timeout=30)
        assert r.status_code == 401, r.status_code

    def test_folios_via_preview_url(self):
        r = requests.post(f"{PREVIEW}/api/v1/auth/login",
                          json={"email": "admin@stayos.local", "password": PASSWORD}, timeout=45)
        assert r.status_code in (200, 201), r.text[:300]
        d = r.json()["data"]
        r2 = requests.get(f"{PREVIEW}/api/v1/properties/{d['user']['propertyId']}/folios",
                          headers={"Authorization": f"Bearer {d['accessToken']}"}, timeout=45)
        assert r2.status_code == 200, r2.text[:300]
        assert isinstance(r2.json()["data"], list)
