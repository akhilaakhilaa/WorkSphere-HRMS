"""
Comprehensive Integration Test Suite for Module 20: Employee Search & Filters (Advanced)
WorkSphere HRMS

Tests:
1. Search by employee name.
2. Partial-name search.
3. Search/filter by department.
4. Search/filter by role.
5. Filter by ACTIVE and INACTIVE status.
6. Attendance filtering (PRESENT, LATE, ABSENT).
7. Performance filtering (HIGH, AVERAGE, LOW, specific rating).
8. Combining multiple filters.
9. Empty search results.
10. Invalid filter values (status, role, attendance, performance, sort_by, sort_order).
11. Pagination and total count.
12. Sorting (by supported fields, asc and desc).
13. Unauthorized requests (unauthenticated 401, regular employee 403, HR/Admin 200).
14. Prevention of duplicate employee rows on multi-joins.
15. Employees without attendance records handled gracefully.
16. Employees without performance reviews handled gracefully.
17. Existing employee CRUD endpoints remain operational.
18. Existing authentication and authorization remain operational.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
import sys

from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.performance import PerformanceReview
from app.models.user import User, UserRole

client = TestClient(app)


def test_module20():
    print("================================================================")
    print("TESTING MODULE 20: EMPLOYEE SEARCH & FILTERS (ADVANCED)")
    print("================================================================")

    db = SessionLocal()

    # Track items for cleanup
    cleanup_employee_ids = []
    cleanup_attendance_ids = []
    cleanup_review_ids = []

    try:
        # ----------------------------------------------------------------------
        # Setup: Authenticate users (Admin, HR, Regular Employee)
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
        print("✓ Admin, HR, and Employee authenticated successfully.")

        # ----------------------------------------------------------------------
        # Setup: Create dedicated test employees with attendance and performance
        # ----------------------------------------------------------------------
        today = date.today()

        # Employee A: Active, Quality Assurance, has late attendance, rating 5
        emp_a = Employee(
            full_name="Zeta Alpha Inspector",
            designation="QA Specialist",
            department="Quality Assurance",
            joining_date=date(2025, 1, 15),
            salary=Decimal("72000.00"),
            status=EmployeeStatus.ACTIVE,
        )
        db.add(emp_a)

        # Employee B: Inactive, Research & Innovation, no attendance, no reviews
        emp_b = Employee(
            full_name="Omega Beta Scientist",
            designation="Research Analyst",
            department="Research & Innovation",
            joining_date=date(2025, 3, 20),
            salary=Decimal("85000.00"),
            status=EmployeeStatus.INACTIVE,
        )
        db.add(emp_b)

        # Employee C: Active, Quality Assurance, rating 2 (Low)
        emp_c = Employee(
            full_name="Sigma Gamma Auditor",
            designation="Compliance Auditor",
            department="Quality Assurance",
            joining_date=date(2025, 2, 10),
            salary=Decimal("68000.00"),
            status=EmployeeStatus.ACTIVE,
        )
        db.add(emp_c)
        db.commit()
        db.refresh(emp_a)
        db.refresh(emp_b)
        db.refresh(emp_c)

        cleanup_employee_ids.extend([emp_a.id, emp_b.id, emp_c.id])

        # Attendance for Employee A (Late today)
        att_a = Attendance(
            employee_id=emp_a.id,
            date=today,
            status=AttendanceStatus.PRESENT,
            is_late=True,
            late_minutes=25,
        )
        db.add(att_a)

        # Review 1 for Employee A (Rating 5, Q4)
        admin_user = db.query(User).filter(User.email == "admin@worksphere.com").first()
        rev_a1 = PerformanceReview(
            employee_id=emp_a.id,
            reviewer_id=admin_user.id if admin_user else None,
            review_period="2026-Q4-MOD20",
            rating=5,
            feedback="Exemplary QA performance",
        )
        db.add(rev_a1)

        # Review 2 for Employee A (Rating 4, Q3) - to test duplicate prevention
        rev_a2 = PerformanceReview(
            employee_id=emp_a.id,
            reviewer_id=admin_user.id if admin_user else None,
            review_period="2026-Q3-MOD20",
            rating=4,
            feedback="Great work",
        )
        db.add(rev_a2)

        # Review for Employee C (Rating 2, Low)
        rev_c = PerformanceReview(
            employee_id=emp_c.id,
            reviewer_id=admin_user.id if admin_user else None,
            review_period="2026-Q4-LOW",
            rating=2,
            feedback="Needs improvement",
        )
        db.add(rev_c)

        db.commit()
        db.refresh(att_a)
        db.refresh(rev_a1)
        db.refresh(rev_a2)
        db.refresh(rev_c)

        cleanup_attendance_ids.append(att_a.id)
        cleanup_review_ids.extend([rev_a1.id, rev_a2.id, rev_c.id])

        # ----------------------------------------------------------------------
        # Test 1: Search by employee full name
        # ----------------------------------------------------------------------
        print("\n--- Test 1: Search by employee full name ---")
        res = client.get("/api/employees/search?q=Zeta Alpha Inspector", headers=admin_headers)
        assert res.status_code == 200, f"Full name search failed: {res.text}"
        data = res.json()
        assert data["total"] >= 1, "Should find at least 1 record"
        names = [item["full_name"] for item in data["items"]]
        assert "Zeta Alpha Inspector" in names
        print(f"✓ Found employee by full name (total: {data['total']})")

        # ----------------------------------------------------------------------
        # Test 2: Partial-name search (case-insensitive)
        # ----------------------------------------------------------------------
        print("\n--- Test 2: Partial-name search ---")
        res = client.get("/api/employees/search?q=alpha", headers=admin_headers)
        assert res.status_code == 200, f"Partial search failed: {res.text}"
        data = res.json()
        assert any("Zeta Alpha Inspector" in item["full_name"] for item in data["items"])
        print("✓ Partial-name search correctly matched 'Zeta Alpha Inspector'.")

        # ----------------------------------------------------------------------
        # Test 3: Search/filter by department
        # ----------------------------------------------------------------------
        print("\n--- Test 3: Search/filter by department ---")
        res = client.get("/api/employees/search?department=Quality Assurance", headers=admin_headers)
        assert res.status_code == 200, f"Dept filter failed: {res.text}"
        data = res.json()
        assert data["total"] >= 2, "Should find both QA employees"
        for item in data["items"]:
            assert item["department"] == "Quality Assurance"
        print(f"✓ Department filter matched {data['total']} employees in 'Quality Assurance'.")

        # ----------------------------------------------------------------------
        # Test 4: Search/filter by role
        # ----------------------------------------------------------------------
        print("\n--- Test 4: Search/filter by role ---")
        res = client.get("/api/employees/search?role=ADMIN", headers=admin_headers)
        assert res.status_code == 200, f"Role filter failed: {res.text}"
        data = res.json()
        for item in data["items"]:
            assert item["role"] == "ADMIN"
        print(f"✓ Role filter correctly returned ADMIN employees (count: {data['total']}).")

        # ----------------------------------------------------------------------
        # Test 5: Filter by ACTIVE and INACTIVE status
        # ----------------------------------------------------------------------
        print("\n--- Test 5: Filter by ACTIVE and INACTIVE status ---")
        res_act = client.get("/api/employees/search?status=ACTIVE&department=Quality Assurance", headers=admin_headers)
        assert res_act.status_code == 200
        for item in res_act.json()["items"]:
            assert item["status"] == "ACTIVE"

        res_inact = client.get(
            "/api/employees/search",
            params={"status": "INACTIVE", "department": "Research & Innovation"},
            headers=admin_headers,
        )
        assert res_inact.status_code == 200
        assert res_inact.json()["total"] >= 1
        for item in res_inact.json()["items"]:
            assert item["status"] == "INACTIVE"
        print("✓ Status filtering verified for both ACTIVE and INACTIVE.")

        # ----------------------------------------------------------------------
        # Test 6: Attendance filtering
        # ----------------------------------------------------------------------
        print("\n--- Test 6: Attendance filtering ---")
        res_late = client.get(
            f"/api/employees/search?attendance_status=LATE&attendance_date={today.isoformat()}",
            headers=admin_headers,
        )
        assert res_late.status_code == 200
        data_late = res_late.json()
        late_emp_ids = [item["id"] for item in data_late["items"]]
        assert emp_a.id in late_emp_ids, "Employee A should be matched under LATE attendance"
        print(f"✓ Attendance LATE filter verified (found {data_late['total']} late employees).")

        # ----------------------------------------------------------------------
        # Test 7: Performance filtering
        # ----------------------------------------------------------------------
        print("\n--- Test 7: Performance filtering ---")
        # High rating (>= 4)
        res_high = client.get("/api/employees/search?performance=HIGH&department=Quality Assurance", headers=admin_headers)
        assert res_high.status_code == 200
        high_emp_ids = [item["id"] for item in res_high.json()["items"]]
        assert emp_a.id in high_emp_ids
        assert emp_c.id not in high_emp_ids, "Employee C (rating 2) should NOT be in HIGH performance"

        # Specific rating (5)
        res_5 = client.get("/api/employees/search?performance=5&department=Quality Assurance", headers=admin_headers)
        assert res_5.status_code == 200
        assert emp_a.id in [item["id"] for item in res_5.json()["items"]]

        # Low rating (<= 2)
        res_low = client.get("/api/employees/search?performance=LOW&department=Quality Assurance", headers=admin_headers)
        assert res_low.status_code == 200
        low_emp_ids = [item["id"] for item in res_low.json()["items"]]
        assert emp_c.id in low_emp_ids
        assert emp_a.id not in low_emp_ids, "Employee A (rating 5) should NOT be in LOW performance"
        print("✓ Performance filters HIGH, specific (5), and LOW verified.")

        # ----------------------------------------------------------------------
        # Test 8: Combining multiple filters
        # ----------------------------------------------------------------------
        print("\n--- Test 8: Combining multiple filters ---")
        res_multi = client.get(
            f"/api/employees/search?department=Quality Assurance&status=ACTIVE&attendance_status=LATE&performance=HIGH&attendance_date={today.isoformat()}",
            headers=admin_headers,
        )
        assert res_multi.status_code == 200
        data_multi = res_multi.json()
        assert data_multi["total"] >= 1
        matched_ids = [item["id"] for item in data_multi["items"]]
        assert emp_a.id in matched_ids
        assert emp_b.id not in matched_ids
        assert emp_c.id not in matched_ids
        print("✓ Multi-filter combination successfully returned exact matching record.")

        # ----------------------------------------------------------------------
        # Test 9: Empty search results
        # ----------------------------------------------------------------------
        print("\n--- Test 9: Empty search results ---")
        res_empty = client.get("/api/employees/search?q=XYZ_NonExistent_String_987654", headers=admin_headers)
        assert res_empty.status_code == 200
        data_empty = res_empty.json()
        assert data_empty["total"] == 0
        assert data_empty["items"] == []
        assert data_empty["total_pages"] == 0
        print("✓ Empty search query gracefully returns empty items list and 0 total.")

        # ----------------------------------------------------------------------
        # Test 10: Invalid filter values
        # ----------------------------------------------------------------------
        print("\n--- Test 10: Invalid filter values ---")
        # Invalid status
        r_inv_status = client.get("/api/employees/search?status=UNREGISTERED", headers=admin_headers)
        assert r_inv_status.status_code == 400
        assert "Invalid status" in r_inv_status.json()["detail"]

        # Invalid role
        r_inv_role = client.get("/api/employees/search?role=SUPERUSER", headers=admin_headers)
        assert r_inv_role.status_code == 400
        assert "Invalid role" in r_inv_role.json()["detail"]

        # Invalid attendance status
        r_inv_att = client.get("/api/employees/search?attendance_status=SLEEPING", headers=admin_headers)
        assert r_inv_att.status_code == 400
        assert "Invalid attendance_status" in r_inv_att.json()["detail"]

        # Invalid performance filter
        r_inv_perf = client.get("/api/employees/search?performance=STELLAR", headers=admin_headers)
        assert r_inv_perf.status_code == 400
        assert "Invalid performance filter" in r_inv_perf.json()["detail"]

        # Invalid sort_by field
        r_inv_sort = client.get("/api/employees/search?sort_by=password_hash", headers=admin_headers)
        assert r_inv_sort.status_code == 400
        assert "Invalid sort_by field" in r_inv_sort.json()["detail"]

        # Invalid sort_order
        r_inv_dir = client.get("/api/employees/search?sort_order=sideways", headers=admin_headers)
        assert r_inv_dir.status_code == 400
        assert "Invalid sort_order" in r_inv_dir.json()["detail"]
        print("✓ All 6 invalid filter scenarios rejected with clear 400 Bad Request.")

        # ----------------------------------------------------------------------
        # Test 11: Pagination and total count
        # ----------------------------------------------------------------------
        print("\n--- Test 11: Pagination and total count ---")
        res_p1 = client.get("/api/employees/search?page=1&page_size=2", headers=admin_headers)
        assert res_p1.status_code == 200
        data_p1 = res_p1.json()
        assert len(data_p1["items"]) <= 2
        assert data_p1["page"] == 1
        assert data_p1["page_size"] == 2
        assert data_p1["total"] >= 3
        assert data_p1["total_pages"] >= 2

        res_p2 = client.get("/api/employees/search?page=2&page_size=2", headers=admin_headers)
        assert res_p2.status_code == 200
        data_p2 = res_p2.json()
        assert data_p2["page"] == 2
        p1_ids = {item["id"] for item in data_p1["items"]}
        p2_ids = {item["id"] for item in data_p2["items"]}
        assert not (p1_ids & p2_ids), "Page 1 and Page 2 should not have overlapping items"
        print("✓ Pagination and total count verified.")

        # ----------------------------------------------------------------------
        # Test 12: Sorting
        # ----------------------------------------------------------------------
        print("\n--- Test 12: Sorting ---")
        res_asc = client.get("/api/employees/search?sort_by=full_name&sort_order=asc&page_size=50", headers=admin_headers)
        assert res_asc.status_code == 200
        asc_names = [item["full_name"] for item in res_asc.json()["items"]]
        assert asc_names == sorted(asc_names, key=lambda s: s.lower()), "Names should be in ascending order"

        res_desc = client.get("/api/employees/search?sort_by=full_name&sort_order=desc&page_size=50", headers=admin_headers)
        assert res_desc.status_code == 200
        desc_names = [item["full_name"] for item in res_desc.json()["items"]]
        assert desc_names == sorted(desc_names, key=lambda s: s.lower(), reverse=True), "Names should be in descending order"
        print("✓ Sorting by full_name in ASC and DESC directions verified.")

        # ----------------------------------------------------------------------
        # Test 13: Unauthorized requests (RBAC)
        # ----------------------------------------------------------------------
        print("\n--- Test 13: Unauthorized requests (RBAC) ---")
        # No token -> 401
        res_no_auth = client.get("/api/employees/search")
        assert res_no_auth.status_code == 401

        # Regular employee -> 403 Forbidden
        res_emp_blocked = client.get("/api/employees/search", headers=emp_headers)
        assert res_emp_blocked.status_code == 403, f"Regular employee should be 403, got {res_emp_blocked.status_code}"

        # HR and Admin -> 200 OK
        res_hr_allowed = client.get("/api/employees/search", headers=hr_headers)
        assert res_hr_allowed.status_code == 200
        print("✓ RBAC enforced: 401 unauthenticated, 403 employee forbidden, 200 HR/Admin authorized.")

        # ----------------------------------------------------------------------
        # Test 14: Prevention of duplicate employee rows
        # ----------------------------------------------------------------------
        print("\n--- Test 14: Prevention of duplicate employee rows ---")
        # Employee A has 2 performance reviews. In a search on department=Quality Assurance,
        # Employee A must appear exactly once.
        res_dup = client.get("/api/employees/search?department=Quality Assurance", headers=admin_headers)
        assert res_dup.status_code == 200
        qa_emp_ids = [item["id"] for item in res_dup.json()["items"]]
        assert qa_emp_ids.count(emp_a.id) == 1, "Employee A should appear exactly once, no duplicates!"
        print("✓ Multi-join queries verified: duplicate employee rows successfully prevented.")

        # ----------------------------------------------------------------------
        # Test 15: Employees without attendance records
        # ----------------------------------------------------------------------
        print("\n--- Test 15: Employees without attendance records ---")
        res_no_att = client.get(
            "/api/employees/search",
            params={"department": "Research & Innovation"},
            headers=admin_headers,
        )
        assert res_no_att.status_code == 200
        items_b = [i for i in res_no_att.json()["items"] if i["id"] == emp_b.id]
        assert len(items_b) == 1
        assert items_b[0]["attendance_status"] is None
        assert items_b[0]["is_late"] is False
        print("✓ Employee without attendance record gracefully returns attendance_status=None.")

        # ----------------------------------------------------------------------
        # Test 16: Employees without performance reviews
        # ----------------------------------------------------------------------
        print("\n--- Test 16: Employees without performance reviews ---")
        assert items_b[0]["performance_level"] == "NO_REVIEW"
        assert items_b[0]["performance_rating"] is None
        print("✓ Employee without reviews gracefully returns performance_level='NO_REVIEW'.")

        # ----------------------------------------------------------------------
        # Test 17: Existing employee CRUD endpoints still work
        # ----------------------------------------------------------------------
        print("\n--- Test 17: Existing employee CRUD endpoints still work ---")
        # List all
        r_list = client.get("/api/employees", headers=admin_headers)
        assert r_list.status_code == 200
        assert isinstance(r_list.json(), list)

        # Get by ID
        r_get = client.get(f"/api/employees/{emp_a.id}", headers=admin_headers)
        assert r_get.status_code == 200
        assert r_get.json()["full_name"] == "Zeta Alpha Inspector"

        # Create new employee via POST /api/employees
        r_create = client.post(
            "/api/employees",
            json={
                "full_name": "Temporary CRUD Candidate",
                "designation": "Intern",
                "department": "Engineering",
                "joining_date": date.today().isoformat(),
                "salary": 30000.0,
                "status": "ACTIVE",
            },
            headers=admin_headers,
        )
        assert r_create.status_code == 201
        temp_id = r_create.json()["id"]

        # Update employee via PUT /api/employees/{id}
        r_upd = client.put(
            f"/api/employees/{temp_id}",
            json={"designation": "Associate Engineer"},
            headers=admin_headers,
        )
        assert r_upd.status_code == 200
        assert r_upd.json()["designation"] == "Associate Engineer"

        # Delete employee via DELETE /api/employees/{id}
        r_del = client.delete(f"/api/employees/{temp_id}", headers=admin_headers)
        assert r_del.status_code == 200
        print("✓ Standard employee CRUD endpoints (GET list, GET id, POST, PUT, DELETE) verified operational.")

        # ----------------------------------------------------------------------
        # Test 18: Existing authentication and authorization still work
        # ----------------------------------------------------------------------
        print("\n--- Test 18: Existing auth endpoints still work ---")
        r_me = client.get("/api/auth/me", headers=admin_headers)
        assert r_me.status_code == 200
        assert r_me.json()["email"] == "admin@worksphere.com"
        print("✓ Auth verification (/api/auth/me) operational.")

        print("\n================================================================")
        print("ALL 18 MODULE 20 TESTS COMPLETED SUCCESSFULLY!")
        print("================================================================")

    finally:
        # Cleanup test data
        try:
            if cleanup_review_ids:
                db.query(PerformanceReview).filter(PerformanceReview.id.in_(cleanup_review_ids)).delete(synchronize_session=False)
            if cleanup_attendance_ids:
                db.query(Attendance).filter(Attendance.id.in_(cleanup_attendance_ids)).delete(synchronize_session=False)
            if cleanup_employee_ids:
                db.query(Employee).filter(Employee.id.in_(cleanup_employee_ids)).delete(synchronize_session=False)
            db.commit()
            print("✓ Test cleanup completed successfully.")
        except Exception as e:
            db.rollback()
            print(f"Warning: cleanup error: {e}")
        finally:
            db.close()


if __name__ == "__main__":
    test_module20()
