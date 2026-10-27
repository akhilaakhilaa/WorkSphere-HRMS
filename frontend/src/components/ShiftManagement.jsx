import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { shiftApi, employeeApi } from '../services/api';
import {
  Clock,
  Calendar,
  Users,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  Shield,
  ArrowRight,
  Filter,
  Search,
  Check,
  X,
  CalendarDays,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

export default function ShiftManagement() {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // Navigation tab: 'definitions' | 'assignments' | 'my_schedule'
  const [activeTab, setActiveTab] = useState(isHrOrAdmin ? 'definitions' : 'my_schedule');

  // Shifts state
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);

  // Assignments state
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  // My Schedule state
  const [myShift, setMyShift] = useState(null);
  const [myShiftLoading, setMyShiftLoading] = useState(false);
  const [myAssignments, setMyAssignments] = useState([]);

  // Filters for assignments tab
  const [searchEmp, setSearchEmp] = useState('');
  const [filterShiftId, setFilterShiftId] = useState('');
  const [filterActive, setFilterActive] = useState('ALL');

  // Modals
  const [showCreateShiftModal, setShowCreateShiftModal] = useState(false);
  const [showEditShiftModal, setShowEditShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    id: null,
    name: '',
    start_time: '09:00',
    end_time: '17:00',
    grace_period_minutes: 15,
    description: '',
  });

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    shift_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_active: true,
  });

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto clear messages
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Load shifts list
  const loadShifts = async () => {
    setShiftsLoading(true);
    try {
      const data = await shiftApi.list();
      setShifts(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load shift definitions: ' + err.message);
    } finally {
      setShiftsLoading(false);
    }
  };

  // Load assignments (HR/Admin)
  const loadAssignments = async () => {
    setAssignmentsLoading(true);
    try {
      const data = await shiftApi.listAssignments({
        shift_id: filterShiftId || undefined,
        is_active: filterActive !== 'ALL' ? filterActive : undefined,
      });
      setAssignments(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load shift assignments: ' + err.message);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  // Load employees for assignment dropdown
  const loadEmployees = async () => {
    if (!isHrOrAdmin) return;
    try {
      const data = await employeeApi.list();
      setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load user's own shift schedule
  const loadMySchedule = async () => {
    setMyShiftLoading(true);
    try {
      // Fetch my shift assignments
      const history = await shiftApi.listAssignments();
      setMyAssignments(history);
      const active = history.find((a) => a.is_active);
      setMyShift(active || null);
    } catch (err) {
      console.error(err);
    } finally {
      setMyShiftLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
    if (isHrOrAdmin) {
      loadEmployees();
      loadAssignments();
    }
    loadMySchedule();
  }, []);

  useEffect(() => {
    if (isHrOrAdmin && activeTab === 'assignments') {
      loadAssignments();
    }
  }, [filterShiftId, filterActive, activeTab]);

  // Format time helpers (HH:MM:SS to 12-hour format)
  const formatTime12h = (timeStr) => {
    if (!timeStr) return '';
    try {
      const parts = timeStr.split(':');
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1] || '00';
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  // Ensure time has seconds: "09:00" -> "09:00:00"
  const ensureTimeFormat = (timeStr) => {
    if (!timeStr) return '00:00:00';
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return `${parts[0]}:${parts[1]}:00`;
    }
    return timeStr;
  };

  // Create shift handler
  const handleCreateShift = async (e) => {
    e.preventDefault();
    setError('');
    const startFormatted = ensureTimeFormat(shiftForm.start_time);
    const endFormatted = ensureTimeFormat(shiftForm.end_time);

    if (startFormatted === endFormatted) {
      setError('Shift start time and end time cannot be identical.');
      return;
    }

    setSubmitting(true);
    try {
      await shiftApi.create({
        name: shiftForm.name.trim(),
        start_time: startFormatted,
        end_time: endFormatted,
        grace_period_minutes: parseInt(shiftForm.grace_period_minutes, 10) || 15,
        description: shiftForm.description?.trim() || undefined,
      });
      setSuccessMsg(`Shift "${shiftForm.name}" created successfully!`);
      setShowCreateShiftModal(false);
      setShiftForm({
        id: null,
        name: '',
        start_time: '09:00',
        end_time: '17:00',
        grace_period_minutes: 15,
        description: '',
      });
      loadShifts();
    } catch (err) {
      setError(err.message || 'Failed to create shift.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit modal
  const openEditModal = (shift) => {
    setShiftForm({
      id: shift.id,
      name: shift.name,
      start_time: shift.start_time ? shift.start_time.substring(0, 5) : '09:00',
      end_time: shift.end_time ? shift.end_time.substring(0, 5) : '17:00',
      grace_period_minutes: shift.grace_period_minutes,
      description: shift.description || '',
    });
    setShowEditShiftModal(true);
  };

  // Update shift handler
  const handleUpdateShift = async (e) => {
    e.preventDefault();
    setError('');
    const startFormatted = ensureTimeFormat(shiftForm.start_time);
    const endFormatted = ensureTimeFormat(shiftForm.end_time);

    if (startFormatted === endFormatted) {
      setError('Shift start time and end time cannot be identical.');
      return;
    }

    setSubmitting(true);
    try {
      await shiftApi.update(shiftForm.id, {
        name: shiftForm.name.trim(),
        start_time: startFormatted,
        end_time: endFormatted,
        grace_period_minutes: parseInt(shiftForm.grace_period_minutes, 10) || 15,
        description: shiftForm.description?.trim() || undefined,
      });
      setSuccessMsg(`Shift "${shiftForm.name}" updated successfully.`);
      setShowEditShiftModal(false);
      loadShifts();
      if (isHrOrAdmin) loadAssignments();
      loadMySchedule();
    } catch (err) {
      setError(err.message || 'Failed to update shift.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete shift handler
  const handleDeleteShift = async (shift) => {
    if (shift.active_employees_count > 0) {
      setError(
        `Cannot delete "${shift.name}" because ${shift.active_employees_count} employee(s) are currently assigned to it. Reassign employees first.`
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to delete shift "${shift.name}"?`)) {
      return;
    }

    try {
      await shiftApi.delete(shift.id);
      setSuccessMsg(`Shift "${shift.name}" deleted successfully.`);
      loadShifts();
    } catch (err) {
      setError(err.message || 'Failed to delete shift.');
    }
  };

  // Assign shift handler
  const handleAssignShift = async (e) => {
    e.preventDefault();
    setError('');

    if (!assignForm.employee_id || !assignForm.shift_id) {
      setError('Please select an employee and a shift.');
      return;
    }

    if (assignForm.end_date && assignForm.end_date < assignForm.start_date) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    try {
      await shiftApi.assign({
        employee_id: parseInt(assignForm.employee_id, 10),
        shift_id: parseInt(assignForm.shift_id, 10),
        start_date: assignForm.start_date,
        end_date: assignForm.end_date || undefined,
        is_active: assignForm.is_active,
      });
      setSuccessMsg('Shift assigned successfully! (Any previous active shift was updated)');
      setShowAssignModal(false);
      setAssignForm({
        employee_id: '',
        shift_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        is_active: true,
      });
      loadAssignments();
      loadShifts();
      loadMySchedule();
    } catch (err) {
      setError(err.message || 'Failed to assign shift.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle assignment status
  const handleToggleAssignmentStatus = async (assignment) => {
    const newStatus = !assignment.is_active;
    try {
      await shiftApi.updateAssignment(assignment.id, { is_active: newStatus });
      setSuccessMsg(`Assignment for ${assignment.employee_name} ${newStatus ? 'activated' : 'deactivated'}.`);
      loadAssignments();
      loadShifts();
      loadMySchedule();
    } catch (err) {
      setError(err.message || 'Failed to update assignment.');
    }
  };

  // Delete assignment handler
  const handleDeleteAssignment = async (assignment) => {
    if (!window.confirm(`Remove shift assignment for ${assignment.employee_name}?`)) {
      return;
    }
    try {
      await shiftApi.deleteAssignment(assignment.id);
      setSuccessMsg('Assignment record removed.');
      loadAssignments();
      loadShifts();
      loadMySchedule();
    } catch (err) {
      setError(err.message || 'Failed to remove assignment.');
    }
  };

  // Filtered assignments
  const filteredAssignments = assignments.filter((a) => {
    if (!searchEmp) return true;
    const term = searchEmp.toLowerCase();
    return (
      (a.employee_name && a.employee_name.toLowerCase().includes(term)) ||
      (a.department && a.department.toLowerCase().includes(term)) ||
      (a.shift_name && a.shift_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="page-container">
      {/* Header Banner */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Clock size={28} style={{ color: 'var(--primary)', verticalAlign: 'middle', marginRight: '8px' }} />
            Shift Management & Schedules
          </h1>
          <p className="page-subtitle">
            Configure working hours, overnight schedules, grace periods, and employee shift assignments.
          </p>
        </div>
        {isHrOrAdmin && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setShowAssignModal(true)}>
              <UserCheck size={18} /> Assign Employee Shift
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreateShiftModal(true)}>
              <PlusCircle size={18} /> Create New Shift
            </button>
          </div>
        )}
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={20} />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="attendance-sub-tabs" style={{ marginBottom: '1.5rem' }}>
        {isHrOrAdmin && (
          <>
            <button
              type="button"
              className={`sub-tab ${activeTab === 'definitions' ? 'active' : ''}`}
              onClick={() => setActiveTab('definitions')}
            >
              <Clock size={16} /> Shift Definitions ({shifts.length})
            </button>
            <button
              type="button"
              className={`sub-tab ${activeTab === 'assignments' ? 'active' : ''}`}
              onClick={() => setActiveTab('assignments')}
            >
              <Users size={16} /> Employee Assignments
            </button>
          </>
        )}
        <button
          type="button"
          className={`sub-tab ${activeTab === 'my_schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('my_schedule')}
        >
          <CalendarDays size={16} /> My Shift Schedule
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: SHIFT DEFINITIONS (HR / Admin)                          */}
      {/* ============================================================== */}
      {activeTab === 'definitions' && isHrOrAdmin && (
        <div className="table-card">
          <div className="table-card-header">
            <div>
              <h3>Configured Shifts</h3>
              <p className="table-subtitle">Defined organization working hours and grace period allowances</p>
            </div>
            <span className="badge-sub">{shifts.length} Total Shifts</span>
          </div>

          {shiftsLoading ? (
            <div className="loading-state">
              <span className="spinner"></span> Loading shifts...
            </div>
          ) : shifts.length === 0 ? (
            <div className="empty-state">
              <Clock size={48} className="empty-icon" />
              <h3>No shifts configured</h3>
              <p>Click "Create New Shift" above to add your organization's work schedules.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Shift Name</th>
                    <th>Working Hours</th>
                    <th>Type</th>
                    <th>Grace Period</th>
                    <th>Assigned Staff</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong style={{ fontSize: '0.95rem' }}>{s.name}</strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>
                          {formatTime12h(s.start_time)} &rarr; {formatTime12h(s.end_time)}
                        </span>
                      </td>
                      <td>
                        {s.is_overnight ? (
                          <span className="badge" style={{ background: '#312e81', color: '#c7d2fe', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Moon size={12} /> Overnight
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Sun size={12} /> Standard Day
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)' }}>{s.grace_period_minutes} mins</span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: s.active_employees_count > 0 ? '#ecfdf5' : '#f1f5f9',
                            color: s.active_employees_count > 0 ? '#047857' : '#64748b',
                            fontWeight: 600,
                          }}
                        >
                          {s.active_employees_count} active
                        </span>
                      </td>
                      <td>
                        <span className="notes-text">{s.description || '—'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Edit Shift"
                            onClick={() => openEditModal(s)}
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            title={
                              s.active_employees_count > 0
                                ? 'Cannot delete shift with active assignments'
                                : 'Delete Shift'
                            }
                            onClick={() => handleDeleteShift(s)}
                            disabled={s.active_employees_count > 0}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: EMPLOYEE SHIFT ASSIGNMENTS (HR / Admin)                 */}
      {/* ============================================================== */}
      {activeTab === 'assignments' && isHrOrAdmin && (
        <div className="table-card">
          <div className="table-card-header">
            <div>
              <h3>Employee Shift Assignments</h3>
              <p className="table-subtitle">Roster of employee shift assignments and scheduling status</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAssignModal(true)}>
              <PlusCircle size={15} /> Assign Shift
            </button>
          </div>

          {/* Filters Bar */}
          <div className="filters-card no-margin" style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="select-with-icon" style={{ flex: '1', minWidth: '220px' }}>
                <Search size={16} className="select-icon" />
                <input
                  type="text"
                  placeholder="Search by employee name or department..."
                  value={searchEmp}
                  onChange={(e) => setSearchEmp(e.target.value)}
                  className="filter-date-input"
                  style={{ width: '100%', paddingLeft: '2.2rem' }}
                />
              </div>

              <div className="select-with-icon">
                <Clock size={16} className="select-icon" />
                <select
                  value={filterShiftId}
                  onChange={(e) => setFilterShiftId(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Shifts</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatTime12h(s.start_time)} - {formatTime12h(s.end_time)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="select-with-icon">
                <Filter size={16} className="select-icon" />
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value)}
                  className="filter-select"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="true">Active Only</option>
                  <option value="false">Inactive / Past</option>
                </select>
              </div>
            </div>
          </div>

          {assignmentsLoading ? (
            <div className="loading-state">
              <span className="spinner"></span> Loading assignments...
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="empty-state">
              <Users size={48} className="empty-icon" />
              <h3>No shift assignments match</h3>
              <p>Try clearing filters or assigning a shift to an employee.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Shift</th>
                    <th>Shift Times</th>
                    <th>Effective Dates</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.employee_name || `Emp #${a.employee_id}`}</strong>
                        {a.designation && (
                          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {a.designation}
                          </span>
                        )}
                      </td>
                      <td>{a.department || '—'}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{a.shift_name}</span>
                        {a.is_overnight && (
                          <span className="badge" style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#312e81', color: '#c7d2fe' }}>
                            Night
                          </span>
                        )}
                      </td>
                      <td>
                        {formatTime12h(a.start_time)} &rarr; {formatTime12h(a.end_time)}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          From: {a.start_date}
                          {a.end_date ? ` to ${a.end_date}` : ' (Ongoing)'}
                        </span>
                      </td>
                      <td>
                        {a.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                            Inactive
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleAssignmentStatus(a)}
                            title={a.is_active ? 'Deactivate Assignment' : 'Activate Assignment'}
                          >
                            {a.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteAssignment(a)}
                            title="Remove assignment record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: MY SHIFT SCHEDULE                                      */}
      {/* ============================================================== */}
      {activeTab === 'my_schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active Shift Card */}
          <div className="attendance-action-card">
            <div className="action-card-header">
              <div>
                <h3 className="action-card-title">My Current Shift Schedule</h3>
                <span className="action-card-date">Active Organization Work Schedule</span>
              </div>
              {myShift ? (
                <span className="badge badge-success" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Active Assignment
                </span>
              ) : (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e', padding: '0.35rem 0.75rem' }}>
                  Default Standard Shift (09:30 AM)
                </span>
              )}
            </div>

            <div className="action-card-body">
              {myShiftLoading ? (
                <div className="loading-state">
                  <span className="spinner"></span> Loading your shift details...
                </div>
              ) : myShift ? (
                <div>
                  <div className="attendance-times-grid">
                    <div className="time-tile">
                      <span className="time-tile-label">Assigned Shift</span>
                      <span className="time-tile-value highlight">{myShift.shift_name}</span>
                    </div>

                    <div className="time-tile">
                      <span className="time-tile-label">Scheduled Start</span>
                      <span className="time-tile-value">{formatTime12h(myShift.start_time)}</span>
                    </div>

                    <div className="time-tile">
                      <span className="time-tile-label">Scheduled End</span>
                      <span className="time-tile-value">{formatTime12h(myShift.end_time)}</span>
                    </div>

                    <div className="time-tile">
                      <span className="time-tile-label">Grace Period</span>
                      <span className="time-tile-value">{myShift.grace_period_minutes} Minutes</span>
                    </div>

                    <div className="time-tile">
                      <span className="time-tile-label">Shift Type</span>
                      <span className="time-tile-value">
                        {myShift.is_overnight ? (
                          <span style={{ color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Moon size={14} /> Overnight Shift
                          </span>
                        ) : (
                          <span style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Sun size={14} /> Day Shift
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '1.25rem',
                      padding: '1rem',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <strong>Schedule Policies:</strong>
                    <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
                      <li>
                        Check-in deadline: <strong>{formatTime12h(myShift.start_time)}</strong> +{' '}
                        <strong>{myShift.grace_period_minutes} min</strong> grace period. Check-in after this threshold is
                        automatically recorded as late.
                      </li>
                      <li>
                        Early departure detection: Checking out prior to <strong>{formatTime12h(myShift.end_time)}</strong>{' '}
                        {myShift.is_overnight ? '(next day)' : ''} is tracked as early departure.
                      </li>
                      <li>Standard full-time threshold: 8.00 hours. Hours worked beyond 8.00 count toward overtime.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <Sun size={36} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
                  <h4 style={{ marginBottom: '0.4rem' }}>Standard Working Hours Applied</h4>
                  <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem' }}>
                    You currently have no customized shift assigned. Standard company working hours (09:30 AM start with
                    standard threshold) apply to your daily check-in.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Past Shift Assignments Table */}
          {myAssignments.length > 0 && (
            <div className="table-card">
              <div className="table-card-header">
                <h3>My Shift History</h3>
                <span className="badge-sub">{myAssignments.length} Assignments</span>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Shift</th>
                      <th>Working Hours</th>
                      <th>Grace Period</th>
                      <th>Effective From</th>
                      <th>Effective To</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAssignments.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.shift_name}</strong>
                          {a.is_overnight && (
                            <span className="badge" style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#312e81', color: '#c7d2fe' }}>
                              Overnight
                            </span>
                          )}
                        </td>
                        <td>
                          {formatTime12h(a.start_time)} &rarr; {formatTime12h(a.end_time)}
                        </td>
                        <td>{a.grace_period_minutes} mins</td>
                        <td>{a.start_date}</td>
                        <td>{a.end_date || 'Ongoing'}</td>
                        <td>
                          {a.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                              Past
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE SHIFT                                           */}
      {/* ============================================================== */}
      {showCreateShiftModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create New Organization Shift</h3>
              <button className="btn-close" onClick={() => setShowCreateShiftModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateShift}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Shift Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Morning Shift, Night Shift, Weekend Support"
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Start Time *</label>
                    <input
                      type="time"
                      required
                      value={shiftForm.start_time}
                      onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Time *</label>
                    <input
                      type="time"
                      required
                      value={shiftForm.end_time}
                      onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {shiftForm.start_time > shiftForm.end_time && (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: '#eef2ff',
                      borderRadius: '6px',
                      color: '#3730a3',
                      fontSize: '0.85rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Moon size={16} />
                    <span>Overnight shift detected: This shift crosses midnight into the following day.</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Grace Period (Minutes) *</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    value={shiftForm.grace_period_minutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, grace_period_minutes: e.target.value })}
                    className="form-input"
                  />
                  <small style={{ color: 'var(--text-muted)' }}>
                    Buffer minutes after start time before check-in is flagged as late.
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Core office hours for development and operations team..."
                    value={shiftForm.description}
                    onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateShiftModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT SHIFT                                             */}
      {/* ============================================================== */}
      {showEditShiftModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit Shift: {shiftForm.name}</h3>
              <button className="btn-close" onClick={() => setShowEditShiftModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateShift}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Shift Name *</label>
                  <input
                    type="text"
                    required
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Start Time *</label>
                    <input
                      type="time"
                      required
                      value={shiftForm.start_time}
                      onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Time *</label>
                    <input
                      type="time"
                      required
                      value={shiftForm.end_time}
                      onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {shiftForm.start_time > shiftForm.end_time && (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: '#eef2ff',
                      borderRadius: '6px',
                      color: '#3730a3',
                      fontSize: '0.85rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Moon size={16} />
                    <span>Overnight shift: crosses midnight into the following day.</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Grace Period (Minutes) *</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    value={shiftForm.grace_period_minutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, grace_period_minutes: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={shiftForm.description}
                    onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditShiftModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ASSIGN SHIFT TO EMPLOYEE                               */}
      {/* ============================================================== */}
      {showAssignModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Assign Shift to Employee</h3>
              <button className="btn-close" onClick={() => setShowAssignModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssignShift}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Employee *</label>
                  <select
                    required
                    value={assignForm.employee_id}
                    onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                    className="form-input"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.department} - {emp.designation})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Shift *</label>
                  <select
                    required
                    value={assignForm.shift_id}
                    onChange={(e) => setAssignForm({ ...assignForm, shift_id: e.target.value })}
                    className="form-input"
                  >
                    <option value="">-- Choose Shift --</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatTime12h(s.start_time)} to {formatTime12h(s.end_time)})
                        {s.is_overnight ? ' [Overnight]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={assignForm.start_date}
                      onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date (Optional)</label>
                    <input
                      type="date"
                      value={assignForm.end_date}
                      onChange={(e) => setAssignForm({ ...assignForm, end_date: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={assignForm.is_active}
                      onChange={(e) => setAssignForm({ ...assignForm, is_active: e.target.checked })}
                    />
                    <span style={{ fontWeight: 500 }}>Set as Active Shift</span>
                  </label>
                  <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Activating this assignment will automatically deactivate any previously active shift for this employee.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAssignModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Assigning...' : 'Assign Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

