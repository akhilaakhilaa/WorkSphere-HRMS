"""
Comprehensive Integration Test Suite for Module 22: Resignation & Exit Management
WorkSphere HRMS

Tests:
1. Unauthenticated request rejection (401).
2. Resignation submission & input validation (reason length, notice period bounds).
3. Duplicate/repeated submission prevention (cannot submit while pending or approved).
4. Employee data isolation (employees can only view their own resignation requests).
5. Role authorization (regular employees blocked from review with 403, HR/Admin permitted).
6. Self-review prevention (HR/Admin cannot approve or reject their own resignation).
7. Approving and rejecting resignation requests (status, reviewer details, timestamps).
8. Invalid status transitions & duplicate processing prevention (approved/rejected cannot be re-processed).
9. Missing records handling (404 Not Found).
10. Resignation cancellation and deletion rules.
11. Resignation summary metrics calculation.
12. Test cleanup.
"""

from datetime import date, datetime, timedelta
import sys

from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.resignation import Resignation, ResignationStatus
from app.models.user import User

client = TestClient(app)


def test_module22():
    print("================================================================")
    print("TESTING MODULE 22: RESIGNATION & EXIT MANAGEMENT")
    print("================================================================")

    db = SessionLocal()
    cleanup_resignation_ids = []

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

        # Identify employee records
        emp_user = db.query(User).filter(User.email == "employee@worksphere.com").first()
        my_employee = db.query(Employee).filter(Employee.user_id == emp_user.id).first()
        assert my_employee is not None, "Employee profile must exist for employee@worksphere.com"
        emp_id = my_employee.id

        hr_user = db.query(User).filter(User.email == "hr@worksphere.com").first()
        hr_employee = db.query(Employee).filter(Employee.user_id == hr_user.id).first()
        assert hr_employee is not None, "HR employee profile must exist"
        hr_emp_id = hr_employee.id

        admin_user = db.query(User).filter(User.email == "admin@worksphere.com").first()
        admin_employee = db.query(Employee).filter(Employee.user_id == admin_user.id).first()
        assert admin_employee is not None, "Admin employee profile must exist"
        admin_emp_id = admin_employee.id

        # Clean existing test resignations if any exist for these employees
        db.query(Resignation).filter(
            Resignation.employee_id.in_([emp_id, hr_emp_id, admin_emp_id])
        ).delete(synchronize_session=False)
        db.commit()

        print(f"✓ Authenticated: Admin (emp_id={admin_emp_id}), HR (emp_id={hr_emp_id}), Employee (emp_id={emp_id})")

        # ----------------------------------------------------------------------
        # Scenario 1: Unauthenticated Requests (401)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 1: Unauthenticated Requests (401) ---")
        endpoints = [
            ("GET", "/api/resignations"),
            ("POST", "/api/resignations"),
            ("GET", "/api/resignations/my"),
            ("GET", "/api/resignations/summary"),
            ("GET", "/api/resignations/1"),
            ("PATCH", "/api/resignations/1/review"),
            ("PUT", "/api/resignations/1/review"),
            ("DELETE", "/api/resignations/1"),
        ]
        for method, ep in endpoints:
            if method == "GET":
                res = client.get(ep)
            elif method == "POST":
                res = client.post(ep, json={})
            elif method in ("PATCH", "PUT"):
                res = client.patch(ep, json={})
            elif method == "DELETE":
                res = client.delete(ep)
            assert res.status_code == 401, f"Expected 401 for unauthenticated {method} {ep}, got {res.status_code}"

        print("✓ All endpoints strictly reject unauthenticated requests with 401 Unauthorized.")

        # ----------------------------------------------------------------------
        # Scenario 2: Resignation Submission & Input Validation
        # ----------------------------------------------------------------------
        print("\n--- Scenario 2: Resignation Submission & Input Validation ---")

        # 2a. Short reason (< 5 characters)
        res_short = client.post(
            "/api/resignations",
            headers=emp_headers,
            json={"reason": "Bye", "notice_period": 30},
        )
        assert res_short.status_code in (400, 422), f"Expected 400/422 for short reason, got {res_short.status_code}"

        # 2b. Zero or negative notice period
        res_zero = client.post(
            "/api/resignations",
            headers=emp_headers,
            json={"reason": "Relocating to another city for family reasons.", "notice_period": 0},
        )
        assert res_zero.status_code in (400, 422), f"Expected 400/422 for notice_period=0, got {res_zero.status_code}"

        # 2c. Excessive notice period (> 180 days)
        res_excess = client.post(
            "/api/resignations",
            headers=emp_headers,
            json={"reason": "Relocating to another city for family reasons.", "notice_period": 365},
        )
        assert res_excess.status_code in (400, 422), f"Expected 400/422 for notice_period=365, got {res_excess.status_code}"

        # 2d. Successful submission by regular employee
        res_valid = client.post(
            "/api/resignations",
            headers=emp_headers,
            json={
                "reason": "Accepted an offer for higher education and Master's degree studies.",
                "notice_period": 30,
            },
        )
        assert res_valid.status_code == 201, f"Expected 201, got {res_valid.status_code}: {res_valid.text}"
        data1 = res_valid.json()
        res_id_1 = data1["id"]
        cleanup_resignation_ids.append(res_id_1)

        assert data1["employee_id"] == emp_id
        assert data1["status"] == "PENDING"
        assert data1["notice_period"] == 30
        assert data1["last_working_day"] is not None
        # Verify calculated last working day is ~30 days from today
        expected_last_day = (date.today() + timedelta(days=30)).isoformat()
        assert data1["last_working_day"] == expected_last_day

        print(f"✓ Resignation submitted successfully (ID: {res_id_1}, Status: PENDING, Notice: 30 days).")

        # ----------------------------------------------------------------------
        # Scenario 3: Duplicate / Repeated Submission Prevention
        # ----------------------------------------------------------------------
        print("\n--- Scenario 3: Duplicate Submission Prevention ---")
        res_dup = client.post(
            "/api/resignations",
            headers=emp_headers,
            json={
                "reason": "Another resignation attempt while one is already pending.",
                "notice_period": 45,
            },
        )
        assert res_dup.status_code == 400, f"Expected 400 for duplicate pending resignation, got {res_dup.status_code}"
        assert "already have a pending resignation" in res_dup.json()["detail"].lower()
        print("✓ Prevented duplicate resignation submission while an active request is pending (400 Bad Request).")

        # ----------------------------------------------------------------------
        # Scenario 4: Employee Data Isolation
        # ----------------------------------------------------------------------
        print("\n--- Scenario 4: Employee Data Isolation ---")

        # Employee retrieves their own resignation via GET /api/resignations/my
        res_my = client.get("/api/resignations/my", headers=emp_headers)
        assert res_my.status_code == 200
        my_list = res_my.json()
        assert len(my_list) >= 1
        assert any(r["id"] == res_id_1 for r in my_list)

        # Employee retrieves via GET /api/resignations
        res_emp_all = client.get("/api/resignations", headers=emp_headers)
        assert res_emp_all.status_code == 200
        emp_all_items = res_emp_all.json()
        # Verify all items returned belong ONLY to this employee
        for item in emp_all_items:
            assert item["employee_id"] == emp_id, "Employee must not see other employees' resignations"

        # Employee probing specific query for another employee's ID returns 403 Forbidden
        res_probe = client.get(f"/api/resignations?employee_id={hr_emp_id}", headers=emp_headers)
        assert res_probe.status_code == 403, f"Expected 403 when probing other employee, got {res_probe.status_code}"

        # Employee accessing own resignation detail via /api/resignations/{id}
        res_detail_own = client.get(f"/api/resignations/{res_id_1}", headers=emp_headers)
        assert res_detail_own.status_code == 200
        assert res_detail_own.json()["id"] == res_id_1

        print("✓ Employee data isolation strictly enforced: peer probing blocked (403), own records accessible (200).")

        # ----------------------------------------------------------------------
        # Scenario 5: Role Authorization (Review Permissions)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 5: Role Authorization (Review Permissions) ---")

        # Regular employee attempts to approve or reject
        res_emp_review = client.patch(
            f"/api/resignations/{res_id_1}/review",
            headers=emp_headers,
            json={"status": "APPROVED", "reviewer_comments": "Self approve attempt"},
        )
        assert res_emp_review.status_code == 403, f"Expected 403 for employee review, got {res_emp_review.status_code}"

        # HR and Admin can view resignation lists with filters
        res_hr_list = client.get("/api/resignations", headers=hr_headers)
        assert res_hr_list.status_code == 200
        assert any(r["id"] == res_id_1 for r in res_hr_list.json())

        res_admin_list = client.get("/api/resignations?status=PENDING", headers=admin_headers)
        assert res_admin_list.status_code == 200

        print("✓ RBAC verified: Regular employee blocked from reviewing (403); HR & Admin authorized.")

        # ----------------------------------------------------------------------
        # Scenario 6: Self-Review Safeguard
        # ----------------------------------------------------------------------
        print("\n--- Scenario 6: Self-Review Safeguard ---")

        # HR user submits a resignation for themselves
        res_hr_submit = client.post(
            "/api/resignations",
            headers=hr_headers,
            json={
                "reason": "Pursuing an executive opportunity at another multinational firm.",
                "notice_period": 60,
            },
        )
        assert res_hr_submit.status_code == 201
        hr_res_id = res_hr_submit.json()["id"]
        cleanup_resignation_ids.append(hr_res_id)

        # HR attempts to review/approve their own resignation!
        res_self_review = client.patch(
            f"/api/resignations/{hr_res_id}/review",
            headers=hr_headers,
            json={"status": "APPROVED", "reviewer_comments": "Approving myself"},
        )
        assert res_self_review.status_code == 400, f"Expected 400 for self-review, got {res_self_review.status_code}"
        assert "cannot approve or reject your own" in res_self_review.json()["detail"].lower()

        # Admin user reviews and approves HR's resignation (Admin is NOT the employee)
        res_admin_reviews_hr = client.patch(
            f"/api/resignations/{hr_res_id}/review",
            headers=admin_headers,
            json={"status": "APPROVED", "reviewer_comments": "Approved by Admin. Best of luck!"},
        )
        assert res_admin_reviews_hr.status_code == 200
        assert res_admin_reviews_hr.json()["status"] == "APPROVED"
        assert res_admin_reviews_hr.json()["reviewed_by"] == admin_user.id

        print("✓ Self-review safeguard verified: HR cannot approve own resignation (400); Admin approval succeeds.")

        # ----------------------------------------------------------------------
        # Scenario 7: Approving Resignation & Preventing New Submissions
        # ----------------------------------------------------------------------
        print("\n--- Scenario 7: Approving Resignation & Preventing New Submissions ---")

        # HR approves regular employee's resignation (res_id_1)
        res_approve = client.patch(
            f"/api/resignations/{res_id_1}/review",
            headers=hr_headers,
            json={
                "status": "APPROVED",
                "reviewer_comments": "Approved. Please initiate handover with team lead.",
                "last_working_day": expected_last_day,
            },
        )
        assert res_approve.status_code == 200, f"Expected 200, got {res_approve.status_code}: {res_approve.text}"
        data_appr = res_approve.json()
        assert data_appr["status"] == "APPROVED"
        assert data_appr["reviewed_by"] == hr_user.id
        assert data_appr["reviewed_at"] is not None
        assert "handover" in data_appr["reviewer_comments"]

        # Employee with APPROVED resignation attempts to submit another resignation
        res_emp_new = client.post(
            "/api/resignations",
            headers=emp_headers,
            json={"reason": "Attempting second resignation after approval.", "notice_period": 30},
        )
        assert res_emp_new.status_code == 400
        assert "already have an approved resignation" in res_emp_new.json()["detail"].lower()

        print("✓ Resignation successfully approved by HR; employee cannot submit duplicate after approval.")

        # ----------------------------------------------------------------------
        # Scenario 8: Invalid Status Transitions & Duplicate Review Prevention
        # ----------------------------------------------------------------------
        print("\n--- Scenario 8: Invalid Status Transitions & Duplicate Review ---")

        # Attempting to re-approve already approved resignation
        res_reapprove = client.patch(
            f"/api/resignations/{res_id_1}/review",
            headers=admin_headers,
            json={"status": "APPROVED", "reviewer_comments": "Double approval attempt"},
        )
        assert res_reapprove.status_code == 400
        assert "already been approved" in res_reapprove.json()["detail"].lower()

        # Attempting to reject already approved resignation
        res_reject_approved = client.patch(
            f"/api/resignations/{res_id_1}/review",
            headers=admin_headers,
            json={"status": "REJECTED", "reviewer_comments": "Attempt to reject approved"},
        )
        assert res_reject_approved.status_code == 400
        assert "already been approved" in res_reject_approved.json()["detail"].lower()

        # Create a new resignation to test REJECTION flow
        res_sub_2 = client.post(
            "/api/resignations",
            headers=admin_headers,
            json={
                "employee_id": 4,  # Michael Scott
                "reason": "Personal career change and exploration.",
                "notice_period": 45,
            },
        )
        assert res_sub_2.status_code == 201
        res_id_2 = res_sub_2.json()["id"]
        cleanup_resignation_ids.append(res_id_2)

        # HR rejects resignation #2
        res_reject = client.patch(
            f"/api/resignations/{res_id_2}/review",
            headers=hr_headers,
            json={
                "status": "REJECTED",
                "reviewer_comments": "Rejected after retention discussion; counter-offer accepted.",
            },
        )
        assert res_reject.status_code == 200
        assert res_reject.json()["status"] == "REJECTED"

        # Attempting to re-review already rejected resignation
        res_re_review_rejected = client.patch(
            f"/api/resignations/{res_id_2}/review",
            headers=admin_headers,
            json={"status": "APPROVED", "reviewer_comments": "Attempt to approve rejected"},
        )
        assert res_re_review_rejected.status_code == 400
        assert "already been rejected" in res_re_review_rejected.json()["detail"].lower()

        print("✓ Status transitions protected: Already approved/rejected resignations cannot be re-reviewed (400).")

        # ----------------------------------------------------------------------
        # Scenario 9: Missing Records Handling (404)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 9: Missing Records Handling (404) ---")
        assert client.get("/api/resignations/999999", headers=admin_headers).status_code == 404
        assert client.patch("/api/resignations/999999/review", headers=admin_headers, json={"status": "APPROVED"}).status_code == 404
        assert client.delete("/api/resignations/999999", headers=admin_headers).status_code == 404
        print("✓ Missing records consistently return 404 Not Found.")

        # ----------------------------------------------------------------------
        # Scenario 10: Cancellation & Deletion Rules
        # ----------------------------------------------------------------------
        print("\n--- Scenario 10: Cancellation & Deletion Rules ---")

        # Create a pending resignation for employee #5
        res_sub_3 = client.post(
            "/api/resignations",
            headers=admin_headers,
            json={"employee_id": 5, "reason": "Relocation across countries.", "notice_period": 30},
        )
        assert res_sub_3.status_code == 201
        res_id_3 = res_sub_3.json()["id"]

        # Employee #3 cannot delete Employee #5's resignation (403)
        res_del_unauth = client.delete(f"/api/resignations/{res_id_3}", headers=emp_headers)
        assert res_del_unauth.status_code == 403

        # Admin can delete it
        res_del_admin = client.delete(f"/api/resignations/{res_id_3}", headers=admin_headers)
        assert res_del_admin.status_code == 200
        assert client.get(f"/api/resignations/{res_id_3}", headers=admin_headers).status_code == 404

        print("✓ Deletion authorization rules verified: Cross-employee deletion blocked (403), Admin deletion allowed.")

        # ----------------------------------------------------------------------
        # Scenario 11: Summary Metrics
        # ----------------------------------------------------------------------
        print("\n--- Scenario 11: Summary Metrics ---")
        summary_res = client.get("/api/resignations/summary", headers=admin_headers)
        assert summary_res.status_code == 200
        s_data = summary_res.json()
        assert "total_requests" in s_data
        assert "pending" in s_data
        assert "approved" in s_data
        assert "rejected" in s_data
        assert s_data["approved"] >= 2  # res_id_1 and hr_res_id
        assert s_data["rejected"] >= 1  # res_id_2

        # Employee summary only reflects own records
        emp_summary_res = client.get("/api/resignations/summary", headers=emp_headers)
        assert emp_summary_res.status_code == 200
        emp_s_data = emp_summary_res.json()
        assert emp_s_data["total_requests"] == 1
        assert emp_s_data["approved"] == 1

        print(f"✓ Summary metrics verified (Total: {s_data['total_requests']}, Approved: {s_data['approved']}, Rejected: {s_data['rejected']}).")

        print("\n================================================================")
        print("ALL MODULE 22 TESTS COMPLETED SUCCESSFULLY! (100% PASS)")
        print("================================================================")

    finally:
        # Cleanup test records
        if cleanup_resignation_ids:
            db.query(Resignation).filter(Resignation.id.in_(cleanup_resignation_ids)).delete(synchronize_session=False)
            db.commit()
            print("✓ Module 22 test resignations cleaned up successfully.")
        db.close()


if __name__ == "__main__":
    test_module22()

