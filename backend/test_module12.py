import sys
from datetime import date
from decimal import Decimal
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.employee import Employee
from app.models.payroll import PaymentMethod, PaymentStatus, Payroll

client = TestClient(app)


def test_module12():
    print("==================================================")
    print("TESTING MODULE 12: PAYROLL ENHANCEMENTS")
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
    print("  ✓ Authenticated Admin, HR, and Employee test accounts")

    # ---------------------------------------------------------
    # SCENARIO 1: DETAILED SALARY BREAKDOWN & CALCULATIONS
    # ---------------------------------------------------------
    print("\n[Scenario 1: Detailed Salary Breakdown & Calculations]")
    # Generate payroll for Month 12, 2026 if not already generated
    r_gen = client.post(
        "/api/payroll/generate",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"month": 12, "year": 2026},
    )
    assert r_gen.status_code in [200, 201], f"Generation failed: {r_gen.text}"
    gen_list = r_gen.json()
    assert len(gen_list) >= 1

    # Find the employee's payroll record
    emp_payroll = next((p for p in gen_list if p["employee_id"] == emp_id), None)
    assert emp_payroll is not None, "Employee payroll record not found in generated batch"
    p_id = emp_payroll["id"]

    # Update payroll with individual allowance and deduction components:
    # HRA: 1000.00, Transport: 300.00, Medical: 200.00, Bonus: 500.00, PF: 400.00
    r_upd = client.put(
        f"/api/payroll/{p_id}",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={
            "hra": 1000.00,
            "transport_allowance": 300.00,
            "medical_allowance": 200.00,
            "bonuses": 500.00,
            "provident_fund": 400.00,
            "allowances": 150.00,
            "deductions": 100.00,
            "notes": "Module 12 comprehensive salary breakdown update",
        },
    )
    assert r_upd.status_code == 200, f"Update failed: {r_upd.text}"
    upd_res = r_upd.json()

    base = Decimal(str(upd_res["base_salary"]))
    hra = Decimal(str(upd_res["hra"]))
    transport = Decimal(str(upd_res["transport_allowance"]))
    medical = Decimal(str(upd_res["medical_allowance"]))
    allowances = Decimal(str(upd_res["allowances"]))
    bonuses = Decimal(str(upd_res["bonuses"]))
    gross = Decimal(str(upd_res["gross_salary"]))
    tax = Decimal(str(upd_res["tax_deduction"]))
    pf = Decimal(str(upd_res["provident_fund"]))
    deductions = Decimal(str(upd_res["deductions"]))
    tot_deduct = Decimal(str(upd_res["total_deductions"]))
    net = Decimal(str(upd_res["net_salary"]))

    # Verify Gross Salary Formula
    expected_gross = base + hra + transport + medical + allowances + bonuses
    assert gross == expected_gross, f"Gross salary mismatch: expected {expected_gross}, got {gross}"

    # Verify Total Deductions Formula
    expected_deduct = tax + pf + deductions
    assert tot_deduct == expected_deduct, f"Total deductions mismatch: expected {expected_deduct}, got {tot_deduct}"

    # Verify Net Salary Formula
    expected_net = gross - tot_deduct
    assert net == expected_net, f"Net salary mismatch: expected {expected_net}, got {net}"
    print(f"  ✓ Formula verified: Base (${base}) + Allowances (${hra+transport+medical+allowances+bonuses}) = Gross (${gross})")
    print(f"  ✓ Total deductions verified: Tax (${tax}) + PF (${pf}) + Other (${deductions}) = ${tot_deduct}")
    print(f"  ✓ Net salary verified: Gross (${gross}) - Deductions (${tot_deduct}) = Net (${net})")

    # Verify Dedicated Salary Breakdown Endpoint
    r_breakdown = client.get(
        f"/api/payroll/{p_id}/breakdown",
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert r_breakdown.status_code == 200, f"Breakdown fetch failed: {r_breakdown.text}"
    bd = r_breakdown.json()
    assert bd["id"] == p_id
    assert bd["employee_id"] == emp_id
    assert Decimal(str(bd["basic_salary"])) == base
    assert Decimal(str(bd["hra"])) == Decimal("1000.00")
    assert Decimal(str(bd["transport_allowance"])) == Decimal("300.00")
    assert Decimal(str(bd["medical_allowance"])) == Decimal("200.00")
    assert Decimal(str(bd["other_allowances"])) == Decimal("150.00")
    assert Decimal(str(bd["bonuses"])) == Decimal("500.00")
    assert Decimal(str(bd["gross_salary"])) == expected_gross
    assert Decimal(str(bd["provident_fund"])) == Decimal("400.00")
    assert Decimal(str(bd["tax_deduction"])) == tax
    assert Decimal(str(bd["other_deductions"])) == Decimal("100.00")
    assert Decimal(str(bd["total_deductions"])) == expected_deduct
    assert Decimal(str(bd["net_salary"])) == expected_net
    print(f"  ✓ GET /api/payroll/{p_id}/breakdown returns structured detailed salary breakdown")

    # ---------------------------------------------------------
    # SCENARIO 2: MONTHLY PAYROLL SUMMARY & EMPTY MONTH SAFETY
    # ---------------------------------------------------------
    print("\n[Scenario 2: Monthly Payroll Summary & Empty Month Safety]")
    # 2.1 Fetch summary for Month 12, 2026
    r_month_sum = client.get(
        "/api/payroll/monthly-summary?month=12&year=2026",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_month_sum.status_code == 200
    m_sum = r_month_sum.json()
    assert m_sum["month"] == 12
    assert m_sum["year"] == 2026
    assert m_sum["total_employees"] >= 1
    assert Decimal(str(m_sum["total_basic_salary"])) > 0
    assert Decimal(str(m_sum["total_gross_payroll"])) > 0
    assert Decimal(str(m_sum["total_net_payroll"])) > 0
    assert m_sum["payroll_status"] in ["PENDING", "PAID", "PARTIALLY_PAID"]
    print(f"  ✓ GET /api/payroll/monthly-summary returns accurate company metrics (Staff: {m_sum['total_employees']}, Gross: ${m_sum['total_gross_payroll']}, Status: {m_sum['payroll_status']})")

    # 2.2 Graceful empty month handling: Month 7, 2035 (zero records)
    db = SessionLocal()
    count_before = db.query(Payroll).count()
    db.close()

    r_empty_sum = client.get(
        "/api/payroll/monthly-summary?month=7&year=2035",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_empty_sum.status_code == 200
    empty_data = r_empty_sum.json()
    assert empty_data["total_employees"] == 0
    assert Decimal(str(empty_data["total_basic_salary"])) == Decimal("0.00")
    assert Decimal(str(empty_data["total_gross_payroll"])) == Decimal("0.00")
    assert Decimal(str(empty_data["total_net_payroll"])) == Decimal("0.00")
    assert empty_data["payroll_status"] == "NO_RECORDS"

    db = SessionLocal()
    count_after = db.query(Payroll).count()
    db.close()
    assert count_before == count_after, "Empty summary query must NOT insert any records into database!"
    print("  ✓ Querying empty month returns zero metrics and 'NO_RECORDS' status without creating database records")

    # ---------------------------------------------------------
    # SCENARIO 3: ROLE-BASED ACCESS CONTROL & TAMPERING PREVENTION
    # ---------------------------------------------------------
    print("\n[Scenario 3: Role-Based Access Control & Tampering Prevention]")
    # Find another employee's payroll record
    other_payroll = next((p for p in gen_list if p["employee_id"] != emp_id), None)
    assert other_payroll is not None, "Need another employee payroll record to test RBAC"
    other_p_id = other_payroll["id"]

    # 3.1 Employee cannot view another employee's payslip
    r_forbidden_payslip = client.get(
        f"/api/payroll/{other_p_id}",
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert r_forbidden_payslip.status_code == 403
    print(f"  ✓ GET /api/payroll/{other_p_id} prevents employee from viewing another employee's payslip (403 Forbidden)")

    # 3.2 Employee cannot view another employee's breakdown
    r_forbidden_breakdown = client.get(
        f"/api/payroll/{other_p_id}/breakdown",
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert r_forbidden_breakdown.status_code == 403
    print(f"  ✓ GET /api/payroll/{other_p_id}/breakdown prevents tampering (403 Forbidden)")

    # 3.3 Employee cannot access organization monthly summary
    r_forbidden_summary = client.get(
        "/api/payroll/monthly-summary?month=12&year=2026",
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert r_forbidden_summary.status_code == 403
    print("  ✓ GET /api/payroll/monthly-summary blocked for EMPLOYEE role (403 Forbidden)")

    # 3.4 Employee cannot update payroll
    r_forbidden_update = client.put(
        f"/api/payroll/{p_id}",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={"bonuses": 5000.0},
    )
    assert r_forbidden_update.status_code == 403
    print("  ✓ PUT /api/payroll/{id} blocked for EMPLOYEE role (403 Forbidden)")

    # ---------------------------------------------------------
    # SCENARIO 4: NEGATIVE VALUES & OVER-DEDUCTION VALIDATION
    # ---------------------------------------------------------
    print("\n[Scenario 4: Negative Values & Over-Deduction Validation]")
    # 4.1 Reject negative bonus/allowance (422)
    r_neg_bonus = client.put(
        f"/api/payroll/{p_id}",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"bonuses": -500.0},
    )
    assert r_neg_bonus.status_code == 422
    print("  ✓ PUT /api/payroll/{id} rejects negative bonus amount (422 Unprocessable Entity)")

    # 4.2 Reject negative PF (422)
    r_neg_pf = client.put(
        f"/api/payroll/{p_id}",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"provident_fund": -100.0},
    )
    assert r_neg_pf.status_code == 422
    print("  ✓ PUT /api/payroll/{id} rejects negative provident fund deduction (422 Unprocessable Entity)")

    # 4.3 Reject deductions exceeding gross (net salary < 0)
    r_over_deduct = client.put(
        f"/api/payroll/{p_id}",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"deductions": 999999.00},
    )
    assert r_over_deduct.status_code == 400
    print("  ✓ PUT /api/payroll/{id} rejects deductions exceeding gross salary (400 Bad Request)")

    # ---------------------------------------------------------
    # SCENARIO 5: DUPLICATE PREVENTION & IDEMPOTENCY
    # ---------------------------------------------------------
    print("\n[Scenario 5: Duplicate Prevention & Idempotency]")
    db = SessionLocal()
    rows_before = db.query(Payroll).filter(Payroll.month == 12, Payroll.year == 2026).count()
    db.close()

    r_regen = client.post(
        "/api/payroll/generate",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"month": 12, "year": 2026},
    )
    assert r_regen.status_code in [200, 201]

    db = SessionLocal()
    rows_after = db.query(Payroll).filter(Payroll.month == 12, Payroll.year == 2026).count()
    db.close()
    assert rows_before == rows_after, f"Re-running generator created duplicate rows! (Before: {rows_before}, After: {rows_after})"
    print(f"  ✓ Idempotency verified: Re-running generator for 12/2026 created 0 duplicate rows ({rows_after} records preserved)")

    # ---------------------------------------------------------
    # SCENARIO 6: PRESERVATION OF HISTORICAL SALARY FIGURES
    # ---------------------------------------------------------
    print("\n[Scenario 6: Preservation of Historical Salary Figures]")
    # Read employee's existing historical payroll figures
    db = SessionLocal()
    historical_p = db.query(Payroll).filter(Payroll.id == p_id).first()
    saved_base = historical_p.base_salary
    saved_gross = historical_p.gross_salary
    saved_net = historical_p.net_salary

    # Modify employee salary in Employee table
    target_emp = db.query(Employee).filter(Employee.id == emp_id).first()
    old_annual = target_emp.salary
    target_emp.salary = Decimal(str(old_annual)) + Decimal("30000.00")
    db.commit()
    db.close()

    # Verify that the existing historical payroll record is UNCHANGED
    db = SessionLocal()
    check_p = db.query(Payroll).filter(Payroll.id == p_id).first()
    assert check_p.base_salary == saved_base, "Historical base salary was altered!"
    assert check_p.gross_salary == saved_gross, "Historical gross salary was altered!"
    assert check_p.net_salary == saved_net, "Historical net salary was altered!"

    # Restore employee salary
    target_emp = db.query(Employee).filter(Employee.id == emp_id).first()
    target_emp.salary = old_annual
    db.commit()
    db.close()
    print("  ✓ Historical payroll figures (base, gross, net) remained strictly preserved after employee salary change")

    print("\n==================================================")
    print("ALL MODULE 12 (PAYROLL ENHANCEMENTS) TESTS PASSED! (100% PASS)")
    print("==================================================")


if __name__ == "__main__":
    test_module12()

