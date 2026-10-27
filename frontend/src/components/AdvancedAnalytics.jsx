import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { advancedAnalyticsApi } from '../services/api';
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  CalendarDays,
  Award,
  Star,
  Download,
  RefreshCw,
  Filter,
  RotateCcw,
  Building2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  FileText,
} from 'lucide-react';

export default function AdvancedAnalytics() {
  const { role } = useAuth();
  const isAuthorized = role === 'ADMIN' || role === 'HR';

  // Filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [department, setDepartment] = useState('ALL');

  // Applied filters state (only changes when "Apply" or "Reset" is clicked)
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: '',
    department: 'ALL',
  });

  // Department dropdown options
  const [availableDepartments, setAvailableDepartments] = useState([]);

  // Data states
  const [summary, setSummary] = useState(null);
  const [attendanceTrends, setAttendanceTrends] = useState([]);
  const [leaveTrends, setLeaveTrends] = useState([]);
  const [performanceInsights, setPerformanceInsights] = useState(null);
  const [departmentReports, setDepartmentReports] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tableSearch, setTableSearch] = useState('');

  // Fetch list of departments on initial mount
  useEffect(() => {
    async function loadDepts() {
      try {
        const depts = await advancedAnalyticsApi.getDepartments();
        setAvailableDepartments(depts || []);
      } catch (err) {
        console.warn('Failed to fetch departments list:', err);
      }
    }
    if (isAuthorized) {
      loadDepts();
    }
  }, [isAuthorized]);

  // Main data fetch function using applied filters
  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError('');

    const params = {};
    if (appliedFilters.startDate) params.start_date = appliedFilters.startDate;
    if (appliedFilters.endDate) params.end_date = appliedFilters.endDate;
    if (appliedFilters.department && appliedFilters.department !== 'ALL') {
      params.department = appliedFilters.department;
    }

    try {
      const [sumRes, attRes, leaveRes, perfRes, deptRes] = await Promise.all([
        advancedAnalyticsApi.getSummary(params),
        advancedAnalyticsApi.getAttendanceTrends(params),
        advancedAnalyticsApi.getLeaveTrends(params),
        advancedAnalyticsApi.getPerformanceInsights(params),
        advancedAnalyticsApi.getDepartmentReports(params),
      ]);

      setSummary(sumRes);
      setAttendanceTrends(attRes || []);
      setLeaveTrends(leaveRes || []);
      setPerformanceInsights(perfRes || null);
      setDepartmentReports(deptRes || []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Advanced Analytics load error:', err);
      setError(err.message || 'Failed to load advanced analytics data. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch whenever appliedFilters change
  useEffect(() => {
    if (isAuthorized) {
      fetchAnalyticsData();
    }
  }, [appliedFilters, isAuthorized]);

  const handleApplyFilters = (e) => {
    e?.preventDefault();
    if (startDate && endDate && startDate > endDate) {
      setError('Start date cannot be after end date.');
      return;
    }
    setError('');
    setAppliedFilters({
      startDate,
      endDate,
      department,
    });
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setDepartment('ALL');
    setError('');
    setAppliedFilters({
      startDate: '',
      endDate: '',
      department: 'ALL',
    });
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = {};
      if (appliedFilters.startDate) params.start_date = appliedFilters.startDate;
      if (appliedFilters.endDate) params.end_date = appliedFilters.endDate;
      if (appliedFilters.department && appliedFilters.department !== 'ALL') {
        params.department = appliedFilters.department;
      }
      await advancedAnalyticsApi.exportDepartmentReportsCsv(params);
    } catch (err) {
      console.error('Export CSV error:', err);
      alert(err.message || 'Failed to export CSV report');
    } finally {
      setExporting(false);
    }
  };

  // Filter department reports table via local search
  const filteredDepartmentReports = useMemo(() => {
    if (!departmentReports) return [];
    if (!tableSearch.trim()) return departmentReports;
    const q = tableSearch.toLowerCase();
    return departmentReports.filter((r) => r.department?.toLowerCase().includes(q));
  }, [departmentReports, tableSearch]);

  if (!isAuthorized) {
    return (
      <div className="analytics-unauthorized" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
          Access Restricted
        </h2>
        <p style={{ color: '#4b5563', maxWidth: '480px', margin: '0 auto' }}>
          Organizational Advanced Analytics & Reports is strictly reserved for Human Resources and System Administrators.
        </p>
      </div>
    );
  }

  // Max value calculation for native bar charts
  const maxAttTotal = Math.max(1, ...(attendanceTrends.map((t) => t.total_records) || [1]));
  const maxLeaveSubmitted = Math.max(1, ...(leaveTrends.map((t) => t.submitted_count) || [1]));
  const totalReviews = performanceInsights?.total_reviews || 0;

  return (
    <div className="advanced-analytics-container" style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* 1. Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Advanced Analytics & Reports
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '2px 0 0' }}>
                Multi-dimensional metrics across workforce headcount, attendance rates, leave requests, and performance reviews.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px' }}>
              Updated {lastUpdated}
            </span>
          )}
          <button
            type="button"
            onClick={fetchAnalyticsData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#334155',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#ffffff',
              background: '#0284c7',
              border: 'none',
              borderRadius: '8px',
              cursor: exporting || loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
            }}
          >
            <Download size={15} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <form
        onSubmit={handleApplyFilters}
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
            Start Date
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '0.875rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#1e293b',
                background: '#f8fafc',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
            End Date
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '0.875rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#1e293b',
                background: '#f8fafc',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
            Department
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={{
              padding: '8.5px 12px',
              fontSize: '0.875rem',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#1e293b',
              background: '#f8fafc',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Departments</option>
            {availableDepartments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
          <button
            type="submit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8.5px 18px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#ffffff',
              background: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
            }}
          >
            <Filter size={15} />
            Apply Filters
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8.5px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#475569',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={15} />
            Reset
          </button>
        </div>
      </form>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAnalyticsData}
            style={{
              background: '#ffffff',
              border: '1px solid #f87171',
              color: '#b91c1c',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Summary KPI Cards (4 Cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '18px',
          marginBottom: '28px',
        }}
      >
        {/* Card 1: Active Employees */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Workforce
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
            {summary?.active_employees ?? 0}
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8', marginLeft: '6px' }}>
              / {summary?.total_employees ?? 0} Total
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '10px' }}>
            Scope: {appliedFilters.department === 'ALL' ? 'All Organization' : appliedFilters.department}
          </div>
        </div>

        {/* Card 2: Attendance Rate */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Attendance Rate
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
            {summary?.attendance_rate !== null && summary?.attendance_rate !== undefined ? `${summary.attendance_rate}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '10px' }}>
            {summary?.present_records ?? 0} Present &bull; {summary?.late_records ?? 0} Late &bull; {summary?.absent_records ?? 0} Absent
          </div>
        </div>

        {/* Card 3: Approved Leaves */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Approved Leaves
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarDays size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
            {summary?.approved_leaves ?? 0}
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8', marginLeft: '6px' }}>
              Requests
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '10px' }}>
            {summary?.approved_leave_days ?? 0.0} Cumulative Leave Days
          </div>
        </div>

        {/* Card 4: Avg Performance Rating */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Average Performance
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {summary?.average_performance_rating !== null && summary?.average_performance_rating !== undefined ? (
              <>
                <span>{summary.average_performance_rating.toFixed(1)}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>/ 5.0</span>
                <Star size={20} fill="#f59e0b" color="#f59e0b" style={{ marginLeft: '4px' }} />
              </>
            ) : (
              'N/A'
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '10px' }}>
            {summary?.evaluated_employees ?? 0} Evaluated Staff &bull; {summary?.total_performance_reviews ?? 0} Reviews
          </div>
        </div>
      </div>

      {/* 4. Charts Section: Attendance Trends & Leave Trends */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Attendance Trend Chart */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Monthly Attendance Trends
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
                Presence volume and monthly attendance compliance rate
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }}></span> Present
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }}></span> Late
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }}></span> Absent
              </span>
            </div>
          </div>

          {attendanceTrends.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
              No attendance records found for the selected interval.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {attendanceTrends.map((item) => {
                const total = item.total_records;
                const pPct = total > 0 ? (item.present_count / total) * 100 : 0;
                const lPct = total > 0 ? (item.late_count / total) * 100 : 0;
                const aPct = total > 0 ? (item.absent_count / total) * 100 : 0;

                return (
                  <div key={item.month}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      <span>{item.month}</span>
                      <span>
                        {item.attendance_rate !== null ? (
                          <span style={{ color: item.attendance_rate >= 80 ? '#059669' : '#d97706', fontWeight: 700 }}>
                            {item.attendance_rate}% Rate
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>No Records</span>
                        )}
                        <span style={{ color: '#64748b', fontWeight: 500, marginLeft: '8px' }}>
                          ({item.total_records} logs)
                        </span>
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '14px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                      {total > 0 ? (
                        <>
                          <div style={{ width: `${pPct}%`, background: '#10b981', height: '100%' }} title={`Present: ${item.present_count}`} />
                          <div style={{ width: `${lPct}%`, background: '#f59e0b', height: '100%' }} title={`Late: ${item.late_count}`} />
                          <div style={{ width: `${aPct}%`, background: '#ef4444', height: '100%' }} title={`Absent: ${item.absent_count}`} />
                        </>
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: '#f1f5f9' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leave Trends Chart */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Monthly Leave Trends
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
                Leave submission volume, approvals, and approved days
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }}></span> Approved
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }}></span> Pending
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }}></span> Rejected
              </span>
            </div>
          </div>

          {leaveTrends.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
              No leave requests found for the selected interval.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {leaveTrends.map((item) => {
                const sub = item.submitted_count;
                const aPct = sub > 0 ? (item.approved_count / sub) * 100 : 0;
                const pPct = sub > 0 ? (item.pending_count / sub) * 100 : 0;
                const rPct = sub > 0 ? (item.rejected_count / sub) * 100 : 0;

                return (
                  <div key={item.month}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      <span>{item.month}</span>
                      <span>
                        <span style={{ color: '#0284c7', fontWeight: 700 }}>
                          {item.approved_leave_days} Days
                        </span>
                        <span style={{ color: '#64748b', fontWeight: 500, marginLeft: '8px' }}>
                          ({item.approved_count} / {item.submitted_count} approved)
                        </span>
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '14px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                      {sub > 0 ? (
                        <>
                          <div style={{ width: `${aPct}%`, background: '#10b981', height: '100%' }} title={`Approved: ${item.approved_count}`} />
                          <div style={{ width: `${pPct}%`, background: '#f59e0b', height: '100%' }} title={`Pending: ${item.pending_count}`} />
                          <div style={{ width: `${rPct}%`, background: '#ef4444', height: '100%' }} title={`Rejected: ${item.rejected_count}`} />
                        </>
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: '#f1f5f9' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Performance Insights Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Rating Distribution (1 to 5 Stars) */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Rating Distribution (1–5 Stars)
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
                Cumulative evaluation breakdown across performance scores
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px' }}>
              {totalReviews} Total Reviews
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = performanceInsights?.rating_distribution?.[String(star)] || 0;
              const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              const starColors = {
                5: '#10b981',
                4: '#6366f1',
                3: '#0ea5e9',
                2: '#f59e0b',
                1: '#f43f5e',
              };

              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '56px', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    <span>{star}</span>
                    <Star size={14} fill="#f59e0b" color="#f59e0b" />
                  </div>

                  <div style={{ flex: 1, height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: starColors[star], borderRadius: '5px' }} />
                  </div>

                  <div style={{ width: '70px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                    {count} ({pct.toFixed(0)}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rating by Department & Period */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            Average Rating by Department
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 16px' }}>
            Departmental performance score averages
          </p>

          {(!performanceInsights?.by_department || Object.keys(performanceInsights.by_department).length === 0) ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
              No performance review data available.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(performanceInsights.by_department).map(([deptName, score]) => {
                const pct = score ? (score / 5.0) * 100 : 0;
                return (
                  <div key={deptName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      <span>{deptName}</span>
                      <span style={{ color: score ? '#0f172a' : '#94a3b8', fontWeight: 700 }}>
                        {score !== null ? `${score.toFixed(2)} / 5.0` : 'N/A'}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#8b5cf6', borderRadius: '5px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Periods Pills */}
          {performanceInsights?.by_period && Object.keys(performanceInsights.by_period).length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Review Period Trends:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(performanceInsights.by_period).map(([period, score]) => (
                  <span
                    key={period}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#1e293b',
                    }}
                  >
                    {period}: <strong style={{ color: '#2563eb' }}>{score !== null ? score.toFixed(1) : 'N/A'}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Department Comparative Reports Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Department Comparative Reports
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>
              Comprehensive cross-departmental benchmarking across attendance, leaves, and evaluations
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search department..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                style={{
                  padding: '7px 12px 7px 32px',
                  fontSize: '0.825rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#1e293b',
                  background: '#f8fafc',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: '#334155',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: exporting || loading ? 'not-allowed' : 'pointer',
              }}
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {filteredDepartmentReports.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8' }}>
            <Building2 size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>No department reports match the criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Department</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Headcount</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Attendance Records</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Attendance Rate</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Leave Requests</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Approved Days</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Evaluated Staff</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {filteredDepartmentReports.map((row) => (
                  <tr key={row.department} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={16} color="#64748b" />
                        <span>{row.department}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      <strong>{row.active_employees}</strong> active / {row.total_employees}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      {row.attendance_records}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {row.attendance_rate !== null ? (
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            background: row.attendance_rate >= 80 ? '#ecfdf5' : '#fffbeb',
                            color: row.attendance_rate >= 80 ? '#047857' : '#b45309',
                          }}
                        >
                          {row.attendance_rate}%
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      <strong>{row.approved_leaves}</strong> / {row.leave_requests}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0284c7', fontWeight: 600 }}>
                      {row.approved_leave_days} d
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      {row.evaluated_employees} ({row.total_reviews} reviews)
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {row.average_rating !== null ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#0f172a' }}>
                          <span>{row.average_rating.toFixed(2)}</span>
                          <Star size={14} fill="#f59e0b" color="#f59e0b" />
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

