import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceApi, employeeApi } from '../services/api';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Calendar,
  History,
  FileSpreadsheet,
  PlusCircle,
  X,
  Filter,
  Check,
  Building,
  CalendarX,
} from 'lucide-react';

export default function AttendanceManagement() {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // Live clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Today's attendance state
  const [todayRecord, setTodayRecord] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // History & Summary
  const [activeSubTab, setActiveSubTab] = useState('my_history'); // 'my_history' | 'all_records'
  const [myHistory, setMyHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Admin / HR Organization Attendance
  const [allAttendance, setAllAttendance] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [allLoading, setAllLoading] = useState(false);

  // Manual Attendance Entry Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualData, setManualData] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    check_in: '',
    check_out: '',
    status: 'PRESENT',
    notes: '',
  });

  // Auto-Mark Absent Modal (Module 10)
  const [showAutoAbsentModal, setShowAutoAbsentModal] = useState(false);
  const [autoAbsentDate, setAutoAbsentDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoAbsentDryRun, setAutoAbsentDryRun] = useState(true);
  const [autoAbsentLoading, setAutoAbsentLoading] = useState(false);
  const [autoAbsentResult, setAutoAbsentResult] = useState(null);

  // Messages
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's record and user summary
  const fetchTodayAndSummary = async () => {
    setTodayLoading(true);
    try {
      // If user has an employee account, fetch today's record
      try {
        const today = await attendanceApi.getToday();
        setTodayRecord(today);
      } catch (err) {
        // May fail if admin doesn't have an employee profile yet
      }

      try {
        const sum = await attendanceApi.getSummary();
        setSummary(sum);
      } catch (err) {}

      try {
        const history = await attendanceApi.getMyHistory();
        setMyHistory(history);
      } catch (err) {}
    } catch (err) {
      console.error(err);
    } finally {
      setTodayLoading(false);
      setHistoryLoading(false);
    }
  };

  const fetchOrganizationAttendance = async () => {
    if (!isHrOrAdmin) return;
    setAllLoading(true);
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterStatus !== 'All') params.status = filterStatus;
      if (filterEmployeeId) params.employee_id = filterEmployeeId;

      const data = await attendanceApi.listAll(params);
      setAllAttendance(data);

      if (employeesList.length === 0) {
        const emps = await employeeApi.list();
        setEmployeesList(emps);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch attendance records');
    } finally {
      setAllLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayAndSummary();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'all_records' && isHrOrAdmin) {
      fetchOrganizationAttendance();
    }
  }, [activeSubTab, filterDate, filterStatus, filterEmployeeId]);

  // Handle Check-In
  const handleCheckIn = async () => {
    setError('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      const res = await attendanceApi.checkIn(notes);
      setTodayRecord(res);
      setNotes('');
      setSuccessMsg(`Successfully checked in at ${new Date(res.check_in).toLocaleTimeString()}!`);
      setTimeout(() => setSuccessMsg(''), 5000);
      fetchTodayAndSummary();
    } catch (err) {
      setError(err.message || 'Failed to check in');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async () => {
    setError('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      const res = await attendanceApi.checkOut(notes);
      setTodayRecord(res);
      setNotes('');
      setSuccessMsg(
        `Successfully checked out at ${new Date(res.check_out).toLocaleTimeString()}! Logged: ${res.working_hours} hrs (${res.status})`
      );
      setTimeout(() => setSuccessMsg(''), 5000);
      fetchTodayAndSummary();
    } catch (err) {
      setError(err.message || 'Failed to check out');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Manual Attendance Submission
  const handleSaveManualAttendance = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        employee_id: parseInt(manualData.employee_id),
        date: manualData.date,
        status: manualData.status,
        notes: manualData.notes || null,
      };

      if (manualData.check_in) {
        payload.check_in = `${manualData.date}T${manualData.check_in}:00`;
      }
      if (manualData.check_out) {
        payload.check_out = `${manualData.date}T${manualData.check_out}:00`;
      }

      await attendanceApi.manualRecord(payload);
      setShowManualModal(false);
      setSuccessMsg('Attendance record created/updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOrganizationAttendance();
      fetchTodayAndSummary();
    } catch (err) {
      setError(err.message || 'Failed to record manual attendance');
    }
  };

  // Handle Automatic Absent Marking (Module 10)
  const handleRunAutoAbsent = async (e) => {
    e.preventDefault();
    setAutoAbsentLoading(true);
    setAutoAbsentResult(null);
    setError('');
    try {
      const res = await attendanceApi.autoAbsent({
        date: autoAbsentDate,
        dry_run: autoAbsentDryRun,
      });
      setAutoAbsentResult(res);
      if (!autoAbsentDryRun) {
        setSuccessMsg(res.message);
        setTimeout(() => setSuccessMsg(''), 5000);
        fetchOrganizationAttendance();
        fetchTodayAndSummary();
      }
    } catch (err) {
      setError(err.message || 'Failed to execute automatic absent marking');
    } finally {
      setAutoAbsentLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PRESENT':
        return <span className="status-badge badge-active">PRESENT</span>;
      case 'HALF_DAY':
        return <span className="status-badge badge-leave">HALF_DAY</span>;
      case 'ABSENT':
        return <span className="status-badge badge-inactive">ABSENT</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  // Check state of today
  const hasCheckedIn = Boolean(todayRecord && todayRecord.check_in);
  const hasCheckedOut = Boolean(todayRecord && todayRecord.check_out);

  // Calculate elapsed time if checked in but not checked out
  const getElapsedString = () => {
    if (!hasCheckedIn || hasCheckedOut) return null;
    const start = new Date(todayRecord.check_in);
    const diffMs = currentTime - start;
    if (diffMs < 0) return '00:00:00';
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <div className="section-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Management</h1>
          <p className="page-subtitle">
            Daily check-in, check-out, working hours calculation, and history logs
          </p>
        </div>
        <div className="live-clock-card">
          <Clock size={20} className="clock-icon" />
          <div className="clock-details">
            <span className="live-clock-time">
              {currentTime.toLocaleTimeString([], { hour12: true })}
            </span>
            <span className="live-clock-date">
              {currentTime.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* --- Check-In / Check-Out Action Panel --- */}
      <div className="attendance-action-card">
        <div className="action-card-header">
          <div>
            <h3 className="action-card-title">Today's Attendance Status</h3>
            <span className="action-card-date">
              {currentTime.toISOString().split('T')[0]}
            </span>
          </div>
          {hasCheckedOut ? (
            <span className="badge-checkout-complete">
              <Check size={16} /> Day Completed
            </span>
          ) : hasCheckedIn ? (
            <span className="badge-checked-in">
              <span className="pulse-dot"></span> Checked In (In Progress)
            </span>
          ) : (
            <span className="badge-not-checked-in">Not Checked In Yet</span>
          )}
        </div>

        <div className="action-card-body">
          {/* Current Day Stats */}
          <div className="attendance-times-grid">
            <div className="time-tile">
              <span className="time-tile-label">Check-In Time</span>
              <span className="time-tile-value">
                {hasCheckedIn
                  ? new Date(todayRecord.check_in).toLocaleTimeString()
                  : '--:--:--'}
              </span>
            </div>

            <div className="time-tile">
              <span className="time-tile-label">Check-Out Time</span>
              <span className="time-tile-value">
                {hasCheckedOut
                  ? new Date(todayRecord.check_out).toLocaleTimeString()
                  : '--:--:--'}
              </span>
            </div>

            <div className="time-tile">
              <span className="time-tile-label">Hours Logged</span>
              <span className="time-tile-value highlight">
                {hasCheckedOut
                  ? `${todayRecord.working_hours} hrs`
                  : hasCheckedIn
                  ? `${getElapsedString()} (Active)`
                  : '0.00 hrs'}
              </span>
            </div>

            <div className="time-tile">
              <span className="time-tile-label">Overtime</span>
              <span className="time-tile-value highlight">
                {hasCheckedOut && todayRecord.overtime_hours && Number(todayRecord.overtime_hours) > 0
                  ? `${todayRecord.overtime_hours} hrs`
                  : '0.00 hrs'}
              </span>
            </div>

            <div className="time-tile">
              <span className="time-tile-label">Status</span>
              <span className="time-tile-value">
                {todayRecord ? getStatusBadge(todayRecord.status) : 'PENDING'}
              </span>
            </div>

            <div className="time-tile">
              <span className="time-tile-label">Assigned Shift</span>
              <span className="time-tile-value" style={{ fontSize: '1rem', fontWeight: 600 }}>
                {todayRecord?.shift_name || 'Standard 09:30 AM'}
              </span>
              {todayRecord?.is_late && (
                <span style={{ fontSize: '0.72rem', color: '#dc2626', display: 'block', fontWeight: 600, marginTop: '2px' }}>
                  Late ({todayRecord.late_minutes}m)
                </span>
              )}
              {todayRecord?.is_early_departure && (
                <span style={{ fontSize: '0.72rem', color: '#b45309', display: 'block', fontWeight: 600, marginTop: '2px' }}>
                  Left Early ({todayRecord.early_departure_minutes}m)
                </span>
              )}
            </div>
          </div>

          {/* Action buttons and optional notes */}
          {!hasCheckedOut && (
            <div className="check-action-controls">
              <input
                type="text"
                placeholder="Optional notes or remarks for today (e.g. Remote work, Client meeting)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="attendance-note-input"
                disabled={actionLoading}
              />

              <div className="check-buttons-row">
                {/* Check In Button */}
                <button
                  type="button"
                  className="btn btn-check-in"
                  onClick={handleCheckIn}
                  disabled={hasCheckedIn || actionLoading}
                  title={
                    hasCheckedIn
                      ? 'Already checked in for today'
                      : 'Check In for today'
                  }
                >
                  <LogIn size={20} />
                  <span>
                    {hasCheckedIn ? 'Already Checked In' : 'Check In Now'}
                  </span>
                </button>

                {/* Check Out Button */}
                <button
                  type="button"
                  className="btn btn-check-out"
                  onClick={handleCheckOut}
                  disabled={!hasCheckedIn || hasCheckedOut || actionLoading}
                  title={
                    !hasCheckedIn
                      ? 'Cannot check out without checking in first'
                      : hasCheckedOut
                      ? 'Already checked out for today'
                      : 'Check Out and calculate working hours'
                  }
                >
                  <LogOut size={20} />
                  <span>
                    {hasCheckedOut ? 'Already Checked Out' : 'Check Out Now'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {hasCheckedOut && (
            <div className="checkout-summary-banner">
              <CheckCircle2 size={24} className="banner-icon" />
              <div>
                <strong>You have completed your shift for today!</strong>
                <p>
                  Check-in: {new Date(todayRecord.check_in).toLocaleTimeString()} |
                  Check-out: {new Date(todayRecord.check_out).toLocaleTimeString()} |
                  Total: {todayRecord.working_hours} hours ({todayRecord.status})
                  {Number(todayRecord.overtime_hours) > 0 ? ` | Overtime: ${todayRecord.overtime_hours} hrs` : ''}.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Summary Metric Cards --- */}
      {summary && (
        <div className="stats-grid mt-4">
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-blue">
              <Calendar size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Logged Days</span>
              <span className="stat-value">{summary.total_records}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-green">
              <CheckCircle2 size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Present Days</span>
              <span className="stat-value">{summary.present_days}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-yellow">
              <Clock size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Half Days</span>
              <span className="stat-value">{summary.half_days}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-purple">
              <FileSpreadsheet size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Hours</span>
              <span className="stat-value">{summary.total_hours} hrs</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-purple">
              <Clock size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Overtime</span>
              <span className="stat-value">{summary.total_overtime_hours ? `${summary.total_overtime_hours} hrs` : '0.00 hrs'}</span>
            </div>
          </div>
        </div>
      )}

      {/* --- Attendance Tables & Navigation Tabs --- */}
      <div className="attendance-tabs-container">
        <div className="attendance-sub-tabs">
          <button
            type="button"
            className={`sub-tab ${activeSubTab === 'my_history' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('my_history')}
          >
            <History size={16} /> My Attendance History
          </button>
          {isHrOrAdmin && (
            <button
              type="button"
              className={`sub-tab ${activeSubTab === 'all_records' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('all_records')}
            >
              <Building size={16} /> Organization Attendance (HR/Admin)
            </button>
          )}
        </div>

        {/* --- Sub Tab 1: My History --- */}
        {activeSubTab === 'my_history' && (
          <div className="table-card">
            <div className="table-card-header">
              <h3>My Attendance Log</h3>
              <span className="badge-sub">{myHistory.length} Records</span>
            </div>

            {historyLoading ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading history...
              </div>
            ) : myHistory.length === 0 ? (
              <div className="empty-state">
                <History size={40} className="empty-icon" />
                <h3>No attendance history yet</h3>
                <p>Your check-in and check-out records will be recorded here.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Shift</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Working Hours</th>
                      <th>Overtime</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myHistory.map((rec) => (
                      <tr key={rec.id}>
                        <td>
                          <strong>{rec.date}</strong>
                        </td>
                        <td>
                          {rec.shift_name ? (
                            <div>
                              <span style={{ fontWeight: 600 }}>{rec.shift_name}</span>
                              {rec.scheduled_start && rec.scheduled_end && (
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {rec.scheduled_start.substring(0, 5)} - {rec.scheduled_end.substring(0, 5)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Standard</span>
                          )}
                        </td>
                        <td>
                          {rec.check_in ? (
                            <div>
                              <div>
                                {new Date(rec.check_in).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </div>
                              {rec.is_late && (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    fontSize: '0.72rem',
                                    marginTop: '2px',
                                    display: 'inline-block',
                                  }}
                                >
                                  Late ({rec.late_minutes}m)
                                </span>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          {rec.check_out ? (
                            <div>
                              <div>
                                {new Date(rec.check_out).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </div>
                              {rec.is_early_departure && (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#fffbeb',
                                    color: '#b45309',
                                    fontSize: '0.72rem',
                                    marginTop: '2px',
                                    display: 'inline-block',
                                  }}
                                >
                                  Early ({rec.early_departure_minutes}m)
                                </span>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          {rec.working_hours !== null && rec.working_hours !== undefined
                            ? `${rec.working_hours} hrs`
                            : '-'}
                        </td>
                        <td>
                          {rec.overtime_hours !== null && rec.overtime_hours !== undefined && Number(rec.overtime_hours) > 0
                            ? `${rec.overtime_hours} hrs`
                            : '-'}
                        </td>
                        <td>{getStatusBadge(rec.status)}</td>
                        <td>
                          <span className="notes-text">{rec.notes || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- Sub Tab 2: Organization Attendance (HR/Admin) --- */}
        {activeSubTab === 'all_records' && isHrOrAdmin && (
          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Company Attendance Roster</h3>
                <p className="table-subtitle">
                  Inspect and manage attendance across all team members
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setAutoAbsentDate(new Date().toISOString().split('T')[0]);
                    setAutoAbsentDryRun(true);
                    setAutoAbsentResult(null);
                    setShowAutoAbsentModal(true);
                  }}
                >
                  <CalendarX size={16} /> Auto-Mark Absent
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setManualData({
                      employee_id: employeesList[0]?.id || '',
                      date: new Date().toISOString().split('T')[0],
                      check_in: '09:00',
                      check_out: '17:30',
                      status: 'PRESENT',
                      notes: '',
                    });
                    setShowManualModal(true);
                  }}
                >
                  <PlusCircle size={16} /> Manual Attendance Entry
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="filters-card no-margin">
              <div className="filter-group">
                <div className="select-with-icon">
                  <Calendar size={16} className="select-icon" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="filter-date-input"
                    title="Filter by date"
                  />
                  {filterDate && (
                    <button
                      className="clear-search-btn"
                      onClick={() => setFilterDate('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="select-with-icon">
                  <Filter size={16} className="select-icon" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="filter-select"
                  >
                    <option value="All">All Statuses</option>
                    <option value="PRESENT">PRESENT</option>
                    <option value="HALF_DAY">HALF_DAY</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                </div>

                <div className="select-with-icon">
                  <Building size={16} className="select-icon" />
                  <select
                    value={filterEmployeeId}
                    onChange={(e) => setFilterEmployeeId(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All Employees</option>
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {allLoading ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading organization records...
              </div>
            ) : allAttendance.length === 0 ? (
              <div className="empty-state">
                <Building size={40} className="empty-icon" />
                <h3>No attendance records match criteria</h3>
                <p>Try clearing filters or selecting another date.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Shift</th>
                      <th>Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Working Hours</th>
                      <th>Overtime</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAttendance.map((rec) => (
                      <tr key={rec.id}>
                        <td>
                          <strong>{rec.employee_name || `Emp #${rec.employee_id}`}</strong>
                        </td>
                        <td>
                          {rec.shift_name ? (
                            <span style={{ fontWeight: 600 }}>{rec.shift_name}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Standard</span>
                          )}
                        </td>
                        <td>{rec.date}</td>
                        <td>
                          {rec.check_in ? (
                            <div>
                              <div>
                                {new Date(rec.check_in).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </div>
                              {rec.is_late && (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    fontSize: '0.72rem',
                                    marginTop: '2px',
                                    display: 'inline-block',
                                  }}
                                >
                                  Late ({rec.late_minutes}m)
                                </span>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          {rec.check_out ? (
                            <div>
                              <div>
                                {new Date(rec.check_out).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </div>
                              {rec.is_early_departure && (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#fffbeb',
                                    color: '#b45309',
                                    fontSize: '0.72rem',
                                    marginTop: '2px',
                                    display: 'inline-block',
                                  }}
                                >
                                  Early ({rec.early_departure_minutes}m)
                                </span>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          {rec.working_hours !== null && rec.working_hours !== undefined
                            ? `${rec.working_hours} hrs`
                            : '-'}
                        </td>
                        <td>
                          {rec.overtime_hours !== null && rec.overtime_hours !== undefined && Number(rec.overtime_hours) > 0
                            ? `${rec.overtime_hours} hrs`
                            : '-'}
                        </td>
                        <td>{getStatusBadge(rec.status)}</td>
                        <td>
                          <span className="notes-text">{rec.notes || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- MANUAL ATTENDANCE ENTRY MODAL (HR/ADMIN) --- */}
      {showManualModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Manual Attendance Entry / Override</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowManualModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveManualAttendance} className="modal-body">
              <div className="form-group">
                <label>Employee *</label>
                <select
                  required
                  value={manualData.employee_id}
                  onChange={(e) =>
                    setManualData({ ...manualData, employee_id: e.target.value })
                  }
                >
                  <option value="">Select Employee...</option>
                  {employeesList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.designation} - {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Date *</label>
                  <input
                    type="date"
                    required
                    value={manualData.date}
                    onChange={(e) =>
                      setManualData({ ...manualData, date: e.target.value })
                    }
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Status *</label>
                  <select
                    value={manualData.status}
                    onChange={(e) =>
                      setManualData({ ...manualData, status: e.target.value })
                    }
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="HALF_DAY">HALF_DAY</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                </div>
              </div>

              {manualData.status !== 'ABSENT' && (
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Check In Time</label>
                    <input
                      type="time"
                      value={manualData.check_in}
                      onChange={(e) =>
                        setManualData({ ...manualData, check_in: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Check Out Time</label>
                    <input
                      type="time"
                      value={manualData.check_out}
                      onChange={(e) =>
                        setManualData({ ...manualData, check_out: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Approved sick leave, Client site visit"
                  value={manualData.notes}
                  onChange={(e) =>
                    setManualData({ ...manualData, notes: e.target.value })
                  }
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowManualModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- AUTO-MARK ABSENT MODAL (HR/ADMIN - MODULE 10) --- */}
      {showAutoAbsentModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Automatic Absent Marking (Module 10)</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowAutoAbsentModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRunAutoAbsent} className="modal-body">
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem', lineHeight: '1.4' }}>
                Automatically detects active employees with no attendance record and no approved leave on the selected completed workday, and records them as <strong>ABSENT</strong>. Weekends and configured public holidays are safely protected.
              </p>

              <div className="form-group">
                <label>Workday Date *</label>
                <input
                  type="date"
                  required
                  value={autoAbsentDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setAutoAbsentDate(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="autoAbsentDryRun"
                  checked={autoAbsentDryRun}
                  onChange={(e) => setAutoAbsentDryRun(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="autoAbsentDryRun" style={{ margin: 0, cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
                  Dry Run Mode (Preview counts without modifying database)
                </label>
              </div>

              {autoAbsentResult && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: autoAbsentResult.dry_run ? '#eff6ff' : '#f0fdf4',
                    border: `1px solid ${autoAbsentResult.dry_run ? '#bfdbfe' : '#bbf7d0'}`,
                    color: autoAbsentResult.dry_run ? '#1e40af' : '#166534',
                    fontSize: '0.85rem',
                  }}
                >
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{autoAbsentResult.message}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem' }}>
                    <span>Target Date: <strong>{autoAbsentResult.target_date}</strong></span>
                    <span>Total Evaluated: <strong>{autoAbsentResult.total_employees_evaluated}</strong></span>
                    <span>Already Logged: <strong>{autoAbsentResult.skipped_already_logged}</strong></span>
                    <span>On Leave: <strong>{autoAbsentResult.skipped_on_leave}</strong></span>
                    <span>Skipped (Non-Workday): <strong>{autoAbsentResult.skipped_non_workday ? 'Yes' : 'No'}</strong></span>
                    <span>
                      {autoAbsentResult.dry_run ? 'Would Mark Absent' : 'Marked Absent'}: <strong>{autoAbsentResult.marked_absent_count}</strong>
                    </span>
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAutoAbsentModal(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className={`btn ${autoAbsentDryRun ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={autoAbsentLoading}
                >
                  {autoAbsentLoading
                    ? 'Processing...'
                    : autoAbsentDryRun
                    ? 'Run Preview (Dry Run)'
                    : 'Confirm & Mark Absent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

