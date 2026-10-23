import sys
from datetime import date, timedelta
from decimal import Decimal
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.payroll import PaymentStatus, Payroll

client = TestClient(app)


def test_batch2():
    print("==================================================")
    print("TESTING BATCH 2: MODULES 4, 5, AND 6")
    print("==================================================")

    # 1. Login to obtain tokens for all roles
    r_admin = client.post("/api/auth/login", json={"email": "admin@worksphere.com", "password": "Admin@123"})
    assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]

    r_hr = client.post("/api/auth/login", json={"email": "hr@worksphere.com", "password": "Hr@123"})
    assert r_hr.status_code == 200, f"HR login failed: {r_hr.text}"
    hr_token = r_hr.json()["access_token"]

    r_emp = client.post("/api/auth/login", json={"email": "employee@worksphere.com", "password": "Employee@123"})
    assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
    emp_token = r_emp.json()["access_token"]
    emp_id = r_emp.json()["employee_id"]

    # ---------------------------------------------------------
    # MODULE 4: LEAVE MANAGEMENT
    # ---------------------------------------------------------
    print("\n[Module 4: Leave Management Tests]")

    # 4.1 Date Validation: end_date < start_date must fail (400 or 422)
    today = date.today()
    r_invalid_dates = client.post(
        "/api/leaves",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={
            "leave_type": "CASUAL",
            "start_date": str(today + timedelta(days=20)),
            "end_date": str(today + timedelta(days=15)),  # earlier than start!
            "reason": "Invalid dates test",
        },
    )
    assert r_invalid_dates.status_code in [400, 422], f"Expected 400/422 for end_date < start_date, got {r_invalid_dates.status_code}"
    print("  ✓ POST /api/leaves rejects invalid date range (end_date < start_date)")

    # 4.2 Valid Leave Application (Dynamic future date to avoid overlapping on repeated runs)
    db = SessionLocal()
    from sqlalchemy import func
    from app.models.leave import LeaveBalance
    ann_bal = db.query(LeaveBalance).filter(LeaveBalance.employee_id == emp_id, LeaveBalance.leave_type == LeaveType.ANNUAL).first()
    if ann_bal and ann_bal.remaining_days < Decimal("3.00"):
        ann_bal.remaining_days = Decimal("15.00")
        db.commit()
    max_leave_date = db.query(func.max(Leave.end_date)).filter(Leave.employee_id == emp_id).scalar()
    db.close()
    base_ref = max_leave_date if (max_leave_date and max_leave_date > today) else today
    target_start = base_ref + timedelta(days=5)
    target_end = target_start + timedelta(days=2)

    r_apply = client.post(
        "/api/leaves",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={
            "leave_type": "ANNUAL",
            "start_date": str(target_start),
            "end_date": str(target_end),
            "reason": "Family road trip vacation",
        },
    )
    assert r_apply.status_code == 201, f"Leave application failed: {r_apply.text}"
    leave_data = r_apply.json()
    new_leave_id = leave_data["id"]
    assert leave_data["status"] == "PENDING"
    assert leave_data["total_days"] == 3
    print(f"  ✓ POST /api/leaves successfully submitted (ID: {new_leave_id}, 3 days, PENDING)")

    # 4.3 Overlapping Leave Application Rejected
    r_overlap = client.post(
        "/api/leaves",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={
            "leave_type": "SICK",
            "start_date": str(target_start),
            "end_date": str(target_end),
            "reason": "Overlapping request",
        },
    )
    assert r_overlap.status_code == 400
    print("  ✓ POST /api/leaves prevents overlapping leave applications (400 Bad Request)")

    # 4.4 Employee Views Own History
    r_my_history = client.get("/api/leaves/my-history", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_my_history.status_code == 200
    my_leaves = r_my_history.json()
    assert len(my_leaves) >= 1
    assert any(l["id"] == new_leave_id for l in my_leaves)
    print(f"  ✓ GET /api/leaves/my-history returns {len(my_leaves)} records")

    # 4.5 Employee Leave Summary
    r_summary = client.get("/api/leaves/summary", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_summary.status_code == 200
    sum_data = r_summary.json()
    assert sum_data["total_requests"] >= 1
    print(f"  ✓ GET /api/leaves/summary returns metrics (Pending: {sum_data['pending']}, Approved: {sum_data['approved']})")

    # 4.6 Employee CANNOT review/approve leaves (403 Forbidden)
    r_unauth_review = client.put(
        f"/api/leaves/{new_leave_id}/review",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={"status": "APPROVED", "admin_remarks": "Hacked approval"},
    )
    assert r_unauth_review.status_code == 403
    print("  ✓ PUT /api/leaves/{id}/review blocks EMPLOYEE role (403 Forbidden)")

    # 4.7 HR Reviews and Approves Leave
    r_approve = client.put(
        f"/api/leaves/{new_leave_id}/review",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"status": "APPROVED", "admin_remarks": "Approved by HR Manager. Enjoy your vacation!"},
    )
    assert r_approve.status_code == 200
    assert r_approve.json()["status"] == "APPROVED"
    assert r_approve.json()["reviewed_by"] is not None
    print(f"  ✓ PUT /api/leaves/{new_leave_id}/review allows HR to approve leave")

    # 4.8 Organization Leaves Roster (HR / Admin)
    r_org_leaves = client.get("/api/leaves", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_org_leaves.status_code == 200
    all_leaves = r_org_leaves.json()
    assert len(all_leaves) >= 1
    print(f"  ✓ GET /api/leaves returns organization roster ({len(all_leaves)} leave records)")

    # ---------------------------------------------------------
    # MODULE 5: PAYROLL MANAGEMENT
    # ---------------------------------------------------------
    print("\n[Module 5: Payroll Management Tests]")

    # 5.1 Non-authorized cannot generate payroll
    r_emp_pay_gen = client.post(
        "/api/payroll/generate",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={"month": 11, "year": 2026},
    )
    assert r_emp_pay_gen.status_code == 403
    print("  ✓ POST /api/payroll/generate blocks EMPLOYEE role (403 Forbidden)")

    # 5.2 HR Generates Payroll for Month 11, 2026
    r_pay_gen = client.post(
        "/api/payroll/generate",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"month": 11, "year": 2026},
    )
    assert r_pay_gen.status_code == 201
    payrolls_gen = r_pay_gen.json()
    assert len(payrolls_gen) >= 1
    sample_payroll = payrolls_gen[0]
    p_id = sample_payroll["id"]
    print(f"  ✓ POST /api/payroll/generate successfully created payrolls for {len(payrolls_gen)} active employees")

    # 5.3 Verify Net Salary Formula
    # net_salary = base_salary + allowances + bonuses - deductions - tax_deduction
    base = Decimal(str(sample_payroll["base_salary"]))
    allow = Decimal(str(sample_payroll["allowances"]))
    bonus = Decimal(str(sample_payroll["bonuses"]))
    deduct = Decimal(str(sample_payroll["deductions"]))
    tax = Decimal(str(sample_payroll["tax_deduction"]))
    expected_net = base + allow + bonus - (deduct + tax)
    actual_net = Decimal(str(sample_payroll["net_salary"]))
    assert actual_net == expected_net, f"Net salary mismatch: expected {expected_net}, got {actual_net}"
    print(f"  ✓ Net salary formula verified: Base (${base}) - Tax (${tax}) = Net (${actual_net})")

    # 5.4 Update Payroll Components (Add Bonus and Deductions)
    r_update_pay = client.put(
        f"/api/payroll/{p_id}",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"bonuses": 750.0, "deductions": 200.0, "notes": "Q4 Performance Bonus added"},
    )
    assert r_update_pay.status_code == 200
    upd_data = r_update_pay.json()
    assert float(upd_data["bonuses"]) == 750.0
    assert float(upd_data["deductions"]) == 200.0
    # Net salary must automatically recalculate
    recalc_net = base + Decimal("750.00") - Decimal("200.00") - tax
    assert Decimal(str(upd_data["net_salary"])) == recalc_net
    print(f"  ✓ PUT /api/payroll/{p_id} updates bonuses/deductions and correctly recalculates net salary (${recalc_net})")

    # 5.5 Mark Payroll as PAID
    r_pay = client.put(
        f"/api/payroll/{p_id}/pay?payment_method=DIRECT_DEPOSIT",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_pay.status_code == 200
    paid_data = r_pay.json()
    assert paid_data["payment_status"] == "PAID"
    assert paid_data["payment_date"] is not None
    assert paid_data["payment_method"] == "DIRECT_DEPOSIT"
    print(f"  ✓ PUT /api/payroll/{p_id}/pay marks status as PAID with date and method")

    # 5.6 Employee Views Own Payroll History
    r_my_pay = client.get("/api/payroll/my-history", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_my_pay.status_code == 200
    my_payrolls = r_my_pay.json()
    assert len(my_payrolls) >= 1
    print(f"  ✓ GET /api/payroll/my-history returns {len(my_payrolls)} payslips for current employee")

    # 5.7 Payroll Summary Metrics
    r_pay_summary = client.get("/api/payroll/summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_pay_summary.status_code == 200
    pay_sum = r_pay_summary.json()
    assert pay_sum["total_payrolls"] >= 1
    assert pay_sum["paid_count"] >= 1
    print(f"  ✓ GET /api/payroll/summary returns metrics (Total: {pay_sum['total_payrolls']}, Paid: {pay_sum['paid_count']})")

    # ---------------------------------------------------------
    # MODULE 6: DASHBOARD & ANALYTICS
    # ---------------------------------------------------------
    print("\n[Module 6: Dashboard & Analytics Tests]")

    # 6.1 Employee Personal Dashboard
    r_my_dash = client.get("/api/dashboard/my-stats", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_my_dash.status_code == 200
    dash_emp = r_my_dash.json()
    assert dash_emp["full_name"] == "Alex Mercer"
    assert "attendance_stats" in dash_emp
    assert "leave_stats" in dash_emp
    print("  ✓ GET /api/dashboard/my-stats returns personalized employee metrics")

    # 6.2 Executive Organization Dashboard & Analytics (Admin/HR)
    r_exec_dash = client.get("/api/dashboard/analytics", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_exec_dash.status_code == 200
    analytics = r_exec_dash.json()
    kpis = analytics["kpis"]
    assert kpis["total_employees"] >= 7
    assert kpis["active_employees"] >= 7
    assert kpis["departments_count"] >= 4
    assert "today_attendance" in kpis
    assert "leaves_kpi" in kpis
    assert "payroll_kpi" in kpis
    assert len(analytics["department_distribution"]) >= 1
    assert len(analytics["monthly_payroll_trend"]) >= 1
    assert len(analytics["recent_activities"]) >= 1
    print(f"  ✓ GET /api/dashboard/analytics returns executive KPIs and analytics:")
    print(f"      - Total Staff: {kpis['total_employees']} across {kpis['departments_count']} departments")
    print(f"      - Leave Approvals Pending: {kpis['leaves_kpi']['pending_approvals']}")
    print(f"      - Payroll Payout: ${float(kpis['payroll_kpi']['total_payout']):,.2f}")
    print(f"      - Recent activities logged: {len(analytics['recent_activities'])}")

    # 6.3 Notifications Retrieval (Notifications-ready)
    r_notifs = client.get("/api/dashboard/notifications", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_notifs.status_code == 200
    notifs_list = r_notifs.json()
    print(f"  ✓ GET /api/dashboard/notifications returns {len(notifs_list)} user notifications")

    print("\n==================================================")
    print("ALL BATCH 2 BACKEND INTEGRATION TESTS PASSED (100% PASS)")
    print("==================================================")


if __name__ == "__main__":
    try:
        test_batch2()
    except Exception as e:
        print("Batch 2 tests failed:", e)
        sys.exit(1)
