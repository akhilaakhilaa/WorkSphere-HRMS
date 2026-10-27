"""
Integration Test Suite for Module 15: Leave Calendar, Team Availability & Conflict Detection
WorkSphere HRMS
"""

import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import Leave, LeaveBalance, LeavePolicy, LeaveStatus, LeaveType
from app.models.user import User, UserRole

client = TestClient(app)


def test_module15():
    print("================================================================")
    print("TESTING MODULE 15: LEAVE CALENDAR & TEAM VIEW")
    print("================================================================")

    db = SessionLocal()

    # 1. Authenticate users
    r_admin = client.post("/api/auth/login", json={"email": "admin@worksphere.com", "password": "Admin@123"})
    assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    r_hr = client.post("/api/auth/login", json={"email": "hr@worksphere.com", "password": "Hr@123"})
    assert r_hr.status_code == 200, f"HR login failed: {r_hr.text}"
    hr_token = r_hr.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    r_emp = client.post("/api/auth/login", json={"email": "employee@worksphere.com", "password": "Employee@123"})
    assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
    emp_token = r_emp.json()["access_token"]
    emp_user_id = r_emp.json()["user_id"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    test_emp = db.query(Employee).filter(Employee.user_id == emp_user_id).first()
    assert test_emp is not None, "Test employee record not found"
    test_emp_id = test_emp.id

    # Retrieve another employee in the same department (or create/identify another)
    dept_colleagues = (
        db.query(Employee)
        .filter(Employee.department == test_emp.department, Employee.id != test_emp_id, Employee.status == EmployeeStatus.ACTIVE)
        .all()
    )
    if dept_colleagues:
        colleague_emp = dept_colleagues[0]
    else:
        # Pick any other active employee
        colleague_emp = db.query(Employee).filter(Employee.id != test_emp_id, Employee.status == EmployeeStatus.ACTIVE).first()
    
    assert colleague_emp is not None, "Need a colleague employee for conflict and multi-user tests"
    colleague_id = colleague_emp.id

    print("  ✓ Authenticated Admin, HR, and Employee test accounts")

    created_leave_ids = []

    try:
        # -------------------------------------------------------------
        # SCENARIO 1: ROLE-BASED ACCESS CONTROL & PRIVACY PROTECTION
        # -------------------------------------------------------------
        print("\n[Scenario 1: Role-Based Access Control & Privacy Protection]")

        # 1.1 Unauthenticated requests are rejected (401)
        r = client.get("/api/leaves/calendar")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ GET /api/leaves/calendar rejects unauthenticated access (401 Unauthorized)")

        r = client.get("/api/leaves/team-availability")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ GET /api/leaves/team-availability rejects unauthenticated access (401 Unauthorized)")

        r = client.get("/api/leaves/conflicts")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ GET /api/leaves/conflicts rejects unauthenticated access (401 Unauthorized)")

        # 1.2 Regular employee cannot access conflict detection (403 Forbidden)
        r = client.get("/api/leaves/conflicts", headers=emp_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print("  ✓ GET /api/leaves/conflicts blocks EMPLOYEE role (403 Forbidden)")

        # 1.3 HR and Admin can access conflict detection (200 OK)
        r_hr_conflicts = client.get("/api/leaves/conflicts", headers=hr_headers)
        assert r_hr_conflicts.status_code == 200
        print("  ✓ GET /api/leaves/conflicts accessible to HR (200 OK)")

        r_admin_conflicts = client.get("/api/leaves/conflicts", headers=admin_headers)
        assert r_admin_conflicts.status_code == 200
        print("  ✓ GET /api/leaves/conflicts accessible to ADMIN (200 OK)")

        # 1.4 Regular employee can access calendar and team availability (200 OK)
        r_emp_cal = client.get("/api/leaves/calendar", headers=emp_headers)
        assert r_emp_cal.status_code == 200
        print("  ✓ GET /api/leaves/calendar accessible to EMPLOYEE (200 OK)")

        r_emp_avail = client.get("/api/leaves/team-availability", headers=emp_headers)
        assert r_emp_avail.status_code == 200
        print("  ✓ GET /api/leaves/team-availability accessible to EMPLOYEE (200 OK)")

        # -------------------------------------------------------------
        # SCENARIO 2: CALENDAR QUERYING, DATES & MULTI-DAY LEAVES
        # -------------------------------------------------------------
        print("\n[Scenario 2: Calendar Querying, Date Ranges & Multi-day Leaves]")

        # 2.1 Validation: end_date earlier than start_date rejected
        r_invalid_dates = client.get(
            "/api/leaves/calendar?start_date=2026-11-20&end_date=2026-11-10",
            headers=admin_headers,
        )
        assert r_invalid_dates.status_code == 400, f"Expected 400, got {r_invalid_dates.status_code}"
        assert "earlier" in r_invalid_dates.text.lower()
        print("  ✓ Inverted date range (end_date < start_date) rejected with 400 Bad Request")

        # 2.2 Seed test leaves for controlled testing
        base_date = date(2026, 11, 10)
        # Leave 1: Multi-day Approved Leave for test_emp (Nov 10 to Nov 13, 4 days)
        l1 = Leave(
            employee_id=test_emp_id,
            leave_type=LeaveType.ANNUAL,
            start_date=base_date,
            end_date=base_date + timedelta(days=3),
            total_days=4,
            reason="Private family vacation in the mountains",
            status=LeaveStatus.APPROVED,
        )
        db.add(l1)

        # Leave 2: Pending Leave for colleague_emp overlapping (Nov 12 to Nov 15, 4 days)
        l2 = Leave(
            employee_id=colleague_id,
            leave_type=LeaveType.CASUAL,
            start_date=base_date + timedelta(days=2),
            end_date=base_date + timedelta(days=5),
            total_days=4,
            reason="Attending personal workshop and conference",
            status=LeaveStatus.PENDING,
        )
        db.add(l2)

        # Leave 3: Rejected Leave for test_emp (Nov 16 to Nov 18) - MUST be excluded from confirmed
        l3 = Leave(
            employee_id=test_emp_id,
            leave_type=LeaveType.SICK,
            start_date=base_date + timedelta(days=6),
            end_date=base_date + timedelta(days=8),
            total_days=3,
            reason="Unapproved leave request",
            status=LeaveStatus.REJECTED,
        )
        db.add(l3)

        # Leave 4: Cancelled Leave for colleague_emp (Nov 20 to Nov 22) - MUST be excluded from confirmed
        l4 = Leave(
            employee_id=colleague_id,
            leave_type=LeaveType.UNPAID,
            start_date=base_date + timedelta(days=10),
            end_date=base_date + timedelta(days=12),
            total_days=3,
            reason="Cancelled leave request",
            status=LeaveStatus.CANCELLED,
        )
        db.add(l4)

        db.commit()
        db.refresh(l1)
        db.refresh(l2)
        db.refresh(l3)
        db.refresh(l4)
        created_leave_ids.extend([l1.id, l2.id, l3.id, l4.id])

        # 2.3 Query calendar for November 2026
        r_cal = client.get(
            "/api/leaves/calendar?start_date=2026-11-01&end_date=2026-11-30&include_pending=true",
            headers=admin_headers,
        )
        assert r_cal.status_code == 200
        cal_items = r_cal.json()
        cal_ids = [item["id"] for item in cal_items]

        # Verify Approved leave appears and is confirmed
        item_l1 = next((item for item in cal_items if item["id"] == l1.id), None)
        assert item_l1 is not None, "Approved multi-day leave should appear on calendar"
        assert item_l1["is_confirmed"] is True
        assert item_l1["status"] == "APPROVED"
        assert item_l1["total_days"] == 4
        assert item_l1["start_date"] == "2026-11-10"
        assert item_l1["end_date"] == "2026-11-13"
        print("  ✓ Approved multi-day leave appears on calendar with is_confirmed=True and total_days=4")

        # Verify Pending leave appears when include_pending=true, clearly flagged as unconfirmed
        item_l2 = next((item for item in cal_items if item["id"] == l2.id), None)
        assert item_l2 is not None, "Pending leave should appear when include_pending=True"
        assert item_l2["is_confirmed"] is False
        assert item_l2["status"] == "PENDING"
        print("  ✓ Pending leave appears when requested, clearly flagged with is_confirmed=False")

        # Verify Rejected and Cancelled leaves are excluded
        assert l3.id not in cal_ids, "REJECTED leaves must be strictly excluded from calendar"
        assert l4.id not in cal_ids, "CANCELLED leaves must be strictly excluded from calendar"
        print("  ✓ REJECTED and CANCELLED leaves are strictly excluded from the calendar")

        # 2.4 Verify include_pending=false excludes pending leaves
        r_cal_no_pending = client.get(
            "/api/leaves/calendar?start_date=2026-11-01&end_date=2026-11-30&include_pending=false",
            headers=admin_headers,
        )
        assert r_cal_no_pending.status_code == 200
        no_pending_ids = [item["id"] for item in r_cal_no_pending.json()]
        assert l1.id in no_pending_ids
        assert l2.id not in no_pending_ids, "Pending leave should be excluded when include_pending=False"
        print("  ✓ include_pending=False filters out pending requests, returning only confirmed leaves")

        # 2.5 Privacy Protection: Test employee inspecting calendar cannot see colleague's reason
        r_emp_cal_items = client.get(
            "/api/leaves/calendar?start_date=2026-11-01&end_date=2026-11-30&include_pending=true",
            headers=emp_headers,
        ).json()
        emp_cal_l1 = next((item for item in r_emp_cal_items if item["id"] == l1.id), None)
        emp_cal_l2 = next((item for item in r_emp_cal_items if item["id"] == l2.id), None)

        assert emp_cal_l1 is not None and emp_cal_l1["reason"] is not None, "Employee should see their own reason"
        assert emp_cal_l2 is not None and emp_cal_l2["reason"] is None, "Colleague's private reason must be masked"
        print("  ✓ Privacy rule enforced: Employee sees own leave reason; colleague's reason is safely masked")

        # -------------------------------------------------------------
        # SCENARIO 3: DEPARTMENT & EMPLOYEE FILTERING
        # -------------------------------------------------------------
        print("\n[Scenario 3: Department & Employee Filtering]")

        # 3.1 Filter by employee_id
        r_filter_emp = client.get(
            f"/api/leaves/calendar?start_date=2026-11-01&end_date=2026-11-30&employee_id={test_emp_id}",
            headers=admin_headers,
        )
        assert r_filter_emp.status_code == 200
        emp_filtered = r_filter_emp.json()
        assert all(item["employee_id"] == test_emp_id for item in emp_filtered)
        assert any(item["id"] == l1.id for item in emp_filtered)
        print(f"  ✓ Calendar filtered accurately by employee_id={test_emp_id}")

        # 3.2 Filter by department
        r_filter_dept = client.get(
            f"/api/leaves/calendar?start_date=2026-11-01&end_date=2026-11-30&department={test_emp.department}",
            headers=admin_headers,
        )
        assert r_filter_dept.status_code == 200
        dept_filtered = r_filter_dept.json()
        assert all(item["department"] == test_emp.department for item in dept_filtered)
        print(f"  ✓ Calendar filtered accurately by department='{test_emp.department}'")

        # -------------------------------------------------------------
        # SCENARIO 4: TEAM AVAILABILITY & DE-DUPLICATION
        # -------------------------------------------------------------
        print("\n[Scenario 4: Team Availability Dashboard & De-duplication]")

        # 4.1 Create an overlapping approved leave for the SAME employee on Nov 11 to test de-duplication
        l1_dup = Leave(
            employee_id=test_emp_id,
            leave_type=LeaveType.CASUAL,
            start_date=base_date + timedelta(days=1),  # Nov 11
            end_date=base_date + timedelta(days=1),    # Nov 11
            total_days=1,
            reason="Additional half-day overlapping record for testing de-duplication",
            status=LeaveStatus.APPROVED,
        )
        db.add(l1_dup)
        db.commit()
        db.refresh(l1_dup)
        created_leave_ids.append(l1_dup.id)

        # 4.2 Query team availability on Nov 11 (when test_emp has TWO overlapping approved leaves)
        r_avail = client.get("/api/leaves/team-availability?target_date=2026-11-11", headers=admin_headers)
        assert r_avail.status_code == 200
        avail_data = r_avail.json()

        total_active = avail_data["total_active_employees"]
        on_leave_today = avail_data["employees_on_leave_today_count"]
        not_on_leave_today = avail_data["employees_not_on_leave_today_count"]

        # Math integrity
        assert total_active == on_leave_today + not_on_leave_today, "Total active must equal on-leave + not-on-leave"
        print(f"  ✓ Mathematical integrity: Total Active ({total_active}) = On Leave ({on_leave_today}) + Not on Leave ({not_on_leave_today})")

        # De-duplication check: test_emp must be listed ONCE in on_leave_today roster
        on_leave_emp_ids = [e["employee_id"] for e in avail_data["on_leave_today"]]
        test_emp_occurrences = on_leave_emp_ids.count(test_emp_id)
        assert test_emp_occurrences == 1, f"Employee should only be counted ONCE, found {test_emp_occurrences} times"
        print("  ✓ De-duplication verified: Multiple overlapping approved leaves for same employee count as 1 employee on leave")

        # Check Department Summaries
        dept_summaries = avail_data["department_summaries"]
        assert len(dept_summaries) > 0
        test_dept_sum = next((d for d in dept_summaries if d["department"] == test_emp.department), None)
        assert test_dept_sum is not None
        assert test_dept_sum["employees_on_leave_today"] >= 1
        assert 0.0 <= test_dept_sum["coverage_rate_percentage"] <= 100.0
        print(f"  ✓ Department summaries accurately computed: '{test_emp.department}' coverage {test_dept_sum['coverage_rate_percentage']}%")

        # 4.3 Verify upcoming leaves list
        upcoming = avail_data["upcoming_leaves"]
        assert isinstance(upcoming, list)
        print(f"  ✓ Upcoming leaves returned ({len(upcoming)} upcoming entries)")

        # -------------------------------------------------------------
        # SCENARIO 5: LEAVE CONFLICT DETECTION (MODULE 15C)
        # -------------------------------------------------------------
        print("\n[Scenario 5: Leave Conflict Detection & Team Coverage Bottlenecks]")

        # In our seeded test data:
        # - l1 (test_emp, Engineering) is APPROVED from Nov 10 to Nov 13.
        # - l2 (colleague_emp, Engineering) is PENDING from Nov 12 to Nov 15.
        # Overlap occurs on Nov 12 and Nov 13 (2 days, 2 employees in same department).
        # One is APPROVED and one is PENDING -> conflict_type: PENDING_OVERLAPPING_APPROVED.

        # Ensure colleague is in the same department for conflict detection
        if colleague_emp.department != test_emp.department:
            colleague_emp.department = test_emp.department
            db.commit()

        r_conflicts = client.get(
            f"/api/leaves/conflicts?department={test_emp.department}&start_date=2026-11-01&end_date=2026-11-30&min_overlap=2",
            headers=admin_headers,
        )
        assert r_conflicts.status_code == 200, f"Conflicts query failed: {r_conflicts.text}"
        conflicts = r_conflicts.json()
        assert len(conflicts) > 0, "Overlapping leaves in same department should trigger a conflict"

        conf = conflicts[0]
        assert conf["department"] == test_emp.department
        assert conf["conflict_type"] == "PENDING_OVERLAPPING_APPROVED"
        assert conf["employee_count"] >= 2
        assert conf["total_days_overlap"] >= 1
        assert conf["severity"] in ("HIGH", "MEDIUM", "LOW")
        assert "overlapping" in conf["message"].lower()
        assert "review" in conf["recommendation"].lower()
        print(f"  ✓ Detected conflict: {conf['conflict_type']} (Severity: {conf['severity']}, Overlap: {conf['total_days_overlap']}d)")
        print(f"    Message: '{conf['message']}'")
        print(f"    Recommendation: '{conf['recommendation']}'")

        # 5.2 Conflict detection with higher threshold min_overlap=5
        r_conf_high = client.get(
            f"/api/leaves/conflicts?department={test_emp.department}&start_date=2026-11-01&end_date=2026-11-30&min_overlap=10",
            headers=admin_headers,
        )
        assert r_conf_high.status_code == 200
        # Should be empty since only 2 staff overlap
        assert len(r_conf_high.json()) == 0
        print("  ✓ min_overlap threshold parameter functions correctly (min_overlap=10 returned 0 conflicts)")

        # 5.3 Validation: end_date earlier than start_date in conflicts
        r_conf_invalid = client.get(
            "/api/leaves/conflicts?start_date=2026-11-20&end_date=2026-11-10",
            headers=admin_headers,
        )
        assert r_conf_invalid.status_code == 400
        print("  ✓ Invalid date range on /api/leaves/conflicts rejected with 400 Bad Request")

        print("\n================================================================")
        print("ALL MODULE 15 TESTS PASSED SUCCESSFULLY! (100%)")
        print("================================================================")

    finally:
        # Clean up test leaves created during test
        try:
            if created_leave_ids:
                db.query(Leave).filter(Leave.id.in_(created_leave_ids)).delete(synchronize_session=False)
                db.commit()
                print(f"  ✓ Cleaned up {len(created_leave_ids)} test leave records.")
        except Exception as e:
            db.rollback()
            print(f"  [Warning] Cleanup error: {e}")
        finally:
            db.close()


if __name__ == "__main__":
    test_module15()

