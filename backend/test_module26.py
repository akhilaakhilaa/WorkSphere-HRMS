"""
Integration Test Suite for Module 26: Employee Feedback System
WorkSphere HRMS
"""

import sys
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.feedback import Feedback
from app.models.user import User

client = TestClient(app)


def test_module26():
    print("================================================================")
    print("TESTING MODULE 26: EMPLOYEE FEEDBACK SYSTEM")
    print("================================================================")

    db = SessionLocal()
    cleanup_feedback_ids = []

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
        unauth_routes = [
            ("GET", "/api/feedback"),
            ("POST", "/api/feedback"),
            ("GET", "/api/feedback/summary"),
            ("GET", "/api/feedback/1"),
        ]
        for meth, route in unauth_routes:
            resp = client.request(meth, route)
            assert resp.status_code == 401, f"Expected 401 for {meth} {route}, got {resp.status_code}"
        print("✓ All unauthenticated requests rejected with HTTP 401.")

        # ----------------------------------------------------------------------
        # Scenario 2: Employee Submits Feedback (201)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 2: Employee Feedback Submission ---")
        fb_payload = {
            "rating": 5,
            "message": "The new collaboration workflows are fantastic! Great culture and support.",
        }
        r_create = client.post("/api/feedback", json=fb_payload, headers=emp_headers)
        assert r_create.status_code == 201, f"Expected 201, got {r_create.status_code}: {r_create.text}"
        created = r_create.json()
        cleanup_feedback_ids.append(created["id"])
        assert created["rating"] == 5
        assert "collaboration workflows" in created["message"]
        assert created["employee_id"] is not None
        my_feedback_id = created["id"]
        print(f"✓ Feedback #{my_feedback_id} submitted successfully.")

        # ----------------------------------------------------------------------
        # Scenario 3: Validation (Rating 1-5, Non-empty message)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 3: Validation Rules ---")
        r_invalid_low = client.post("/api/feedback", json={"rating": 0, "message": "Too low"}, headers=emp_headers)
        assert r_invalid_low.status_code == 422

        r_invalid_high = client.post("/api/feedback", json={"rating": 6, "message": "Too high"}, headers=emp_headers)
        assert r_invalid_high.status_code == 422

        r_empty_msg = client.post("/api/feedback", json={"rating": 4, "message": "   "}, headers=emp_headers)
        assert r_empty_msg.status_code == 422
        print("✓ Rating range (1-5) and message validation strictly enforced.")

        # ----------------------------------------------------------------------
        # Scenario 4: Employee Feedback Isolation
        # ----------------------------------------------------------------------
        print("\n--- Scenario 4: Employee Listing Scoping ---")
        r_list_emp = client.get("/api/feedback", headers=emp_headers)
        assert r_list_emp.status_code == 200
        emp_feedbacks = r_list_emp.json()
        assert len(emp_feedbacks) >= 1
        for item in emp_feedbacks:
            assert item["employee_id"] == created["employee_id"]
        print("✓ Regular employees can only view their own feedback submissions.")

        # ----------------------------------------------------------------------
        # Scenario 5: HR/Admin Metrics Summary & RBAC
        # ----------------------------------------------------------------------
        print("\n--- Scenario 5: HR/Admin Summary & RBAC ---")
        r_emp_summary = client.get("/api/feedback/summary", headers=emp_headers)
        assert r_emp_summary.status_code == 403, f"Expected 403 for employee summary, got {r_emp_summary.status_code}"

        r_admin_summary = client.get("/api/feedback/summary", headers=admin_headers)
        assert r_admin_summary.status_code == 200
        summary_data = r_admin_summary.json()
        assert summary_data["total_feedback"] >= 1
        assert summary_data["average_rating"] >= 1.0
        assert len(summary_data["rating_breakdown"]) == 5
        print(f"✓ Feedback summary: Total={summary_data['total_feedback']}, Avg={summary_data['average_rating']}.")

        # ----------------------------------------------------------------------
        # Scenario 6: Single Feedback Retrieval & Security
        # ----------------------------------------------------------------------
        print("\n--- Scenario 6: Single Feedback Retrieval ---")
        # Employee can retrieve own
        r_get_own = client.get(f"/api/feedback/{my_feedback_id}", headers=emp_headers)
        assert r_get_own.status_code == 200

        # Admin can retrieve any
        r_admin_get = client.get(f"/api/feedback/{my_feedback_id}", headers=admin_headers)
        assert r_admin_get.status_code == 200

        # Non-existent ID returns 404
        r_404 = client.get("/api/feedback/999999", headers=admin_headers)
        assert r_404.status_code == 404
        print("✓ Single feedback access permissions and 404 verified.")

        print("\n================================================================")
        print("✓ ALL MODULE 26 INTEGRATION TESTS PASSED (100%)")
        print("================================================================")

    finally:
        # Cleanup created records
        if cleanup_feedback_ids:
            db.query(Feedback).filter(Feedback.id.in_(cleanup_feedback_ids)).delete(synchronize_session=False)
            db.commit()
        db.close()


if __name__ == "__main__":
    test_module26()

