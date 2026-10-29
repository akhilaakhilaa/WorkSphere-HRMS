import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../services/api';
import {
  User,
  Mail,
  Shield,
  Briefcase,
  Building,
  Calendar,
  DollarSign,
  KeyRound,
  Bell,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';

export default function ProfileSettings() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'preferences'

  // Profile data
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [fullNameInput, setFullNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password data
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  // Preferences data
  const [preferences, setPreferences] = useState({
    in_app_enabled: true,
    email_enabled: true,
    notify_leaves: true,
    notify_attendance: true,
    notify_tasks: true,
    notify_announcements: true,
    notify_payroll: true,
  });
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefSuccess, setPrefSuccess] = useState('');
  const [prefError, setPrefError] = useState('');

  useEffect(() => {
    loadProfile();
    loadPreferences();
  }, []);

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const data = await profileApi.getMe();
      setProfile(data);
      setFullNameInput(data.full_name || '');
      setEmailInput(data.email || '');
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadPreferences = async () => {
    setLoadingPrefs(true);
    try {
      const data = await profileApi.getPreferences();
      setPreferences(data);
    } catch (err) {
      console.error('Failed to load preferences', err);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const updated = await profileApi.updateMe({
        full_name: fullNameInput,
        email: emailInput,
      });
      setProfile(updated);
      setProfileSuccess('Profile updated successfully.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters long.');
      return;
    }

    setChangingPass(true);
    try {
      await profileApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setPassSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(''), 4000);
    } catch (err) {
      setPassError(err.message || 'Failed to change password.');
    } finally {
      setChangingPass(false);
    }
  };

  const handlePreferenceToggle = (field) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handlePreferencesSave = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefError('');
    setPrefSuccess('');

    try {
      const updated = await profileApi.updatePreferences(preferences);
      setPreferences(updated);
      setPrefSuccess('Notification preferences saved.');
      setTimeout(() => setPrefSuccess(''), 4000);
    } catch (err) {
      setPrefError(err.message || 'Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="section-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile & Settings</h1>
          <p className="page-subtitle">
            Manage your personal profile, security credentials, and communication alerts.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'profile' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'profile' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          <User size={18} /> Personal Profile
        </button>

        <button
          onClick={() => setActiveTab('security')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'security' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'security' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'security' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          <KeyRound size={18} /> Security & Password
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'preferences' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'preferences' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'preferences' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          <Bell size={18} /> Notification Preferences
        </button>
      </div>

      {/* TAB 1: PERSONAL PROFILE */}
      {activeTab === 'profile' && (
        <div>
          {profileSuccess && (
            <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
              <CheckCircle2 size={18} /> {profileSuccess}
            </div>
          )}
          {profileError && (
            <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
              <AlertCircle size={18} /> {profileError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 360px) minmax(0, 1fr)', gap: '1.5rem' }}>
            {/* Identity Card */}
            <div className="card-custom">
              <div className="profile-card-header">
                <div className="avatar-huge">
                  {(profile?.full_name || profile?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <h2>{profile?.full_name || profile?.username || 'WorkSphere User'}</h2>
                <p className="text-muted">{profile?.email}</p>
                <div className="mt-2">
                  <span className={`role-pill badge-${(profile?.role || role).toLowerCase()}`}>
                    {profile?.role || role}
                  </span>
                </div>
              </div>

              <div className="profile-card-details">
                <div className="info-row">
                  <span className="info-icon"><User size={16} /></span>
                  <span className="info-label">Username</span>
                  <span className="info-val">{profile?.username}</span>
                </div>
                <div className="info-row">
                  <span className="info-icon"><Mail size={16} /></span>
                  <span className="info-label">Email</span>
                  <span className="info-val">{profile?.email}</span>
                </div>
                <div className="info-row">
                  <span className="info-icon"><Shield size={16} /></span>
                  <span className="info-label">Role</span>
                  <span className="info-val">{profile?.role}</span>
                </div>
                <div className="info-row">
                  <span className="info-icon"><CheckCircle2 size={16} /></span>
                  <span className="info-label">Account Status</span>
                  <span className="info-val text-success">{profile?.is_active ? 'Active' : 'Suspended'}</span>
                </div>
              </div>
            </div>

            {/* Editable Profile & Employment Details */}
            <div className="card-custom">
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 600 }}>
                Edit Personal Information
              </h3>

              <form onSubmit={handleProfileSave}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingProfile}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}
                >
                  {savingProfile ? (
                    <>
                      <RefreshCw size={16} className="spin" /> Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Profile Changes
                    </>
                  )}
                </button>
              </form>

              {/* Organization Assignment (Read Only) */}
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600, borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                Employment Details (Managed by HR)
              </h4>

              <div className="profile-details-grid-large">
                <div className="profile-detail-card">
                  <span className="label">Department</span>
                  <span className="value">{profile?.department || 'Unassigned'}</span>
                </div>
                <div className="profile-detail-card">
                  <span className="label">Designation</span>
                  <span className="value">{profile?.designation || 'Staff'}</span>
                </div>
                <div className="profile-detail-card">
                  <span className="label">Joining Date</span>
                  <span className="value">{profile?.joining_date || 'N/A'}</span>
                </div>
                <div className="profile-detail-card">
                  <span className="label">Employment Status</span>
                  <span className="value text-success">{profile?.status || 'Active'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY & PASSWORD */}
      {activeTab === 'security' && (
        <div style={{ maxWidth: '600px' }}>
          <div className="card-custom">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <KeyRound size={22} className="text-primary" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Change Account Password</h3>
            </div>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Keep your account secure by utilizing a strong password with at least 6 characters.
            </p>

            {passSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
                <CheckCircle2 size={18} /> {passSuccess}
              </div>
            )}
            {passError && (
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertCircle size={18} /> {passError}
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                  Current Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    className="form-control"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem 2.2rem 0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ width: '100%', padding: '0.6rem 2.2rem 0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ width: '100%', padding: '0.6rem 2.2rem 0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={changingPass}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {changingPass ? (
                  <>
                    <RefreshCw size={16} className="spin" /> Updating Password...
                  </>
                ) : (
                  <>
                    <KeyRound size={16} /> Update Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICATION PREFERENCES */}
      {activeTab === 'preferences' && (
        <div style={{ maxWidth: '640px' }}>
          <div className="card-custom">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Bell size={22} className="text-primary" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Notification & Alert Preferences</h3>
            </div>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Customize your communication channels and choose which system events notify you.
            </p>

            {prefSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
                <CheckCircle2 size={18} /> {prefSuccess}
              </div>
            )}
            {prefError && (
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertCircle size={18} /> {prefError}
              </div>
            )}

            <form onSubmit={handlePreferencesSave}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
                Delivery Channels
              </h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', background: '#fafafa' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>In-App Notifications</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Receive alerts in the top navigation bell dropdown</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.in_app_enabled}
                    onChange={() => handlePreferenceToggle('in_app_enabled')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Email Notifications</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Receive direct emails via SMTP for urgent updates</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.email_enabled}
                    onChange={() => handlePreferenceToggle('email_enabled')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>
              </div>

              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
                Event Subscriptions
              </h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', background: '#fafafa' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Leave Management</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Status updates on your leave requests and team approvals</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.notify_leaves}
                    onChange={() => handlePreferenceToggle('notify_leaves')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Attendance & Shifts</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Shift schedule changes, auto-absent alerts, and punch reminders</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.notify_attendance}
                    onChange={() => handlePreferenceToggle('notify_attendance')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Tasks & Deadlines</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>New task assignments and impending due dates</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.notify_tasks}
                    onChange={() => handlePreferenceToggle('notify_tasks')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Announcements</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Company-wide announcements and departmental broadcasts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.notify_announcements}
                    onChange={() => handlePreferenceToggle('notify_announcements')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Payroll Notifications</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Salary processing notifications and payslip generation alerts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.notify_payroll}
                    onChange={() => handlePreferenceToggle('notify_payroll')}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingPrefs}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {savingPrefs ? (
                  <>
                    <RefreshCw size={16} className="spin" /> Saving Preferences...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save Notification Preferences
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

