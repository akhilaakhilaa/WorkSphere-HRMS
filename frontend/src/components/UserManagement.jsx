import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userApi, employeeApi } from '../services/api';
import {
  ShieldCheck,
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Edit,
  Trash2,
  Lock,
  Mail,
  User as UserIcon,
  Briefcase,
  Eye,
  Power,
  ShieldAlert,
} from 'lucide-react';

export default function UserManagement() {
  const { role: currentUserRole, user: currentUser } = useAuth();
  const isAdmin = currentUserRole === 'ADMIN';

  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    is_active: true,
    employee_id: '',
  });

  // Edit User Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    role: 'EMPLOYEE',
    is_active: true,
    password: '',
    employee_id: '',
  });

  // Details Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Status Change Confirmation Modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (selectedRole !== 'ALL') params.role = selectedRole;
      if (selectedStatus !== 'ALL') params.is_active = selectedStatus === 'ACTIVE';

      const [usersData, empsData] = await Promise.all([
        userApi.list(params),
        employees.length === 0 ? employeeApi.list() : Promise.resolve(employees),
      ]);
      setUsers(usersData);
      if (employees.length === 0) setEmployees(empsData);
    } catch (err) {
      setError(err.message || 'Failed to load user accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [searchQuery, selectedRole, selectedStatus]);

  // Handle Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');

    if (!createForm.username.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setError('Username, email, and password are required');
      return;
    }

    if (createForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const payload = {
        username: createForm.username.trim().toLowerCase(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
        is_active: createForm.is_active,
      };

      if (createForm.employee_id) {
        payload.employee_id = parseInt(createForm.employee_id);
      }

      const res = await userApi.create(payload);
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
        is_active: true,
        employee_id: '',
      });
      setSuccessMsg(`User account '${res.username}' successfully created!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user account');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (u) => {
    setEditUser(u);
    setEditForm({
      username: u.username || '',
      email: u.email,
      role: u.role,
      is_active: u.is_active,
      password: '',
      employee_id: u.employee_id ? String(u.employee_id) : '',
    });
    setShowEditModal(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setError('');

    try {
      const payload = {
        username: editForm.username.trim().toLowerCase(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        is_active: editForm.is_active,
      };

      if (editForm.password.trim()) {
        if (editForm.password.length < 6) {
          setError('New password must be at least 6 characters');
          return;
        }
        payload.password = editForm.password;
      }

      if (editForm.employee_id) {
        payload.employee_id = parseInt(editForm.employee_id);
      } else if (editUser.employee_id && !editForm.employee_id) {
        // Unlink
        payload.employee_id = 0;
      }

      await userApi.update(editUser.id, payload);
      setShowEditModal(false);
      setEditUser(null);
      setSuccessMsg(`User '${payload.username}' successfully updated!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user account');
    }
  };

  // Handle Toggle Status
  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    setError('');
    const newStatus = !statusTarget.is_active;

    try {
      await userApi.updateStatus(statusTarget.id, newStatus);
      setShowStatusModal(false);
      setSuccessMsg(`Account '${statusTarget.username}' marked as ${newStatus ? 'ACTIVE' : 'INACTIVE'}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setStatusTarget(null);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to change account status');
    }
  };

  // Open Details Modal
  const handleOpenDetail = async (u) => {
    setSelectedDetail(null);
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const details = await userApi.getById(u.id);
      setSelectedDetail(details);
    } catch (err) {
      setSelectedDetail(u);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Handle Delete User
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError('');

    try {
      await userApi.delete(deleteTarget.id);
      setShowDeleteModal(false);
      setSuccessMsg(`User '${deleteTarget.username}' was safely deleted.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user account');
    }
  };

  if (!isAdmin) {
    return (
      <div className="section-container">
        <div className="alert alert-error">
          <ShieldAlert size={20} />
          <span>Access Denied: You must be an Administrator to access User Management controls.</span>
        </div>
      </div>
    );
  }

  // Calculate Metrics
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;

  return (
    <div className="section-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Controls & User Management</h1>
          <p className="page-subtitle">
            Administer system accounts, assign roles, manage activation status, and maintain organizational security
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError('');
            setShowCreateModal(true);
          }}
        >
          <UserPlus size={18} /> Create New User
        </button>
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

      {/* KPI Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper icon-blue">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Users</span>
            <span className="stat-value">{totalCount}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper icon-green">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Active Accounts</span>
            <span className="stat-value">{activeCount}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper icon-yellow">
            <Power size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Inactive Accounts</span>
            <span className="stat-value" style={{ color: inactiveCount > 0 ? '#dc2626' : 'inherit' }}>
              {inactiveCount}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper icon-purple">
            <ShieldCheck size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Administrators</span>
            <span className="stat-value">{adminCount}</span>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="table-card">
        <div className="table-card-header">
          <div>
            <h3>System User Directory</h3>
            <p className="table-subtitle">View and configure system credentials, roles, and account permissions</p>
          </div>
        </div>

        {/* Filters Card */}
        <div className="filters-card no-margin">
          <div className="filter-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search username, email, or employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                }}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
            </div>

            {/* Role Filter */}
            <div className="select-with-icon">
              <Filter size={16} className="select-icon" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="HR">HR</option>
                <option value="EMPLOYEE">EMPLOYEE</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="select-with-icon">
              <Power size={16} className="select-icon" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="loading-state">
            <span className="spinner"></span> Loading user accounts...
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <Users size={40} className="empty-icon" />
            <h3>No user accounts found</h3>
            <p>Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Linked Employee Profile</th>
                  <th>Account Status</th>
                  <th>Created Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isCurrentLoggedInUser = currentUser && currentUser.id === u.id;

                  return (
                    <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.75 }}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                            @{u.username || 'unspecified'}
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{u.email}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.role === 'ADMIN'
                              ? 'badge-admin'
                              : u.role === 'HR'
                              ? 'badge-hr'
                              : 'badge-employee'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {u.full_name ? (
                          <div>
                            <strong style={{ fontSize: '0.9rem' }}>{u.full_name}</strong>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              {u.designation || 'Staff'} &bull; {u.department || 'General'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '0.85rem' }}>
                            Unlinked Account
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${u.is_active ? 'badge-active' : 'badge-terminated'}`}>
                          {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="action-buttons" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-action view"
                            title="View Account Details & Audit"
                            onClick={() => handleOpenDetail(u)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-action edit"
                            title="Edit User Credentials / Role"
                            onClick={() => handleOpenEdit(u)}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-primary'}`}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.78rem',
                              background: u.is_active ? '#fef2f2' : '#ecfdf5',
                              borderColor: u.is_active ? '#fca5a5' : '#a7f3d0',
                              color: u.is_active ? '#b91c1c' : '#047857',
                            }}
                            title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                            onClick={() => {
                              setStatusTarget(u);
                              setShowStatusModal(true);
                            }}
                          >
                            <Power size={13} style={{ marginRight: '3px' }} />
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="btn-action delete"
                            title="Delete User"
                            onClick={() => {
                              setDeleteTarget(u);
                              setShowDeleteModal(true);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- CREATE USER MODAL --- */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3>Create System User Account</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="modal-body">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Username *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="e.g. john.doe"
                      value={createForm.username}
                      onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group flex-1">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    placeholder="e.g. john@worksphere.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Initial Password * (min 6 characters)</label>
                  <input
                    type="password"
                    placeholder="Enter secure initial password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label>System Role *</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="HR">HR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Link to Existing Employee (Optional)</label>
                <select
                  value={createForm.employee_id}
                  onChange={(e) => setCreateForm({ ...createForm, employee_id: e.target.value })}
                >
                  <option value="">No Employee Profile (Account Only)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.designation} &bull; {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <input
                  type="checkbox"
                  id="create_is_active"
                  checked={createForm.is_active}
                  onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="create_is_active" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
                  Active Account (Immediate system access)
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT USER MODAL --- */}
      {showEditModal && editUser && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3>Edit User: @{editUser.username}</h3>
              <button className="modal-close-btn" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-body">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Assigned Role *</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="HR">HR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Account Status</label>
                  <select
                    value={editForm.is_active ? 'true' : 'false'}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                  >
                    <option value="true">ACTIVE</option>
                    <option value="false">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Reset Password (leave blank to keep current password)</label>
                <input
                  type="password"
                  placeholder="Enter new password (optional)"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Associated Employee</label>
                <select
                  value={editForm.employee_id}
                  onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
                >
                  <option value="">Unlinked (No Employee Profile)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.designation} &bull; {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- STATUS TOGGLE CONFIRMATION MODAL --- */}
      {showStatusModal && statusTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>
                {statusTarget.is_active ? 'Deactivate Account' : 'Activate Account'}
              </h3>
              <button className="modal-close-btn" onClick={() => setShowStatusModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to {statusTarget.is_active ? 'deactivate' : 'activate'} user account{' '}
                <strong>@{statusTarget.username}</strong> ({statusTarget.email})?
              </p>

              {statusTarget.is_active ? (
                <div className="alert alert-info" style={{ marginTop: '12px' }}>
                  <Power size={18} />
                  <span>
                    Deactivating this account will immediately revoke access and prevent future logins. All historical attendance, leave, and payroll records remain completely safe.
                  </span>
                </div>
              ) : (
                <div className="alert alert-success" style={{ marginTop: '12px' }}>
                  <CheckCircle2 size={18} />
                  <span>
                    Activating this account will allow the user to authenticate and access the WorkSphere HRMS.
                  </span>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn ${statusTarget.is_active ? 'btn-danger' : 'btn-primary'}`}
                  style={statusTarget.is_active ? { background: '#dc2626', borderColor: '#dc2626', color: '#fff' } : {}}
                  onClick={handleConfirmStatusChange}
                >
                  Confirm {statusTarget.is_active ? 'Deactivation' : 'Activation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- USER DETAILS & AUDIT MODAL --- */}
      {showDetailModal && (
        <div className="modal-backdrop">
          <div className="modal-card modal-profile" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>User Account Details & Audit</h3>
              <button className="modal-close-btn" onClick={() => setShowDetailModal(false)}>
                <X size={20} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading user metadata...
              </div>
            ) : selectedDetail ? (
              <div className="modal-body profile-content">
                <div className="profile-banner">
                  <div className="brand-badge" style={{ margin: 0, width: 48, height: 48 }}>
                    <UserIcon size={24} />
                  </div>
                  <div className="profile-banner-info">
                    <h2>@{selectedDetail.username}</h2>
                    <p className="profile-designation">
                      {selectedDetail.email} &bull; User ID #{selectedDetail.id}
                    </p>
                    <div className="profile-badges">
                      <span className={`badge ${selectedDetail.role === 'ADMIN' ? 'badge-admin' : selectedDetail.role === 'HR' ? 'badge-hr' : 'badge-employee'}`}>
                        {selectedDetail.role}
                      </span>
                      <span className={`status-badge ${selectedDetail.is_active ? 'badge-active' : 'badge-terminated'}`}>
                        {selectedDetail.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audit Grid */}
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', margin: '16px 0 8px' }}>
                  Linked Organizational Records
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Attendance Logs</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>
                      {selectedDetail.attendance_records_count || 0}
                    </strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Leave Applications</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>
                      {selectedDetail.leave_requests_count || 0}
                    </strong>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Payroll Slips</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>
                      {selectedDetail.payroll_records_count || 0}
                    </strong>
                  </div>
                </div>

                {selectedDetail.can_delete ? (
                  <div className="alert alert-info">
                    <CheckCircle2 size={16} />
                    <span>Safe to delete: This account has no linked attendance, leave, or payroll history.</span>
                  </div>
                ) : (
                  <div className="alert alert-info" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                    <AlertCircle size={16} />
                    <span>Protected: This user is associated with historical organization records. To revoke access, deactivate the account rather than deleting.</span>
                  </div>
                )}

                <div className="modal-footer" style={{ marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* --- DELETE USER MODAL --- */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Confirm User Deletion</h3>
              <button className="modal-close-btn" onClick={() => setShowDeleteModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete user <strong>@{deleteTarget.username}</strong> ({deleteTarget.email})?
              </p>

              {deleteTarget.full_name && (
                <div className="alert alert-info" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginTop: '12px' }}>
                  <AlertCircle size={18} />
                  <span>
                    Note: Accounts linked to employee records with attendance, leave, or payroll history cannot be deleted. If historical records exist, the deletion will be rejected. Use <strong>Deactivate</strong> instead.
                  </span>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                  onClick={handleConfirmDelete}
                >
                  <Trash2 size={16} /> Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

