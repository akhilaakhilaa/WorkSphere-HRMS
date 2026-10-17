import sys
from datetime import date, timedelta
from decimal import Decimal
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.notification import Notification, NotificationType

client = TestClient(app)


def test_batch3():
    print("==================================================")
    print("TESTING BATCH 3: MODULE 7 — NOTIFICATIONS")
    print("==================================================")

    # 1. Login to obtain JWT tokens for all roles
    r_admin = client.post("/api/auth/login", json={"email": "admin@worksphere.com", "password": "Admin@123"})
    assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]
    admin_user_id = r_admin.json()["user_id"]

    r_hr = client.post("/api/auth/login", json={"email": "hr@worksphere.com", "password": "Hr@123"})
    assert r_hr.status_code == 200, f"HR login failed: {r_hr.text}"
    hr_token = r_hr.json()["access_token"]
    hr_user_id = r_hr.json()["user_id"]

    r_emp = client.post("/api/auth/login", json={"email": "employee@worksphere.com", "password": "Employee@123"})
    assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
    emp_token = r_emp.json()["access_token"]
    emp_user_id = r_emp.json()["user_id"]

    print(f"  ✓ Authenticated Admin (user_id={admin_user_id}), HR (user_id={hr_user_id}), Employee (user_id={emp_user_id})")

    # ---------------------------------------------------------
    # 2. ENFORCE AUTHENTICATION & ACCESS CONTROL (Requirement 6)
    # ---------------------------------------------------------
    print("\n[Security & Access Control Tests]")

    # 2.1 Unauthenticated request must return 401 Unauthorized
    r_unauth = client.get("/api/notifications")
    assert r_unauth.status_code == 401, f"Expected 401 for unauthenticated request, got {r_unauth.status_code}"
    print("  ✓ GET /api/notifications enforces authentication (401 Unauthorized)")

    r_unauth_badge = client.get("/api/notifications/unread-count")
    assert r_unauth_badge.status_code == 401
    print("  ✓ GET /api/notifications/unread-count enforces authentication (401 Unauthorized)")

    # 2.2 User sees only their own notifications
    r_emp_notifs = client.get("/api/notifications", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_emp_notifs.status_code == 200
    emp_notifs = r_emp_notifs.json()
    assert all(n["user_id"] == emp_user_id for n in emp_notifs), "Employee received notifications belonging to another user!"
    print(f"  ✓ GET /api/notifications ensures employee only receives own notifications ({len(emp_notifs)} items)")

    # 2.3 Regular employee cannot mark another user's notification as read
    # Find or create a notification belonging to admin
    r_admin_notifs = client.get("/api/notifications", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_admin_notifs.status_code == 200
    admin_notifs = r_admin_notifs.json()
    if admin_notifs:
        admin_notif_id = admin_notifs[0]["id"]
        r_cross_read = client.put(
            f"/api/notifications/{admin_notif_id}/read",
            headers={"Authorization": f"Bearer {emp_token}"},
        )
        assert r_cross_read.status_code == 404, f"Expected 404 when employee marks admin's notif as read, got {r_cross_read.status_code}"
        print("  ✓ PUT /api/notifications/{id}/read prevents tampering with another user's notification (404 Not Found)")

    # ---------------------------------------------------------
    # 3. NOTIFICATION DETAILS & BADGE COUNTS (Requirements 1 & 2)
    # ---------------------------------------------------------
    print("\n[Notification Center & Badge Tests]")

    # 3.1 Unread count endpoint
    r_unread = client.get("/api/notifications/unread-count", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_unread.status_code == 200
    unread_data = r_unread.json()
    assert "unread_count" in unread_data
    initial_unread = unread_data["unread_count"]
    print(f"  ✓ GET /api/notifications/unread-count returns {initial_unread} unread count for badge")

    # 3.2 Notification summary endpoint
    r_summary = client.get("/api/notifications/summary", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_summary.status_code == 200
    sum_data = r_summary.json()
    assert "total" in sum_data
    assert "unread" in sum_data
    assert "leave_count" in sum_data
    assert "payroll_count" in sum_data
    assert "attendance_count" in sum_data
    assert sum_data["unread"] == initial_unread
    print(f"  ✓ GET /api/notifications/summary returns categorized metrics (Total: {sum_data['total']}, Leaves: {sum_data['leave_count']}, Payroll: {sum_data['payroll_count']}, Attendance: {sum_data['attendance_count']})")

    # 3.3 Verify notification data fields: title, message, date, type, is_read
    if emp_notifs:
        sample = emp_notifs[0]
        assert "title" in sample and sample["title"]
        assert "message" in sample and sample["message"]
        assert "created_at" in sample and sample["created_at"]
        assert "type" in sample
        assert "is_read" in sample
        print(f"  ✓ Notification item contains title ('{sample['title']}'), message, created_at, type ({sample['type']}), and is_read ({sample['is_read']})")

    # ---------------------------------------------------------
    # 4. MARKING NOTIFICATIONS AS READ (Requirement 3)
    # ---------------------------------------------------------
    print("\n[Mark as Read Tests]")

    # 4.1 Filter unread only
    r_unread_list = client.get("/api/notifications?unread_only=true", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_unread_list.status_code == 200
    unreads = r_unread_list.json()
    assert all(n["is_read"] is False for n in unreads)
    print(f"  ✓ GET /api/notifications?unread_only=true returns only unread items ({len(unreads)} unread)")

    if unreads:
        target_notif = unreads[0]
        # Mark single as read
        r_mark = client.put(f"/api/notifications/{target_notif['id']}/read", headers={"Authorization": f"Bearer {emp_token}"})
        assert r_mark.status_code == 200
        assert r_mark.json()["is_read"] is True
        print(f"  ✓ PUT /api/notifications/{target_notif['id']}/read successfully marks item as read")

        # Verify badge count decremented
        r_new_count = client.get("/api/notifications/unread-count", headers={"Authorization": f"Bearer {emp_token}"})
        assert r_new_count.json()["unread_count"] == initial_unread - 1
        print(f"  ✓ Unread badge count accurately decremented to {r_new_count.json()['unread_count']}")

    # 4.2 Mark all as read
    r_mark_all = client.put("/api/notifications/read-all", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_mark_all.status_code == 200
    assert "updated_count" in r_mark_all.json()
    print(f"  ✓ PUT /api/notifications/read-all marked {r_mark_all.json()['updated_count']} remaining notifications as read")

    # Verify zero unread
    r_zero = client.get("/api/notifications/unread-count", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_zero.json()["unread_count"] == 0
    print("  ✓ Verified unread count is now 0")

    # ---------------------------------------------------------
    # 5. ATTENDANCE ALERTS DISPATCH (Requirement 5)
    # ---------------------------------------------------------
    print("\n[Attendance Alerts Tests]")

    # Clean today's attendance for test employee so we can trigger check-in
    db = SessionLocal()
    from app.models.attendance import Attendance
    db.query(Attendance).filter(Attendance.employee_id == 3, Attendance.date == date.today()).delete()
    db.commit()
    db.close()

    # Employee Check-In triggers attendance alert notification
    r_cin = client.post("/api/attendance/check-in", headers={"Authorization": f"Bearer {emp_token}"}, json={"notes": "Shift start"})
    assert r_cin.status_code == 200

    r_emp_notifs2 = client.get("/api/notifications?type=ATTENDANCE", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_emp_notifs2.status_code == 200
    att_notifs = r_emp_notifs2.json()
    assert len(att_notifs) >= 1
    latest_att = att_notifs[0]
    assert latest_att["type"] == "ATTENDANCE"
    print(f"  ✓ Attendance check-in dispatched alert notification: '{latest_att['title']}' - '{latest_att['message']}'")

    # Employee Check-Out triggers attendance alert notification
    r_cout = client.post("/api/attendance/check-out", headers={"Authorization": f"Bearer {emp_token}"}, json={})
    assert r_cout.status_code == 200

    r_emp_notifs3 = client.get("/api/notifications?type=ATTENDANCE", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_emp_notifs3.status_code == 200
    latest_att2 = r_emp_notifs3.json()[0]
    assert "Attendance" in latest_att2["title"]
    print(f"  ✓ Attendance check-out dispatched alert notification: '{latest_att2['title']}' - '{latest_att2['message']}'")

    # HR Manual Attendance Record triggers attendance alert to employee
    r_manual = client.post(
        "/api/attendance/manual",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={
            "employee_id": 3,
            "date": str(date.today() - timedelta(days=5)),
            "status": "PRESENT",
            "working_hours": 8.0,
            "notes": "Verified client site visit",
        },
    )
    assert r_manual.status_code == 201
    r_manual_notif = client.get("/api/notifications?type=ATTENDANCE", headers={"Authorization": f"Bearer {emp_token}"})
    assert any("Manual Attendance" in n["title"] or "site visit" in n["message"] for n in r_manual_notif.json())
    print("  ✓ HR manual attendance entry dispatched notification to employee")

    # ---------------------------------------------------------
    # 6. LEAVE NOTIFICATIONS (Requirement 4)
    # ---------------------------------------------------------
    print("\n[Leave Notifications Tests]")

    # Find highest end date to submit a fresh leave
    db = SessionLocal()
    from app.models.leave import Leave
    from sqlalchemy import func
    max_d = db.query(func.max(Leave.end_date)).filter(Leave.employee_id == 3).scalar()
    db.close()
    ref_d = max_d if (max_d and max_d > date.today()) else date.today()
    l_start = ref_d + timedelta(days=10)
    l_end = l_start + timedelta(days=1)

    # Employee submits leave -> notifies HR & Admin
    r_l_apply = client.post(
        "/api/leaves",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={"leave_type": "CASUAL", "start_date": str(l_start), "end_date": str(l_end), "reason": "Doc checkup"},
    )
    assert r_l_apply.status_code == 201
    leave_id = r_l_apply.json()["id"]

    # Verify HR received organization alert
    r_hr_notifs = client.get("/api/notifications?type=LEAVE", headers={"Authorization": f"Bearer {hr_token}"})
    assert r_hr_notifs.status_code == 200
    assert any("New Leave Application" in n["title"] for n in r_hr_notifs.json())
    print("  ✓ HR received organization alert for new leave application")

    # HR Approves leave -> employee receives approval notification
    r_l_review = client.put(
        f"/api/leaves/{leave_id}/review",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"status": "APPROVED", "admin_remarks": "Approved with pleasure"},
    )
    assert r_l_review.status_code == 200

    r_emp_leaves = client.get("/api/notifications?type=LEAVE", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_emp_leaves.status_code == 200
    assert any("Approved" in n["title"] and str(leave_id) not in n["title"] for n in r_emp_leaves.json())
    print("  ✓ Employee received leave approval notification")

    # ---------------------------------------------------------
    # 7. PAYROLL NOTIFICATIONS (Requirement 4)
    # ---------------------------------------------------------
    print("\n[Payroll Notifications Tests]")

    # HR generates payroll for December 2026 (Month 12)
    r_pay_gen = client.post(
        "/api/payroll/generate",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={"month": 12, "year": 2026},
    )
    assert r_pay_gen.status_code == 201

    # Employee receives "New Payroll Generated" notification
    r_emp_pay_notif = client.get("/api/notifications?type=PAYROLL", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_emp_pay_notif.status_code == 200
    assert any("Payroll Generated" in n["title"] for n in r_emp_pay_notif.json())
    print("  ✓ Employee received notification when payroll was generated")

    # Find the payroll record for employee 3 to disburse
    generated_payrolls = r_pay_gen.json()
    emp_payroll = next(p for p in generated_payrolls if p["employee_id"] == 3)
    p_id = emp_payroll["id"]

    # Admin marks payroll as PAID -> employee receives "Salary Disbursed" notification
    r_pay_disburse = client.put(
        f"/api/payroll/{p_id}/pay?payment_method=BANK_TRANSFER",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_pay_disburse.status_code == 200

    r_emp_pay_notif2 = client.get("/api/notifications?type=PAYROLL", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_emp_pay_notif2.status_code == 200
    assert any("Salary Disbursed" in n["title"] for n in r_emp_pay_notif2.json())
    print("  ✓ Employee received notification when payroll was marked as PAID")

    # ---------------------------------------------------------
    # 8. ORGANIZATION ALERTS & BROADCAST (Requirement 6)
    # ---------------------------------------------------------
    print("\n[Organization Alerts & Broadcast Tests]")

    # 8.1 Employee CANNOT send broadcast (403 Forbidden)
    r_unauth_bc = client.post(
        "/api/notifications/broadcast",
        headers={"Authorization": f"Bearer {emp_token}"},
        json={"title": "Unauthorized Alert", "message": "Spam"},
    )
    assert r_unauth_bc.status_code == 403
    print("  ✓ Regular employee cannot send broadcast alerts (403 Forbidden)")

    # 8.2 HR broadcasts an organization announcement to all employees
    r_bc = client.post(
        "/api/notifications/broadcast",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={
            "title": "Townhall Meeting",
            "message": "All-hands quarterly company townhall this Friday at 3:00 PM.",
            "type": "SYSTEM",
            "target_role": "ALL",
        },
    )
    assert r_bc.status_code == 201
    bc_data = r_bc.json()
    assert bc_data["recipients_count"] >= 3
    print(f"  ✓ HR broadcasted organization announcement to {bc_data['recipients_count']} active users")

    # Verify employee received the broadcast
    r_emp_bc = client.get("/api/notifications?type=SYSTEM", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_emp_bc.status_code == 200
    assert any("Townhall Meeting" in n["title"] for n in r_emp_bc.json())
    print("  ✓ Verified employee received the organization announcement")

    # ---------------------------------------------------------
    # 9. BACKWARD COMPATIBILITY: DASHBOARD NOTIFICATION ROUTES
    # ---------------------------------------------------------
    print("\n[Dashboard Route Compatibility Tests]")
    r_dash_notifs = client.get("/api/dashboard/notifications", headers={"Authorization": f"Bearer {emp_token}"})
    assert r_dash_notifs.status_code == 200
    print(f"  ✓ GET /api/dashboard/notifications remains 100% backward compatible ({len(r_dash_notifs.json())} items)")

    print("\n==================================================")
    print("ALL BATCH 3 (MODULE 7: NOTIFICATIONS) TESTS PASSED! (100% PASS)")
    print("==================================================")


if __name__ == "__main__":
    try:
        test_batch3()
    except Exception as e:
        print("Batch 3 tests failed:", e)
        sys.exit(1)

