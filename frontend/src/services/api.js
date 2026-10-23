// API Service for WorkSphere HRMS

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('worksphere_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    if (typeof data === 'object' && data !== null) {
      errorMessage = data.detail || data.message || JSON.stringify(data);
    } else if (typeof data === 'string' && data.length > 0) {
      errorMessage = data;
    }
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Module 1: Auth APIs
export const authApi = {
  login: (email, password) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email, password, role = 'EMPLOYEE') =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    }),
  getMe: () => apiRequest('/auth/me'),
};

// Module 2: Employee APIs
export const employeeApi = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.department) searchParams.append('department', params.department);
    if (params.status) searchParams.append('status', params.status);
    if (params.skip) searchParams.append('skip', params.skip);
    if (params.limit) searchParams.append('limit', params.limit);
    const query = searchParams.toString();
    return apiRequest(`/employees${query ? `?${query}` : ''}`);
  },
  getById: (id) => apiRequest(`/employees/${id}`),
  getMyProfile: () => apiRequest('/employees/me/profile'),
  create: (employeeData) =>
    apiRequest('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    }),
  update: (id, employeeData) =>
    apiRequest(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    }),
  delete: (id) =>
    apiRequest(`/employees/${id}`, {
      method: 'DELETE',
    }),
};

// Module 3: Attendance APIs
export const attendanceApi = {
  getToday: () => apiRequest('/attendance/today'),
  checkIn: (notes = '') =>
    apiRequest('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  checkOut: (notes = '') =>
    apiRequest('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  getMyHistory: () => apiRequest('/attendance/my-history'),
  getSummary: (employeeId = null) => {
    const query = employeeId ? `?employee_id=${employeeId}` : '';
    return apiRequest(`/attendance/summary${query}`);
  },
  listAll: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.employee_id) searchParams.append('employee_id', params.employee_id);
    if (params.date) searchParams.append('date', params.date);
    if (params.status) searchParams.append('status', params.status);
    if (params.skip) searchParams.append('skip', params.skip);
    if (params.limit) searchParams.append('limit', params.limit);
    const query = searchParams.toString();
    return apiRequest(`/attendance${query ? `?${query}` : ''}`);
  },
  manualRecord: (recordData) =>
    apiRequest('/attendance/manual', {
      method: 'POST',
      body: JSON.stringify(recordData),
    }),
  updateRecord: (id, updateData) =>
    apiRequest(`/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    }),
  autoAbsent: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.date) searchParams.append('target_date', params.date);
    if (params.dry_run !== undefined) searchParams.append('dry_run', params.dry_run);
    const query = searchParams.toString();
    return apiRequest(`/attendance/auto-absent${query ? `?${query}` : ''}`, {
      method: 'POST',
    });
  },
};

// Module 4: Leave Management APIs
export const leaveApi = {
  apply: (leaveData) =>
    apiRequest('/leaves', {
      method: 'POST',
      body: JSON.stringify(leaveData),
    }),
  getMyHistory: (status = null) => {
    const query = status ? `?status=${status}` : '';
    return apiRequest(`/leaves/my-history${query}`);
  },
  getSummary: (employeeId = null) => {
    const query = employeeId ? `?employee_id=${employeeId}` : '';
    return apiRequest(`/leaves/summary${query}`);
  },
  listAll: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.leave_type) searchParams.append('leave_type', params.leave_type);
    if (params.employee_id) searchParams.append('employee_id', params.employee_id);
    if (params.skip) searchParams.append('skip', params.skip);
    if (params.limit) searchParams.append('limit', params.limit);
    const query = searchParams.toString();
    return apiRequest(`/leaves${query ? `?${query}` : ''}`);
  },
  getById: (id) => apiRequest(`/leaves/${id}`),
  review: (id, reviewData) =>
    apiRequest(`/leaves/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify(reviewData),
    }),
  cancel: (id) =>
    apiRequest(`/leaves/${id}/cancel`, {
      method: 'PUT',
    }),
  // Module 11: Leave Policies & Balances
  getPolicies: () => apiRequest('/leaves/policies'),
  createPolicy: (policyData) =>
    apiRequest('/leaves/policies', {
      method: 'POST',
      body: JSON.stringify(policyData),
    }),
  updatePolicy: (policyId, policyData) =>
    apiRequest(`/leaves/policies/${policyId}`, {
      method: 'PUT',
      body: JSON.stringify(policyData),
    }),
  getMyBalances: () => apiRequest('/leaves/balances/me'),
  getBalances: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.employee_id) searchParams.append('employee_id', params.employee_id);
    const query = searchParams.toString();
    return apiRequest(`/leaves/balances${query ? `?${query}` : ''}`);
  },
  initializeBalances: (data = {}) =>
    apiRequest('/leaves/balances/initialize', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Module 5: Payroll Management APIs
export const payrollApi = {
  generate: (genData) =>
    apiRequest('/payroll/generate', {
      method: 'POST',
      body: JSON.stringify(genData),
    }),
  getMyHistory: (year = null) => {
    const query = year ? `?year=${year}` : '';
    return apiRequest(`/payroll/my-history${query}`);
  },
  getSummary: (month = null, year = null) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    const q = params.toString();
    return apiRequest(`/payroll/summary${q ? `?${q}` : ''}`);
  },
  listAll: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.month) searchParams.append('month', params.month);
    if (params.year) searchParams.append('year', params.year);
    if (params.status) searchParams.append('status', params.status);
    if (params.employee_id) searchParams.append('employee_id', params.employee_id);
    if (params.skip) searchParams.append('skip', params.skip);
    if (params.limit) searchParams.append('limit', params.limit);
    const query = searchParams.toString();
    return apiRequest(`/payroll${query ? `?${query}` : ''}`);
  },
  getById: (id) => apiRequest(`/payroll/${id}`),
  getBreakdown: (id) => apiRequest(`/payroll/${id}/breakdown`),
  getMonthlySummary: (month, year) =>
    apiRequest(`/payroll/monthly-summary?month=${month}&year=${year}`),
  update: (id, updateData) =>
    apiRequest(`/payroll/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    }),
  markPaid: (id, paymentMethod = 'BANK_TRANSFER') =>
    apiRequest(`/payroll/${id}/pay?payment_method=${paymentMethod}`, {
      method: 'PUT',
    }),
};

// Module 6: Dashboard & Analytics APIs
export const dashboardApi = {
  getAnalytics: () => apiRequest('/dashboard/analytics'),
  getMyStats: () => apiRequest('/dashboard/my-stats'),
  getNotifications: (limit = 20) => apiRequest(`/dashboard/notifications?limit=${limit}`),
  markNotificationRead: (id) =>
    apiRequest(`/dashboard/notifications/${id}/read`, {
      method: 'PUT',
    }),
};

// Module 7: Notifications APIs
export const notificationApi = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.unread_only) searchParams.append('unread_only', 'true');
    if (params.type) searchParams.append('type', params.type);
    if (params.skip) searchParams.append('skip', params.skip);
    if (params.limit) searchParams.append('limit', params.limit);
    const query = searchParams.toString();
    return apiRequest(`/notifications${query ? `?${query}` : ''}`);
  },
  getUnreadCount: () => apiRequest('/notifications/unread-count'),
  getSummary: () => apiRequest('/notifications/summary'),
  markRead: (id) =>
    apiRequest(`/notifications/${id}/read`, {
      method: 'PUT',
    }),
  markAllRead: () =>
    apiRequest('/notifications/read-all', {
      method: 'PUT',
    }),
  broadcastAlert: (broadcastData) =>
    apiRequest('/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(broadcastData),
    }),
};

// Module 13: Admin Controls & User Management APIs
export const userApi = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.role && params.role !== 'ALL') searchParams.append('role', params.role);
    if (params.is_active !== undefined && params.is_active !== null && params.is_active !== 'ALL') {
      searchParams.append('is_active', params.is_active);
    }
    if (params.skip) searchParams.append('skip', params.skip);
    if (params.limit) searchParams.append('limit', params.limit);
    const query = searchParams.toString();
    return apiRequest(`/users${query ? `?${query}` : ''}`);
  },
  getById: (id) => apiRequest(`/users/${id}`),
  create: (userData) =>
    apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  update: (id, userData) =>
    apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),
  updateRole: (id, role) =>
    apiRequest(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  updateStatus: (id, isActive) =>
    apiRequest(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }),
  delete: (id) =>
    apiRequest(`/users/${id}`, {
      method: 'DELETE',
    }),
};

