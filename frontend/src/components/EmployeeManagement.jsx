import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { employeeApi } from '../services/api';
import {
  Users,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Building2,
  Briefcase,
  Calendar,
  DollarSign,
  UserCheck,
  X,
  Shield,
  Star,
  Clock,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

const DEPARTMENTS = [
  'All Departments',
  'Management',
  'Human Resources',
  'Engineering',
  'Sales',
  'Operations',
  'Marketing',
  'Customer Support',
  'Finance',
];

const ROLES = ['All Roles', 'ADMIN', 'HR', 'EMPLOYEE'];
const STATUSES = ['All Statuses', 'ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'];
const ATTENDANCE_OPTIONS = [
  { label: 'All Attendance', value: 'All' },
  { label: 'Present', value: 'PRESENT' },
  { label: 'Late', value: 'LATE' },
  { label: 'Absent', value: 'ABSENT' },
  { label: 'Half Day', value: 'HALF_DAY' },
];
const PERFORMANCE_OPTIONS = [
  { label: 'All Ratings', value: 'All' },
  { label: 'High Rating (>= 4★)', value: 'HIGH' },
  { label: 'Average Rating (3★)', value: 'AVERAGE' },
  { label: 'Low Rating (<= 2★)', value: 'LOW' },
  { label: '5 Stars', value: '5' },
  { label: '4 Stars', value: '4' },
  { label: '3 Stars', value: '3' },
  { label: '2 Stars', value: '2' },
  { label: '1 Star', value: '1' },
];

export default function EmployeeManagement() {
  const { role, user } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';
  const isAdmin = role === 'ADMIN';

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');

  // Module 20: Filters & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedAttendance, setSelectedAttendance] = useState('All');
  const [selectedPerformance, setSelectedPerformance] = useState('All');

  // Sorting & Pagination States
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    designation: '',
    department: 'Engineering',
    joining_date: new Date().toISOString().split('T')[0],
    salary: '',
    status: 'ACTIVE',
    create_user_account: false,
    user_email: '',
    user_password: '',
  });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (selectedDept !== 'All Departments') params.department = selectedDept;
      if (selectedRole !== 'All Roles') params.role = selectedRole;
      if (selectedStatus !== 'All Statuses') params.status = selectedStatus;
      if (selectedAttendance !== 'All') params.attendance_status = selectedAttendance;
      if (selectedPerformance !== 'All') params.performance = selectedPerformance;

      const data = await employeeApi.search(params);
      setEmployees(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch employees.');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    sortBy,
    sortOrder,
    searchQuery,
    selectedDept,
    selectedRole,
    selectedStatus,
    selectedAttendance,
    selectedPerformance,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchEmployees]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDept('All Departments');
    setSelectedRole('All Roles');
    setSelectedStatus('All Statuses');
    setSelectedAttendance('All');
    setSelectedPerformance('All');
    setSortBy('id');
    setSortOrder('asc');
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedDept !== 'All Departments' ||
    selectedRole !== 'All Roles' ||
    selectedStatus !== 'All Statuses' ||
    selectedAttendance !== 'All' ||
    selectedPerformance !== 'All';

  const resetForm = () => {
    setFormData({
      full_name: '',
      designation: '',
      department: 'Engineering',
      joining_date: new Date().toISOString().split('T')[0],
      salary: '',
      status: 'ACTIVE',
      create_user_account: false,
      user_email: '',
      user_password: '',
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      full_name: emp.full_name,
      designation: emp.designation,
      department: emp.department,
      joining_date: emp.joining_date,
      salary: emp.salary,
      status: emp.status,
    });
    setShowEditModal(true);
  };

  const handleOpenView = (emp) => {
    setSelectedEmployee(emp);
    setShowViewModal(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        full_name: formData.full_name,
        designation: formData.designation,
        department: formData.department,
        joining_date: formData.joining_date,
        salary: parseFloat(formData.salary),
        status: formData.status,
      };

      if (formData.create_user_account && formData.user_email && formData.user_password) {
        payload.create_user_account = true;
        payload.user_email = formData.user_email;
        payload.user_password = formData.user_password;
      }

      await employeeApi.create(payload);
      setShowAddModal(false);
      resetForm();
      setNotification('Employee created successfully!');
      setTimeout(() => setNotification(''), 4000);
      fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to create employee');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setError('');
    try {
      const payload = {
        full_name: formData.full_name,
        designation: formData.designation,
        department: formData.department,
        joining_date: formData.joining_date,
        salary: parseFloat(formData.salary),
        status: formData.status,
      };

      await employeeApi.update(selectedEmployee.id, payload);
      setShowEditModal(false);
      setSelectedEmployee(null);
      setNotification('Employee updated successfully!');
      setTimeout(() => setNotification(''), 4000);
      fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to update employee');
    }
  };

  const handleDelete = async (emp) => {
    if (
      !window.confirm(
        `Are you sure you want to delete employee "${emp.full_name}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    setError('');
    try {
      await employeeApi.delete(emp.id);
      setNotification(`Employee "${emp.full_name}" deleted.`);
      setTimeout(() => setNotification(''), 4000);
      fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to delete employee');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="status-badge badge-active">Active</span>;
      case 'INACTIVE':
        return <span className="status-badge badge-inactive">Inactive</span>;
      case 'ON_LEAVE':
        return <span className="status-badge badge-leave">On Leave</span>;
      case 'TERMINATED':
        return <span className="status-badge badge-terminated">Terminated</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getRoleBadge = (roleVal) => {
    switch (roleVal) {
      case 'ADMIN':
        return <span className="status-badge badge-admin">Admin</span>;
      case 'HR':
        return <span className="status-badge badge-hr">HR</span>;
      case 'EMPLOYEE':
        return <span className="status-badge badge-employee">Employee</span>;
      default:
        return <span className="badge-att-none">—</span>;
    }
  };

  const getAttendanceBadge = (emp) => {
    if (!emp.attendance_status) {
      return <span className="badge-att-none">—</span>;
    }
    if (emp.attendance_status === 'LATE' || emp.is_late) {
      return (
        <span className="badge-att badge-att-late" title="Checked in late">
          <Clock size={12} /> Late
        </span>
      );
    }
    if (emp.attendance_status === 'PRESENT') {
      return (
        <span className="badge-att badge-att-present" title="Present today">
          <CheckCircle2 size={12} /> Present
        </span>
      );
    }
    if (emp.attendance_status === 'ABSENT') {
      return (
        <span className="badge-att badge-att-absent" title="Absent today">
          <AlertCircle size={12} /> Absent
        </span>
      );
    }
    if (emp.attendance_status === 'HALF_DAY') {
      return (
        <span className="badge-att badge-att-halfday" title="Half day attendance">
          Half Day
        </span>
      );
    }
    return <span className="badge-att">{emp.attendance_status}</span>;
  };

  const getPerformanceBadge = (emp) => {
    if (emp.performance_level === 'HIGH') {
      return (
        <span className="badge-perf badge-perf-high" title={`Rating: ${emp.performance_rating} / 5`}>
          <Star size={12} fill="currentColor" /> {emp.performance_rating}★ High
        </span>
      );
    }
    if (emp.performance_level === 'AVERAGE') {
      return (
        <span className="badge-perf badge-perf-avg" title={`Rating: ${emp.performance_rating} / 5`}>
          <Star size={12} fill="currentColor" /> {emp.performance_rating}★ Avg
        </span>
      );
    }
    if (emp.performance_level === 'LOW') {
      return (
        <span className="badge-perf badge-perf-low" title={`Rating: ${emp.performance_rating} / 5`}>
          <Star size={12} fill="currentColor" /> {emp.performance_rating}★ Low
        </span>
      );
    }
    return <span className="badge-perf badge-perf-none">No Review</span>;
  };

  const renderSortIndicator = (field) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={14} className="sort-icon-muted" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={14} className="sort-icon-active" />
    ) : (
      <ArrowDown size={14} className="sort-icon-active" />
    );
  };


  return (
    <div className="section-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Management</h1>
          <p className="page-subtitle">
            Manage organization staff, roles, departments, and employee directory
          </p>
        </div>
        {isHrOrAdmin && (
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={18} /> Add New Employee
          </button>
        )}
      </div>

      {notification && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} /> {notification}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Stats Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper icon-blue">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Results</span>
            <span className="stat-value">{totalCount}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper icon-green">
            <UserCheck size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Current Page Staff</span>
            <span className="stat-value">
              {employees.filter((e) => e.status === 'ACTIVE').length} / {employees.length}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper icon-purple">
            <Building2 size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Departments Represented</span>
            <span className="stat-value">
              {new Set(employees.map((e) => e.department)).size}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="filters-card">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search employees by name, department, or role..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              title="Clear Search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Multi-Filter Controls */}
        <div className="filter-toolbar-grid">
          {/* Department Filter */}
          <div className="select-with-icon">
            <Building2 size={16} className="select-icon" />
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setPage(1);
              }}
              className="filter-select"
              title="Filter by Department"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="select-with-icon">
            <Shield size={16} className="select-icon" />
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
              className="filter-select"
              title="Filter by User Role"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === 'All Roles' ? 'All Roles' : `Role: ${r}`}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="select-with-icon">
            <Filter size={16} className="select-icon" />
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="filter-select"
              title="Filter by Employment Status"
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st === 'All Statuses' ? 'All Statuses' : `Status: ${st}`}
                </option>
              ))}
            </select>
          </div>

          {/* Attendance Status Filter */}
          <div className="select-with-icon">
            <Clock size={16} className="select-icon" />
            <select
              value={selectedAttendance}
              onChange={(e) => {
                setSelectedAttendance(e.target.value);
                setPage(1);
              }}
              className="filter-select"
              title="Filter by Attendance Status"
            >
              {ATTENDANCE_OPTIONS.map((att) => (
                <option key={att.value} value={att.value}>
                  {att.label}
                </option>
              ))}
            </select>
          </div>

          {/* Performance Rating Filter */}
          <div className="select-with-icon">
            <Star size={16} className="select-icon" />
            <select
              value={selectedPerformance}
              onChange={(e) => {
                setSelectedPerformance(e.target.value);
                setPage(1);
              }}
              className="filter-select"
              title="Filter by Performance Review Rating"
            >
              {PERFORMANCE_OPTIONS.map((perf) => (
                <option key={perf.value} value={perf.value}>
                  {perf.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-reset-filters"
              onClick={handleResetFilters}
              title="Reset all filters to defaults"
            >
              <RotateCcw size={14} /> Reset Filters
            </button>
          )}

          {/* Result Count Badge */}
          <span className="results-count-badge">
            {totalCount} {totalCount === 1 ? 'record' : 'records'}
          </span>
        </div>
      </div>

      {/* Employees Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <span className="spinner"></span> Loading employee records...
          </div>
        ) : employees.length === 0 ? (
          <div className="empty-state">
            <Users size={48} className="empty-icon" />
            <h3>No employees found</h3>
            <p>
              No employees match your active search and filter criteria. Try adjusting or clearing filters.
            </p>
            {hasActiveFilters && (
              <button
                className="btn btn-secondary mt-3"
                onClick={handleResetFilters}
              >
                <RotateCcw size={16} /> Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      className="clickable-th"
                      onClick={() => handleSort('full_name')}
                      title="Sort by Name"
                    >
                      <div className="th-sort-wrapper">
                        Employee {renderSortIndicator('full_name')}
                      </div>
                    </th>
                    <th
                      className="clickable-th"
                      onClick={() => handleSort('designation')}
                      title="Sort by Designation"
                    >
                      <div className="th-sort-wrapper">
                        Designation {renderSortIndicator('designation')}
                      </div>
                    </th>
                    <th
                      className="clickable-th"
                      onClick={() => handleSort('department')}
                      title="Sort by Department"
                    >
                      <div className="th-sort-wrapper">
                        Department {renderSortIndicator('department')}
                      </div>
                    </th>
                    <th>Role</th>
                    <th>Attendance</th>
                    <th>Performance</th>
                    <th
                      className="clickable-th"
                      onClick={() => handleSort('joining_date')}
                      title="Sort by Joining Date"
                    >
                      <div className="th-sort-wrapper">
                        Joining Date {renderSortIndicator('joining_date')}
                      </div>
                    </th>
                    {isHrOrAdmin && (
                      <th
                        className="clickable-th"
                        onClick={() => handleSort('salary')}
                        title="Sort by Salary"
                      >
                        <div className="th-sort-wrapper">
                          Salary {renderSortIndicator('salary')}
                        </div>
                      </th>
                    )}
                    <th
                      className="clickable-th"
                      onClick={() => handleSort('status')}
                      title="Sort by Status"
                    >
                      <div className="th-sort-wrapper">
                        Status {renderSortIndicator('status')}
                      </div>
                    </th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <div className="user-cell">
                          <div className="avatar-circle">
                            {emp.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="user-cell-name">{emp.full_name}</span>
                            {emp.user_email && (
                              <span className="user-cell-email">{emp.user_email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="designation-text">{emp.designation}</span>
                      </td>
                      <td>
                        <span className="dept-tag">{emp.department}</span>
                      </td>
                      <td>{getRoleBadge(emp.role)}</td>
                      <td>{getAttendanceBadge(emp)}</td>
                      <td>{getPerformanceBadge(emp)}</td>
                      <td>{emp.joining_date}</td>
                      {isHrOrAdmin && (
                        <td className="salary-text">
                          ${Number(emp.salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      <td>{getStatusBadge(emp.status)}</td>
                      <td className="text-right">
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn-action view"
                            onClick={() => handleOpenView(emp)}
                            title="View Profile"
                          >
                            <Eye size={16} />
                          </button>
                          {isHrOrAdmin && (
                            <button
                              type="button"
                              className="btn-action edit"
                              onClick={() => handleOpenEdit(emp)}
                              title="Edit Employee"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn-action delete"
                              onClick={() => handleDelete(emp)}
                              title="Delete Employee"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-bar">
              <div className="pagination-info">
                {totalCount === 0
                  ? '0 employees'
                  : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(
                      page * pageSize,
                      totalCount
                    )} of ${totalCount} employees`}
              </div>
              <div className="pagination-controls">
                <div className="pagination-page-size-wrapper">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="pagination-page-size-select"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  title="Previous Page"
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <span className="pagination-page-indicator">
                  Page {page} of {Math.max(1, totalPages)}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  title="Next Page"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- ADD EMPLOYEE MODAL --- */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Add New Employee</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="modal-body">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lead Software Architect"
                    value={formData.designation}
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                  >
                    {DEPARTMENTS.filter((d) => d !== 'All Departments').map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Joining Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.joining_date}
                    onChange={(e) =>
                      setFormData({ ...formData, joining_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Annual Salary ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 75000"
                    value={formData.salary}
                    onChange={(e) =>
                      setFormData({ ...formData, salary: e.target.value })
                    }
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
              </div>

              {/* Login Account creation section */}
              <div className="account-creation-box">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.create_user_account}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        create_user_account: e.target.checked,
                      })
                    }
                  />
                  <span>Create System Login Account for this Employee</span>
                </label>

                {formData.create_user_account && (
                  <div className="form-row mt-3">
                    <div className="form-group flex-1">
                      <label>User Email *</label>
                      <input
                        type="email"
                        required={formData.create_user_account}
                        placeholder="employee@company.com"
                        value={formData.user_email}
                        onChange={(e) =>
                          setFormData({ ...formData, user_email: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Initial Password *</label>
                      <input
                        type="password"
                        required={formData.create_user_account}
                        placeholder="••••••••••••"
                        value={formData.user_password}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            user_password: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT EMPLOYEE MODAL --- */}
      {showEditModal && selectedEmployee && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit Employee: {selectedEmployee.full_name}</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-body">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Designation *</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                  >
                    {DEPARTMENTS.filter((d) => d !== 'All Departments').map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Joining Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.joining_date}
                    onChange={(e) =>
                      setFormData({ ...formData, joining_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Annual Salary ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.salary}
                    onChange={(e) =>
                      setFormData({ ...formData, salary: e.target.value })
                    }
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VIEW PROFILE MODAL --- */}
      {showViewModal && selectedEmployee && (
        <div className="modal-backdrop">
          <div className="modal-card modal-profile">
            <div className="modal-header">
              <h3>Employee Profile</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowViewModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body profile-content">
              <div className="profile-banner">
                <div className="profile-avatar-large">
                  {selectedEmployee.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-banner-info">
                  <h2>{selectedEmployee.full_name}</h2>
                  <p className="profile-designation">{selectedEmployee.designation}</p>
                  <div className="profile-badges">
                    <span className="dept-tag">{selectedEmployee.department}</span>
                    {getStatusBadge(selectedEmployee.status)}
                  </div>
                </div>
              </div>

              <div className="profile-details-grid">
                <div className="profile-detail-item">
                  <span className="detail-label">Employee ID</span>
                  <span className="detail-value">EMP-{String(selectedEmployee.id).padStart(4, '0')}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Associated Email</span>
                  <span className="detail-value">{selectedEmployee.user_email || 'Not Linked'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">System Role</span>
                  <span className="detail-value">{getRoleBadge(selectedEmployee.role)}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Today's Attendance</span>
                  <span className="detail-value">{getAttendanceBadge(selectedEmployee)}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Performance Rating</span>
                  <span className="detail-value">{getPerformanceBadge(selectedEmployee)}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Joining Date</span>
                  <span className="detail-value">{selectedEmployee.joining_date}</span>
                </div>
                {isHrOrAdmin && (
                  <div className="profile-detail-item">
                    <span className="detail-label">Annual Compensation</span>
                    <span className="detail-value text-success">
                      ${Number(selectedEmployee.salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="profile-detail-item">
                  <span className="detail-label">Created At</span>
                  <span className="detail-value">
                    {new Date(selectedEmployee.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Last Updated</span>
                  <span className="detail-value">
                    {new Date(selectedEmployee.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </button>
                {isHrOrAdmin && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setShowViewModal(false);
                      handleOpenEdit(selectedEmployee);
                    }}
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

