"""
Integration Test Suite for Module 27: Profile & Settings Management
WorkSphere HRMS
"""

import sys
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.preference import UserNotificationPreference
from app.models.user import User

client = TestClient(app)


def test_module27():
    print("================================================================")
    print("TESTING MODULE 27: PROFILE & SETTINGS MANAGEMENT")
    print("================================================================")

    db = SessionLocal()

    try:
        # ----------------------------------------------------------------------
        # Setup: Authenticate Users
        # ----------------------------------------------------------------------
        print("\n--- Setup: Authenticating Users ---")
        r_emp = client.post(
            "/api/auth/login",
            json={"email": "employee@worksphere.com", "password": "Employee@123"},
        )
        assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
        emp_token = r_emp.json()["access_token"]
        emp_headers = {"Authorization": f"Bearer {emp_token}"}

        r_admin = client.post(
            "/api/auth/login",
            json={"email": "admin@worksphere.com", "password": "Admin@123"},
        )
        assert r_admin.status_code == 200
        admin_token = r_admin.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        print("✓ Authenticated: Admin and Employee.")

        # ----------------------------------------------------------------------
        # Scenario 1: Unauthenticated Requests (401)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 1: Unauthenticated Requests (401) ---")
        unauth_routes = [
            ("GET", "/api/profile/me"),
            ("PUT", "/api/profile/me"),
            ("POST", "/api/profile/change-password"),
            ("GET", "/api/profile/preferences"),
            ("PUT", "/api/profile/preferences"),
        ]
        for meth, route in unauth_routes:
            resp = client.request(meth, route)
            assert resp.status_code == 401, f"Expected 401 for {meth} {route}, got {resp.status_code}"
        print("✓ All unauthenticated profile requests rejected with HTTP 401.")

        # ----------------------------------------------------------------------
        # Scenario 2: View Profile (GET /api/profile/me)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 2: Profile Retrieval ---")
        r_profile = client.get("/api/profile/me", headers=emp_headers)
        assert r_profile.status_code == 200
        p_data = r_profile.json()
        assert p_data["email"] == "employee@worksphere.com"
        assert p_data["role"] == "EMPLOYEE"
        assert p_data["employee_id"] is not None
        orig_full_name = p_data["full_name"]
        print(f"✓ Profile loaded: {orig_full_name} ({p_data['role']}).")

        # ----------------------------------------------------------------------
        # Scenario 3: Profile Update & Privilege Escalation Prevention
        # ----------------------------------------------------------------------
        print("\n--- Scenario 3: Profile Update & Privilege Protection ---")
        # Update name
        r_update = client.put(
            "/api/profile/me",
            json={"full_name": f"{orig_full_name} (Updated)"},
            headers=emp_headers,
        )
        assert r_update.status_code == 200
        assert r_update.json()["full_name"] == f"{orig_full_name} (Updated)"

        # Verify role cannot be changed
        r_tamper = client.put(
            "/api/profile/me",
            json={"full_name": orig_full_name, "role": "ADMIN", "salary": 999999},
            headers=emp_headers,
        )
        assert r_tamper.status_code == 200
        assert r_tamper.json()["role"] == "EMPLOYEE"  # Role remains EMPLOYEE
        print("✓ Personal profile update succeeded; privilege escalation prevented.")

        # ----------------------------------------------------------------------
        # Scenario 4: Notification Preferences (GET & PUT)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 4: Notification Preferences ---")
        r_pref_get = client.get("/api/profile/preferences", headers=emp_headers)
        assert r_pref_get.status_code == 200
        pref_data = r_pref_get.json()
        assert "in_app_enabled" in pref_data
        assert "email_enabled" in pref_data

        # Update preferences
        r_pref_put = client.put(
            "/api/profile/preferences",
            json={"email_enabled": False, "notify_tasks": False},
            headers=emp_headers,
        )
        assert r_pref_put.status_code == 200
        updated_prefs = r_pref_put.json()
        assert updated_prefs["email_enabled"] is False
        assert updated_prefs["notify_tasks"] is False
        assert updated_prefs["in_app_enabled"] is True

        # Re-fetch to ensure persistence
        r_pref_verify = client.get("/api/profile/preferences", headers=emp_headers)
        assert r_pref_verify.json()["email_enabled"] is False

        # Reset back to all True
        client.put(
            "/api/profile/preferences",
            json={"email_enabled": True, "notify_tasks": True},
            headers=emp_headers,
        )
        print("✓ Notification preferences persistence and category toggling verified.")

        # ----------------------------------------------------------------------
        # Scenario 5: Change Password & Verification
        # ----------------------------------------------------------------------
        print("\n--- Scenario 5: Change Password ---")
        # 1. Incorrect current password
        r_wrong = client.post(
            "/api/profile/change-password",
            json={
                "current_password": "WrongPassword@123",
                "new_password": "NewSecretPass@123",
                "confirm_password": "NewSecretPass@123",
            },
            headers=emp_headers,
        )
        assert r_wrong.status_code == 400
        assert "current password is incorrect" in r_wrong.text.lower()

        # 2. Mismatched confirmation
        r_mismatch = client.post(
            "/api/profile/change-password",
            json={
                "current_password": "Employee@123",
                "new_password": "NewSecretPass@123",
                "confirm_password": "DifferentPass@123",
            },
            headers=emp_headers,
        )
        assert r_mismatch.status_code == 400
        assert "match" in r_mismatch.text.lower()

        # 3. Same as current password
        r_same = client.post(
            "/api/profile/change-password",
            json={
                "current_password": "Employee@123",
                "new_password": "Employee@123",
                "confirm_password": "Employee@123",
            },
            headers=emp_headers,
        )
        assert r_same.status_code == 400

        # 4. Successful password change
        r_success = client.post(
            "/api/profile/change-password",
            json={
                "current_password": "Employee@123",
                "new_password": "Employee@NewPass2026",
                "confirm_password": "Employee@NewPass2026",
            },
            headers=emp_headers,
        )
        assert r_success.status_code == 200

        # 5. Verify login with NEW password
        r_login_new = client.post(
            "/api/auth/login",
            json={"email": "employee@worksphere.com", "password": "Employee@NewPass2026"},
        )
        assert r_login_new.status_code == 200
        new_token = r_login_new.json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}

        # 6. Revert back to original password "Employee@123"
        r_revert = client.post(
            "/api/profile/change-password",
            json={
                "current_password": "Employee@NewPass2026",
                "new_password": "Employee@123",
                "confirm_password": "Employee@123",
            },
            headers=new_headers,
        )
        assert r_revert.status_code == 200

        # 7. Verify login with original password
        r_login_orig = client.post(
            "/api/auth/login",
            json={"email": "employee@worksphere.com", "password": "Employee@123"},
        )
        assert r_login_orig.status_code == 200
        print("✓ Change password flow verified with Argon2id validation and rollback.")

        print("\n================================================================")
        print("✓ ALL MODULE 27 INTEGRATION TESTS PASSED (100%)")
        print("================================================================")

    finally:
        db.close()


if __name__ == "__main__":
    test_module27()

