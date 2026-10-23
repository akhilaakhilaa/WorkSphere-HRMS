import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from starlette.testclient import TestClient

from app.main import app, scheduler
from app.database import SessionLocal
from app.config import (
    STANDARD_WORK_HOURS,
    DEFAULT_PUBLIC_HOLIDAYS,
    PUBLIC_HOLIDAYS,
    AUTO_ABSENT_DRY_RUN,
)
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.user import UserRole
from app.attendance_tasks import (
    get_configured_holidays,
    is_weekend,
    is_public_holiday,
    is_workday,
    get_completed_workday,
    mark_absent_employees,
)

client = TestClient(app)


def test_module10_advanced_attendance():
    print("==================================================")
    print("TESTING MODULE 10: ADVANCED ATTENDANCE & SCHEDULER")
    print("==================================================")

    # ---------------------------------------------------------
    # 1. AUTHENTICATION SETUP
    # ---------------------------------------------------------
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
    emp_headers = {"Authorization": f"Bearer {emp_token}"}
    emp_id = r_emp.json()["user_id"]

    print("  ✓ Authenticated Admin, HR, and Employee test accounts")

    db = SessionLocal()
    try:
        # Get employee profile for regular employee user
        regular_emp = db.query(Employee).filter(Employee.user_id == emp_id).first()
        assert regular_emp is not None, "Regular employee profile not found"
        target_emp_id = regular_emp.id

        # ---------------------------------------------------------
        # 2. OVERTIME CALCULATION & ATTENDANCE SCENARIOS
        # ---------------------------------------------------------
        print("\n[Scenario 1: Attendance Duration & Overtime Calculations]")

        # 2.1 Short Duration (< 8.0 hrs) -> HALF_DAY, 0 Overtime
        short_date = date(2026, 9, 1)
        # Clean existing test records for this date
        db.query(Attendance).filter(Attendance.date == short_date).delete()
        db.commit()

        r_short = client.post(
            "/api/attendance/manual",
            headers=hr_headers,
            json={
                "employee_id": target_emp_id,
                "date": str(short_date),
                "check_in": f"{short_date}T09:00:00",
                "check_out": f"{short_date}T14:30:00",  # 5.5 hours
                "status": "HALF_DAY",
                "notes": "Short shift test",
            },
        )
        assert r_short.status_code == 201, f"Manual short attendance failed: {r_short.text}"
        data_short = r_short.json()
        assert Decimal(str(data_short["working_hours"])) == Decimal("5.50"), f"Expected 5.50 working hours, got {data_short['working_hours']}"
        assert Decimal(str(data_short["overtime_hours"])) == Decimal("0.00"), f"Expected 0.00 overtime, got {data_short['overtime_hours']}"
        assert data_short["status"] == "HALF_DAY"
        print(f"  ✓ Short duration (<8h): 5.50 hrs working -> {data_short['overtime_hours']} hrs overtime, status {data_short['status']}")

        # 2.2 Normal Duration (Exactly 8.0 hrs) -> PRESENT, 0 Overtime
        normal_date = date(2026, 9, 2)
        db.query(Attendance).filter(Attendance.date == normal_date).delete()
        db.commit()

        r_normal = client.post(
            "/api/attendance/manual",
            headers=hr_headers,
            json={
                "employee_id": target_emp_id,
                "date": str(normal_date),
                "check_in": f"{normal_date}T09:00:00",
                "check_out": f"{normal_date}T17:00:00",  # exactly 8.0 hours
                "status": "PRESENT",
                "notes": "Standard 8-hour shift",
            },
        )
        assert r_normal.status_code == 201, f"Manual normal attendance failed: {r_normal.text}"
        data_normal = r_normal.json()
        assert Decimal(str(data_normal["working_hours"])) == Decimal("8.00")
        assert Decimal(str(data_normal["overtime_hours"])) == Decimal("0.00")
        assert data_normal["status"] == "PRESENT"
        print(f"  ✓ Normal duration (8.0h): 8.00 hrs working -> {data_normal['overtime_hours']} hrs overtime, status {data_normal['status']}")

        # 2.3 Overtime Duration (> 8.0 hrs) -> PRESENT, working_hours - 8.0 hrs Overtime
        overtime_date = date(2026, 9, 3)
        db.query(Attendance).filter(Attendance.date == overtime_date).delete()
        db.commit()

        r_ot = client.post(
            "/api/attendance/manual",
            headers=hr_headers,
            json={
                "employee_id": target_emp_id,
                "date": str(overtime_date),
                "check_in": f"{overtime_date}T09:00:00",
                "check_out": f"{overtime_date}T19:30:00",  # 10.5 hours
                "status": "PRESENT",
                "notes": "Overtime sprint test",
            },
        )
        assert r_ot.status_code == 201, f"Manual overtime attendance failed: {r_ot.text}"
        data_ot = r_ot.json()
        assert Decimal(str(data_ot["working_hours"])) == Decimal("10.50")
        assert Decimal(str(data_ot["overtime_hours"])) == Decimal("2.50"), f"Expected 2.50 overtime, got {data_ot['overtime_hours']}"
        assert data_ot["status"] == "PRESENT"
        print(f"  ✓ Overtime duration (>8h): 10.50 hrs working -> {data_ot['overtime_hours']} hrs overtime (10.5 - 8.0 = 2.50 hrs), status {data_ot['status']}")

        # 2.4 Update Record Recalculation
        ot_rec_id = data_ot["id"]
        r_update = client.put(
            f"/api/attendance/{ot_rec_id}",
            headers=hr_headers,
            json={
                "check_in": f"{overtime_date}T09:00:00",
                "check_out": f"{overtime_date}T20:00:00",  # 11.0 hours (3.0 hrs overtime)
            },
        )
        assert r_update.status_code == 200, f"Update attendance failed: {r_update.text}"
        data_upd = r_update.json()
        assert Decimal(str(data_upd["working_hours"])) == Decimal("11.00")
        assert Decimal(str(data_upd["overtime_hours"])) == Decimal("3.00")
        print(f"  ✓ Record update recalculation: check-out extended to 20:00 -> {data_upd['overtime_hours']} hrs overtime")

        # 2.5 Summary Metrics Overtime Aggregation
        r_sum = client.get("/api/attendance/summary", headers=emp_headers)
        assert r_sum.status_code == 200
        sum_data = r_sum.json()
        assert "total_overtime_hours" in sum_data
        assert Decimal(str(sum_data["total_overtime_hours"])) >= Decimal("3.00")
        print(f"  ✓ Attendance summary includes total_overtime_hours: {sum_data['total_overtime_hours']} hrs")

        # ---------------------------------------------------------
        # 3. WORKDAY, WEEKEND, AND PUBLIC HOLIDAY VALIDATION
        # ---------------------------------------------------------
        print("\n[Scenario 2: Workday, Weekend, and Public Holiday Protection]")

        # 3.1 Weekend check (Saturday / Sunday)
        saturday = date(2026, 10, 17)
        sunday = date(2026, 10, 18)
        monday = date(2026, 10, 19)
        assert is_weekend(saturday) is True
        assert is_weekend(sunday) is True
        assert is_weekend(monday) is False
        print(f"  ✓ Weekend identification verified: {saturday} (Sat) & {sunday} (Sun) flagged as weekends; {monday} (Mon) is a workday")

        # 3.2 Public Holiday check
        xmas = date(2026, 12, 25)
        new_year = date(2026, 1, 1)
        assert is_public_holiday(xmas) is True
        assert is_public_holiday(new_year) is True
        assert is_public_holiday(monday) is False
        print(f"  ✓ Public holiday protection: {xmas} (Christmas) and {new_year} (New Year) safely detected")

        # 3.3 Custom Holiday configuration override
        custom_holidays = ["2026-07-04", "2026-05-01"]
        assert is_public_holiday(date(2026, 7, 4), custom_holidays) is True
        assert is_public_holiday(date(2026, 7, 5), custom_holidays) is False
        print("  ✓ Custom configurable public holiday exclusion verified")

        # 3.4 Completed workday resolution
        # Tuesday after a holiday Monday
        res_workday = get_completed_workday(ref_date=date(2026, 10, 18))  # Sunday
        assert res_workday == date(2026, 10, 16)  # Previous Friday
        print(f"  ✓ Completed workday navigation: Sunday {sunday} resolves backwards to Friday {res_workday}")

        # ---------------------------------------------------------
        # 4. AUTOMATIC ABSENT MARKING SAFEGUARDS & INTEGRATION
        # ---------------------------------------------------------
        print("\n[Scenario 3: Automatic Absent Marking - Controlled Execution & Safety]")

        controlled_test_date = date(2026, 9, 15)  # A Tuesday (Workday)
        # Clean any existing attendance or leaves for this test date
        db.query(Attendance).filter(Attendance.date == controlled_test_date).delete()
        db.query(Leave).filter(
            Leave.start_date <= controlled_test_date,
            Leave.end_date >= controlled_test_date,
        ).delete()
        db.commit()

        # Count active employees
        active_emp_count = db.query(Employee).filter(Employee.status == EmployeeStatus.ACTIVE).count()
        assert active_emp_count > 0, "Need at least one active employee for testing"

        # 4.1 Future date rejection
        future_date = date.today() + timedelta(days=10)
        try:
            mark_absent_employees(work_date=future_date, dry_run=True)
            assert False, "Future date should have raised ValueError"
        except ValueError as e:
            assert "Cannot mark future attendance" in str(e)
            print("  ✓ Safety check: Future dates safely rejected")

        # 4.2 Weekend date rejection
        try:
            mark_absent_employees(work_date=saturday, dry_run=True)
            assert False, "Weekend date should have raised ValueError"
        except ValueError as e:
            assert "weekend" in str(e).lower()
            print("  ✓ Safety check: Weekend dates safely rejected")

        # 4.3 Public Holiday rejection
        past_holiday = date(2026, 1, 1)  # New Year's Day (Past holiday in 2026)
        try:
            mark_absent_employees(work_date=past_holiday, dry_run=True)
            assert False, "Public holiday should have raised ValueError"
        except ValueError as e:
            assert "public holiday" in str(e).lower()
            print("  ✓ Safety check: Configured public holidays safely rejected")

        # 4.4 Dry-Run Mode (Preview without modifying DB)
        preview_count = mark_absent_employees(work_date=controlled_test_date, dry_run=True)
        assert preview_count == active_emp_count, f"Expected {active_emp_count} employees in preview, got {preview_count}"

        # Verify DB is completely untouched
        db_records_after_dry_run = db.query(Attendance).filter(Attendance.date == controlled_test_date).count()
        assert db_records_after_dry_run == 0, "Dry run mode MUST NOT write records to database"
        print(f"  ✓ Dry-Run mode previewed {preview_count} employees absent; database remained completely untouched (0 records written)")

        # 4.5 Leave Skip Verification: Give target_emp_id an approved leave on controlled_test_date
        test_leave = Leave(
            employee_id=target_emp_id,
            leave_type=LeaveType.CASUAL,
            start_date=controlled_test_date,
            end_date=controlled_test_date,
            reason="Module 10 leave test",
            status=LeaveStatus.APPROVED,
        )
        db.add(test_leave)
        db.commit()

        # Now active_emp_count - 1 should be eligible
        preview_with_leave = mark_absent_employees(work_date=controlled_test_date, dry_run=True)
        assert preview_with_leave == active_emp_count - 1
        print(f"  ✓ Approved leave exclusion: Employee on approved leave was successfully skipped (count: {preview_with_leave})")

        # 4.6 Existing Attendance Skip Verification: Give another employee an attendance record
        all_emps = db.query(Employee).filter(Employee.status == EmployeeStatus.ACTIVE).all()
        other_emp = [e for e in all_emps if e.id != target_emp_id][0]

        existing_att = Attendance(
            employee_id=other_emp.id,
            date=controlled_test_date,
            status=AttendanceStatus.PRESENT,
            working_hours=Decimal("8.00"),
            overtime_hours=Decimal("0.00"),
            notes="Already logged attendance",
        )
        db.add(existing_att)
        db.commit()

        preview_with_att = mark_absent_employees(work_date=controlled_test_date, dry_run=True)
        assert preview_with_att == active_emp_count - 2
        print(f"  ✓ Existing attendance preservation: Employee with logged attendance was safely skipped (count: {preview_with_att})")

        # 4.7 Controlled Live Commit (dry_run=False)
        live_count = mark_absent_employees(work_date=controlled_test_date, dry_run=False)
        assert live_count == active_emp_count - 2
        print(f"  ✓ Controlled live absent marking committed {live_count} ABSENT records")

        # 4.8 Idempotency & Duplicate Prevention: Running again must NOT create duplicate records
        repeated_count = mark_absent_employees(work_date=controlled_test_date, dry_run=False)
        assert repeated_count == 0, f"Repeated run must mark 0 employees absent, got {repeated_count}"
        print("  ✓ Idempotency verified: Re-running scheduler on same date marks 0 records (no duplicates)")

        # Verify existing attendance was never overwritten
        re_att = db.query(Attendance).filter(Attendance.employee_id == other_emp.id, Attendance.date == controlled_test_date).first()
        assert re_att.status == AttendanceStatus.PRESENT, "Existing attendance record must NEVER be overwritten!"
        assert re_att.working_hours == Decimal("8.00")
        print("  ✓ Integrity verified: Pre-existing attendance was completely preserved and not overwritten")

        # Clean up test leave and records
        db.query(Leave).filter(Leave.id == test_leave.id).delete()
        db.query(Attendance).filter(Attendance.date == controlled_test_date).delete()
        db.commit()

        # ---------------------------------------------------------
        # 5. APSCHEDULER CONFIGURATION VERIFICATION
        # ---------------------------------------------------------
        print("\n[Scenario 4: APScheduler Configuration & Job Verification]")
        job = scheduler.get_job("automatic_absent_marking")
        assert job is not None, "automatic_absent_marking job not found in scheduler"
        assert str(job.trigger) == "cron[day_of_week='mon-fri', hour='18', minute='0']"
        assert job.coalesce is True, "Job coalesce must be True to prevent duplicate runs after downtime"
        assert job.max_instances == 1, "Job max_instances must be 1 to prevent simultaneous concurrent executions"
        assert job.misfire_grace_time == 3600
        print(f"  ✓ Scheduler job '{job.id}' verified:")
        print(f"      - Trigger: {job.trigger}")
        print(f"      - Coalesce: {job.coalesce}")
        print(f"      - Max Instances: {job.max_instances}")
        print(f"      - Misfire Grace Time: {job.misfire_grace_time}s")

        # ---------------------------------------------------------
        # 6. REST API ENDPOINT: POST /api/attendance/auto-absent
        # ---------------------------------------------------------
        print("\n[Scenario 5: REST API Endpoint - POST /api/attendance/auto-absent]")

        # 6.1 Employee role blocked (403 Forbidden)
        r_api_emp = client.post(
            "/api/attendance/auto-absent?dry_run=true",
            headers=emp_headers,
        )
        assert r_api_emp.status_code == 403, f"Expected 403 for employee, got {r_api_emp.status_code}"
        print("  ✓ POST /api/attendance/auto-absent blocked for EMPLOYEE role (403 Forbidden)")

        # 6.2 Weekend rejection via API
        r_api_weekend = client.post(
            f"/api/attendance/auto-absent?target_date={saturday}&dry_run=true",
            headers=hr_headers,
        )
        assert r_api_weekend.status_code == 400
        assert "weekend" in r_api_weekend.json()["detail"].lower()
        print("  ✓ POST /api/attendance/auto-absent rejects weekend target date with 400 Bad Request")

        # 6.3 Public Holiday rejection via API
        r_api_holiday = client.post(
            f"/api/attendance/auto-absent?target_date={past_holiday}&dry_run=true",
            headers=hr_headers,
        )
        assert r_api_holiday.status_code == 400
        assert "public holiday" in r_api_holiday.json()["detail"].lower()
        print("  ✓ POST /api/attendance/auto-absent rejects public holiday with 400 Bad Request")

        # 6.4 Valid Workday Dry-Run Preview via API
        test_api_date = date(2026, 9, 22)  # Tuesday
        db.query(Attendance).filter(Attendance.date == test_api_date).delete()
        db.commit()

        r_api_valid = client.post(
            f"/api/attendance/auto-absent?target_date={test_api_date}&dry_run=true",
            headers=hr_headers,
        )
        assert r_api_valid.status_code == 200, f"Auto-absent API failed: {r_api_valid.text}"
        res_data = r_api_valid.json()
        assert res_data["target_date"] == str(test_api_date)
        assert res_data["dry_run"] is True
        assert res_data["marked_count"] >= 1
        assert "total_employees_evaluated" in res_data
        print(f"  ✓ POST /api/attendance/auto-absent returned dry-run breakdown: {res_data['message']}")

        # Clean up test_api_date
        db.query(Attendance).filter(Attendance.date == test_api_date).delete()
        db.commit()

    finally:
        db.close()

    print("\n==================================================")
    print("ALL MODULE 10 (ADVANCED ATTENDANCE) TESTS PASSED! (100% PASS)")
    print("==================================================")


if __name__ == "__main__":
    test_module10_advanced_attendance()
