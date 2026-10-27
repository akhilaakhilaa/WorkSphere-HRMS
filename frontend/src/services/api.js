// API Service for WorkSphere HRMS

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('worksphere_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
  search: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.department && params.department !== 'All Departments') searchParams.append('department', params.department);
    if (params.role && params.role !== 'All Roles') searchParams.append('role', params.role);
    if (params.status && params.status !== 'All Statuses') searchParams.append('status', params.status);
    if (params.attendance_status && params.attendance_status !== 'All') searchParams.append('attendance_status', params.attendance_status);
    if (params.attendance_date) searchParams.append('attendance_date', params.attendance_date);
    if (params.performance && params.performance !== 'All') searchParams.append('performance', params.performance);
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    if (params.page) searchParams.append('page', params.page);
    if (params.page_size) searchParams.append('page_size', params.page_size);
    const query = searchParams.toString();
    return apiRequest(`/employees/search${query ? `?${query}` : ''}`);
  },
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
  getAll: (params = {}) => employeeApi.list(params),
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
  // Module 15: Leave Calendar, Team Availability & Conflict APIs
  getCalendar: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.department && params.department !== 'ALL') searchParams.append('department', params.department);
    if (params.employee_id) searchParams.append('employee_id', params.employee_id);
    if (params.include_pending !== undefined) searchParams.append('include_pending', params.include_pending);
    const query = searchParams.toString();
    return apiRequest(`/leaves/calendar${query ? `?${query}` : ''}`);
  },
  getTeamAvailability: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.target_date) searchParams.append('target_date', params.target_date);
    if (params.department && params.department !== 'ALL') searchParams.append('department', params.department);
    const query = searchParams.toString();
    return apiRequest(`/leaves/team-availability${query ? `?${query}` : ''}`);
  },
  getConflicts: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.department && params.department !== 'ALL') searchParams.append('department', params.department);
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.min_overlap) searchParams.append('min_overlap', params.min_overlap);
    const query = searchParams.toString();
    return apiRequest(`/leaves/conflicts${query ? `?${query}` : ''}`);
  },
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

// Module 7 & 19: Notifications APIs
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
  getById: (id) => apiRequest(`/notifications/${id}`),
  markRead: (id) =>
    apiRequest(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),
  markAllRead: () =>
    apiRequest('/notifications/read-all', {
      method: 'PATCH',
    }),
  delete: (id) =>
    apiRequest(`/notifications/${id}`, {
      method: 'DELETE',
    }),
  getDocumentExpiryStatus: () => apiRequest('/notifications/document-expiry-status'),
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

