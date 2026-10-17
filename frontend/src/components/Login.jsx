import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, UserPlus, LogIn, Shield, Users, Briefcase, CheckCircle } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, role);
        setSuccessMsg(`Registration successful! You can now log in with ${email}`);
        setIsRegister(false);
        setPassword('');
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setIsRegister(false);
    setError('');
    setSuccessMsg('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-header">
          <div className="brand-badge">
            <Briefcase className="brand-icon" size={28} />
          </div>
          <h2>WorkSphere HRMS</h2>
          <p className="auth-subtitle">
            Enterprise Human Resource & Attendance System
          </p>
        </div>

        {/* Tab switch */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(false);
              setError('');
              setSuccessMsg('');
            }}
          >
            <LogIn size={16} /> Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(true);
              setError('');
              setSuccessMsg('');
            }}
          >
            <UserPlus size={16} /> Register
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {successMsg && (
          <div className="alert alert-success">
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Work Email</label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label>Role</label>
              <div className="input-with-icon">
                <Shield className="input-icon" size={18} />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="select-field"
                >
                  <option value="EMPLOYEE">EMPLOYEE (Standard Staff)</option>
                  <option value="HR">HR (Human Resources Manager)</option>
                  <option value="ADMIN">ADMIN (System Administrator)</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner"></span>
            ) : isRegister ? (
              'Create Account'
            ) : (
              'Sign In to WorkSphere'
            )}
          </button>
        </form>

        {/* Demo Accounts Quick-Select */}
        <div className="demo-accounts-section">
          <p className="demo-title">Quick Demo Login (Batch 1 Verified):</p>
          <div className="demo-buttons">
            <button
              type="button"
              className="demo-btn admin"
              onClick={() => fillDemo('admin@worksphere.com', 'Admin@123')}
            >
              <Shield size={14} /> Admin
            </button>
            <button
              type="button"
              className="demo-btn hr"
              onClick={() => fillDemo('hr@worksphere.com', 'Hr@123')}
            >
              <Users size={14} /> HR Manager
            </button>
            <button
              type="button"
              className="demo-btn employee"
              onClick={() => fillDemo('employee@worksphere.com', 'Employee@123')}
            >
              <Briefcase size={14} /> Employee
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

