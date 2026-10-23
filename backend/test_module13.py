import sys
from datetime import date
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.user import User, UserRole
from app.utils.security import verify_password

client = TestClient(app)


def test_module13():
    print("==================================================")
    print("TESTING MODULE 13: ADMIN CONTROLS & USER MANAGEMENT")
    print("==================================================")

    # 1. Login to obtain tokens for all roles
    r_admin = client.post("/api/auth/login", json={"email": "admin@worksphere.com", "password": "Admin@123"})
    assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]
    admin_user_id = r_admin.json()["user_id"]

    r_hr = client.post("/api/auth/login", json={"email": "hr@worksphere.com", "password": "Hr@123"})
    assert r_hr.status_code == 200, f"HR login failed: {r_hr.text}"
    hr_token = r_hr.json()["access_token"]

    r_emp = client.post("/api/auth/login", json={"email": "employee@worksphere.com", "password": "Employee@123"})
    assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
    emp_token = r_emp.json()["access_token"]
    emp_user_id = r_emp.json()["user_id"]
    print("  ✓ Authenticated Admin, HR, and Employee test accounts")

    # ---------------------------------------------------------
    # SCENARIO 1: ROLE-BASED ACCESS CONTROL & SECURITY ENFORCEMENT
    # ---------------------------------------------------------
    print("\n[Scenario 1: Role-Based Access Control & Security Enforcement]")
    # 1.1 Unauthenticated request rejected (401)
    r_no_auth = client.get("/api/users")
    assert r_no_auth.status_code == 401
    print("  ✓ GET /api/users rejects unauthenticated access (401 Unauthorized)")

    # 1.2 Employee role blocked (403)
    r_emp_list = client.get("/api/users", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_emp_list.status_code == 403
    print("  ✓ GET /api/users blocks EMPLOYEE role (403 Forbidden)")

    # 1.3 HR role blocked (403)
    r_hr_list = client.get("/api/users", headers={"Authorization": f"Bearer {hr_token}"})
    assert r_hr_list.status_code == 403
    print("  ✓ GET /api/users blocks HR role (403 Forbidden)")

    # 1.4 Employee cannot create user (403)
    r_emp_create = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={"username": "hacker", "email": "hacker@evil.com", "password": "Password123", "role": "ADMIN"},
    )
    assert r_emp_create.status_code == 403
    print("  ✓ POST /api/users blocks EMPLOYEE role from creating accounts (403 Forbidden)")

    # 1.5 Employee cannot alter role or elevate self (403)
    r_emp_elevate = client.patch(
        f"/api/users/{emp_user_id}/role",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={"role": "ADMIN"},
    )
    assert r_emp_elevate.status_code == 403
    print("  ✓ PATCH /api/users/{id}/role blocks unauthorized role change / privilege elevation (403 Forbidden)")

    # ---------------------------------------------------------
    # SCENARIO 2: ADMIN USER LISTING, SEARCH & FILTERING
    # ---------------------------------------------------------
    print("\n[Scenario 2: Admin User Listing, Search & Filtering]")
    r_users = client.get("/api/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_users.status_code == 200
    user_list = r_users.json()
    assert len(user_list) >= 4
    print(f"  ✓ GET /api/users returns {len(user_list)} accounts for Admin")

    # Security check: Password hashes are NEVER returned in API responses!
    for u in user_list:
        assert "password" not in u
        assert "password_hash" not in u
    print("  ✓ Verified: Password hashes are completely absent from API responses")

    # Search filter by username
    r_search = client.get("/api/users?q=admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_search.status_code == 200
    search_res = r_search.json()
    assert any(u["username"] == "admin" for u in search_res)
    print("  ✓ GET /api/users?q=admin searches successfully by username")

    # Filter by role
    r_role_filter = client.get("/api/users?role=HR", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_role_filter.status_code == 200
    hr_users = r_role_filter.json()
    assert all(u["role"] == "HR" for u in hr_users)
    print(f"  ✓ GET /api/users?role=HR filters accurately ({len(hr_users)} HR user)")

    # Filter by is_active
    r_active_filter = client.get("/api/users?is_active=true", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_active_filter.status_code == 200
    assert all(u["is_active"] is True for u in r_active_filter.json())
    print("  ✓ GET /api/users?is_active=true filters active accounts")

    # ---------------------------------------------------------
    # SCENARIO 3: USER CREATION & VALIDATION
    # ---------------------------------------------------------
    print("\n[Scenario 3: User Creation & Validation]")
    test_username = "testmod13user"
    test_email = "testmod13user@worksphere.com"
    test_pass = "SecurePass@2026"

    # Cleanup test user if pre-existing from previous test run
    db = SessionLocal()
    existing_t = db.query(User).filter((User.username == test_username) | (User.email == test_email)).first()
    if existing_t:
        db.delete(existing_t)
        db.commit()
    db.close()

    # 3.1 Admin successfully creates a new user
    r_create = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": test_username,
            "email": test_email,
            "password": test_pass,
            "role": "EMPLOYEE",
            "is_active": True,
        },
    )
    assert r_create.status_code == 201, f"User creation failed: {r_create.text}"
    created_u = r_create.json()
    new_uid = created_u["id"]
    assert created_u["username"] == test_username
    assert created_u["email"] == test_email
    assert created_u["role"] == "EMPLOYEE"
    assert created_u["is_active"] is True
    assert "password" not in created_u
    assert "password_hash" not in created_u
    print(f"  ✓ POST /api/users created user #{new_uid} ('{test_username}')")

    # 3.2 Verify password is encrypted in database, not stored plaintext
    db = SessionLocal()
    db_u = db.query(User).filter(User.id == new_uid).first()
    assert db_u is not None
    assert db_u.password_hash != test_pass
    assert verify_password(test_pass, db_u.password_hash) is True
    db.close()
    print("  ✓ Verified: Password is cryptographically hashed in database, never stored in plaintext")

    # 3.3 Duplicate username rejected (400)
    r_dup_user = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": test_username,
            "email": "different_email@worksphere.com",
            "password": "Password123",
            "role": "EMPLOYEE",
        },
    )
    assert r_dup_user.status_code == 400
    print(f"  ✓ Duplicate username '{test_username}' correctly rejected (400 Bad Request)")

    # 3.4 Duplicate email rejected (400)
    r_dup_email = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "different_username",
            "email": test_email,
            "password": "Password123",
            "role": "EMPLOYEE",
        },
    )
    assert r_dup_email.status_code == 400
    print(f"  ✓ Duplicate email '{test_email}' correctly rejected (400 Bad Request)")

    # 3.5 Invalid role rejected (422)
    r_bad_role = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "badroleuser",
            "email": "badrole@worksphere.com",
            "password": "Password123",
            "role": "SUPER_HERO",
        },
    )
    assert r_bad_role.status_code == 422
    print("  ✓ Invalid role 'SUPER_HERO' correctly rejected (422 Unprocessable Entity)")

    # ---------------------------------------------------------
    # SCENARIO 4: ROLE ASSIGNMENT & ACCOUNT STATUS TOGGLE
    # ---------------------------------------------------------
    print("\n[Scenario 4: Role Assignment & Account Status Toggle]")
    # 4.1 Admin updates user's role to HR
    r_role_change = client.patch(
        f"/api/users/{new_uid}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "HR"},
    )
    assert r_role_change.status_code == 200
    assert r_role_change.json()["role"] == "HR"
    print(f"  ✓ PATCH /api/users/{new_uid}/role promoted role to HR")

    # 4.2 Admin deactivates account
    r_deactivate = client.patch(
        f"/api/users/{new_uid}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False},
    )
    assert r_deactivate.status_code == 200
    assert r_deactivate.json()["is_active"] is False
    print(f"  ✓ PATCH /api/users/{new_uid}/status deactivated user account")

    # 4.3 Disabled account CANNOT obtain a new JWT session (Login rejected with 403)
    r_disabled_login = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": test_pass},
    )
    assert r_disabled_login.status_code == 403
    print("  ✓ POST /api/auth/login blocks inactive user from logging in (403 Forbidden)")

    # 4.4 Admin re-activates account
    r_activate = client.patch(
        f"/api/users/{new_uid}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": True},
    )
    assert r_activate.status_code == 200
    assert r_activate.json()["is_active"] is True
    print(f"  ✓ PATCH /api/users/{new_uid}/status re-activated user account")

    # 4.5 Active user can now login
    r_active_login = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": test_pass},
    )
    assert r_active_login.status_code == 200
    new_user_token = r_active_login.json()["access_token"]
    print("  ✓ Active user successfully authenticated and obtained JWT token")

    # 4.6 Deactivation revokes existing token immediately via get_current_user
    client.patch(
        f"/api/users/{new_uid}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False},
    )
    r_revoked_req = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_user_token}"})
    assert r_revoked_req.status_code == 403
    print("  ✓ Deactivated user immediately blocked on subsequent API calls even with unexpired JWT (403 Forbidden)")

    # Re-activate for further tests
    client.patch(
        f"/api/users/{new_uid}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": True},
    )

    # ---------------------------------------------------------
    # SCENARIO 5: LAST ACTIVE ADMINISTRATOR SAFEGUARD
    # ---------------------------------------------------------
    print("\n[Scenario 5: Last Active Administrator Safeguards]")
    # 5.1 Admin cannot demote themselves if they are the only active admin
    r_demote_self = client.patch(
        f"/api/users/{admin_user_id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "EMPLOYEE"},
    )
    assert r_demote_self.status_code == 400
    assert "only active administrator" in r_demote_self.json()["detail"].lower()
    print("  ✓ PATCH /api/users/{admin_id}/role prevents demoting the last active administrator (400 Bad Request)")

    # 5.2 Admin cannot deactivate themselves if they are the only active admin
    r_deact_self = client.patch(
        f"/api/users/{admin_user_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False},
    )
    assert r_deact_self.status_code == 400
    assert "only active administrator" in r_deact_self.json()["detail"].lower()
    print("  ✓ PATCH /api/users/{admin_id}/status prevents deactivating the last active administrator (400 Bad Request)")

    # 5.3 Admin cannot delete themselves if they are the only active admin
    r_del_self = client.delete(
        f"/api/users/{admin_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_del_self.status_code == 400
    assert "only active administrator" in r_del_self.json()["detail"].lower()
    print("  ✓ DELETE /api/users/{admin_id} prevents deleting the last active administrator (400 Bad Request)")

    # ---------------------------------------------------------
    # SCENARIO 6: PRESERVATION OF HISTORICAL BUSINESS RECORDS
    # ---------------------------------------------------------
    print("\n[Scenario 6: Preservation of Historical Business Records]")
    # User #3 (Alex Mercer) has attendance, leave, and payroll records.
    # Attempting to delete User #3 must be BLOCKED!
    r_del_emp = client.delete(
        f"/api/users/{emp_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_del_emp.status_code == 400
    detail_msg = r_del_emp.json()["detail"].lower()
    assert "attendance" in detail_msg and "payroll" in detail_msg and "deactivate" in detail_msg
    print(f"  ✓ DELETE /api/users/{emp_user_id} prevents deleting user with historical business records (400 Bad Request)")

    # Verify User #3 is still intact in database
    db = SessionLocal()
    check_u3 = db.query(User).filter(User.id == emp_user_id).first()
    assert check_u3 is not None
    assert check_u3.employee is not None
    assert len(check_u3.employee.attendances) > 0
    db.close()
    print("  ✓ Verified: User and employee records and all associated history remain fully intact")

    # ---------------------------------------------------------
    # SCENARIO 7: SAFE USER DELETION FOR ACCOUNTS WITHOUT HISTORY
    # ---------------------------------------------------------
    print("\n[Scenario 7: Safe User Deletion for Accounts Without History]")
    # User new_uid was newly created and has no historical attendance/leave/payroll
    r_del_safe = client.delete(
        f"/api/users/{new_uid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_del_safe.status_code == 200
    print(f"  ✓ DELETE /api/users/{new_uid} safely deletes account with no business records")

    # Verify user is gone
    db = SessionLocal()
    del_check = db.query(User).filter(User.id == new_uid).first()
    assert del_check is None
    db.close()
    print(f"  ✓ Verified: User #{new_uid} safely deleted without affecting other accounts")

    # ---------------------------------------------------------
    # SCENARIO 8: USER DETAILS ENDPOINT
    # ---------------------------------------------------------
    print("\n[Scenario 8: User Details Endpoint]")
    r_detail = client.get(f"/api/users/{emp_user_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_detail.status_code == 200
    d_data = r_detail.json()
    assert d_data["id"] == emp_user_id
    assert d_data["username"] == "employee"
    assert d_data["email"] == "employee@worksphere.com"
    assert d_data["full_name"] == "Alex Mercer"
    assert d_data["attendance_records_count"] > 0
    assert d_data["can_delete"] is False
    print(f"  ✓ GET /api/users/{emp_user_id} returned detailed metadata: {d_data['attendance_records_count']} attendances, can_delete={d_data['can_delete']}")

    print("\n==================================================")
    print("ALL MODULE 13 (ADMIN CONTROLS) TESTS PASSED! (100% PASS)")
    print("==================================================")


if __name__ == "__main__":
    test_module13()
