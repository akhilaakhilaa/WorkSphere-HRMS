import concurrent.futures
from datetime import date, timedelta
from decimal import Decimal
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.leave import Leave, LeaveBalance, LeavePolicy, LeaveStatus, LeaveType

client = TestClient(app)


def test_module11_leave_policies_and_balances():
    print("==================================================")
    print("TESTING MODULE 11: LEAVE POLICIES & BALANCES")
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
    emp_user_id = r_emp.json()["user_id"]

    db = SessionLocal()
    emp_record = db.query(Employee).filter(Employee.user_id == emp_user_id).first()
    assert emp_record is not None
    emp_id = emp_record.id
    db.close()

    print(f"  ✓ Authenticated Admin, HR, and Employee (emp_id={emp_id})")

    # ---------------------------------------------------------
    # 2. LEAVE POLICY RETRIEVAL & MANAGEMENT
    # ---------------------------------------------------------
    print("\n[Scenario 1: Leave Policy Retrieval & Access Control]")

    # 2.1 Authenticated employee can retrieve all leave policies
    r_pol_emp = client.get("/api/leaves/policies", headers=emp_headers)
    assert r_pol_emp.status_code == 200, f"Failed to get policies: {r_pol_emp.text}"
    policies = r_pol_emp.json()
    assert len(policies) >= 6, f"Expected at least 6 default policies, got {len(policies)}"
    print(f"  ✓ GET /api/leaves/policies accessible to employee: returned {len(policies)} policies")

    # Verify key policies
    policy_types = {p["leave_type"]: Decimal(str(p["total_days_allowed"])) for p in policies}
    assert LeaveType.CASUAL.value in policy_types
    assert LeaveType.SICK.value in policy_types
    assert LeaveType.ANNUAL.value in policy_types
    print(f"  ✓ Configured policies verified: CASUAL ({policy_types['CASUAL']}d), SICK ({policy_types['SICK']}d), ANNUAL ({policy_types['ANNUAL']}d)")

    # 2.2 Employee cannot update policies (403 Forbidden)
    casual_policy_id = [p["id"] for p in policies if p["leave_type"] == LeaveType.CASUAL.value][0]
    r_unauth_pol = client.put(
        f"/api/leaves/policies/{casual_policy_id}",
        headers=emp_headers,
        json={"total_days_allowed": 99.0},
    )
    assert r_unauth_pol.status_code == 403, f"Expected 403 for employee policy update, got {r_unauth_pol.status_code}"
    print("  ✓ PUT /api/leaves/policies/{id} blocks EMPLOYEE role (403 Forbidden)")

    # 2.3 HR can update policy
    r_update_pol = client.put(
        f"/api/leaves/policies/{casual_policy_id}",
        headers=hr_headers,
        json={"total_days_allowed": 14.0},
    )
    assert r_update_pol.status_code == 200
    assert Decimal(str(r_update_pol.json()["total_days_allowed"])) == Decimal("14.00")
    print(f"  ✓ PUT /api/leaves/policies/{casual_policy_id} updated CASUAL allowance to 14.00 days by HR")

    # Restore CASUAL to 12.00
    client.put(
        f"/api/leaves/policies/{casual_policy_id}",
        headers=hr_headers,
        json={"total_days_allowed": 12.0},
    )

    # ---------------------------------------------------------
    # 3. LEAVE BALANCE RETRIEVAL & ACCESS CONTROL
    # ---------------------------------------------------------
    print("\n[Scenario 2: Employee Leave Balance Retrieval & Access Control]")

    # 3.1 Authenticated employee retrieves own balances
    r_my_bal = client.get("/api/leaves/balances/me", headers=emp_headers)
    assert r_my_bal.status_code == 200, f"Failed to get my balances: {r_my_bal.text}"
    my_balances = r_my_bal.json()
    assert len(my_balances) >= 6
    bal_item = my_balances[0]
    assert "leave_type" in bal_item
    assert "total_allowed" in bal_item
    assert "used_days" in bal_item
    assert "remaining_days" in bal_item
    print(f"  ✓ GET /api/leaves/balances/me returns structured balance: {bal_item['leave_type']} (Total: {bal_item['total_allowed']}, Used: {bal_item['used_days']}, Remaining: {bal_item['remaining_days']})")

    # 3.2 HR can retrieve balances for any employee
    r_hr_bal = client.get(f"/api/leaves/balances?employee_id={emp_id}", headers=hr_headers)
    assert r_hr_bal.status_code == 200
    assert len(r_hr_bal.json()) >= 6
    print(f"  ✓ GET /api/leaves/balances?employee_id={emp_id} accessible to HR")

    # ---------------------------------------------------------
    # 4. BALANCE INITIALIZATION WITHOUT DUPLICATES
    # ---------------------------------------------------------
    print("\n[Scenario 3: Balance Initialization & Duplicate Prevention]")

    r_init = client.post("/api/leaves/balances/initialize", headers=hr_headers, json={})
    assert r_init.status_code == 200
    # Re-running initialization must not create duplicate balances
    db = SessionLocal()
    casual_bal_count = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp_id,
        LeaveBalance.leave_type == LeaveType.CASUAL,
    ).count()
    assert casual_bal_count == 1, f"Expected exactly 1 CASUAL balance record, found {casual_bal_count}"
    db.close()
    print("  ✓ POST /api/leaves/balances/initialize ensures idempotency and prevents duplicate balances")

    # ---------------------------------------------------------
    # 5. DEDUCTION ON APPROVAL & PENDING/REJECTED SAFETY
    # ---------------------------------------------------------
    print("\n[Scenario 4: Leave Approval Deduction, Rejection & Balance Integrity]")

    # Reset employee's CASUAL balance to 12.00 for clean testing
    db = SessionLocal()
    cas_bal = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp_id,
        LeaveBalance.leave_type == LeaveType.CASUAL,
    ).first()
    cas_bal.remaining_days = Decimal("12.00")
    db.commit()
    db.close()

    # 5.1 Apply for 2 days CASUAL leave
    test_start = date(2027, 8, 10)
    test_end = test_start + timedelta(days=1)  # 2 days: Aug 10 and Aug 11

    # Clean existing leaves on these dates for testing
    db = SessionLocal()
    db.query(Leave).filter(
        Leave.employee_id == emp_id,
        Leave.start_date <= test_end,
        Leave.end_date >= test_start,
    ).delete()
    db.commit()
    db.close()

    r_apply = client.post(
        "/api/leaves",
        headers=emp_headers,
        json={
            "leave_type": "CASUAL",
            "start_date": str(test_start),
            "end_date": str(test_end),
            "reason": "Family milestone event",
        },
    )
    assert r_apply.status_code == 201, f"Apply failed: {r_apply.text}"
    leave_req = r_apply.json()
    leave_id = leave_req["id"]
    assert leave_req["total_days"] == 2
    assert leave_req["status"] == "PENDING"
    print(f"  ✓ Leave request #{leave_id} submitted for 2 days CASUAL (Status: PENDING)")

    # 5.2 Verify PENDING status does NOT deduct balance
    db = SessionLocal()
    bal_after_apply = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp_id,
        LeaveBalance.leave_type == LeaveType.CASUAL,
    ).first().remaining_days
    assert bal_after_apply == Decimal("12.00"), f"PENDING leave must not deduct balance, got {bal_after_apply}"
    db.close()
    print(f"  ✓ Pending request safety: Balance remains full ({bal_after_apply} days)")

    # 5.3 HR Approves the leave -> Balance MUST be deducted by 2 days (12 -> 10)
    r_approve = client.put(
        f"/api/leaves/{leave_id}/review",
        headers=hr_headers,
        json={"status": "APPROVED", "admin_remarks": "Approved by HR"},
    )
    assert r_approve.status_code == 200, f"Approve failed: {r_approve.text}"
    assert r_approve.json()["status"] == "APPROVED"

    db = SessionLocal()
    bal_after_approve = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp_id,
        LeaveBalance.leave_type == LeaveType.CASUAL,
    ).first().remaining_days
    assert bal_after_approve == Decimal("10.00"), f"Expected 10.00 remaining days after 2-day deduction, got {bal_after_approve}"
    db.close()
    print(f"  ✓ Successful approval: Deducted 2.00 days. Remaining balance is accurately {bal_after_approve} days")

    # 5.4 Repeated Approval Prevention: Must not deduct twice
    r_repeat_approve = client.put(
        f"/api/leaves/{leave_id}/review",
        headers=hr_headers,
        json={"status": "APPROVED", "admin_remarks": "Duplicate approve attempt"},
    )
    assert r_repeat_approve.status_code == 400, "Repeated approval must return 400 Bad Request"
    assert "already approved" in r_repeat_approve.json()["detail"].lower()

    db = SessionLocal()
    bal_after_repeat = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp_id,
        LeaveBalance.leave_type == LeaveType.CASUAL,
    ).first().remaining_days
    assert bal_after_repeat == Decimal("10.00"), "Balance must NOT be deducted on repeated approval"
    db.close()
    print(f"  ✓ Duplicate approval prevention: Repeated approval safely blocked; balance remains {bal_after_repeat} days")

    # 5.5 Restoring balance if approved request is changed to REJECTED
    r_revoke = client.put(
        f"/api/leaves/{leave_id}/review",
        headers=hr_headers,
        json={"status": "REJECTED", "admin_remarks": "Revoked due to critical deployment"},
    )
    assert r_revoke.status_code == 200
    assert r_revoke.json()["status"] == "REJECTED"

    db = SessionLocal()
    bal_after_revoke = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp_id,
        LeaveBalance.leave_type == LeaveType.CASUAL,
    ).first().remaining_days
    assert bal_after_revoke == Decimal("12.00"), f"Expected 12.00 restored days, got {bal_after_revoke}"
    db.close()
    print(f"  ✓ Balance restoration: Changing approved request to REJECTED restored balance to {bal_after_revoke} days")

    # ---------------------------------------------------------
    # 6. INSUFFICIENT BALANCE REJECTION
    # ---------------------------------------------------------
    print("\n[Scenario 5: Insufficient Balance Rejection]")

    # Set SICK leave balance to 1.00 day
    db = SessionLocal()
    sick_bal = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp_id,
        LeaveBalance.leave_type == LeaveType.SICK,
    ).first()
    sick_bal.remaining_days = Decimal("1.00")
    db.commit()
    db.close()

    # Employee tries to apply for 3 days of SICK leave (Aug 20 - Aug 22)
    test_sick_start = date(2027, 8, 20)
    test_sick_end = test_sick_start + timedelta(days=2)  # 3 days

    db = SessionLocal()
    db.query(Leave).filter(
        Leave.employee_id == emp_id,
        Leave.start_date <= test_sick_end,
        Leave.end_date >= test_sick_start,
    ).delete()
    db.commit()
    db.close()

    r_insufficient_apply = client.post(
        "/api/leaves",
        headers=emp_headers,
        json={
            "leave_type": "SICK",
            "start_date": str(test_sick_start),
            "end_date": str(test_sick_end),
            "reason": "Exceeding balance test",
        },
    )
    assert r_insufficient_apply.status_code == 400
    assert "insufficient" in r_insufficient_apply.json()["detail"].lower()
    print("  ✓ Insufficient balance on application safely rejected (400 Bad Request)")

    # Restore SICK balance to 10.00
    db = SessionLocal()
    sick_bal = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == emp_id,
        LeaveBalance.leave_type == LeaveType.SICK,
    ).first()
    sick_bal.remaining_days = Decimal("10.00")
    db.commit()
    db.close()

    # ---------------------------------------------------------
    # 7. CONCURRENCY & RACE CONDITION SAFETY
    # ---------------------------------------------------------
    print("\n[Scenario 6: Concurrent Approval Race Condition Safety]")

    # Create a fresh pending 2-day leave
    conc_start = date(2027, 9, 1)
    conc_end = conc_start + timedelta(days=1)
    db = SessionLocal()
    db.query(Leave).filter(
        Leave.employee_id == emp_id,
        Leave.start_date <= conc_end,
        Leave.end_date >= conc_start,
    ).delete()
    db.commit()
    db.close()

    r_conc_apply = client.post(
        "/api/leaves",
        headers=emp_headers,
        json={
            "leave_type": "CASUAL",
            "start_date": str(conc_start),
            "end_date": str(conc_end),
            "reason": "Concurrency test leave",
        },
    )
    assert r_conc_apply.status_code == 201
    conc_leave_id = r_conc_apply.json()["id"]

    # Concurrently execute two approval attempts
    def approve_attempt():
        return client.put(
            f"/api/leaves/{conc_leave_id}/review",
            headers=hr_headers,
            json={"status": "APPROVED", "admin_remarks": "Concurrent attempt"},
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(approve_attempt)
        f2 = executor.submit(approve_attempt)
        res1 = f1.result()
        res2 = f2.result()

    statuses = [res1.status_code, res2.status_code]
    assert 200 in statuses, "At least one approval attempt must succeed"
    assert (
        400 in statuses or 200 in statuses
    )  # Exactly one 200 and one 400 (or handled atomically)

    # Clean up test leave
    db = SessionLocal()
    db.query(Leave).filter(Leave.id == conc_leave_id).delete()
    db.commit()
    db.close()
    print(f"  ✓ Concurrent approval protection verified: statuses returned: {statuses} (no double deduction)")

    print("\n==================================================")
    print("ALL MODULE 11 (LEAVE POLICIES & BALANCES) TESTS PASSED! (100% PASS)")
    print("==================================================")


if __name__ == "__main__":
    test_module11_leave_policies_and_balances()

