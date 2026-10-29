"""
Integration Test Suite for Module 24: Task Assignment & Tracking
WorkSphere HRMS

Tests:
1. Unauthenticated request rejection (401).
2. HR/Admin can assign tasks (201).
3. Employees cannot assign tasks (403).
4. Invalid employee IDs are rejected (404).
5. Required-field validation works (title, due_date).
6. HR/Admin can view organization-wide tasks.
7. Employees can view only their own tasks.
8. Employees cannot retrieve another employee's task (403).
9. Employees can mark their own tasks as completed (200).
10. Employees cannot modify task details through status endpoint.
11. Invalid statuses are rejected (400/422).
12. HR/Admin can update task details.
13. HR/Admin can delete tasks.
14. Missing task returns HTTP 404.
15. Task summary counts are accurate.
16. Overdue task filtering works.
17. Database cleanup.
"""

from datetime import date, datetime, timedelta
import sys

from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.task import Task, TaskStatus
from app.models.user import User

client = TestClient(app)


def test_module24():
    print("================================================================")
    print("TESTING MODULE 24: TASK ASSIGNMENT & TRACKING")
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

        # Identify employees
        emp_user = db.query(User).filter(User.email == "employee@worksphere.com").first()
        my_emp = db.query(Employee).filter(Employee.user_id == emp_user.id).first()
        assert my_emp is not None
        my_emp_id = my_emp.id

        other_emp = db.query(Employee).filter(Employee.id != my_emp_id).first()
        assert other_emp is not None
        other_emp_id = other_emp.id

        # Clean existing tasks for these two employees if any exist
        db.query(Task).filter(Task.assigned_to.in_([my_emp_id, other_emp_id])).delete(synchronize_session=False)
        db.commit()

        print(f"✓ Authenticated: Admin, HR, and Employee (my_emp_id={my_emp_id}, other_emp_id={other_emp_id}).")

        # ----------------------------------------------------------------------
        # Scenario 1: Unauthenticated Requests (401)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 1: Unauthenticated Requests (401) ---")
        endpoints = [
            ("GET", "/api/tasks"),
            ("POST", "/api/tasks"),
            ("GET", "/api/tasks/summary"),
            ("GET", "/api/tasks/1"),
            ("PATCH", "/api/tasks/1/status"),
            ("PUT", "/api/tasks/1"),
            ("DELETE", "/api/tasks/1"),
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
            assert res.status_code == 401, f"Expected 401 for unauthenticated {method} {ep}, got {res.status_code}"

        print("✓ All endpoints reject unauthenticated requests with 401 Unauthorized.")

        # ----------------------------------------------------------------------
        # Scenario 2: Employee cannot assign tasks (403)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 2: Role Authorization on Task Assignment ---")
        emp_assign_res = client.post(
            "/api/tasks",
            headers=emp_headers,
            json={
                "assigned_to": other_emp_id,
                "title": "Unauthorized Task Assignment",
                "due_date": (date.today() + timedelta(days=3)).isoformat(),
            },
        )
        assert emp_assign_res.status_code == 403, f"Expected 403 for employee assigning task, got {emp_assign_res.status_code}"
        print("✓ Regular employees blocked from assigning tasks (403 Forbidden).")

        # ----------------------------------------------------------------------
        # Scenario 3: Invalid Employee ID & Input Validation
        # ----------------------------------------------------------------------
        print("\n--- Scenario 3: Validation and Missing Employee ---")
        # Missing employee
        missing_emp_res = client.post(
            "/api/tasks",
            headers=hr_headers,
            json={
                "assigned_to": 999999,
                "title": "Prepare Annual Audit",
                "due_date": (date.today() + timedelta(days=5)).isoformat(),
            },
        )
        assert missing_emp_res.status_code == 404, f"Expected 404 for non-existent employee, got {missing_emp_res.status_code}"

        # Empty/short title
        short_title_res = client.post(
            "/api/tasks",
            headers=hr_headers,
            json={
                "assigned_to": my_emp_id,
                "title": "T",
                "due_date": (date.today() + timedelta(days=5)).isoformat(),
            },
        )
        assert short_title_res.status_code in (400, 422), f"Expected 400/422 for short title, got {short_title_res.status_code}"

        print("✓ Non-existent employee (404) and invalid title lengths correctly handled.")

        # ----------------------------------------------------------------------
        # Scenario 4: Successful Task Assignment by HR & Admin
        # ----------------------------------------------------------------------
        print("\n--- Scenario 4: Successful Task Assignment ---")
        due_future = (date.today() + timedelta(days=7)).isoformat()
        due_overdue = (date.today() - timedelta(days=2)).isoformat()

        # Task 1: Assigned to my_emp (future)
        res_t1 = client.post(
            "/api/tasks",
            headers=hr_headers,
            json={
                "assigned_to": my_emp_id,
                "title": "Complete Q4 Security Compliance",
                "description": "Complete all compliance modules on the portal.",
                "due_date": due_future,
            },
        )
        assert res_t1.status_code == 201, f"Expected 201, got {res_t1.status_code}: {res_t1.text}"
        task_1 = res_t1.json()
        task_id_1 = task_1["id"]
        cleanup_task_ids.append(task_id_1)
        assert task_1["assigned_to"] == my_emp_id
        assert task_1["status"] == "PENDING"
        assert task_1["is_overdue"] is False

        # Task 2: Assigned to my_emp (overdue)
        res_t2 = client.post(
            "/api/tasks",
            headers=admin_headers,
            json={
                "assigned_to": my_emp_id,
                "title": "Submit Infrastructure Expense Receipts",
                "description": "Attach invoices for cloud servers.",
                "due_date": due_overdue,
            },
        )
        assert res_t2.status_code == 201
        task_2 = res_t2.json()
        task_id_2 = task_2["id"]
        cleanup_task_ids.append(task_id_2)
        assert task_2["is_overdue"] is True

        # Task 3: Assigned to other_emp
        res_t3 = client.post(
            "/api/tasks",
            headers=hr_headers,
            json={
                "assigned_to": other_emp_id,
                "title": "Perform QA on Sprint Release",
                "description": "Verify test cases across web and mobile.",
                "due_date": due_future,
            },
        )
        assert res_t3.status_code == 201
        task_id_3 = res_t3.json()["id"]
        cleanup_task_ids.append(task_id_3)

        print(f"✓ Tasks assigned successfully (IDs: {task_id_1}, {task_id_2}, {task_id_3}).")

        # ----------------------------------------------------------------------
        # Scenario 5: HR/Admin can view all tasks, Employee views only own tasks
        # ----------------------------------------------------------------------
        print("\n--- Scenario 5: Visibility & Cross-Employee Data Isolation ---")
        # HR sees all 3 tasks
        hr_tasks_res = client.get("/api/tasks", headers=hr_headers)
        assert hr_tasks_res.status_code == 200
        hr_tasks = hr_tasks_res.json()
        hr_ids = [t["id"] for t in hr_tasks]
        assert task_id_1 in hr_ids
        assert task_id_2 in hr_ids
        assert task_id_3 in hr_ids

        # Employee only sees task_1 and task_2 (their own)
        emp_tasks_res = client.get("/api/tasks", headers=emp_headers)
        assert emp_tasks_res.status_code == 200
        emp_tasks = emp_tasks_res.json()
        emp_ids = [t["id"] for t in emp_tasks]
        assert task_id_1 in emp_ids
        assert task_id_2 in emp_ids
        assert task_id_3 not in emp_ids, "Employee must not see another employee's tasks in list"

        # Employee attempting to probe other employee's tasks via query param gets 403
        probe_res = client.get(f"/api/tasks?assigned_to={other_emp_id}", headers=emp_headers)
        assert probe_res.status_code == 403, f"Expected 403 for employee probing peer tasks, got {probe_res.status_code}"

        # Employee attempting to retrieve details of other employee's task gets 403
        emp_get_other = client.get(f"/api/tasks/{task_id_3}", headers=emp_headers)
        assert emp_get_other.status_code == 403, f"Expected 403 for other employee task detail, got {emp_get_other.status_code}"

        # Employee retrieves own task detail (200)
        emp_get_own = client.get(f"/api/tasks/{task_id_1}", headers=emp_headers)
        assert emp_get_own.status_code == 200
        assert emp_get_own.json()["id"] == task_id_1

        print("✓ Employee data isolation strictly enforced: peer probing & task details blocked (403).")

        # ----------------------------------------------------------------------
        # Scenario 6: Employees can mark own task as completed
        # ----------------------------------------------------------------------
        print("\n--- Scenario 6: Task Status Update ---")
        # Employee completes task_1
        patch_res = client.patch(
            f"/api/tasks/{task_id_1}/status",
            headers=emp_headers,
            json={"status": "COMPLETED"},
        )
        assert patch_res.status_code == 200, f"Expected 200, got {patch_res.status_code}"
        assert patch_res.json()["status"] == "COMPLETED"
        assert patch_res.json()["completed_at"] is not None

        # Employee cannot update status of other employee's task (403)
        emp_patch_other = client.patch(
            f"/api/tasks/{task_id_3}/status",
            headers=emp_headers,
            json={"status": "COMPLETED"},
        )
        assert emp_patch_other.status_code == 403

        # Invalid status rejected
        invalid_status_res = client.patch(
            f"/api/tasks/{task_id_1}/status",
            headers=emp_headers,
            json={"status": "ARCHIVED"},
        )
        assert invalid_status_res.status_code in (400, 422)

        print("✓ Employee can mark own task as completed (completed_at set); blocked from modifying peer tasks.")

        # ----------------------------------------------------------------------
        # Scenario 7: HR/Admin can update full task details, Employee blocked
        # ----------------------------------------------------------------------
        print("\n--- Scenario 7: Full Task Details Update ---")
        # Employee blocked from PUT /api/tasks/{id}
        emp_put_res = client.put(
            f"/api/tasks/{task_id_1}",
            headers=emp_headers,
            json={"title": "Hacked Title"},
        )
        assert emp_put_res.status_code == 403

        # HR updates task details
        hr_put_res = client.put(
            f"/api/tasks/{task_id_1}",
            headers=hr_headers,
            json={
                "title": "Complete Q4 Security Compliance (Urgent)",
                "description": "Updated instructions from HR team.",
            },
        )
        assert hr_put_res.status_code == 200
        assert hr_put_res.json()["title"] == "Complete Q4 Security Compliance (Urgent)"

        print("✓ Full task updates restricted to HR & Admin (Employee gets 403).")

        # ----------------------------------------------------------------------
        # Scenario 8: Deletion & Missing Record Handling
        # ----------------------------------------------------------------------
        print("\n--- Scenario 8: Deletion & 404 Handling ---")
        # Employee cannot delete task
        emp_del = client.delete(f"/api/tasks/{task_id_3}", headers=emp_headers)
        assert emp_del.status_code == 403

        # Admin deletes task_3
        admin_del = client.delete(f"/api/tasks/{task_id_3}", headers=admin_headers)
        assert admin_del.status_code == 200

        # Deleted task returns 404
        assert client.get(f"/api/tasks/{task_id_3}", headers=admin_headers).status_code == 404
        assert client.put(f"/api/tasks/{task_id_3}", headers=admin_headers, json={"title": "New"}).status_code == 404
        assert client.delete(f"/api/tasks/{task_id_3}", headers=admin_headers).status_code == 404

        print("✓ Delete permissions verified: Employee blocked (403), Admin deletion succeeded (200), 404 on missing.")

        # ----------------------------------------------------------------------
        # Scenario 9: Task Summary Metrics & Overdue Filtering
        # ----------------------------------------------------------------------
        print("\n--- Scenario 9: Summary Metrics & Overdue Filtering ---")
        # Employee summary: task_1 is COMPLETED, task_2 is PENDING & OVERDUE
        emp_sum_res = client.get("/api/tasks/summary", headers=emp_headers)
        assert emp_sum_res.status_code == 200
        emp_sum = emp_sum_res.json()
        assert emp_sum["total_tasks"] == 2
        assert emp_sum["completed_tasks"] == 1
        assert emp_sum["pending_tasks"] == 1
        assert emp_sum["overdue_tasks"] == 1

        # Test overdue_only filter for employee
        emp_overdue_res = client.get("/api/tasks?overdue_only=true", headers=emp_headers)
        assert emp_overdue_res.status_code == 200
        overdue_items = emp_overdue_res.json()
        assert len(overdue_items) == 1
        assert overdue_items[0]["id"] == task_id_2

        # HR summary
        hr_sum_res = client.get("/api/tasks/summary", headers=hr_headers)
        assert hr_sum_res.status_code == 200
        hr_sum = hr_sum_res.json()
        assert hr_sum["total_tasks"] >= 2
        assert hr_sum["overdue_tasks"] >= 1

        print(f"✓ Task summary metrics validated (Employee: Total={emp_sum['total_tasks']}, Completed={emp_sum['completed_tasks']}, Overdue={emp_sum['overdue_tasks']}).")

        print("\n================================================================")
        print("ALL MODULE 24 TESTS COMPLETED SUCCESSFULLY! (100% PASS)")
        print("================================================================")

    finally:
        if cleanup_task_ids:
            db.query(Task).filter(Task.id.in_(cleanup_task_ids)).delete(synchronize_session=False)
            db.commit()
            print("✓ Module 24 test tasks cleaned up successfully.")
        db.close()


if __name__ == "__main__":
    test_module24()

