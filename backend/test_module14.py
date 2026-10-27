"""
Integration Test Suite for Module 14: Automated Attendance & Shift Management
WorkSphere HRMS
"""

import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.shift import EmployeeShift, Shift
from app.models.user import User, UserRole
from app.attendance_tasks import mark_absent_employees, get_completed_workday

client = TestClient(app)


def test_module14():
    print("================================================================")
    print("TESTING MODULE 14: AUTOMATED ATTENDANCE & SHIFT MANAGEMENT")
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

    # Retrieve test employee record
    test_emp = db.query(Employee).filter(Employee.user_id == emp_user_id).first()
    assert test_emp is not None, "Test employee record not found"
    test_emp_id = test_emp.id

    # Retrieve another employee record for permission tests
    other_emp = db.query(Employee).filter(Employee.id != test_emp_id).first()
    other_emp_id = other_emp.id if other_emp else test_emp_id + 999

    print("  ✓ Authenticated Admin, HR, and Employee test accounts")

    created_shift_ids = []

    try:
        # -------------------------------------------------------------
        # SCENARIO 1: ROLE-BASED ACCESS CONTROL (RBAC) ON SHIFT ENDPOINTS
        # -------------------------------------------------------------
        print("\n[Scenario 1: Role-Based Access Control (RBAC)]")

        # 1.1 Unauthenticated requests are rejected
        r = client.post("/api/shifts", json={"name": "Test Shift", "start_time": "09:00:00", "end_time": "17:00:00"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ POST /api/shifts rejects unauthenticated requests (401)")

        r = client.post("/api/shifts/assign", json={"employee_id": test_emp_id, "shift_id": 1})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ POST /api/shifts/assign rejects unauthenticated requests (401)")

        # 1.2 Regular employee cannot create shifts
        r = client.post(
            "/api/shifts",
            headers=emp_headers,
            json={"name": "Emp Shift", "start_time": "08:00:00", "end_time": "16:00:00"},
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print("  ✓ POST /api/shifts blocks EMPLOYEE role (403 Forbidden)")

        # 1.3 Regular employee cannot assign shifts
        r = client.post(
            "/api/shifts/assign",
            headers=emp_headers,
            json={"employee_id": test_emp_id, "shift_id": 1},
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print("  ✓ POST /api/shifts/assign blocks EMPLOYEE role (403 Forbidden)")

        # 1.4 Regular employee can view shift definitions list
        r = client.get("/api/shifts", headers=emp_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print("  ✓ GET /api/shifts accessible to authenticated EMPLOYEE (200 OK)")

        # -------------------------------------------------------------
        # SCENARIO 2: SHIFT DEFINITIONS CRUD & VALIDATION
        # -------------------------------------------------------------
        print("\n[Scenario 2: Shift Definitions CRUD & Validation]")

        # 2.1 Reject identical start and end time
        r = client.post(
            "/api/shifts",
            headers=hr_headers,
            json={"name": "Identical Times Shift", "start_time": "09:00:00", "end_time": "09:00:00"},
        )
        assert r.status_code in (400, 422), f"Expected 400 or 422, got {r.status_code}: {r.text}"
        assert "identical" in r.text.lower()
        print("  ✓ Rejects shift with identical start and end time (400/422 Unprocessable Entity)")

        # 2.2 Create standard daytime shift
        shift_data = {
            "name": "M14 Early Morning Shift",
            "start_time": "07:00:00",
            "end_time": "15:30:00",
            "grace_period_minutes": 15,
            "description": "Shift for early birds and ground crew",
        }
        r = client.post("/api/shifts", headers=hr_headers, json=shift_data)
        assert r.status_code == 201, f"Failed to create shift: {r.status_code} {r.text}"
        res1 = r.json()
        shift1_id = res1["id"]
        created_shift_ids.append(shift1_id)
        assert res1["name"] == "M14 Early Morning Shift"
        assert res1["is_overnight"] is False
        assert res1["grace_period_minutes"] == 15
        assert res1["active_employees_count"] == 0
        print(f"  ✓ Created standard day shift #{shift1_id} ({res1['start_time']} to {res1['end_time']})")

        # 2.3 Create overnight shift (start_time > end_time)
        night_shift_data = {
            "name": "M14 Overnight Graveyard Shift",
            "start_time": "23:00:00",
            "end_time": "07:00:00",
            "grace_period_minutes": 20,
            "description": "Overnight support shift crossing midnight",
        }
        r = client.post("/api/shifts", headers=admin_headers, json=night_shift_data)
        assert r.status_code == 201, f"Failed to create night shift: {r.status_code} {r.text}"
        res2 = r.json()
        shift2_id = res2["id"]
        created_shift_ids.append(shift2_id)
        assert res2["is_overnight"] is True
        print(f"  ✓ Created overnight shift #{shift2_id} (is_overnight=True, {res2['start_time']} to {res2['end_time']})")

        # 2.4 Duplicate shift name rejected
        r = client.post("/api/shifts", headers=hr_headers, json=shift_data)
        assert r.status_code == 400, f"Expected 400 for duplicate shift name, got {r.status_code}"
        assert "already exists" in r.text
        print("  ✓ Duplicate shift name rejected (400 Bad Request)")

        # 2.5 Get shift details by ID
        r = client.get(f"/api/shifts/{shift1_id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["id"] == shift1_id
        print(f"  ✓ GET /api/shifts/{shift1_id} returns correct shift details")

        # 2.6 Update shift
        r = client.put(
            f"/api/shifts/{shift1_id}",
            headers=admin_headers,
            json={"grace_period_minutes": 20, "description": "Updated early morning description"},
        )
        assert r.status_code == 200
        assert r.json()["grace_period_minutes"] == 20
        assert r.json()["description"] == "Updated early morning description"
        print(f"  ✓ PUT /api/shifts/{shift1_id} updated grace period and description")

        # -------------------------------------------------------------
        # SCENARIO 3: EMPLOYEE SHIFT ASSIGNMENT & CONFLICT HANDLING
        # -------------------------------------------------------------
        print("\n[Scenario 3: Employee Shift Assignment & Active Conflict Handling]")

        # 3.1 Validation: Invalid employee ID
        r = client.post(
            "/api/shifts/assign",
            headers=admin_headers,
            json={"employee_id": 999999, "shift_id": shift1_id},
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"
        print("  ✓ Reject assignment to non-existent employee (404 Not Found)")

        # 3.2 Validation: Invalid shift ID
        r = client.post(
            "/api/shifts/assign",
            headers=admin_headers,
            json={"employee_id": test_emp_id, "shift_id": 999999},
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"
        print("  ✓ Reject assignment with non-existent shift (404 Not Found)")

        # 3.3 Validation: end_date before start_date
        r = client.post(
            "/api/shifts/assign",
            headers=admin_headers,
            json={
                "employee_id": test_emp_id,
                "shift_id": shift1_id,
                "start_date": "2026-11-10",
                "end_date": "2026-11-01",
            },
        )
        assert r.status_code in (400, 422), f"Expected 400 or 422, got {r.status_code}: {r.text}"
        print("  ✓ Reject assignment with end_date earlier than start_date (400/422 Bad Request)")

        # 3.4 Valid shift assignment to test employee
        r = client.post(
            "/api/shifts/assign",
            headers=hr_headers,
            json={
                "employee_id": test_emp_id,
                "shift_id": shift1_id,
                "start_date": str(date.today() - timedelta(days=5)),
                "is_active": True,
            },
        )
        assert r.status_code == 201, f"Failed to assign shift: {r.status_code} {r.text}"
        assign1 = r.json()
        assign1_id = assign1["id"]
        assert assign1["is_active"] is True
        assert assign1["shift_id"] == shift1_id
        print(f"  ✓ Assigned shift #{shift1_id} to employee #{test_emp_id} (Assignment #{assign1_id})")

        # Verify active count increased
        r_sh = client.get(f"/api/shifts/{shift1_id}", headers=admin_headers)
        assert r_sh.json()["active_employees_count"] >= 1
        print("  ✓ Shift active_employees_count reflects current active assignment")

        # 3.5 Reassigning to another active shift automatically deactivates prior assignment
        r = client.post(
            "/api/shifts/assign",
            headers=admin_headers,
            json={
                "employee_id": test_emp_id,
                "shift_id": shift2_id,
                "start_date": str(date.today()),
                "is_active": True,
            },
        )
        assert r.status_code == 201
        assign2 = r.json()
        assign2_id = assign2["id"]
        assert assign2["is_active"] is True
        assert assign2["shift_id"] == shift2_id

        # Verify old assignment was automatically deactivated
        r_list = client.get(f"/api/shifts/assignments?employee_id={test_emp_id}", headers=admin_headers)
        assignments = r_list.json()
        old_assign = next((a for a in assignments if a["id"] == assign1_id), None)
        assert old_assign is not None
        assert old_assign["is_active"] is False, "Previous assignment should be deactivated"
        print("  ✓ Automatic conflict deactivation: Prior active assignment was deactivated")

        # 3.6 Employee access controls on assignments
        # Employee can view their own current active shift
        r_my_shift = client.get(f"/api/shifts/employee/{test_emp_id}", headers=emp_headers)
        assert r_my_shift.status_code == 200
        assert r_my_shift.json()["shift_id"] == shift2_id
        print("  ✓ Employee can view their own active shift (/api/shifts/employee/{id})")

        # Employee cannot view another employee's active shift
        if other_emp_id != test_emp_id:
            r_forbidden = client.get(f"/api/shifts/employee/{other_emp_id}", headers=emp_headers)
            assert r_forbidden.status_code == 403, f"Expected 403, got {r_forbidden.status_code}"
            print("  ✓ Employee forbidden from viewing other employee's shift assignment (403 Forbidden)")

        # -------------------------------------------------------------
        # SCENARIO 4: SHIFT DELETION SAFEGUARD
        # -------------------------------------------------------------
        print("\n[Scenario 4: Shift Deletion Safeguard]")

        # 4.1 Deleting shift with active assignment should be blocked
        r = client.delete(f"/api/shifts/{shift2_id}", headers=admin_headers)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        assert "active assignments" in r.text
        print("  ✓ Safeguard active: Cannot delete shift with active employee assignments (400 Bad Request)")

        # 4.2 Deactivate assignment
        r = client.put(
            f"/api/shifts/assignments/{assign2_id}",
            headers=admin_headers,
            json={"is_active": False},
        )
        assert r.status_code == 200
        assert r.json()["is_active"] is False
        print(f"  ✓ Deactivated assignment #{assign2_id}")

        # Reassign test employee back to shift1 for attendance tests
        r = client.post(
            "/api/shifts/assign",
            headers=admin_headers,
            json={
                "employee_id": test_emp_id,
                "shift_id": shift1_id,
                "start_date": str(date.today() - timedelta(days=1)),
                "is_active": True,
            },
        )
        assert r.status_code == 201
        current_active_assignment_id = r.json()["id"]

        # Delete unused shift2
        # First remove any assignments referencing shift2
        client.delete(f"/api/shifts/assignments/{assign2_id}", headers=admin_headers)
        r = client.delete(f"/api/shifts/{shift2_id}", headers=admin_headers)
        assert r.status_code == 200
        created_shift_ids.remove(shift2_id)
        print(f"  ✓ Deleted shift #{shift2_id} after assignments cleared")

        # -------------------------------------------------------------
        # SCENARIO 5: SHIFT-AWARE ATTENDANCE CALCULATION (LATE & EARLY)
        # -------------------------------------------------------------
        print("\n[Scenario 5: Shift-Aware Attendance Calculation (Late Arrival & Early Departure)]")

        # Create a shift with explicit start time 09:00:00, end time 17:00:00, grace 15 mins
        test_shift_data = {
            "name": "M14 Standard Test Shift",
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "grace_period_minutes": 15,
            "description": "Standard 9 to 5 shift for precision testing",
        }
        r = client.post("/api/shifts", headers=admin_headers, json=test_shift_data)
        assert r.status_code == 201
        test_shift_id = r.json()["id"]
        created_shift_ids.append(test_shift_id)

        # Assign test_shift to test_emp
        r = client.post(
            "/api/shifts/assign",
            headers=admin_headers,
            json={
                "employee_id": test_emp_id,
                "shift_id": test_shift_id,
                "start_date": str(date.today() - timedelta(days=30)),
                "is_active": True,
            },
        )
        assert r.status_code == 201

        # 5.1 On-time check-in within grace period (09:10:00 <= 09:15:00 deadline)
        sim_date_ontime = date.today() - timedelta(days=20)
        # Clean any preexisting record for that date
        db.query(Attendance).filter(Attendance.employee_id == test_emp_id, Attendance.date == sim_date_ontime).delete()
        db.commit()

        r_manual = client.post(
            "/api/attendance/manual",
            headers=admin_headers,
            json={
                "employee_id": test_emp_id,
                "date": str(sim_date_ontime),
                "check_in": f"{sim_date_ontime}T09:10:00",
                "check_out": f"{sim_date_ontime}T17:30:00",
                "status": "PRESENT",
                "notes": "Testing on-time check-in within grace period",
            },
        )
        assert r_manual.status_code == 201, f"Failed manual attendance: {r_manual.text}"
        att_ontime = r_manual.json()
        assert att_ontime["shift_id"] == test_shift_id
        assert att_ontime["shift_name"] == "M14 Standard Test Shift"
        assert att_ontime["is_late"] is False, "09:10 should NOT be late for 09:00 start with 15m grace"
        assert att_ontime["late_minutes"] == 0
        assert att_ontime["is_early_departure"] is False, "17:30 is after 17:00, not early"
        assert att_ontime["early_departure_minutes"] == 0
        print("  ✓ On-time check-in within grace period: is_late=False, late_minutes=0")

        # 5.2 Late check-in beyond grace period (09:35:00 > 09:15:00 deadline)
        sim_date_late = date.today() - timedelta(days=21)
        db.query(Attendance).filter(Attendance.employee_id == test_emp_id, Attendance.date == sim_date_late).delete()
        db.commit()

        r_manual_late = client.post(
            "/api/attendance/manual",
            headers=admin_headers,
            json={
                "employee_id": test_emp_id,
                "date": str(sim_date_late),
                "check_in": f"{sim_date_late}T09:35:00",
                "check_out": f"{sim_date_late}T17:00:00",
                "status": "PRESENT",
                "notes": "Testing late arrival",
            },
        )
        assert r_manual_late.status_code == 201
        att_late = r_manual_late.json()
        assert att_late["is_late"] is True
        assert att_late["late_minutes"] == 35, f"Expected 35 late minutes (from 09:00), got {att_late['late_minutes']}"
        assert att_late["is_early_departure"] is False
        print("  ✓ Late check-in detected: is_late=True, late_minutes=35")

        # 5.3 Early departure check-out (15:45:00 < 17:00:00 shift end)
        sim_date_early = date.today() - timedelta(days=22)
        db.query(Attendance).filter(Attendance.employee_id == test_emp_id, Attendance.date == sim_date_early).delete()
        db.commit()

        r_manual_early = client.post(
            "/api/attendance/manual",
            headers=admin_headers,
            json={
                "employee_id": test_emp_id,
                "date": str(sim_date_early),
                "check_in": f"{sim_date_early}T09:00:00",
                "check_out": f"{sim_date_early}T15:45:00",
                "status": "HALF_DAY",
                "notes": "Testing early departure",
            },
        )
        assert r_manual_early.status_code == 201
        att_early = r_manual_early.json()
        assert att_early["is_late"] is False
        assert att_early["is_early_departure"] is True
        assert att_early["early_departure_minutes"] == 75, f"Expected 75 early minutes, got {att_early['early_departure_minutes']}"
        print("  ✓ Early departure detected: is_early_departure=True, early_departure_minutes=75")

        # 5.4 Overnight shift early departure detection
        night_shift = Shift(
            name="M14 Night Test Shift",
            start_time=time(22, 0),
            end_time=time(6, 0),
            grace_period_minutes=15,
            is_overnight=True,
        )
        db.add(night_shift)
        db.commit()
        db.refresh(night_shift)
        created_shift_ids.append(night_shift.id)

        # Assign overnight shift
        client.post(
            "/api/shifts/assign",
            headers=admin_headers,
            json={"employee_id": test_emp_id, "shift_id": night_shift.id, "start_date": str(date.today() - timedelta(days=15))},
        )

        sim_date_night = date.today() - timedelta(days=14)
        db.query(Attendance).filter(Attendance.employee_id == test_emp_id, Attendance.date == sim_date_night).delete()
        db.commit()

        # Check out at 04:30 AM next day (90 minutes before 06:00 AM)
        next_day = sim_date_night + timedelta(days=1)
        r_manual_night = client.post(
            "/api/attendance/manual",
            headers=admin_headers,
            json={
                "employee_id": test_emp_id,
                "date": str(sim_date_night),
                "check_in": f"{sim_date_night}T22:05:00",
                "check_out": f"{next_day}T04:30:00",
                "status": "HALF_DAY",
                "notes": "Testing overnight shift early departure",
            },
        )
        assert r_manual_night.status_code == 201
        att_night = r_manual_night.json()
        assert att_night["is_late"] is False  # 22:05 is within 22:15 grace
        assert att_night["is_early_departure"] is True
        assert att_night["early_departure_minutes"] == 90, f"Expected 90 early minutes, got {att_night['early_departure_minutes']}"
        print("  ✓ Overnight shift early departure calculated accurately across midnight boundary (90 mins early)")

        # 5.5 Re-assign standard test shift to test_emp
        client.post(
            "/api/shifts/assign",
            headers=admin_headers,
            json={"employee_id": test_emp_id, "shift_id": test_shift_id, "start_date": str(date.today() - timedelta(days=2))},
        )

        # -------------------------------------------------------------
        # SCENARIO 6: LIVE CHECK-IN / CHECK-OUT WORKFLOW
        # -------------------------------------------------------------
        print("\n[Scenario 6: Live Check-In / Check-Out Workflow]")

        # Clean today's attendance record for test_emp to test live endpoint
        db.query(Attendance).filter(Attendance.employee_id == test_emp_id, Attendance.date == date.today()).delete()
        db.commit()

        # Check-in
        r_ci = client.post("/api/attendance/check-in", headers=emp_headers, json={"notes": "Module 14 live check-in test"})
        assert r_ci.status_code == 200, f"Check-in failed: {r_ci.text}"
        ci_res = r_ci.json()
        assert ci_res["employee_id"] == test_emp_id
        assert ci_res["shift_id"] == test_shift_id
        assert ci_res["shift_name"] == "M14 Standard Test Shift"
        assert ci_res["scheduled_start"] == "09:00:00"
        assert ci_res["scheduled_end"] == "17:00:00"
        print(f"  ✓ Live check-in associated active shift '{ci_res['shift_name']}', late status: {ci_res['is_late']}")

        # Duplicate check-in rejected
        r_ci_dup = client.post("/api/attendance/check-in", headers=emp_headers)
        assert r_ci_dup.status_code == 400
        assert "duplicate check-in" in r_ci_dup.text.lower()
        print("  ✓ Duplicate check-in correctly rejected (400 Bad Request)")

        # Check-out
        r_co = client.post("/api/attendance/check-out", headers=emp_headers, json={"notes": "Module 14 live check-out test"})
        assert r_co.status_code == 200, f"Check-out failed: {r_co.text}"
        co_res = r_co.json()
        assert co_res["check_out"] is not None
        assert co_res["shift_id"] == test_shift_id
        assert "is_early_departure" in co_res
        print(f"  ✓ Live check-out completed: working_hours={co_res['working_hours']}, early_dep={co_res['is_early_departure']}")

        # -------------------------------------------------------------
        # SCENARIO 7: ATTENDANCE HISTORY & SHIFT VISIBILITY
        # -------------------------------------------------------------
        print("\n[Scenario 7: Attendance History & Shift Visibility]")

        r_hist = client.get("/api/attendance/my-history", headers=emp_headers)
        assert r_hist.status_code == 200
        records = r_hist.json()
        assert len(records) > 0
        latest = records[0]
        assert "shift_name" in latest
        assert "scheduled_start" in latest
        assert "scheduled_end" in latest
        assert "is_late" in latest
        assert "is_early_departure" in latest
        print("  ✓ Attendance history payload exposes shift and schedule metadata")

        # -------------------------------------------------------------
        # SCENARIO 8: AUTOMATED ABSENT MARKING INTEGRATION
        # -------------------------------------------------------------
        print("\n[Scenario 8: Automated Absent Marking Integration]")
        # Test dry-run preview of absent marking
        target_workday = get_completed_workday()
        preview = mark_absent_employees(work_date=target_workday, dry_run=True, return_details=True)
        assert isinstance(preview, dict)
        assert preview["dry_run"] is True
        assert "marked_absent_count" in preview
        print(f"  ✓ Automated absent marking task safely previewed ({preview['marked_absent_count']} evaluated for {target_workday})")

        print("\n================================================================")
        print("ALL MODULE 14 TESTS PASSED SUCCESSFULLY! (100%)")
        print("================================================================")

    finally:
        # Cleanup test data created during this run
        try:
            # Clean up test attendances
            db.query(Attendance).filter(
                Attendance.employee_id == test_emp_id,
                Attendance.date.in_([
                    date.today(),
                    date.today() - timedelta(days=20),
                    date.today() - timedelta(days=21),
                    date.today() - timedelta(days=22),
                    date.today() - timedelta(days=14),
                ]),
            ).delete()

            # Clean up assignments referencing created test shifts
            if created_shift_ids:
                db.query(EmployeeShift).filter(
                    EmployeeShift.shift_id.in_(created_shift_ids)
                ).delete(synchronize_session=False)

                # Delete test shifts
                db.query(Shift).filter(
                    Shift.id.in_(created_shift_ids)
                ).delete(synchronize_session=False)

            db.commit()
            print("  ✓ Cleaned up test shifts and attendance records.")
        except Exception as e:
            db.rollback()
            print(f"  [Warning] Cleanup encountered error: {e}")
        finally:
            db.close()


if __name__ == "__main__":
    test_module14()
