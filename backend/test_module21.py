"""
Comprehensive Integration Test Suite for Module 21: Employee Onboarding System
WorkSphere HRMS

Tests:
1. Unauthenticated request rejection (401).
2. Role-based permissions for task creation (Employee blocked with 403, HR/Admin allowed with 201).
3. Input validation & missing records (non-existent employee 404, empty task name 422, non-existent task 404).
4. Creating and retrieving onboarding tasks (list, filter by employee, filter by status, filter overdue).
5. Employee access restrictions & cross-employee isolation (403 when employee probes another's tasks or progress).
6. Updating task status (Employee updates own task, Employee blocked from updating other's task 403, completed_at set).
7. Full task update & task deletion permissions (Employee blocked with 403, HR/Admin allowed).
8. Accurate onboarding progress calculations (total, completed, pending, overdue, percentage, is_completed).
9. Organization-level onboarding summary statistics.
10. Database cleanup.
"""

from datetime import date, datetime, timedelta
import sys

from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.onboarding import OnboardingTask, OnboardingTaskStatus
from app.models.user import User

client = TestClient(app)


def test_module21():
    print("================================================================")
    print("TESTING MODULE 21: EMPLOYEE ONBOARDING SYSTEM")
    print("================================================================")

    db = SessionLocal()
    cleanup_task_ids = []

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
        my_emp_id = my_employee.id

        other_employee = db.query(Employee).filter(Employee.id != my_emp_id).first()
        assert other_employee is not None, "A second employee profile must exist"
        other_emp_id = other_employee.id

        # Clean existing test tasks if any exist
        db.query(OnboardingTask).filter(
            OnboardingTask.employee_id.in_([my_emp_id, other_emp_id])
        ).delete(synchronize_session=False)
        db.commit()

        print(f"✓ Authenticated: Admin, HR, and Employee (my_emp_id={my_emp_id}, other_emp_id={other_emp_id})")

        # ----------------------------------------------------------------------
        # Scenario 1: Unauthenticated Requests (401)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 1: Unauthenticated Requests (401) ---")
        endpoints = [
            ("GET", "/api/onboarding"),
            ("POST", "/api/onboarding"),
            ("GET", "/api/onboarding/summary"),
            ("GET", "/api/onboarding/progress"),
            ("GET", f"/api/onboarding/employee/{my_emp_id}"),
            ("PATCH", "/api/onboarding/1/status"),
            ("PUT", "/api/onboarding/1"),
            ("DELETE", "/api/onboarding/1"),
        ]
        for method, ep in endpoints:
            if method == "GET":
                res = client.get(ep)
            elif method == "POST":
                res = client.post(ep, json={})
            elif method == "PATCH":
                res = client.patch(ep, json={})
            elif method == "PUT":
                res = client.put(ep, json={})
            elif method == "DELETE":
                res = client.delete(ep)
            assert res.status_code == 401, f"{method} {ep} should be 401, got {res.status_code}"
        print("✓ All endpoints strictly reject unauthenticated requests with 401.")

        # ----------------------------------------------------------------------
        # Scenario 2: Role-based Permissions for Task Creation
        # ----------------------------------------------------------------------
        print("\n--- Scenario 2: Role-based Permissions for Task Creation ---")
        today = date.today()
        task_payload = {
            "employee_id": my_emp_id,
            "task_name": "Submit Govt Identification & Tax Forms",
            "due_date": (today + timedelta(days=7)).isoformat(),
        }

        # Regular employee blocked from creating tasks (403)
        res_emp_create = client.post("/api/onboarding", json=task_payload, headers=emp_headers)
        assert res_emp_create.status_code == 403, f"Employee should be 403, got {res_emp_create.status_code}"

        # HR can create onboarding task (201)
        res_hr_create = client.post("/api/onboarding", json=task_payload, headers=hr_headers)
        assert res_hr_create.status_code == 201, f"HR create failed: {res_hr_create.text}"
        task_1 = res_hr_create.json()
        assert task_1["task_name"] == "Submit Govt Identification & Tax Forms"
        assert task_1["status"] == "PENDING"
        assert task_1["employee_id"] == my_emp_id
        cleanup_task_ids.append(task_1["id"])

        # Admin can create onboarding task (201)
        task_payload_2 = {
            "employee_id": my_emp_id,
            "task_name": "Complete Workstation & Security Setup",
            "due_date": (today + timedelta(days=3)).isoformat(),
        }
        res_admin_create = client.post("/api/onboarding", json=task_payload_2, headers=admin_headers)
        assert res_admin_create.status_code == 201
        task_2 = res_admin_create.json()
        cleanup_task_ids.append(task_2["id"])

        # Overdue task for employee (due 2 days ago)
        task_payload_overdue = {
            "employee_id": my_emp_id,
            "task_name": "Sign Employee Code of Conduct",
            "due_date": (today - timedelta(days=2)).isoformat(),
        }
        res_overdue_create = client.post("/api/onboarding", json=task_payload_overdue, headers=hr_headers)
        assert res_overdue_create.status_code == 201
        task_3 = res_overdue_create.json()
        assert task_3["is_overdue"] is True
        cleanup_task_ids.append(task_3["id"])

        # Task for other employee
        task_other = {
            "employee_id": other_emp_id,
            "task_name": "Initial Department Orientation",
            "due_date": (today + timedelta(days=5)).isoformat(),
        }
        res_other_create = client.post("/api/onboarding", json=task_other, headers=hr_headers)
        assert res_other_create.status_code == 201
        task_4 = res_other_create.json()
        cleanup_task_ids.append(task_4["id"])

        print("✓ Task creation permissions verified: Employee blocked (403), HR & Admin allowed (201).")

        # ----------------------------------------------------------------------
        # Scenario 3: Input Validation and Missing Records
        # ----------------------------------------------------------------------
        print("\n--- Scenario 3: Input Validation and Missing Records ---")
        # Non-existent employee ID
        r_bad_emp = client.post(
            "/api/onboarding",
            json={"employee_id": 999999, "task_name": "Test Task", "due_date": today.isoformat()},
            headers=hr_headers,
        )
        assert r_bad_emp.status_code == 404
        assert "not found" in r_bad_emp.json()["detail"].lower()

        # Empty task name
        r_empty_name = client.post(
            "/api/onboarding",
            json={"employee_id": my_emp_id, "task_name": "   ", "due_date": today.isoformat()},
            headers=hr_headers,
        )
        assert r_empty_name.status_code == 422

        # Non-existent task ID on get/update/delete
        r_bad_task = client.patch(
            "/api/onboarding/999999/status",
            json={"status": "COMPLETED"},
            headers=hr_headers,
        )
        assert r_bad_task.status_code == 404

        r_bad_del = client.delete("/api/onboarding/999999", headers=admin_headers)
        assert r_bad_del.status_code == 404
        print("✓ Input validation and 404/422 responses verified.")

        # ----------------------------------------------------------------------
        # Scenario 4: Retrieving Tasks & Filters
        # ----------------------------------------------------------------------
        print("\n--- Scenario 4: Retrieving Tasks & Filters ---")
        # HR lists all tasks
        r_all = client.get("/api/onboarding", headers=hr_headers)
        assert r_all.status_code == 200
        all_task_ids = [t["id"] for t in r_all.json()]
        assert task_1["id"] in all_task_ids
        assert task_4["id"] in all_task_ids

        # HR filters by employee_id
        r_filter_emp = client.get(f"/api/onboarding?employee_id={my_emp_id}", headers=hr_headers)
        assert r_filter_emp.status_code == 200
        emp_tasks = r_filter_emp.json()
        assert all(t["employee_id"] == my_emp_id for t in emp_tasks)

        # HR filters overdue tasks only
        r_overdue = client.get(f"/api/onboarding?overdue_only=true", headers=hr_headers)
        assert r_overdue.status_code == 200
        overdue_tasks = r_overdue.json()
        assert any(t["id"] == task_3["id"] for t in overdue_tasks)
        assert all(t["is_overdue"] is True for t in overdue_tasks)

        # Get tasks for specific employee endpoint
        r_emp_ep = client.get(f"/api/onboarding/employee/{my_emp_id}", headers=hr_headers)
        assert r_emp_ep.status_code == 200
        assert len(r_emp_ep.json()) >= 3
        print("✓ Task retrieval and filtering verified.")

        # ----------------------------------------------------------------------
        # Scenario 5: Employee Access Restrictions (Data Isolation)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 5: Employee Access Restrictions (Data Isolation) ---")
        # Employee retrieves their own tasks
        r_my_tasks = client.get("/api/onboarding", headers=emp_headers)
        assert r_my_tasks.status_code == 200
        my_tasks = r_my_tasks.json()
        # Must only see their own tasks
        assert all(t["employee_id"] == my_emp_id for t in my_tasks)
        assert not any(t["id"] == task_4["id"] for t in my_tasks)

        # Employee probing another employee's tasks -> 403 Forbidden
        r_probe_list = client.get(f"/api/onboarding?employee_id={other_emp_id}", headers=emp_headers)
        assert r_probe_list.status_code == 403

        r_probe_ep = client.get(f"/api/onboarding/employee/{other_emp_id}", headers=emp_headers)
        assert r_probe_ep.status_code == 403

        r_probe_prog = client.get(f"/api/onboarding/progress/{other_emp_id}", headers=emp_headers)
        assert r_probe_prog.status_code == 403

        r_probe_summary = client.get("/api/onboarding/summary", headers=emp_headers)
        assert r_probe_summary.status_code == 403

        r_probe_all_prog = client.get("/api/onboarding/progress/all", headers=emp_headers)
        assert r_probe_all_prog.status_code == 403
        print("✓ Employee access restrictions and cross-employee isolation strictly enforced (403).")

        # ----------------------------------------------------------------------
        # Scenario 6: Updating Task Status & Completed Timestamp
        # ----------------------------------------------------------------------
        print("\n--- Scenario 6: Updating Task Status & Completed Timestamp ---")
        # Employee marks their own task as COMPLETED
        r_status_comp = client.patch(
            f"/api/onboarding/{task_1['id']}/status",
            json={"status": "COMPLETED"},
            headers=emp_headers,
        )
        assert r_status_comp.status_code == 200
        res_comp_data = r_status_comp.json()
        assert res_comp_data["status"] == "COMPLETED"
        assert res_comp_data["completed_at"] is not None

        # Employee attempts to update status of another employee's task -> 403 Forbidden
        r_tamper_status = client.patch(
            f"/api/onboarding/{task_4['id']}/status",
            json={"status": "COMPLETED"},
            headers=emp_headers,
        )
        assert r_tamper_status.status_code == 403

        # Employee toggles task back to PENDING -> completed_at cleared
        r_status_pend = client.patch(
            f"/api/onboarding/{task_1['id']}/status",
            json={"status": "PENDING"},
            headers=emp_headers,
        )
        assert r_status_pend.status_code == 200
        assert r_status_pend.json()["status"] == "PENDING"
        assert r_status_pend.json()["completed_at"] is None

        # Re-complete task 1 for progress calculation
        client.patch(
            f"/api/onboarding/{task_1['id']}/status",
            json={"status": "COMPLETED"},
            headers=emp_headers,
        )
        print("✓ Status updates and completed_at transitions verified.")

        # ----------------------------------------------------------------------
        # Scenario 7: Full Task Details Update & Task Deletion
        # ----------------------------------------------------------------------
        print("\n--- Scenario 7: Full Task Details Update & Task Deletion ---")
        # Employee blocked from full update (403)
        r_emp_put = client.put(
            f"/api/onboarding/{task_2['id']}",
            json={"task_name": "Updated by Employee"},
            headers=emp_headers,
        )
        assert r_emp_put.status_code == 403

        # Employee blocked from deleting task (403)
        r_emp_del = client.delete(f"/api/onboarding/{task_2['id']}", headers=emp_headers)
        assert r_emp_del.status_code == 403

        # HR performs full task update (200)
        r_hr_put = client.put(
            f"/api/onboarding/{task_2['id']}",
            json={"task_name": "Complete Workstation & Biometrics Setup", "status": "COMPLETED"},
            headers=hr_headers,
        )
        assert r_hr_put.status_code == 200
        assert r_hr_put.json()["task_name"] == "Complete Workstation & Biometrics Setup"
        assert r_hr_put.json()["status"] == "COMPLETED"

        # Admin deletes a task
        # Create temp task to delete
        temp_task = client.post(
            "/api/onboarding",
            json={"employee_id": my_emp_id, "task_name": "Temporary Task", "due_date": today.isoformat()},
            headers=hr_headers,
        ).json()
        r_del = client.delete(f"/api/onboarding/{temp_task['id']}", headers=admin_headers)
        assert r_del.status_code == 200

        # Verifying deleted task is gone
        assert client.patch(f"/api/onboarding/{temp_task['id']}/status", json={"status": "COMPLETED"}, headers=hr_headers).status_code == 404
        print("✓ Task full update and deletion permissions verified.")

        # ----------------------------------------------------------------------
        # Scenario 8: Onboarding Progress Calculations
        # ----------------------------------------------------------------------
        print("\n--- Scenario 8: Onboarding Progress Calculations ---")
        # Currently for my_employee:
        # task_1 is COMPLETED
        # task_2 is COMPLETED
        # task_3 is PENDING (and overdue)
        # Total = 3, Completed = 2, Pending = 1, Overdue = 1 -> Progress = (2/3)*100 = 66.7%

        # Employee retrieves their own progress
        r_prog_me = client.get("/api/onboarding/progress", headers=emp_headers)
        assert r_prog_me.status_code == 200
        data_prog = r_prog_me.json()
        assert data_prog["employee_id"] == my_emp_id
        assert data_prog["total_tasks"] == 3
        assert data_prog["completed_tasks"] == 2
        assert data_prog["pending_tasks"] == 1
        assert data_prog["overdue_tasks"] == 1
        assert data_prog["progress_percentage"] == 66.7
        assert data_prog["is_completed"] is False

        # Complete task 3 -> 100.0% completion
        client.patch(f"/api/onboarding/{task_3['id']}/status", json={"status": "COMPLETED"}, headers=emp_headers)

        r_prog_100 = client.get(f"/api/onboarding/progress/{my_emp_id}", headers=hr_headers)
        assert r_prog_100.status_code == 200
        data_100 = r_prog_100.json()
        assert data_100["total_tasks"] == 3
        assert data_100["completed_tasks"] == 3
        assert data_100["pending_tasks"] == 0
        assert data_100["progress_percentage"] == 100.0
        assert data_100["is_completed"] is True

        # HR lists all employees progress
        r_all_prog = client.get("/api/onboarding/progress/all", headers=hr_headers)
        assert r_all_prog.status_code == 200
        prog_list = r_all_prog.json()
        assert len(prog_list) >= 2
        emp_ids_in_prog = [p["employee_id"] for p in prog_list]
        assert my_emp_id in emp_ids_in_prog
        print("✓ Progress calculations and 100% completion metrics verified.")

        # ----------------------------------------------------------------------
        # Scenario 9: Organization Summary Statistics
        # ----------------------------------------------------------------------
        print("\n--- Scenario 9: Organization Summary Statistics ---")
        r_summary = client.get("/api/onboarding/summary", headers=hr_headers)
        assert r_summary.status_code == 200
        summary_data = r_summary.json()
        assert summary_data["total_assigned_tasks"] >= 4
        assert summary_data["total_completed_tasks"] >= 3
        assert summary_data["employees_onboarding_count"] >= 2
        assert summary_data["overall_completion_rate"] > 0
        print(f"✓ Summary metrics verified: Total: {summary_data['total_assigned_tasks']}, Rate: {summary_data['overall_completion_rate']}%.")

        print("\n================================================================")
        print("ALL MODULE 21 TESTS COMPLETED SUCCESSFULLY! (100% PASS)")
        print("================================================================")

    finally:
        # Cleanup test records
        try:
            if cleanup_task_ids:
                db.query(OnboardingTask).filter(OnboardingTask.id.in_(cleanup_task_ids)).delete(synchronize_session=False)
                db.commit()
                print("✓ Module 21 test tasks cleaned up successfully.")
        except Exception as e:
            db.rollback()
            print(f"Cleanup error: {e}")
        finally:
            db.close()


if __name__ == "__main__":
    test_module21()

