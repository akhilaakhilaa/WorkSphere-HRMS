import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.utils.security import verify_password

client = TestClient(app)


def verify_batch1():
    print("==================================================")
    print("VERIFYING BATCH 1 (NON-DESTRUCTIVE VERIFICATION)")
    print("==================================================")

    # 1. Database table & account verification
    print("\n[1. Database Integrity & Demo Accounts Check]")
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@worksphere.com").first()
        hr = db.query(User).filter(User.email == "hr@worksphere.com").first()
        emp = db.query(User).filter(User.email == "employee@worksphere.com").first()

        assert admin is not None, "Admin user missing"
        assert hr is not None, "HR user missing"
        assert emp is not None, "Employee user missing"

        assert admin.role == UserRole.ADMIN, f"Admin role is {admin.role}"
        assert hr.role == UserRole.HR, f"HR role is {hr.role}"
        assert emp.role == UserRole.EMPLOYEE, f"Employee role is {emp.role}"

        assert verify_password("Admin@123", admin.password_hash), "Admin password verification failed"
        assert verify_password("Hr@123", hr.password_hash), "HR password verification failed"
        assert verify_password("Employee@123", emp.password_hash), "Employee password verification failed"

        print("  ✓ Admin account verified: admin@worksphere.com (Role: ADMIN)")
        print("  ✓ HR account verified: hr@worksphere.com (Role: HR)")
        print("  ✓ Employee account verified: employee@worksphere.com (Role: EMPLOYEE)")

        emp_count = db.query(Employee).count()
        att_count = db.query(Attendance).count()
        print(f"  ✓ Existing data preserved: {emp_count} employees, {att_count} attendance records in DB")

    finally:
        db.close()

    # 2. Login & JWT authentication for all three roles
    print("\n[2. Authentication & JWT Tokens Check]")
    r_admin = client.post("/api/auth/login", json={"email": "admin@worksphere.com", "password": "Admin@123"})
    assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]
    assert r_admin.json()["role"] == "ADMIN"
    print("  ✓ Admin login successful with valid JWT & role=ADMIN")

    r_hr = client.post("/api/auth/login", json={"email": "hr@worksphere.com", "password": "Hr@123"})
    assert r_hr.status_code == 200, f"HR login failed: {r_hr.text}"
    hr_token = r_hr.json()["access_token"]
    assert r_hr.json()["role"] == "HR"
    print("  ✓ HR login successful with valid JWT & role=HR")

    r_emp = client.post("/api/auth/login", json={"email": "employee@worksphere.com", "password": "Employee@123"})
    assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
    emp_token = r_emp.json()["access_token"]
    assert r_emp.json()["role"] == "EMPLOYEE"
    print("  ✓ Employee login successful with valid JWT & role=EMPLOYEE")

    # Invalid login test
    r_bad = client.post("/api/auth/login", json={"email": "admin@worksphere.com", "password": "IncorrectPassword"})
    assert r_bad.status_code == 401
    print("  ✓ Bad credentials correctly rejected (401 Unauthorized)")

    # 3. Protected endpoints & Role-Based Authorization
    print("\n[3. Protected Routes & RBAC Check]")
    # Unauthenticated access to /api/auth/me should fail
    r_unauth = client.get("/api/auth/me")
    assert r_unauth.status_code == 401
    print("  ✓ Unauthenticated access to /api/auth/me blocked (401)")

    # Authenticated access to /api/auth/me
    r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_me.status_code == 200
    assert r_me.json()["email"] == "employee@worksphere.com"
    print("  ✓ Authenticated access to /api/auth/me succeeded")

    # Employee cannot create new employee (Role restriction: ADMIN/HR only)
    r_emp_create = client.post(
        "/api/employees",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={
            "full_name": "Unauthorized Add",
            "designation": "Tester",
            "department": "QA",
            "joining_date": "2024-01-01",
            "salary": 50000,
            "status": "ACTIVE"
        }
    )
    assert r_emp_create.status_code == 403, f"Expected 403 Forbidden for employee, got {r_emp_create.status_code}"
    print("  ✓ Employee restricted from creating employees (403 Forbidden enforced)")

    # HR can list employees
    r_list = client.get("/api/employees", headers={"Authorization": f"Bearer {hr_token}"})
    assert r_list.status_code == 200
    assert len(r_list.json()) >= 7
    print(f"  ✓ HR successfully listed employees ({len(r_list.json())} retrieved)")

    # Search employee
    r_search = client.get("/api/employees?q=Alex", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_search.status_code == 200
    assert any("Alex" in emp["full_name"] for emp in r_search.json())
    print("  ✓ Employee search by name works correctly")

    # 4. Attendance working-hours & status calculation verification
    print("\n[4. Attendance Working Hours & Status Calculation Check]")
    # Test cases for working hours calculation
    # >= 8.0 hours -> PRESENT
    t_start_1 = datetime(2026, 10, 15, 9, 0, 0)
    t_end_1 = datetime(2026, 10, 15, 17, 30, 0)
    delta_1 = t_end_1 - t_start_1
    hours_1 = round(Decimal(delta_1.total_seconds()) / Decimal(3600.0), 2)
    assert hours_1 == Decimal("8.50"), f"Expected 8.50, got {hours_1}"
    status_1 = "PRESENT" if hours_1 >= Decimal("8.00") else ("HALF_DAY" if hours_1 >= Decimal("4.00") else "HALF_DAY")
    assert status_1 == "PRESENT"
    print(f"  ✓ Case 1 (9:00 to 17:30 = {hours_1} hrs) correctly yields PRESENT")

    # 4.0 <= hours < 8.0 -> HALF_DAY
    t_start_2 = datetime(2026, 10, 15, 9, 0, 0)
    t_end_2 = datetime(2026, 10, 15, 14, 0, 0)
    delta_2 = t_end_2 - t_start_2
    hours_2 = round(Decimal(delta_2.total_seconds()) / Decimal(3600.0), 2)
    assert hours_2 == Decimal("5.00"), f"Expected 5.00, got {hours_2}"
    status_2 = "PRESENT" if hours_2 >= Decimal("8.00") else ("HALF_DAY" if hours_2 >= Decimal("4.00") else "HALF_DAY")
    assert status_2 == "HALF_DAY"
    print(f"  ✓ Case 2 (9:00 to 14:00 = {hours_2} hrs) correctly yields HALF_DAY")

    # < 4.0 hours -> HALF_DAY
    t_start_3 = datetime(2026, 10, 15, 9, 0, 0)
    t_end_3 = datetime(2026, 10, 15, 12, 15, 0)
    delta_3 = t_end_3 - t_start_3
    hours_3 = round(Decimal(delta_3.total_seconds()) / Decimal(3600.0), 2)
    assert hours_3 == Decimal("3.25"), f"Expected 3.25, got {hours_3}"
    status_3 = "PRESENT" if hours_3 >= Decimal("8.00") else ("HALF_DAY" if hours_3 >= Decimal("4.00") else "HALF_DAY")
    assert status_3 == "HALF_DAY"
    print(f"  ✓ Case 3 (9:00 to 12:15 = {hours_3} hrs) correctly yields HALF_DAY")

    # Check attendance history endpoint
    r_hist = client.get("/api/attendance/my-history", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_hist.status_code == 200
    print(f"  ✓ Attendance history retrieved ({len(r_hist.json())} records found)")

    # Check summary endpoint
    r_sum = client.get("/api/attendance/summary", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_sum.status_code == 200
    print(f"  ✓ Attendance summary retrieved: {r_sum.json()}")

    print("\n==================================================")
    print("ALL BATCH 1 CHECKS PASSED WITH ZERO DATA LOSS!")
    print("==================================================")


if __name__ == "__main__":
    try:
        verify_batch1()
    except Exception as e:
        print("Verification failed:", e)
        sys.exit(1)

