import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { feedbackApi } from '../services/api';
import {
  Star,
  MessageSquare,
  TrendingUp,
  BarChart2,
  Users,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';

export default function FeedbackManagement() {
  const { role, user } = useAuth();
  const isAdminOrHr = role === 'ADMIN' || role === 'HR';

  // Submission state (Employee)
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Listing & metrics state
  const [feedbacks, setFeedbacks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [isAdminOrHr]);

  const loadData = async () => {
    setLoading(true);
    try {
      const listData = await feedbackApi.list();
      setFeedbacks(Array.isArray(listData) ? listData : []);

      if (isAdminOrHr) {
        const sumData = await feedbackApi.getSummary();
        setSummary(sumData);
      }
    } catch (err) {
      console.error('Failed to load feedback data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setSubmitError('Please enter your feedback comments.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    try {
      await feedbackApi.submit({ rating, message: message.trim() });
      setSubmitSuccess('Thank you! Your feedback has been submitted successfully.');
      setMessage('');
      setRating(5);
      loadData();
      setTimeout(() => setSubmitSuccess(''), 5000);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter feedback
  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (filterRating !== 'ALL' && fb.rating !== parseInt(filterRating, 10)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const empName = fb.employee?.full_name?.toLowerCase() || '';
      const msg = fb.message?.toLowerCase() || '';
      return empName.includes(q) || msg.includes(q);
    }
    return true;
  });

  return (
    <div className="section-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Feedback System</h1>
          <p className="page-subtitle">
            Share workplace experiences, suggest improvements, and review team sentiment.
          </p>
        </div>
      </div>

      {submitSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} /> {submitSuccess}
        </div>
      )}

      {submitError && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} /> {submitError}
        </div>
      )}

      {/* HR/Admin Metrics Summary */}
      {isAdminOrHr && summary && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <MessageSquare size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-label">Total Submissions</span>
                <span className="stat-value">{summary.total_feedback}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Star size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-label">Average Rating</span>
                <span className="stat-value">{summary.average_rating.toFixed(1)} / 5.0</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <TrendingUp size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-label">Satisfaction Score</span>
                <span className="stat-value">
                  {summary.total_feedback > 0 ? `${Math.round((summary.average_rating / 5) * 100)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Rating Breakdown Bar Chart */}
          <div className="card-custom" style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 600 }}>Rating Breakdown</h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {summary.rating_breakdown.map((item) => {
                const pct = summary.total_feedback > 0 ? (item.count / summary.total_feedback) * 100 : 0;
                return (
                  <div key={item.rating} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div style={{ width: '60px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <strong>{item.rating}</strong>
                      <Star size={14} fill="#f59e0b" color="#f59e0b" />
                    </div>
                    <div style={{ flex: 1, height: '10px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: item.rating >= 4 ? '#10b981' : item.rating === 3 ? '#f59e0b' : '#ef4444',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ width: '80px', textAlign: 'right', color: '#64748b' }}>
                      {item.count} ({pct.toFixed(0)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isAdminOrHr ? '1fr' : 'minmax(0, 420px) minmax(0, 1fr)', gap: '1.5rem' }}>
        {/* Submit Feedback Form (Available to all employees) */}
        <div className="card-custom">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Send size={20} className="text-primary" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Share Your Feedback</h3>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            How has your experience at WorkSphere been? Rate your satisfaction and share comments or suggestions.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Overall Rating (1 to 5 Stars)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <Star
                      size={28}
                      fill={(hoverRating || rating) >= star ? '#f59e0b' : 'none'}
                      color={(hoverRating || rating) >= star ? '#f59e0b' : '#cbd5e1'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                Feedback Message & Suggestions
              </label>
              <textarea
                className="form-control"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your thoughts on company culture, projects, team support, or operational improvements..."
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send size={16} /> Submit Feedback
                </>
              )}
            </button>
          </form>
        </div>

        {/* Feedback List Section */}
        <div className="card-custom">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
              {isAdminOrHr ? 'All Employee Feedback' : 'My Submitted Feedback'}
            </h3>

            {/* Filter controls */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                className="form-control"
                value={filterRating}
                onChange={(e) => setFilterRating(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="ALL">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>

              {isAdminOrHr && (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search comments or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem 0.4rem 1.8rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
              Loading feedback submissions...
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.9rem' }}>
              No feedback submissions found matching your filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {filteredFeedbacks.map((fb) => (
                <div
                  key={fb.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ display: 'flex' }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={16}
                            fill={s <= fb.rating ? '#f59e0b' : 'none'}
                            color={s <= fb.rating ? '#f59e0b' : '#cbd5e1'}
                          />
                        ))}
                      </div>
                      {isAdminOrHr && fb.employee && (
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                          {fb.employee.full_name} ({fb.employee.department || 'Staff'})
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(fb.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
                    {fb.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

