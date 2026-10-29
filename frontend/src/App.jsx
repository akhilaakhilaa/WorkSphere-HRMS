import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Navbar from './components/Navbar';
import DashboardAnalytics from './components/DashboardAnalytics';
import EmployeeManagement from './components/EmployeeManagement';
import AttendanceManagement from './components/AttendanceManagement';
import LeaveManagement from './components/LeaveManagement';
import PayrollManagement from './components/PayrollManagement';
import NotificationCenter from './components/NotificationCenter';
import MyProfile from './components/MyProfile';
import UserManagement from './components/UserManagement';
import ShiftManagement from './components/ShiftManagement';
import LeaveCalendar from './components/LeaveCalendar';
import DocumentManagement from './components/DocumentManagement';
import PerformanceManagement from './components/PerformanceManagement';
import AdvancedAnalytics from './components/AdvancedAnalytics';
import OnboardingManagement from './components/OnboardingManagement';
import ResignationManagement from './components/ResignationManagement';
import Announcements from './components/Announcements';
import TaskManagement from './components/TaskManagement';
import IntegrationsReports from './components/IntegrationsReports';
import FeedbackManagement from './components/FeedbackManagement';
import ProfileSettings from './components/ProfileSettings';
import ErrorBoundary from './components/ErrorBoundary';

function MainApp() {
  const { isAuthenticated, loading, role } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Set initial tab upon login
  useEffect(() => {
    if (isAuthenticated) {
      setActiveTab('dashboard');
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-card">
          <div className="spinner-large"></div>
          <h2>WorkSphere HRMS</h2>
          <p>Connecting to secure backend...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="app-root">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        <ErrorBoundary key={activeTab}>
          {activeTab === 'dashboard' && <DashboardAnalytics />}
          {activeTab === 'attendance' && <AttendanceManagement />}
          {activeTab === 'shifts' && <ShiftManagement />}
          {activeTab === 'employees' && <EmployeeManagement />}
          {activeTab === 'leaves' && <LeaveManagement />}
          {activeTab === 'leave_calendar' && <LeaveCalendar />}
          {activeTab === 'payroll' && <PayrollManagement />}
          {activeTab === 'documents' && <DocumentManagement />}
          {activeTab === 'performance' && <PerformanceManagement />}
          {activeTab === 'onboarding' && <OnboardingManagement />}
          {activeTab === 'resignations' && <ResignationManagement />}
          {activeTab === 'announcements' && <Announcements />}
          {activeTab === 'tasks' && <TaskManagement />}
          {activeTab === 'reports' && <IntegrationsReports />}
          {activeTab === 'feedback' && <FeedbackManagement />}
          {activeTab === 'analytics' && (role === 'ADMIN' || role === 'HR') && <AdvancedAnalytics />}
          {activeTab === 'notifications' && <NotificationCenter setActiveTab={setActiveTab} />}
          {activeTab === 'users' && role === 'ADMIN' && <UserManagement />}
          {activeTab === 'profile' && <ProfileSettings />}
        </ErrorBoundary>
      </main>
      <footer className="app-footer">
        <p>
          WorkSphere HRMS &bull; Modules 1–27 (Auth & Roles, Employees, Attendance, Leaves, Policies, Leave Calendar, Payroll, Analytics, Notifications, Admin Controls, Shift Management, Document Management, Performance Management, Advanced Analytics, Smart Alerts, Advanced Search, Employee Onboarding, Resignation & Exit, Company Announcements, Task Assignment, Integrations & Reports, Feedback System, Profile & Settings)
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
