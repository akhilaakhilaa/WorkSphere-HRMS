"""
Integration Test Suite for Module 23: Internal Announcements System
WorkSphere HRMS

Tests:
1. Unauthenticated request rejection (401).
2. HR/Admin can create announcements (201).
3. Employees cannot create announcements (403).
4. Required-field & length validation (title, message).
5. Authenticated employees can list announcements (200, newest first).
6. Authenticated users can retrieve announcement details (200).
7. Missing announcement returns 404.
8. HR/Admin can update announcements (200).
9. Employees cannot update announcements (403).
10. HR/Admin can delete announcements (200).
11. Employees cannot delete announcements (403).
12. Broadcast notifications dispatched on creation.
13. Database cleanup.
"""

from datetime import datetime
import sys

from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.announcement import Announcement
from app.models.notification import Notification
from app.models.user import User

client = TestClient(app)


def test_module23():
    print("================================================================")
    print("TESTING MODULE 23: INTERNAL ANNOUNCEMENTS SYSTEM")
    print("================================================================")

    db = SessionLocal()
    cleanup_ids = []

    try:
        # ----------------------------------------------------------------------
        # Setup: Authenticate Users
        # ----------------------------------------------------------------------
        print("\n--- Setup: Authenticating Users ---")
        r_admin = client.post(
            "/api/auth/login",
            json={"email": "admin@worksphere.com", "password": "Admin@123"},
        )
        assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
        admin_token = r_admin.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        r_hr = client.post(
            "/api/auth/login",
            json={"email": "hr@worksphere.com", "password": "Hr@123"},
        )
        assert r_hr.status_code == 200, f"HR login failed: {r_hr.text}"
        hr_token = r_hr.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}

        r_emp = client.post(
            "/api/auth/login",
            json={"email": "employee@worksphere.com", "password": "Employee@123"},
        )
        assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
        emp_token = r_emp.json()["access_token"]
        emp_headers = {"Authorization": f"Bearer {emp_token}"}

        print("✓ Authenticated: Admin, HR, and Employee.")

        # ----------------------------------------------------------------------
        # Scenario 1: Unauthenticated Requests (401)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 1: Unauthenticated Requests (401) ---")
        endpoints = [
            ("GET", "/api/announcements"),
            ("POST", "/api/announcements"),
            ("GET", "/api/announcements/1"),
            ("PUT", "/api/announcements/1"),
            ("DELETE", "/api/announcements/1"),
        ]
        for method, ep in endpoints:
            if method == "GET":
                res = client.get(ep)
            elif method == "POST":
                res = client.post(ep, json={})
            elif method == "PUT":
                res = client.put(ep, json={})
            elif method == "DELETE":
                res = client.delete(ep)
            assert res.status_code == 401, f"Expected 401 for unauthenticated {method} {ep}, got {res.status_code}"

        print("✓ All endpoints reject unauthenticated requests with 401 Unauthorized.")

        # ----------------------------------------------------------------------
        # Scenario 2: Employee cannot create announcements (403)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 2: Role Authorization on Creation ---")
        emp_create_res = client.post(
            "/api/announcements",
            headers=emp_headers,
            json={"title": "Unauthorized Notice", "message": "Trying to post as employee."},
        )
        assert emp_create_res.status_code == 403, f"Expected 403 for employee creation, got {emp_create_res.status_code}"
        print("✓ Regular employees blocked from creating announcements (403 Forbidden).")

        # ----------------------------------------------------------------------
        # Scenario 3: Validation checks (Title and message length)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 3: Input Validation ---")
        # Too short title
        res_short_title = client.post(
            "/api/announcements",
            headers=hr_headers,
            json={"title": "Hi", "message": "This is a valid long enough message."},
        )
        assert res_short_title.status_code in (400, 422), f"Expected 400/422 for short title, got {res_short_title.status_code}"

        # Too short message
        res_short_msg = client.post(
            "/api/announcements",
            headers=hr_headers,
            json={"title": "Valid Title Here", "message": "No"},
        )
        assert res_short_msg.status_code in (400, 422), f"Expected 400/422 for short message, got {res_short_msg.status_code}"

        print("✓ Title and message validations enforced (400/422).")

        # ----------------------------------------------------------------------
        # Scenario 4: HR and Admin can create announcements (201)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 4: Successful Creation by HR & Admin ---")
        create_res = client.post(
            "/api/announcements",
            headers=hr_headers,
            json={
                "title": "Annual Company Retreat 2026",
                "message": "We are thrilled to announce our upcoming company-wide retreat scheduled for next month!",
            },
        )
        assert create_res.status_code == 201, f"Expected 201, got {create_res.status_code}: {create_res.text}"
        ann_1 = create_res.json()
        ann_id_1 = ann_1["id"]
        cleanup_ids.append(ann_id_1)
        assert ann_1["title"] == "Annual Company Retreat 2026"
        assert ann_1["creator_role"] == "HR"
        assert ann_1["created_by"] is not None

        # Admin creates second announcement
        create_res_2 = client.post(
            "/api/announcements",
            headers=admin_headers,
            json={
                "title": "Office Maintenance Schedule",
                "message": "Routine server and electrical maintenance this Saturday starting at 10 PM.",
            },
        )
        assert create_res_2.status_code == 201
        ann_id_2 = create_res_2.json()["id"]
        cleanup_ids.append(ann_id_2)

        print(f"✓ HR and Admin created announcements successfully (IDs: {ann_id_1}, {ann_id_2}).")

        # ----------------------------------------------------------------------
        # Scenario 5: Authenticated users can list announcements (Newest First)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 5: Listing Announcements ---")
        list_res = client.get("/api/announcements", headers=emp_headers)
        assert list_res.status_code == 200, f"Expected 200, got {list_res.status_code}"
        items = list_res.json()
        assert len(items) >= 2
        # Check ordering: ann_id_2 should appear before ann_id_1
        ids = [item["id"] for item in items]
        idx2 = ids.index(ann_id_2)
        idx1 = ids.index(ann_id_1)
        assert idx2 < idx1, f"Announcements must be ordered newest first (got {ids})"

        # Check search filtering
        search_res = client.get("/api/announcements?search=Retreat", headers=emp_headers)
        assert search_res.status_code == 200
        search_items = search_res.json()
        assert any(item["id"] == ann_id_1 for item in search_items)
        assert not any(item["id"] == ann_id_2 for item in search_items)

        print("✓ Employees and staff can list announcements with newest-first ordering and keyword search.")

        # ----------------------------------------------------------------------
        # Scenario 6: Retrieve announcement details
        # ----------------------------------------------------------------------
        print("\n--- Scenario 6: Retrieve Details ---")
        detail_res = client.get(f"/api/announcements/{ann_id_1}", headers=emp_headers)
        assert detail_res.status_code == 200
        d_data = detail_res.json()
        assert d_data["id"] == ann_id_1
        assert d_data["title"] == "Annual Company Retreat 2026"
        assert d_data["creator_name"] is not None

        # Missing record returns 404
        assert client.get("/api/announcements/999999", headers=emp_headers).status_code == 404

        print("✓ Announcement details retrieved successfully (and 404 on missing record).")

        # ----------------------------------------------------------------------
        # Scenario 7: Update Announcement (HR/Admin allowed, Employee blocked)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 7: Update Announcements ---")
        # Employee blocked
        emp_update = client.put(
            f"/api/announcements/{ann_id_1}",
            headers=emp_headers,
            json={"title": "Hacked Title", "message": "Attempt by employee"},
        )
        assert emp_update.status_code == 403, f"Expected 403 for employee update, got {emp_update.status_code}"

        # HR updates
        hr_update = client.put(
            f"/api/announcements/{ann_id_1}",
            headers=hr_headers,
            json={"title": "Annual Company Retreat 2026 (Updated Dates)"},
        )
        assert hr_update.status_code == 200
        assert hr_update.json()["title"] == "Annual Company Retreat 2026 (Updated Dates)"

        # Missing announcement update returns 404
        assert client.put("/api/announcements/999999", headers=hr_headers, json={"title": "Valid Title"}).status_code == 404

        print("✓ Update permissions verified: Employee blocked (403), HR allowed (200), missing record 404.")

        # ----------------------------------------------------------------------
        # Scenario 8: Delete Announcement (HR/Admin allowed, Employee blocked)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 8: Delete Announcements ---")
        # Employee blocked
        emp_del = client.delete(f"/api/announcements/{ann_id_2}", headers=emp_headers)
        assert emp_del.status_code == 403

        # Admin deletes
        admin_del = client.delete(f"/api/announcements/{ann_id_2}", headers=admin_headers)
        assert admin_del.status_code == 200

        # Deleted announcement returns 404
        assert client.get(f"/api/announcements/{ann_id_2}", headers=emp_headers).status_code == 404
        assert client.delete("/api/announcements/999999", headers=admin_headers).status_code == 404

        print("✓ Delete permissions verified: Employee blocked (403), Admin deletion succeeded (200).")

        # ----------------------------------------------------------------------
        # Scenario 9: Notification Dispatch Verification
        # ----------------------------------------------------------------------
        print("\n--- Scenario 9: Broadcast Notification Verification ---")
        emp_notifs = client.get("/api/notifications", headers=emp_headers)
        assert emp_notifs.status_code == 200
        notif_list = emp_notifs.json()
        assert any("Company Announcement" in n["title"] for n in notif_list)
        print("✓ Broadcast notification delivered to employee inbox.")

        print("\n================================================================")
        print("ALL MODULE 23 TESTS COMPLETED SUCCESSFULLY! (100% PASS)")
        print("================================================================")

    finally:
        if cleanup_ids:
            db.query(Announcement).filter(Announcement.id.in_(cleanup_ids)).delete(synchronize_session=False)
            db.commit()
            print("✓ Module 23 test announcements cleaned up successfully.")
        db.close()


if __name__ == "__main__":
    test_module23()

