"""
Integration Test Suite for Module 17: Performance Management System
WorkSphere HRMS
"""

import sys
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.performance import PerformanceReview
from app.models.user import User

client = TestClient(app)


def test_module17():
    print("================================================================")
    print("TESTING MODULE 17: PERFORMANCE MANAGEMENT SYSTEM")
    print("================================================================")

    db = SessionLocal()

    # 1. Authenticate users
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
    emp_user_id = r_emp.json()["user_id"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    emp1 = db.query(Employee).filter(Employee.user_id == emp_user_id).first()
    assert emp1 is not None, "Test employee 1 not found"
    emp1_id = emp1.id

    # Retrieve a second employee
    emp2 = db.query(Employee).filter(Employee.id != emp1_id).first()
    assert emp2 is not None, "Test employee 2 not found"
    emp2_id = emp2.id

    print(f"  ✓ Authenticated Admin, HR, and Employee (emp1_id={emp1_id}, emp2_id={emp2_id})")

    # Clean up any leftover reviews for the test employees/periods
    db.query(PerformanceReview).filter(
        PerformanceReview.employee_id.in_([emp1_id, emp2_id]),
        PerformanceReview.review_period.in_(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]),
    ).delete(synchronize_session=False)
    db.commit()

    created_review_ids = []

    try:
        # -------------------------------------------------------------
        # SCENARIO 1: UNAUTHENTICATED REQUEST REJECTION (401)
        # -------------------------------------------------------------
        print("\n[Scenario 1: Unauthenticated Request Rejection]")

        r = client.get("/api/performance")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ GET /api/performance rejects unauthenticated request (401)")

        r = client.get("/api/performance/summary")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ GET /api/performance/summary rejects unauthenticated request (401)")

        r = client.post(
            "/api/performance",
            json={
                "employee_id": emp1_id,
                "review_period": "2026-Q1",
                "rating": 4,
                "feedback": "Outstanding quarterly delivery.",
            },
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ POST /api/performance rejects unauthenticated request (401)")

        r = client.get("/api/performance/999")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ GET /api/performance/{id} rejects unauthenticated request (401)")

        r = client.put("/api/performance/999", json={"rating": 5})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ PUT /api/performance/{id} rejects unauthenticated request (401)")

        r = client.delete("/api/performance/999")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ DELETE /api/performance/{id} rejects unauthenticated request (401)")

        # -------------------------------------------------------------
        # SCENARIO 2: INPUT VALIDATION CHECKS
        # -------------------------------------------------------------
        print("\n[Scenario 2: Input Validation Checks]")

        # 2.1 Rating below 1
        r = client.post(
            "/api/performance",
            headers=hr_headers,
            json={
                "employee_id": emp1_id,
                "review_period": "2026-Q1",
                "rating": 0,
                "feedback": "Needs significant work across tasks.",
            },
        )
        assert r.status_code == 422, f"Expected 422 for rating < 1, got {r.status_code}"
        print("  ✓ Rating below 1 (0) correctly rejected with 422 Unprocessable Entity")

        # 2.2 Rating above 5
        r = client.post(
            "/api/performance",
            headers=hr_headers,
            json={
                "employee_id": emp1_id,
                "review_period": "2026-Q1",
                "rating": 6,
                "feedback": "Superhuman performance throughout.",
            },
        )
        assert r.status_code == 422, f"Expected 422 for rating > 5, got {r.status_code}"
        print("  ✓ Rating above 5 (6) correctly rejected with 422 Unprocessable Entity")

        # 2.3 Invalid review period format
        invalid_periods = ["2026-Q5", "2026", "2026/Q1", "Q1-2026", "invalid"]
        for p in invalid_periods:
            r = client.post(
                "/api/performance",
                headers=hr_headers,
                json={
                    "employee_id": emp1_id,
                    "review_period": p,
                    "rating": 4,
                    "feedback": "Valid feedback for testing.",
                },
            )
            assert r.status_code == 422, f"Expected 422 for invalid period '{p}', got {r.status_code}"
        print("  ✓ Invalid review period formats ('2026-Q5', '2026', etc.) rejected with 422")

        # 2.4 Too short feedback
        r = client.post(
            "/api/performance",
            headers=hr_headers,
            json={
                "employee_id": emp1_id,
                "review_period": "2026-Q1",
                "rating": 3,
                "feedback": "Good",
            },
        )
        assert r.status_code == 422, f"Expected 422 for feedback < 5 chars, got {r.status_code}"
        print("  ✓ Too short feedback (< 5 chars) rejected with 422 Unprocessable Entity")

        # 2.5 Nonexistent employee ID
        r = client.post(
            "/api/performance",
            headers=hr_headers,
            json={
                "employee_id": 999999,
                "review_period": "2026-Q1",
                "rating": 4,
                "feedback": "Employee does not exist in company roster.",
            },
        )
        assert r.status_code == 404, f"Expected 404 for nonexistent employee, got {r.status_code}"
        print("  ✓ Nonexistent employee ID (999999) rejected with 404 Not Found")

        # -------------------------------------------------------------
        # SCENARIO 3: ROLE-BASED ACCESS CONTROL (EMPLOYEE RESTRICTIONS)
        # -------------------------------------------------------------
        print("\n[Scenario 3: Role-Based Access Control (Employee Restrictions)]")

        # 3.1 Regular employee cannot create reviews
        r = client.post(
            "/api/performance",
            headers=emp_headers,
            json={
                "employee_id": emp1_id,
                "review_period": "2026-Q1",
                "rating": 5,
                "feedback": "Self evaluation attempt by employee.",
            },
        )
        assert r.status_code == 403, f"Expected 403 for employee creating review, got {r.status_code}"
        print("  ✓ Employee forbidden from creating performance reviews (403 Forbidden)")

        # -------------------------------------------------------------
        # SCENARIO 4: HR REVIEW CREATION & DUPLICATE POLICY
        # -------------------------------------------------------------
        print("\n[Scenario 4: HR Review Creation & Duplicate Policy]")

        # 4.1 HR creates review for emp1 (2026-Q1)
        r = client.post(
            "/api/performance",
            headers=hr_headers,
            json={
                "employee_id": emp1_id,
                "review_period": "2026-Q1",
                "rating": 4,
                "feedback": "Consistently exceeded engineering targets in Q1. Strong collaboration.",
                "goals": "Lead the Module 18 architectural design in Q2.",
            },
        )
        assert r.status_code == 201, f"HR create review failed: {r.text}"
        rev1 = r.json()
        rev1_id = rev1["id"]
        created_review_ids.append(rev1_id)
        assert rev1["employee_id"] == emp1_id
        assert rev1["review_period"] == "2026-Q1"
        assert rev1["rating"] == 4
        assert rev1["rating_label"] == "Exceeds Expectations"
        assert rev1["employee_name"] == emp1.full_name
        print(f"  ✓ HR successfully created review #{rev1_id} for Employee #{emp1_id} (Rating: 4 — Exceeds Expectations)")

        # 4.2 Duplicate review prevention: same employee and same period
        r_dup = client.post(
            "/api/performance",
            headers=hr_headers,
            json={
                "employee_id": emp1_id,
                "review_period": "2026-Q1",
                "rating": 5,
                "feedback": "Attempting to create second review for same period.",
            },
        )
        assert r_dup.status_code == 400, f"Expected 400 on duplicate review, got {r_dup.status_code}: {r_dup.text}"
        assert "already exists" in r_dup.json()["detail"].lower()
        print("  ✓ Duplicate review for same employee and period safely rejected (400 Bad Request)")

        # 4.3 HR creates review for emp1 in different period (2026-Q2)
        r = client.post(
            "/api/performance",
            headers=hr_headers,
            json={
                "employee_id": emp1_id,
                "review_period": "2026-Q2",
                "rating": 5,
                "feedback": "Exceptional leadership during cloud infrastructure migration.",
                "goals": "Mentor junior backend developers.",
            },
        )
        assert r.status_code == 201, f"Failed to create Q2 review: {r.text}"
        rev2_id = r.json()["id"]
        created_review_ids.append(rev2_id)
        print(f"  ✓ HR successfully created review #{rev2_id} for Employee #{emp1_id} in period '2026-Q2' (Rating: 5 — Exceptional)")

        # 4.4 Admin creates review for emp2 (2026-Q1)
        r = client.post(
            "/api/performance",
            headers=admin_headers,
            json={
                "employee_id": emp2_id,
                "review_period": "2026-Q1",
                "rating": 3,
                "feedback": "Meets operational expectations; steady attendance and code review turnaround.",
                "goals": "Improve unit test coverage on frontend components.",
            },
        )
        assert r.status_code == 201, f"Admin create review failed: {r.text}"
        rev3_id = r.json()["id"]
        created_review_ids.append(rev3_id)
        print(f"  ✓ Admin successfully created review #{rev3_id} for Employee #{emp2_id} (Rating: 3 — Meets Expectations)")

        # -------------------------------------------------------------
        # SCENARIO 5: CROSS-EMPLOYEE ISOLATION & VISIBILITY
        # -------------------------------------------------------------
        print("\n[Scenario 5: Cross-Employee Isolation & Visibility]")

        # 5.1 Employee 1 lists reviews: must see only their own
        r = client.get("/api/performance", headers=emp_headers)
        assert r.status_code == 200
        emp_reviews = r.json()
        assert len(emp_reviews) >= 2
        for r_item in emp_reviews:
            assert r_item["employee_id"] == emp1_id, "Employee leaked another employee's review!"
        print(f"  ✓ GET /api/performance isolates employee view: Employee #{emp1_id} sees only own reviews ({len(emp_reviews)} items)")

        # 5.2 Employee 1 tries to filter for Employee 2: blocked with 403
        r = client.get(f"/api/performance?employee_id={emp2_id}", headers=emp_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print(f"  ✓ GET /api/performance?employee_id={emp2_id} blocked for EMPLOYEE (403 Forbidden)")

        # 5.3 Employee 1 can retrieve their own review by ID
        r = client.get(f"/api/performance/{rev1_id}", headers=emp_headers)
        assert r.status_code == 200
        assert r.json()["id"] == rev1_id
        print(f"  ✓ Employee successfully accessed own review #{rev1_id}")

        # 5.4 Employee 1 attempts to retrieve Employee 2's review by ID: blocked with 403
        r = client.get(f"/api/performance/{rev3_id}", headers=emp_headers)
        assert r.status_code == 403, f"Expected 403 accessing other's review, got {r.status_code}"
        print(f"  ✓ GET /api/performance/{rev3_id} (Employee 2's review) blocked for EMPLOYEE (403 Forbidden)")

        # 5.5 Employee 1 retrieves own history via employee endpoint
        r = client.get(f"/api/performance/employee/{emp1_id}", headers=emp_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 2
        print(f"  ✓ GET /api/performance/employee/{emp1_id} returns own history")

        # 5.6 Employee 1 attempts to retrieve Employee 2's history: blocked with 403
        r = client.get(f"/api/performance/employee/{emp2_id}", headers=emp_headers)
        assert r.status_code == 403, f"Expected 403 accessing other's history, got {r.status_code}"
        print(f"  ✓ GET /api/performance/employee/{emp2_id} blocked for EMPLOYEE (403 Forbidden)")

        # -------------------------------------------------------------
        # SCENARIO 6: FILTERS, SEARCH & SUMMARY
        # -------------------------------------------------------------
        print("\n[Scenario 6: Filters, Search & Summary]")

        # 6.1 HR lists reviews filtered by period
        r = client.get("/api/performance?review_period=2026-Q1", headers=hr_headers)
        assert r.status_code == 200
        for item in r.json():
            assert item["review_period"] == "2026-Q1"
        print("  ✓ HR filtered reviews by review_period='2026-Q1'")

        # 6.2 HR lists reviews filtered by rating
        r = client.get("/api/performance?rating=5", headers=hr_headers)
        assert r.status_code == 200
        for item in r.json():
            assert item["rating"] == 5
        print("  ✓ HR filtered reviews by rating=5")

        # 6.3 HR searches reviews by text
        r = client.get("/api/performance?search=infrastructure", headers=hr_headers)
        assert r.status_code == 200
        assert any("infrastructure" in (item["feedback"] or "").lower() for item in r.json())
        print("  ✓ HR searched reviews matching 'infrastructure'")

        # 6.4 Summary endpoint
        r = client.get("/api/performance/summary", headers=hr_headers)
        assert r.status_code == 200
        summary = r.json()
        assert summary["total_reviews"] >= 3
        assert summary["average_rating"] > 0
        assert summary["employees_reviewed"] >= 2
        assert "4" in summary["rating_distribution"]
        print(f"  ✓ Performance summary: Total: {summary['total_reviews']}, Avg Rating: {summary['average_rating']}, Employees: {summary['employees_reviewed']}")

        # -------------------------------------------------------------
        # SCENARIO 7: REVIEW UPDATES & UNAUTHORIZED MODIFICATIONS
        # -------------------------------------------------------------
        print("\n[Scenario 7: Review Updates & Unauthorized Modifications]")

        # 7.1 Regular employee cannot update reviews
        r = client.put(f"/api/performance/{rev1_id}", headers=emp_headers, json={"rating": 5})
        assert r.status_code == 403, f"Expected 403 for employee updating review, got {r.status_code}"
        print("  ✓ PUT /api/performance/{id} blocked for EMPLOYEE (403 Forbidden)")

        # 7.2 HR updates review #rev1_id
        r = client.put(
            f"/api/performance/{rev1_id}",
            headers=hr_headers,
            json={
                "rating": 5,
                "feedback": "Updated: Upgraded to Exceptional after final KPI audit.",
                "goals": "Achieve principal engineer benchmarks.",
            },
        )
        assert r.status_code == 200
        updated_rev = r.json()
        assert updated_rev["rating"] == 5
        assert updated_rev["rating_label"] == "Exceptional"
        assert "Upgraded to Exceptional" in updated_rev["feedback"]
        print(f"  ✓ HR successfully updated review #{rev1_id} (Rating changed to 5)")

        # 7.3 Attempting to change period to an existing period collisions
        # rev1 is 2026-Q1, rev2 is 2026-Q2. Changing rev1 to 2026-Q2 should collide.
        r_col = client.put(
            f"/api/performance/{rev1_id}",
            headers=hr_headers,
            json={"review_period": "2026-Q2"},
        )
        assert r_col.status_code == 400, f"Expected 400 on period collision, got {r_col.status_code}"
        print("  ✓ Changing period to collide with existing review period rejected (400 Bad Request)")

        # -------------------------------------------------------------
        # SCENARIO 8: REVIEW DELETION & UNAUTHORIZED DELETION
        # -------------------------------------------------------------
        print("\n[Scenario 8: Review Deletion & Unauthorized Deletion]")

        # 8.1 Regular employee cannot delete reviews
        r = client.delete(f"/api/performance/{rev1_id}", headers=emp_headers)
        assert r.status_code == 403, f"Expected 403 for employee deleting review, got {r.status_code}"
        print("  ✓ DELETE /api/performance/{id} blocked for EMPLOYEE (403 Forbidden)")

        # 8.2 Admin deletes review #rev3_id
        r = client.delete(f"/api/performance/{rev3_id}", headers=admin_headers)
        assert r.status_code == 200
        created_review_ids.remove(rev3_id)
        print(f"  ✓ Admin deleted review #{rev3_id} successfully")

        # 8.3 Verify deleted review returns 404
        r = client.get(f"/api/performance/{rev3_id}", headers=admin_headers)
        assert r.status_code == 404
        print(f"  ✓ Deleted review #{rev3_id} returns 404 Not Found")

    finally:
        # Cleanup created reviews
        print("\n[Cleanup]")
        for rev_id in created_review_ids:
            rev = db.query(PerformanceReview).filter(PerformanceReview.id == rev_id).first()
            if rev:
                db.delete(rev)
        db.commit()
        db.close()
        print("  ✓ Cleaned up all Module 17 test reviews.")

    print("\n================================================================")
    print("ALL MODULE 17 TESTS PASSED SUCCESSFULLY! (100%)")
    print("================================================================")


if __name__ == "__main__":
    test_module17()
