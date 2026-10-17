import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardApi } from '../services/api';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  Building,
  Check,
  CreditCard,
  Briefcase,
  PieChart,
} from 'lucide-react';

export default function DashboardAnalytics() {
  const { role, user } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  const [analytics, setAnalytics] = useState(null);
  const [personalStats, setPersonalStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      if (isHrOrAdmin) {
        const data = await dashboardApi.getAnalytics();
        setAnalytics(data);
      } else {
        const pStats = await dashboardApi.getMyStats();
        setPersonalStats(pStats);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err.message);
      // If error occurred (e.g. employee lacks employee profile), fallback gracefully
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [role]);

  if (loading) {
    return (
      <div className="section-container">
        <div className="loading-state">
          <span className="spinner-large"></span>
          <h3>Loading WorkSphere Analytics Dashboard...</h3>
        </div>
      </div>
    );
  }

  // --- EMPLOYEE PERSONAL DASHBOARD VIEW ---
  if (!isHrOrAdmin && personalStats) {
    const { attendance_stats, leave_stats, latest_payslip, today_attendance } = personalStats;
    return (
      <div className="section-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Welcome back, {personalStats.full_name}!</h1>
            <p className="page-subtitle">
              {personalStats.designation} &bull; {personalStats.department}
            </p>
          </div>
        </div>

        {/* Quick KPI Cards */}
        <div className="stats-grid">
          {/* Today Attendance */}
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-green">
              <Clock size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Today's Status</span>
              <span className="stat-value" style={{ fontSize: '1.25rem' }}>
                {today_attendance ? (
                  today_attendance.check_out ? (
                    <span style={{ color: '#10b981' }}>Checked Out ({today_attendance.working_hours} hrs)</span>
                  ) : (
                    <span style={{ color: '#0284c7' }}>Checked In (Active)</span>
                  )
                ) : (
                  <span style={{ color: '#64748b' }}>Not Checked In</span>
                )}
              </span>
            </div>
          </div>

          {/* Present Days */}
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-blue">
              <CheckCircle2 size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Days Present</span>
              <span className="stat-value">
                {attendance_stats.present_days} / {attendance_stats.total_days} days
              </span>
            </div>
          </div>

          {/* Remaining Leave Balance */}
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-yellow">
              <CalendarDays size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Remaining Leaves</span>
              <span className="stat-value">{leave_stats.annual_balance} days</span>
            </div>
          </div>

          {/* Latest Payslip */}
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-purple">
              <DollarSign size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Latest Take-Home Pay</span>
              <span className="stat-value">
                {latest_payslip ? (
                  `$${Number(latest_payslip.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                ) : (
                  'Pending'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Employee Summary Sections */}
        <div className="profile-layout-grid">
          <div className="card-custom">
            <h3 className="card-custom-title">
              <Activity size={20} /> Attendance Overview
            </h3>
            <div className="profile-details-grid-large">
              <div className="profile-detail-card">
                <span className="label">Total Logged Days</span>
                <span className="value">{attendance_stats.total_days}</span>
              </div>
              <div className="profile-detail-card">
                <span className="label">Total Hours</span>
                <span className="value">{attendance_stats.total_hours} hrs</span>
              </div>
              <div className="profile-detail-card">
                <span className="label">Half Days</span>
                <span className="value">{attendance_stats.half_days}</span>
              </div>
              <div className="profile-detail-card">
                <span className="label">Absent Days</span>
                <span className="value">{attendance_stats.absent_days}</span>
              </div>
            </div>
          </div>

          <div className="card-custom">
            <h3 className="card-custom-title">
              <CalendarDays size={20} /> Leave Tracker
            </h3>
            <div className="profile-details-grid-large">
              <div className="profile-detail-card">
                <span className="label">Annual Entitlement</span>
                <span className="value">20 days / year</span>
              </div>
              <div className="profile-detail-card">
                <span className="label">Days Approved & Taken</span>
                <span className="value text-highlight">{leave_stats.days_taken} days</span>
              </div>
              <div className="profile-detail-card">
                <span className="label">Pending Applications</span>
                <span className="value">{leave_stats.pending}</span>
              </div>
              <div className="profile-detail-card">
                <span className="label">Available Balance</span>
                <span className="value text-success">{leave_stats.annual_balance} days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- EXECUTIVE DASHBOARD VIEW (ADMIN / HR) ---
  if (!analytics) {
    return (
      <div className="section-container">
        <div className="alert alert-error">
          <AlertCircle size={18} /> {error || 'No analytics data available'}
        </div>
      </div>
    );
  }

  const { kpis, department_distribution, attendance_breakdown, leave_types_breakdown, recent_activities } = analytics;

  return (
    <div className="section-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard & Analytics</h1>
          <p className="page-subtitle">
            Real-time organizational KPI metrics across Staff, Attendance, Leaves, and Payroll
          </p>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="stats-grid">
        {/* Total Staff */}
        <div className="stat-card">
          <div className="stat-icon-wrapper icon-blue">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Staff / Active</span>
            <span className="stat-value">
              {kpis.total_employees}{' '}
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#16a34a' }}>
                ({kpis.active_employees} active)
              </span>
            </span>
          </div>
        </div>

        {/* Today's Attendance Rate */}
        <div className="stat-card">
          <div className="stat-icon-wrapper icon-green">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Today's Attendance Rate</span>
            <span className="stat-value">
              {kpis.today_attendance.attendance_rate}%{' '}
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0284c7' }}>
                ({kpis.today_attendance.checked_in_count} in)
              </span>
            </span>
          </div>
        </div>

        {/* Pending Leave Approvals */}
        <div className="stat-card">
          <div className="stat-icon-wrapper icon-yellow">
            <CalendarDays size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Pending Leave Requests</span>
            <span className="stat-value">
              {kpis.leaves_kpi.pending_approvals}{' '}
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#d97706' }}>
                requests
              </span>
            </span>
          </div>
        </div>

        {/* Monthly Payroll Outflow */}
        <div className="stat-card">
          <div className="stat-icon-wrapper icon-purple">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Monthly Payroll Outflow</span>
            <span className="stat-value">
              ${Number(kpis.payroll_kpi.total_payout || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="profile-layout-grid">
        {/* Department Distribution */}
        <div className="card-custom">
          <h3 className="card-custom-title">
            <Building size={20} /> Department Distribution & Payroll
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {department_distribution.map((dept) => {
              const totalPayroll = Number(dept.total_payroll || 0);
              const maxDeptEmp = Math.max(...department_distribution.map((d) => d.employee_count), 1);
              const pct = Math.round((dept.employee_count / maxDeptEmp) * 100);

              return (
                <div key={dept.department}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                    <strong>{dept.department}</strong>
                    <span>
                      {dept.employee_count} staff &bull; ${totalPayroll.toLocaleString('en-US')} / yr
                    </span>
                  </div>
                  <div style={{ background: '#f1f5f9', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                    <div
                      style={{
                        background: 'linear-gradient(90deg, #4f46e5, #06b6d4)',
                        height: '100%',
                        width: `${pct}%`,
                        borderRadius: '5px',
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Recent Activity Stream */}
        <div className="card-custom">
          <h3 className="card-custom-title">
            <Activity size={20} /> Recent System Activities
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recent_activities.length === 0 ? (
              <p className="text-muted">No recent activities recorded.</p>
            ) : (
              recent_activities.map((act) => {
                let badgeClass = 'badge-active';
                if (act.status === 'PENDING') badgeClass = 'badge-leave';
                if (act.status === 'REJECTED' || act.status === 'ABSENT') badgeClass = 'badge-terminated';

                return (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ marginTop: '2px' }}>
                      {act.type === 'LEAVE' && <CalendarDays size={18} color="#d97706" />}
                      {act.type === 'ATTENDANCE' && <Clock size={18} color="#0284c7" />}
                      {act.type === 'PAYROLL' && <DollarSign size={18} color="#16a34a" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{act.title}</span>
                        <span className={`status-badge ${badgeClass}`} style={{ fontSize: '0.7rem' }}>
                          {act.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0' }}>{act.description}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Attendance & Leave Analytics Tiles */}
      <div className="stats-grid">
        <div className="card-custom">
          <h3 className="card-custom-title">
            <PieChart size={20} /> Attendance Breakdown
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div className="profile-detail-card flex-1">
              <span className="label">Present</span>
              <span className="value" style={{ color: '#16a34a' }}>
                {attendance_breakdown.PRESENT || 0}
              </span>
            </div>
            <div className="profile-detail-card flex-1">
              <span className="label">Half Day</span>
              <span className="value" style={{ color: '#d97706' }}>
                {attendance_breakdown.HALF_DAY || 0}
              </span>
            </div>
            <div className="profile-detail-card flex-1">
              <span className="label">Absent</span>
              <span className="value" style={{ color: '#dc2626' }}>
                {attendance_breakdown.ABSENT || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="card-custom">
          <h3 className="card-custom-title">
            <CalendarDays size={20} /> Leave Types Allocation
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div className="profile-detail-card flex-1">
              <span className="label">Casual</span>
              <span className="value">{leave_types_breakdown.CASUAL || 0}</span>
            </div>
            <div className="profile-detail-card flex-1">
              <span className="label">Sick</span>
              <span className="value">{leave_types_breakdown.SICK || 0}</span>
            </div>
            <div className="profile-detail-card flex-1">
              <span className="label">Annual</span>
              <span className="value">{leave_types_breakdown.ANNUAL || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

