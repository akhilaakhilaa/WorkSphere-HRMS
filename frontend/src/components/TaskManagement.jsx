import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { taskApi, employeeApi } from '../services/api';
import {
  CheckSquare,
  Square,
  Clock,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Users,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  RefreshCw,
  Eye,
  X,
  Check,
  FileText,
  ListTodo,
} from 'lucide-react';

export default function TaskManagement() {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // State
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('ALL');
  const [filterOverdue, setFilterOverdue] = useState(false);

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Helper date function (e.g. today + 7 days)
  const getTodayPlusDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Forms
  const [assignForm, setAssignForm] = useState({
    assigned_to: '',
    title: '',
    description: '',
    due_date: getTodayPlusDays(7),
  });

  const [editForm, setEditForm] = useState({
    assigned_to: '',
    title: '',
    description: '',
    due_date: '',
    status: 'PENDING',
  });

  // Auto clear success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isHrOrAdmin) {
        const [tasksRes, summaryRes, empRes] = await Promise.all([
          taskApi.list(),
          taskApi.getSummary().catch(() => null),
          employeeApi.list({ limit: 200 }).catch(() => []),
        ]);
        setTasks(Array.isArray(tasksRes) ? tasksRes : []);
        setSummary(summaryRes);
        const empList = Array.isArray(empRes) ? empRes : (empRes.items || []);
        setEmployees(empList);
        if (empList.length > 0 && !assignForm.assigned_to) {
          setAssignForm((prev) => ({ ...prev, assigned_to: empList[0].id }));
        }
      } else {
        const [tasksRes, summaryRes] = await Promise.all([
          taskApi.list(),
          taskApi.getSummary().catch(() => null),
        ]);
        setTasks(Array.isArray(tasksRes) ? tasksRes : []);
        setSummary(summaryRes);
      }
    } catch (err) {
      console.error('Error loading task data:', err);
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isHrOrAdmin]);

  // Toggle Task Status (Employee & HR/Admin)
  const handleToggleStatus = async (task) => {
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';

    // Optimistic UI update
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

    try {
      await taskApi.updateStatus(task.id, newStatus);
      setSuccessMessage(
        newStatus === 'COMPLETED'
          ? `Task "${task.title}" marked as completed!`
          : `Task "${task.title}" reopened.`
      );
      // Refresh summary
      const updatedSummary = await taskApi.getSummary();
      setSummary(updatedSummary);
    } catch (err) {
      console.error('Error updating task status:', err);
      setError(err.message || 'Failed to update task status');
      loadData();
    }
  };

  // Submit Task Assignment (HR/Admin)
  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!assignForm.title.trim()) {
      setError('Task title is required.');
      return;
    }
    if (!assignForm.assigned_to) {
      setError('Please select an employee.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await taskApi.assign({
        assigned_to: parseInt(assignForm.assigned_to, 10),
        title: assignForm.title.trim(),
        description: assignForm.description.trim() || null,
        due_date: assignForm.due_date,
      });

      setSuccessMessage('Task assigned successfully!');
      setShowAssignModal(false);
      setAssignForm({
        assigned_to: employees.length > 0 ? employees[0].id : '',
        title: '',
        description: '',
        due_date: getTodayPlusDays(7),
      });
      await loadData();
    } catch (err) {
      console.error('Error assigning task:', err);
      setError(err.message || 'Failed to assign task');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (task) => {
    setSelectedTask(task);
    setEditForm({
      assigned_to: task.assigned_to,
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      status: task.status,
    });
    setShowEditModal(true);
  };

  // Submit Edit
  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (!editForm.title.trim()) {
      setError('Task title cannot be empty.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await taskApi.update(selectedTask.id, {
        assigned_to: parseInt(editForm.assigned_to, 10),
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        due_date: editForm.due_date || null,
        status: editForm.status,
      });

      setSuccessMessage('Task updated successfully.');
      setShowEditModal(false);
      setSelectedTask(null);
      await loadData();
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err.message || 'Failed to update task');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (task) => {
    setSelectedTask(task);
    setShowDeleteModal(true);
  };

  // Submit Delete
  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    setActionLoading(true);
    setError(null);
    try {
      await taskApi.delete(selectedTask.id);
      setSuccessMessage(`Task "${selectedTask.title}" deleted successfully.`);
      setShowDeleteModal(false);
      setSelectedTask(null);
      await loadData();
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err.message || 'Failed to delete task');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description && t.description.toLowerCase().includes(q);
        const matchEmp = t.assigned_employee_name && t.assigned_employee_name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchEmp) return false;
      }
      // Status
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }
      // Overdue
      if (filterOverdue && !t.is_overdue) {
        return false;
      }
      // HR/Admin employee dropdown filter
      if (
        isHrOrAdmin &&
        selectedEmployeeFilter !== 'ALL' &&
        t.assigned_to !== parseInt(selectedEmployeeFilter, 10)
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery, statusFilter, filterOverdue, selectedEmployeeFilter, isHrOrAdmin]);

  return (
    <div className="tasks-page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-info">
          <div className="page-title-row">
            <ListTodo className="page-title-icon" size={28} />
            <h1 className="page-title">
              {isHrOrAdmin ? 'Task Assignment & Tracking' : 'My Assigned Tasks'}
            </h1>
          </div>
          <p className="page-subtitle">
            {isHrOrAdmin
              ? 'Assign responsibilities, monitor operational progress, and track due dates across the team.'
              : 'View your pending tasks, update completion statuses, and stay on top of target deadlines.'}
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadData}
            disabled={loading}
            title="Refresh Tasks"
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

      {/* KPI Summary Cards */}
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Total Tasks</span>
              <ListTodo className="kpi-icon" size={20} />
            </div>
            <div className="kpi-value">{summary.total_tasks}</div>
            <div className="kpi-footer">
              {isHrOrAdmin ? 'Across all employees' : 'Assigned to your queue'}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Pending Tasks</span>
              <Clock className="kpi-icon text-warning" size={20} />
            </div>
            <div className="kpi-value text-warning">{summary.pending_tasks}</div>
            <div className="kpi-footer">Currently in progress</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Completed Tasks</span>
              <CheckCircle2 className="kpi-icon text-success" size={20} />
            </div>
            <div className="kpi-value text-success">{summary.completed_tasks}</div>
            <div className="kpi-footer">Successfully fulfilled</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Overdue Tasks</span>
              <AlertTriangle className="kpi-icon text-danger" size={20} />
            </div>
            <div className="kpi-value text-danger">{summary.overdue_tasks}</div>
            <div className="kpi-footer">Past target due date</div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
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
                isHrOrAdmin
                  ? 'Search tasks by title, description, or employee...'
                  : 'Search your tasks by title or description...'
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

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {isHrOrAdmin && (
              <select
                className="filter-select"
                value={selectedEmployeeFilter}
                onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
              >
                <option value="ALL">All Assignees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            )}

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
        </div>
      </div>

      {/* Task List / Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}></th>
                <th>Task Title</th>
                {isHrOrAdmin && <th>Assigned To</th>}
                {isHrOrAdmin && <th>Department</th>}
                <th>Due Date</th>
                <th>Status</th>
                <th>Completed At</th>
                {isHrOrAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isHrOrAdmin ? 8 : 5} style={{ textAlign: 'center', padding: 36 }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                    <div>Loading tasks...</div>
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={isHrOrAdmin ? 8 : 5}
                    style={{ textAlign: 'center', padding: 44, color: '#64748b' }}
                  >
                    <ListTodo size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                    <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>No Tasks Found</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                      {tasks.length === 0
                        ? 'No tasks are currently assigned.'
                        : 'No tasks match your active filter criteria.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const isDone = t.status === 'COMPLETED';
                  return (
                    <tr key={t.id} className={isDone ? 'is-completed' : ''}>
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
                          {t.title}
                        </div>
                        {t.description && (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: '#64748b',
                              marginTop: 2,
                              maxWidth: 380,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {t.description}
                          </div>
                        )}
                      </td>
                      {isHrOrAdmin && (
                        <td>
                          <div style={{ fontWeight: 500 }}>{t.assigned_employee_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {t.assigned_employee_code}
                          </div>
                        </td>
                      )}
                      {isHrOrAdmin && (
                        <td>
                          <span className="badge badge-outline">
                            {t.department || 'General'}
                          </span>
                        </td>
                      )}
                      <td>
                        <span
                          className={
                            t.is_overdue
                              ? 'badge badge-overdue'
                              : 'badge badge-outline'
                          }
                        >
                          <Calendar size={12} />
                          <span>{t.due_date}</span>
                          {t.is_overdue && <span>(Overdue)</span>}
                        </span>
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
                      {isHrOrAdmin && (
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
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN TASK (HR/Admin)                                             */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={20} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Assign New Task</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAssignModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignTask}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">
                    Assign To Employee <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={assignForm.assigned_to}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, assigned_to: e.target.value })
                    }
                    required
                  >
                    <option value="" disabled>
                      Select an employee...
                    </option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code}) &bull; {emp.department || 'General'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Task Title <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Prepare quarterly financial reconciliation report"
                    value={assignForm.title}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, title: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Instructions</label>
                  <textarea
                    rows={4}
                    className="form-control"
                    placeholder="Detailed steps, deliverable expectations, reference links..."
                    value={assignForm.description}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, description: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Target Due Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={assignForm.due_date}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, due_date: e.target.value })
                    }
                    required
                  />
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
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit Task Details</h3>
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
                  <label className="form-label">Reassign Employee</label>
                  <select
                    className="form-control"
                    value={editForm.assigned_to}
                    onChange={(e) =>
                      setEditForm({ ...editForm, assigned_to: e.target.value })
                    }
                    required
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code}) &bull; {emp.department || 'General'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Task Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm({ ...editForm, title: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={4}
                    className="form-control"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
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
                    required
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
                <Trash2 size={20} className="text-danger" />
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
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>
                Are you sure you want to permanently delete task{' '}
                <strong>"{selectedTask.title}"</strong> assigned to{' '}
                <strong>{selectedTask.assigned_employee_name}</strong>?
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
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
    </div>
  );
}