// Module 14: Shift Management APIs
export const shiftApi = {
  list: () => apiRequest('/shifts'),
  getById: (id) => apiRequest(`/shifts/${id}`),
  create: (shiftData) =>
    apiRequest('/shifts', {
      method: 'POST',
      body: JSON.stringify(shiftData),
    }),
  update: (id, shiftData) =>
    apiRequest(`/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(shiftData),
    }),
  delete: (id) =>
    apiRequest(`/shifts/${id}`, {
      method: 'DELETE',
    }),
  assign: (assignmentData) =>
    apiRequest('/shifts/assign', {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    }),
  listAssignments: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.employee_id) searchParams.append('employee_id', params.employee_id);
    if (params.shift_id) searchParams.append('shift_id', params.shift_id);
    if (params.is_active !== undefined && params.is_active !== null && params.is_active !== 'ALL') {
      searchParams.append('is_active', params.is_active);
    }
    const query = searchParams.toString();
    return apiRequest(`/shifts/assignments${query ? `?${query}` : ''}`);
  },
  getEmployeeShift: (employeeId) => apiRequest(`/shifts/employee/${employeeId}`),
  updateAssignment: (id, data) =>
    apiRequest(`/shifts/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteAssignment: (id) =>
    apiRequest(`/shifts/assignments/${id}`, {
      method: 'DELETE',
    }),
};

export const documentApi = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.employee_id) searchParams.append('employee_id', params.employee_id);
    if (params.document_type && params.document_type !== 'ALL') searchParams.append('document_type', params.document_type);
    if (params.search) searchParams.append('search', params.search);
    const query = searchParams.toString();
    return apiRequest(`/documents${query ? `?${query}` : ''}`);
  },
  getSummary: (employeeId) => {
    const query = employeeId ? `?employee_id=${employeeId}` : '';
    return apiRequest(`/documents/summary${query}`);
  },
  getById: (id) => apiRequest(`/documents/${id}`),
  upload: (formData) => {
    return apiRequest('/documents/upload', {
      method: 'POST',
      body: formData,
    });
  },
  download: async (id, fallbackName = 'document') => {
    const token = localStorage.getItem('worksphere_token');
    const response = await fetch(`${API_BASE}/documents/${id}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to download document' }));
      throw new Error(error.detail || 'Failed to download document');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    let filename = fallbackName;
    if (disposition && disposition.includes('filename=')) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  getViewBlobUrl: async (id) => {
    const token = localStorage.getItem('worksphere_token');
    const response = await fetch(`${API_BASE}/documents/${id}/view`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to preview document' }));
      throw new Error(error.detail || 'Failed to preview document');
    }
    const blob = await response.blob();
    return {
      url: window.URL.createObjectURL(blob),
      contentType: response.headers.get('Content-Type') || blob.type,
    };
  },
  delete: (id) =>
    apiRequest(`/documents/${id}`, {
      method: 'DELETE',
    }),
};

export const performanceApi = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.employee_id) searchParams.append('employee_id', params.employee_id);
    if (params.review_period && params.review_period !== 'ALL') searchParams.append('review_period', params.review_period);
    if (params.rating && params.rating !== 'ALL') searchParams.append('rating', params.rating);
    if (params.search) searchParams.append('search', params.search);
    const query = searchParams.toString();
    return apiRequest(`/performance${query ? `?${query}` : ''}`);
  },
  getSummary: (employeeId) => {
    const query = employeeId ? `?employee_id=${employeeId}` : '';
    return apiRequest(`/performance/summary${query}`);
  },
  getById: (id) => apiRequest(`/performance/${id}`),
  getByEmployeeId: (employeeId) => apiRequest(`/performance/employee/${employeeId}`),
  create: (reviewData) =>
    apiRequest('/performance', {
      method: 'POST',
      body: JSON.stringify(reviewData),
    }),
  update: (id, reviewData) =>
    apiRequest(`/performance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reviewData),
    }),
  delete: (id) =>
    apiRequest(`/performance/${id}`, {
      method: 'DELETE',
    }),
};

export const advancedAnalyticsApi = {
  getSummary: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.department && params.department !== 'ALL') searchParams.append('department', params.department);
    const query = searchParams.toString();
    return apiRequest(`/advanced-analytics/summary${query ? `?${query}` : ''}`);
  },
  getAttendanceTrends: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.department && params.department !== 'ALL') searchParams.append('department', params.department);
    const query = searchParams.toString();
    return apiRequest(`/advanced-analytics/attendance-trends${query ? `?${query}` : ''}`);
  },
  getLeaveTrends: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.department && params.department !== 'ALL') searchParams.append('department', params.department);
    const query = searchParams.toString();
    return apiRequest(`/advanced-analytics/leave-trends${query ? `?${query}` : ''}`);
  },
  getPerformanceInsights: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.department && params.department !== 'ALL') searchParams.append('department', params.department);
    const query = searchParams.toString();
    return apiRequest(`/advanced-analytics/performance-insights${query ? `?${query}` : ''}`);
  },
  getDepartmentReports: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.department && params.department !== 'ALL') searchParams.append('department', params.department);
    const query = searchParams.toString();
    return apiRequest(`/advanced-analytics/department-reports${query ? `?${query}` : ''}`);
  },
  getDepartments: () => apiRequest('/advanced-analytics/departments'),
  exportDepartmentReportsCsv: async (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.department && params.department !== 'ALL') searchParams.append('department', params.department);
    const query = searchParams.toString();
    const token = localStorage.getItem('worksphere_token');
    const response = await fetch(`${API_BASE}/advanced-analytics/department-reports/export${query ? `?${query}` : ''}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to export CSV report' }));
      throw new Error(error.detail || 'Failed to export CSV report');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    let filename = `WorkSphere_Department_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    if (disposition && disposition.includes('filename=')) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};





