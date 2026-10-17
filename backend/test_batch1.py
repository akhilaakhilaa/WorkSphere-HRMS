import sys
from datetime import date
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.attendance import Attendance

client = TestClient(app)


def run_tests():
    print("==========================================")
    print("Testing WorkSphere HRMS - Batch 1 Modules")
    print("==========================================")

    # Clean today's attendance for test employee so attendance tests can run cleanly
    db = SessionLocal()
    db.query(Attendance).filter(Attendance.date == date.today()).delete()
    db.commit()
    db.close()

    # --- 1. MODULE 1: AUTHENTICATION & ROLES ---
    print("\n[Module 1: Authentication & Roles]")

    # 1.1 Root & DB check
    r = client.get("/")
    assert r.status_code == 200, f"Root failed: {r.text}"
    print("  ✓ GET / returns 200 OK")

    r = client.get("/db-check")
    assert r.status_code == 200, f"DB check failed: {r.text}"
    print("  ✓ GET /db-check returns 200 OK")

    # 1.2 Invalid Login
    r = client.post("/api/auth/login", json={"email": "admin@worksphere.com", "password": "WrongPassword!"})
    assert r.status_code == 401, f"Expected 401 on bad password, got {r.status_code}"
    print("  ✓ POST /api/auth/login rejects wrong password (401)")

    # 1.3 Admin Login
    r = client.post("/api/auth/login", json={"email": "admin@worksphere.com", "password": "Admin@123"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    admin_token = r.json()["access_token"]
    assert r.json()["role"] == "ADMIN"
    print("  ✓ POST /api/auth/login Admin succeeds with JWT and role=ADMIN")

    # 1.4 HR Login
    r = client.post("/api/auth/login", json={"email": "hr@worksphere.com", "password": "Hr@123"})
    assert r.status_code == 200, f"HR login failed: {r.text}"
    hr_token = r.json()["access_token"]
    assert r.json()["role"] == "HR"
    print("  ✓ POST /api/auth/login HR succeeds with JWT and role=HR")

    # 1.5 Employee Login
    r = client.post("/api/auth/login", json={"email": "employee@worksphere.com", "password": "Employee@123"})
    assert r.status_code == 200, f"Employee login failed: {r.text}"
    emp_token = r.json()["access_token"]
    emp_user_id = r.json()["user_id"]
    emp_id = r.json()["employee_id"]
    assert r.json()["role"] == "EMPLOYEE"
    print("  ✓ POST /api/auth/login Employee succeeds with JWT and role=EMPLOYEE")

    # 1.6 Protected GET /api/auth/me without token -> 401
    r = client.get("/api/auth/me")
    assert r.status_code == 401, f"Expected 401 without auth, got {r.status_code}"
    print("  ✓ GET /api/auth/me rejects unauthenticated request (401)")

    # 1.7 Protected GET /api/auth/me with valid token -> 200
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {emp_token}"})
    assert r.status_code == 200, f"Failed /api/auth/me: {r.text}"
    assert r.json()["email"] == "employee@worksphere.com"
    print("  ✓ GET /api/auth/me returns current user details with valid token")

    # 1.8 User Registration
    test_reg_email = "newhire@worksphere.com"
    r = client.post("/api/auth/register", json={
        "email": test_reg_email,
        "password": "Password123!",
        "role": "EMPLOYEE"
    })
    if r.status_code == 201:
        print("  ✓ POST /api/auth/register successfully registers new user")
    elif r.status_code == 400 and "already exists" in r.text:
        print("  ✓ POST /api/auth/register handles existing user appropriately")
    else:
        assert False, f"Registration unexpected status: {r.status_code} - {r.text}"

    # 1.9 Duplicate Registration -> 400
    r = client.post("/api/auth/register", json={
        "email": test_reg_email,
        "password": "Password123!",
        "role": "EMPLOYEE"
    })
    assert r.status_code == 400, f"Expected 400 for duplicate email, got {r.status_code}"
    print("  ✓ POST /api/auth/register prevents duplicate email registration (400)")

    # --- 2. MODULE 2: EMPLOYEE MANAGEMENT ---
    print("\n[Module 2: Employee Management]")

    # 2.1 List employees (authenticated)
    r = client.get("/api/employees", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, f"List employees failed: {r.text}"
    employees = r.json()
    assert len(employees) > 0, "No employees found"
    print(f"  ✓ GET /api/employees returns {len(employees)} employees")

    # 2.2 Search employee by name
    r = client.get("/api/employees?q=Alex", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    search_results = r.json()
    assert any("Alex" in emp["full_name"] for emp in search_results)
    print("  ✓ GET /api/employees?q=Alex finds matching employee")

    # 2.3 Search by department
    r = client.get("/api/employees?department=Engineering", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    dept_results = r.json()
    assert all(emp["department"] == "Engineering" for emp in dept_results)
    print("  ✓ GET /api/employees?department=Engineering filters properly")

    # 2.4 Get employee profile by ID
    first_emp_id = employees[0]["id"]
    r = client.get(f"/api/employees/{first_emp_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["id"] == first_emp_id
    print(f"  ✓ GET /api/employees/{first_emp_id} returns employee details")

    # 2.5 Get current employee profile (/me/profile)
    r = client.get("/api/employees/me/profile", headers={"Authorization": f"Bearer {emp_token}"})
    assert r.status_code == 200
    assert r.json()["full_name"] == "Alex Mercer"
    print("  ✓ GET /api/employees/me/profile returns logged in employee's profile")

    # 2.6 Unauthorized role cannot create employee (EMPLOYEE role -> 403)
    r = client.post("/api/employees", headers={"Authorization": f"Bearer {emp_token}"}, json={
        "full_name": "Test Employee",
        "designation": "Junior Dev",
        "department": "Engineering",
        "joining_date": "2024-03-01",
        "salary": 50000,
        "status": "ACTIVE"
    })
    assert r.status_code == 403, f"Expected 403 Forbidden for employee role, got {r.status_code}"
    print("  ✓ POST /api/employees prevents EMPLOYEE role from creating employee (403 Forbidden)")

    # 2.7 HR creates new employee
    r = client.post("/api/employees", headers={"Authorization": f"Bearer {hr_token}"}, json={
        "full_name": "Kelly Kapoor",
        "designation": "Customer Service Rep",
        "department": "Customer Support",
        "joining_date": "2024-01-10",
        "salary": 48000,
        "status": "ACTIVE"
    })
    assert r.status_code == 201, f"HR create employee failed: {r.text}"
    new_created_emp = r.json()
    created_id = new_created_emp["id"]
    print(f"  ✓ POST /api/employees allows HR to create employee (ID: {created_id})")

    # 2.8 Update employee (HR)
    r = client.put(f"/api/employees/{created_id}", headers={"Authorization": f"Bearer {hr_token}"}, json={
        "designation": "Senior Customer Service Lead",
        "salary": 55000
    })
    assert r.status_code == 200, f"Update employee failed: {r.text}"
    assert r.json()["designation"] == "Senior Customer Service Lead"
    assert float(r.json()["salary"]) == 55000.0
    print("  ✓ PUT /api/employees/{id} updates employee designation and salary")

    # 2.9 Delete employee (ADMIN only)
    r = client.delete(f"/api/employees/{created_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, f"Delete failed: {r.text}"
    print("  ✓ DELETE /api/employees/{id} allows ADMIN to delete employee")

    # --- 3. MODULE 3: ATTENDANCE MANAGEMENT ---
    print("\n[Module 3: Attendance Management]")

    # 3.1 Check initial status today (should be None or not checked in)
    r = client.get("/api/attendance/today", headers={"Authorization": f"Bearer {emp_token}"})
    assert r.status_code == 200
    assert r.json() is None
    print("  ✓ GET /api/attendance/today shows no check-in yet")

    # 3.2 Invalid Check-Out before Check-In -> 400
    r = client.post("/api/attendance/check-out", headers={"Authorization": f"Bearer {emp_token}"}, json={})
    assert r.status_code == 400, f"Expected 400 for check-out before check-in, got {r.status_code}"
    print("  ✓ POST /api/attendance/check-out rejects check-out before check-in (400)")

    # 3.3 Valid Check-In
    r = client.post("/api/attendance/check-in", headers={"Authorization": f"Bearer {emp_token}"}, json={"notes": "Starting morning shift"})
    assert r.status_code == 200, f"Check-in failed: {r.text}"
    att_data = r.json()
    assert att_data["status"] == "PRESENT"
    assert att_data["check_in"] is not None
    assert att_data["check_out"] is None
    print(f"  ✓ POST /api/attendance/check-in records check-in at {att_data['check_in']}")

    # 3.4 Duplicate Check-In -> 400
    r = client.post("/api/attendance/check-in", headers={"Authorization": f"Bearer {emp_token}"}, json={})
    assert r.status_code == 400, f"Expected 400 on duplicate check-in, got {r.status_code}"
    assert "Duplicate check-in" in r.text
    print("  ✓ POST /api/attendance/check-in rejects duplicate check-in (400 Bad Request)")

    # 3.5 Check-Out
    r = client.post("/api/attendance/check-out", headers={"Authorization": f"Bearer {emp_token}"}, json={"notes": "Shift completed"})
    assert r.status_code == 200, f"Check-out failed: {r.text}"
    att_out_data = r.json()
    assert att_out_data["check_out"] is not None
    assert att_out_data["working_hours"] is not None
    print(f"  ✓ POST /api/attendance/check-out records check-out and calculates working hours ({att_out_data['working_hours']} hrs, status: {att_out_data['status']})")

    # 3.6 Invalid Check-Out after already checked out -> 400
    r = client.post("/api/attendance/check-out", headers={"Authorization": f"Bearer {emp_token}"}, json={})
    assert r.status_code == 400, f"Expected 400 on duplicate check-out, got {r.status_code}"
    assert "already checked out" in r.text
    print("  ✓ POST /api/attendance/check-out rejects duplicate check-out (400 Bad Request)")

    # 3.7 View today's status after checkout
    r = client.get("/api/attendance/today", headers={"Authorization": f"Bearer {emp_token}"})
    assert r.status_code == 200
    assert r.json()["check_out"] is not None
    print("  ✓ GET /api/attendance/today reflects checked out state")

    # 3.8 View my attendance history
    r = client.get("/api/attendance/my-history", headers={"Authorization": f"Bearer {emp_token}"})
    assert r.status_code == 200
    history = r.json()
    assert len(history) >= 1
    print(f"  ✓ GET /api/attendance/my-history returns {len(history)} attendance records for current employee")

    # 3.9 Attendance Summary
    r = client.get("/api/attendance/summary", headers={"Authorization": f"Bearer {emp_token}"})
    assert r.status_code == 200
    summary = r.json()
    assert summary["total_records"] >= 1
    print(f"  ✓ GET /api/attendance/summary returns summary (Total: {summary['total_records']}, Total Hours: {summary['total_hours']})")

    # 3.10 HR / Admin views organization attendance
    r = client.get("/api/attendance", headers={"Authorization": f"Bearer {hr_token}"})
    assert r.status_code == 200
    all_att = r.json()
    assert len(all_att) >= 1
    print(f"  ✓ GET /api/attendance returns organization attendance records ({len(all_att)} records)")

    print("\n==========================================")
    print("ALL TESTS PASSED SUCCESSFULLY! (100% PASS)")
    print("==========================================")


if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print("Test failed with error:", e)
        sys.exit(1)

