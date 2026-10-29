import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { onboardingApi, employeeApi } from '../services/api';
import {
  UserCheck,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  RefreshCw,
  Eye,
  X,
  Check,
  PartyPopper,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

const PRESET_TASKS = [
  'Submit Identification & Tax Documents',
  'Workstation, Laptop & Email Setup',
  'Sign Employee Handbook & Code of Conduct',
  'Complete IT Security & Compliance Training',
  'Enroll in Health & Medical Benefits',
  'Schedule 1-on-1 with Team Lead / Manager',
  'Join Team Chat & Communication Channels',
  'Review 30-60-90 Day Goals & Expectations',
];

export default function OnboardingManagement() {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // Active HR/Admin view subtab: 'overview' or 'tasks'
  const [subTab, setSubTab] = useState('overview');

  // Loading & notification states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Data states
  const [tasks, setTasks] = useState([]);
  const [myProgress, setMyProgress] = useState(null);
  const [allProgress, setAllProgress] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);

  // Filters for Employee & HR views
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('ALL');

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Employee detail checklist modal (for HR/Admin viewing a specific employee)
  const [inspectingEmployee, setInspectingEmployee] = useState(null);
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [employeeProgress, setEmployeeProgress] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Form states
  const getTodayPlusDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    task_name: '',
    due_date: getTodayPlusDays(7),
  });

  const [editForm, setEditForm] = useState({
    task_name: '',
    due_date: '',
    status: 'PENDING',
  });

  // Auto clear success alerts
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Initial load
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isHrOrAdmin) {
        // Fetch HR overview data, summary, and tasks
        const [summaryRes, progressRes, tasksRes, empRes] = await Promise.all([
          onboardingApi.getSummary().catch(() => null),
          onboardingApi.getAllProgress().catch(() => []),
          onboardingApi.list().catch(() => []),
          employeeApi.list({ limit: 200 }).catch(() => []),
        ]);
        setSummary(summaryRes);
        setAllProgress(Array.isArray(progressRes) ? progressRes : []);
        setTasks(Array.isArray(tasksRes) ? tasksRes : []);
        const empList = Array.isArray(empRes) ? empRes : (empRes.items || []);
        setEmployees(empList);
        if (empList.length > 0 && !assignForm.employee_id) {
          setAssignForm((prev) => ({ ...prev, employee_id: empList[0].id }));
        }
      } else {
        // Fetch personal tasks & progress
        const [progressRes, myTasksRes] = await Promise.all([
          onboardingApi.getMyProgress().catch(() => null),
          onboardingApi.list().catch(() => []),
        ]);
        setMyProgress(progressRes);
        setTasks(Array.isArray(myTasksRes) ? myTasksRes : []);
      }
    } catch (err) {
      console.error('Error loading onboarding data:', err);
      setError(err.message || 'Failed to load onboarding information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isHrOrAdmin]);

  // Toggle Task Status (Used by both Employee and HR/Admin)
  const handleToggleStatus = async (task) => {
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';

    // Optimistic UI updates
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: newStatus,
              completed_at: newStatus === 'COMPLETED' ? new Date().toISOString() : null,
              is_overdue:
                newStatus === 'PENDING' &&
                t.due_date &&
                new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0)),
            }
          : t
      )
    );

    if (employeeTasks.length > 0) {
      setEmployeeTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: newStatus,
                completed_at: newStatus === 'COMPLETED' ? new Date().toISOString() : null,
              }
            : t
        )
      );
    }

    try {
      await onboardingApi.updateStatus(task.id, newStatus);
      setSuccessMessage(
        newStatus === 'COMPLETED'
          ? `Marked "${task.task_name}" as completed!`
          : `Reopened task "${task.task_name}"`
      );

      // Refresh progress metrics
      if (!isHrOrAdmin) {
        const updatedProgress = await onboardingApi.getMyProgress();
        setMyProgress(updatedProgress);
      } else {
        const [summaryRes, progressRes] = await Promise.all([
          onboardingApi.getSummary(),
          onboardingApi.getAllProgress(),
        ]);
        setSummary(summaryRes);
        setAllProgress(progressRes);
        if (inspectingEmployee) {
          const empProg = await onboardingApi.getProgressByEmployee(inspectingEmployee.employee_id);
          setEmployeeProgress(empProg);
        }
      }
    } catch (err) {
      console.error('Error updating task status:', err);
      setError(err.message || 'Failed to update task status');
      // Revert on error
      loadData();
    }
  };

  // Open HR Inspector for a single employee
  const handleInspectEmployee = async (empProgressItem) => {
    setInspectingEmployee(empProgressItem);
    setInspectLoading(true);
    try {
      const [empTaskList, empProg] = await Promise.all([
        onboardingApi.getByEmployee(empProgressItem.employee_id),
        onboardingApi.getProgressByEmployee(empProgressItem.employee_id),
      ]);
      setEmployeeTasks(empTaskList);
      setEmployeeProgress(empProg);
    } catch (err) {
      console.error('Error fetching employee onboarding tasks:', err);
      setError('Failed to fetch tasks for ' + empProgressItem.employee_name);
    } finally {
      setInspectLoading(false);
    }
  };

  // Create Task (HR/Admin)
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!assignForm.task_name.trim()) {
      setError('Task name is required');
      return;
    }
    if (!assignForm.employee_id) {
      setError('Please select an employee');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await onboardingApi.create({
        employee_id: parseInt(assignForm.employee_id, 10),
        task_name: assignForm.task_name.trim(),
        due_date: assignForm.due_date || null,
      });

      setSuccessMessage('Onboarding task successfully assigned!');
      setShowAssignModal(false);
      setAssignForm({
        employee_id: employees.length > 0 ? employees[0].id : '',
        task_name: '',
        due_date: getTodayPlusDays(7),
      });

      // Reload HR overview and tasks
      await loadData();
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err.message || 'Failed to assign onboarding task');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Task Modal
  const openEditModal = (task) => {
    setSelectedTask(task);
    setEditForm({
      task_name: task.task_name,
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      status: task.status,
    });
    setShowEditModal(true);
  };

  // Submit Edit Task
  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (!editForm.task_name.trim()) {
      setError('Task name cannot be empty');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await onboardingApi.update(selectedTask.id, {
        task_name: editForm.task_name.trim(),
        due_date: editForm.due_date || null,
        status: editForm.status,
      });

      setSuccessMessage('Task updated successfully');
      setShowEditModal(false);
      setSelectedTask(null);

      await loadData();
      if (inspectingEmployee) {
        const empTaskList = await onboardingApi.getByEmployee(inspectingEmployee.employee_id);
        setEmployeeTasks(empTaskList);
        const empProg = await onboardingApi.getProgressByEmployee(inspectingEmployee.employee_id);
        setEmployeeProgress(empProg);
      }
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err.message || 'Failed to update task');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Task
  const openDeleteModal = (task) => {
    setSelectedTask(task);
    setShowDeleteModal(true);
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    setActionLoading(true);
    setError(null);
    try {
      await onboardingApi.delete(selectedTask.id);
      setSuccessMessage(`Deleted task "${selectedTask.task_name}"`);
      setShowDeleteModal(false);
      setSelectedTask(null);

      await loadData();
      if (inspectingEmployee) {
        const empTaskList = await onboardingApi.getByEmployee(inspectingEmployee.employee_id);
        setEmployeeTasks(empTaskList);
        const empProg = await onboardingApi.getProgressByEmployee(inspectingEmployee.employee_id);
        setEmployeeProgress(empProg);
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err.message || 'Failed to delete task');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Tasks for Employee or HR All Tasks view
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.task_name.toLowerCase().includes(q);
        const matchesEmp =
          t.employee_name && t.employee_name.toLowerCase().includes(q);
        if (!matchesName && !matchesEmp) return false;
      }
      // Status
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }
      // Overdue
      if (filterOverdue && !t.is_overdue) {
        return false;
      }
      // HR Employee dropdown filter
      if (
        isHrOrAdmin &&
        selectedEmployeeFilter !== 'ALL' &&
        t.employee_id !== parseInt(selectedEmployeeFilter, 10)
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery, statusFilter, filterOverdue, selectedEmployeeFilter, isHrOrAdmin]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set();
    allProgress.forEach((item) => {
      if (item.department) set.add(item.department);
    });
    return Array.from(set).sort();
  }, [allProgress]);

  // Filtered allProgress (HR overview)
  const filteredAllProgress = useMemo(() => {
    return allProgress.filter((item) => {
      if (departmentFilter !== 'ALL' && item.department !== departmentFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.employee_name.toLowerCase().includes(q);
        const matchesCode = item.employee_code.toLowerCase().includes(q);
        const matchesDept = item.department && item.department.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDept) return false;
      }
      return true;
    });
  }, [allProgress, departmentFilter, searchQuery]);

  return (
    <div className="onboarding-page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <div className="page-title-row">
            <UserCheck className="page-title-icon" size={28} />
            <h1 className="page-title">
              {isHrOrAdmin ? 'Employee Onboarding Management' : 'My Onboarding Checklist'}
            </h1>
          </div>
          <p className="page-subtitle">
            {isHrOrAdmin
              ? 'Assign, monitor, and manage onboarding checklists and milestone progress across employees.'
              : 'Complete your required onboarding tasks, verify policies, and get ready for your role at WorkSphere.'}
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadData}
            disabled={loading}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {isHrOrAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAssignModal(true)}
            >
              <Plus size={16} />
              <span>Assign Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="alert-close-btn"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="alert-close-btn"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REGULAR EMPLOYEE VIEW                                                      */}
      {/* ========================================================================= */}
      {!isHrOrAdmin && (
        <div className="employee-onboarding-view">
          {/* Progress Card */}
          {myProgress && (
            <div className="onboarding-progress-card">
              <div className="onboarding-progress-header">
                <div className="onboarding-progress-title">
                  <TrendingUp size={20} className="text-primary" />
                  <span>My Onboarding Progress</span>
                  <span
                    className={`badge ${
                      myProgress.is_completed ? 'badge-completed' : 'badge-pending'
                    }`}
                  >
                    {myProgress.progress_percentage}% Completed
                  </span>
                </div>
                <div className="onboarding-progress-metrics">
                  <span>
                    <strong>{myProgress.completed_tasks}</strong> of{' '}
                    <strong>{myProgress.total_tasks}</strong> Tasks Completed
                  </span>
                  {myProgress.overdue_tasks > 0 && (
                    <span className="badge badge-overdue">
                      <AlertTriangle size={13} /> {myProgress.overdue_tasks} Overdue
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar Track */}
              <div className="progress-track">
                <div
                  className={`progress-fill ${myProgress.is_completed ? 'completed' : ''}`}
                  style={{ width: `${Math.min(100, myProgress.progress_percentage)}%` }}
                />
              </div>
            </div>
          )}

          {/* Celebration Box when 100% finished */}
          {myProgress && myProgress.is_completed && myProgress.total_tasks > 0 && (
            <div className="celebration-box">
              <PartyPopper size={36} color="#059669" />
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  Congratulations! All onboarding tasks completed!
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem' }}>
                  You have successfully satisfied all onboarding requirements. Welcome aboard to
                  the WorkSphere team!
                </p>
              </div>
            </div>
          )}

          {/* Checklist Card */}
          <div className="onboarding-checklist-card">
            <div className="onboarding-checklist-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Onboarding Checklist
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Check off items as you finish them. Click any box to toggle completion.
                </p>
              </div>

              {/* Quick Filters */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="COMPLETED">Completed Only</option>
                </select>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filterOverdue}
                    onChange={(e) => setFilterOverdue(e.target.checked)}
                  />
                  <span>Overdue Only</span>
                </label>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                <p>Loading your onboarding tasks...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>No Tasks Found</h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {tasks.length === 0
                    ? 'You currently have no onboarding tasks assigned. Check back later or contact HR!'
                    : 'No tasks match your active filter criteria.'}
                </p>
              </div>
            ) : (
              <div className="checklist-items-list">
                {filteredTasks.map((t) => {
                  const isDone = t.status === 'COMPLETED';
                  return (
                    <div
                      key={t.id}
                      className={`checklist-item-row ${isDone ? 'is-completed' : ''}`}
                    >
                      <div className="checklist-left">
                        <button
                          type="button"
                          className={`checklist-checkbox-btn ${isDone ? 'checked' : ''}`}
                          onClick={() => handleToggleStatus(t)}
                          title={isDone ? 'Mark as Pending' : 'Mark as Completed'}
                        >
                          {isDone ? <Check size={16} strokeWidth={3} /> : null}
                        </button>
                        <div>
                          <div
                            className={`checklist-task-title ${isDone ? 'completed' : ''}`}
                          >
                            {t.task_name}
                          </div>
                          {t.completed_at && isDone && (
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: '#10b981',
                                marginTop: 3,
                              }}
                            >
                              Completed on {new Date(t.completed_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="checklist-meta">
                        {t.due_date && (
                          <span
                            className={
                              t.is_overdue
                                ? 'badge badge-overdue'
                                : 'badge badge-outline'
                            }
                            title="Due Date"
                          >
                            <Calendar size={12} />
                            <span>Due: {t.due_date}</span>
                            {t.is_overdue && <span>(Overdue)</span>}
                          </span>
                        )}

                        <span
                          className={`badge ${
                            isDone ? 'badge-completed' : 'badge-pending'
                          }`}
                        >
                          {isDone ? 'Completed' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HR / ADMIN MANAGEMENT VIEW                                                */}
      {/* ========================================================================= */}
      {isHrOrAdmin && (
        <div className="hr-onboarding-view">
          {/* KPI Summary Cards */}
          {summary && (
            <div className="kpi-grid" style={{ marginBottom: 24 }}>
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-title">Total Tasks</span>
                  <UserCheck className="kpi-icon" size={20} />
                </div>
                <div className="kpi-value">{summary.total_tasks}</div>
                <div className="kpi-footer">Across all employees</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-title">Completed</span>
                  <CheckCircle2 className="kpi-icon text-success" size={20} />
                </div>
                <div className="kpi-value text-success">{summary.completed_tasks}</div>
                <div className="kpi-footer">
                  {summary.overall_completion_rate}% Overall Completion Rate
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-title">Pending Tasks</span>
                  <Clock className="kpi-icon text-warning" size={20} />
                </div>
                <div className="kpi-value text-warning">{summary.pending_tasks}</div>
                <div className="kpi-footer">Awaiting employee submission</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-title">Overdue Tasks</span>
                  <AlertTriangle className="kpi-icon text-danger" size={20} />
                </div>
                <div className="kpi-value text-danger">{summary.overdue_tasks}</div>
                <div className="kpi-footer">Past target due dates</div>
              </div>
            </div>
          )}

          {/* Subnavigation Tabs */}
          <div className="subnav-tabs" style={{ marginBottom: 20 }}>
            <button
              type="button"
              className={`subnav-tab ${subTab === 'overview' ? 'active' : ''}`}
              onClick={() => setSubTab('overview')}
            >
              <Users size={16} />
              <span>Employee Overview ({allProgress.length})</span>
            </button>
            <button
              type="button"
              className={`subnav-tab ${subTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setSubTab('tasks')}
            >
              <CheckSquare size={16} />
              <span>All Tasks ({tasks.length})</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="filter-card" style={{ marginBottom: 20, padding: 16 }}>
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Search Bar */}
              <div className="search-bar" style={{ minWidth: 260, flex: 1 }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder={
                    subTab === 'overview'
                      ? 'Search employees by name, code, department...'
                      : 'Search tasks by name or employee...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Subtab-specific filters */}
              {subTab === 'overview' ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <select
                    className="filter-select"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="filter-select"
                    value={selectedEmployeeFilter}
                    onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                  >
                    <option value="ALL">All Employees</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>

                  <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Only</option>
                    <option value="COMPLETED">Completed Only</option>
                  </select>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filterOverdue}
                      onChange={(e) => setFilterOverdue(e.target.checked)}
                    />
                    <span>Overdue Only</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* SUBTAB 1: EMPLOYEE OVERVIEW */}
          {subTab === 'overview' && (
            <div className="table-card">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Task Breakdown</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>
                          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                          <div>Loading employee onboarding metrics...</div>
                        </td>
                      </tr>
                    ) : filteredAllProgress.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                          No employees match the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredAllProgress.map((row) => (
                        <tr key={row.employee_id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {row.employee_name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {row.employee_code} &bull; {row.employee_email}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-outline">
                              {row.department || 'General'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.85rem' }}>
                              <span style={{ color: '#15803d', fontWeight: 600 }}>
                                {row.completed_tasks} completed
                              </span>{' '}
                              / <span>{row.total_tasks} total</span>
                              {row.overdue_tasks > 0 && (
                                <span
                                  className="badge badge-overdue"
                                  style={{ marginLeft: 8, fontSize: '0.7rem' }}
                                >
                                  {row.overdue_tasks} overdue
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ minWidth: 160 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="progress-track" style={{ height: 8, flex: 1 }}>
                                <div
                                  className={`progress-fill ${row.is_completed ? 'completed' : ''}`}
                                  style={{ width: `${Math.min(100, row.progress_percentage)}%` }}
                                />
                              </div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, width: 42 }}>
                                {row.progress_percentage}%
                              </span>
                            </div>
                          </td>
                          <td>
                            {row.total_tasks === 0 ? (
                              <span className="badge badge-outline" style={{ color: '#64748b' }}>
                                No Tasks
                              </span>
                            ) : row.is_completed ? (
                              <span className="badge badge-completed">Completed</span>
                            ) : row.completed_tasks > 0 ? (
                              <span className="badge badge-pending">In Progress</span>
                            ) : (
                              <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                                Not Started
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => handleInspectEmployee(row)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Eye size={14} />
                              <span>View Checklist</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBTAB 2: ALL TASKS */}
          {subTab === 'tasks' && (
            <div className="table-card">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Task Name</th>
                      <th>Assigned Employee</th>
                      <th>Department</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Completed At</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 30 }}>
                          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                          <div>Loading onboarding tasks...</div>
                        </td>
                      </tr>
                    ) : filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                          No onboarding tasks match the filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map((t) => {
                        const isDone = t.status === 'COMPLETED';
                        return (
                          <tr key={t.id}>
                            <td>
                              <button
                                type="button"
                                className={`checklist-checkbox-btn ${isDone ? 'checked' : ''}`}
                                onClick={() => handleToggleStatus(t)}
                                title={isDone ? 'Mark as Pending' : 'Mark as Completed'}
                                style={{ width: 22, height: 22 }}
                              >
                                {isDone ? <Check size={14} strokeWidth={3} /> : null}
                              </button>
                            </td>
                            <td>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: isDone ? '#94a3b8' : '#1e293b',
                                  textDecoration: isDone ? 'line-through' : 'none',
                                }}
                              >
                                {t.task_name}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 500 }}>{t.employee_name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {t.employee_code}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-outline">
                                {t.department || 'General'}
                              </span>
                            </td>
                            <td>
                              {t.due_date ? (
                                <span
                                  className={
                                    t.is_overdue
                                      ? 'badge badge-overdue'
                                      : 'badge badge-outline'
                                  }
                                >
                                  {t.due_date}
                                  {t.is_overdue && ' (Overdue)'}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                  No Due Date
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  isDone ? 'badge-completed' : 'badge-pending'
                                }`}
                              >
                                {isDone ? 'Completed' : 'Pending'}
                              </span>
                            </td>
                            <td>
                              {t.completed_at ? (
                                <span style={{ fontSize: '0.8rem', color: '#15803d' }}>
                                  {new Date(t.completed_at).toLocaleDateString()}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => openEditModal(t)}
                                  title="Edit Task"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon text-danger"
                                  onClick={() => openDeleteModal(t)}
                                  title="Delete Task"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN TASK (HR/Admin)                                             */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={20} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Assign Onboarding Task</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAssignModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Employee select */}
                <div className="form-group">
                  <label className="form-label">
                    Assign To Employee <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={assignForm.employee_id}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, employee_id: e.target.value })
                    }
                    required
                  >
                    <option value="" disabled>
                      Select an employee...
                    </option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code}) - {emp.department || 'General'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Task name */}
                <div className="form-group">
                  <label className="form-label">
                    Task Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Submit Identification & Tax Documents"
                    value={assignForm.task_name}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, task_name: e.target.value })
                    }
                    required
                  />

                  {/* Preset Suggestions */}
                  <div style={{ marginTop: 8 }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Sparkles size={12} />
                      <span>Quick Presets (Click to apply):</span>
                    </div>
                    <div className="preset-pills-wrapper">
                      {PRESET_TASKS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="preset-pill-btn"
                          onClick={() =>
                            setAssignForm({ ...assignForm, task_name: preset })
                          }
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Due date */}
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={assignForm.due_date}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, due_date: e.target.value })
                    }
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    Leave blank if task has no strict target completion date.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAssignModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT TASK (HR/Admin)                                               */}
      {/* ========================================================================= */}
      {showEditModal && selectedTask && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit Onboarding Task</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateTask}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Assigned Employee</label>
                  <input
                    type="text"
                    className="form-control"
                    value={`${selectedTask.employee_name} (${selectedTask.employee_code})`}
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Task Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.task_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, task_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editForm.due_date}
                    onChange={(e) =>
                      setEditForm({ ...editForm, due_date: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value })
                    }
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowEditModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION (HR/Admin)                                     */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedTask && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} className="text-danger" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Delete Task</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem' }}>
                Are you sure you want to delete the onboarding task{' '}
                <strong>"{selectedTask.task_name}"</strong> assigned to{' '}
                <strong>{selectedTask.employee_name}</strong>?
              </p>
              <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                This action cannot be undone.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteTask}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSPECT SPECIFIC EMPLOYEE CHECKLIST (HR/Admin)                     */}
      {/* ========================================================================= */}
      {inspectingEmployee && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  {inspectingEmployee.employee_name}'s Onboarding Checklist
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                  {inspectingEmployee.employee_code} &bull; {inspectingEmployee.department || 'General'} &bull; {inspectingEmployee.employee_email}
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setInspectingEmployee(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Progress Summary in Modal */}
              {employeeProgress && (
                <div
                  style={{
                    background: '#f8fafc',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 16,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>Completion Rate</span>
                    <span
                      className={`badge ${
                        employeeProgress.is_completed ? 'badge-completed' : 'badge-pending'
                      }`}
                    >
                      {employeeProgress.progress_percentage}% ({employeeProgress.completed_tasks}/{employeeProgress.total_tasks})
                    </span>
                  </div>
                  <div className="progress-track" style={{ height: 8 }}>
                    <div
                      className={`progress-fill ${employeeProgress.is_completed ? 'completed' : ''}`}
                      style={{ width: `${Math.min(100, employeeProgress.progress_percentage)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Checklist list */}
              {inspectLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  <div>Loading employee tasks...</div>
                </div>
              ) : employeeTasks.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                  No tasks assigned to this employee yet.
                </div>
              ) : (
                <div className="checklist-items-list" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {employeeTasks.map((t) => {
                    const isDone = t.status === 'COMPLETED';
                    return (
                      <div
                        key={t.id}
                        className={`checklist-item-row ${isDone ? 'is-completed' : ''}`}
                        style={{ padding: '12px 16px' }}
                      >
                        <div className="checklist-left">
                          <button
                            type="button"
                            className={`checklist-checkbox-btn ${isDone ? 'checked' : ''}`}
                            onClick={() => handleToggleStatus(t)}
                            title={isDone ? 'Mark as Pending' : 'Mark as Completed'}
                            style={{ width: 22, height: 22 }}
                          >
                            {isDone ? <Check size={14} strokeWidth={3} /> : null}
                          </button>
                          <div>
                            <div
                              className={`checklist-task-title ${isDone ? 'completed' : ''}`}
                              style={{ fontSize: '0.9rem' }}
                            >
                              {t.task_name}
                            </div>
                            {t.due_date && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                                Due: {t.due_date}{' '}
                                {t.is_overdue && (
                                  <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                    (Overdue)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="checklist-meta">
                          <span
                            className={`badge ${
                              isDone ? 'badge-completed' : 'badge-pending'
                            }`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {isDone ? 'Completed' : 'Pending'}
                          </span>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => openEditModal(t)}
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon text-danger"
                            onClick={() => openDeleteModal(t)}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setInspectingEmployee(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setAssignForm({
                    employee_id: inspectingEmployee.employee_id,
                    task_name: '',
                    due_date: getTodayPlusDays(7),
                  });
                  setInspectingEmployee(null);
                  setShowAssignModal(true);
                }}
              >
                <Plus size={15} />
                <span>Add Task for Employee</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

