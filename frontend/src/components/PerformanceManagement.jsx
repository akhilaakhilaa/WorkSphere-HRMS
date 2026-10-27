import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { performanceApi, employeeApi } from '../services/api';
import {
  Award,
  Star,
  TrendingUp,
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  X,
  Target,
  FileText,
  BarChart2,
  Check,
} from 'lucide-react';

const RATING_CONFIG = {
  5: {
    label: 'Exceptional',
    color: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    starColor: '#10b981',
  },
  4: {
    label: 'Exceeds Expectations',
    color: '#4338ca',
    bg: '#eef2ff',
    border: '#c7d2fe',
    starColor: '#6366f1',
  },
  3: {
    label: 'Meets Expectations',
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
    starColor: '#0ea5e9',
  },
  2: {
    label: 'Below Expectations',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    starColor: '#f59e0b',
  },
  1: {
    label: 'Needs Improvement',
    color: '#be123c',
    bg: '#fff1f2',
    border: '#fecdd3',
    starColor: '#f43f5e',
  },
};

const DEFAULT_PERIODS = [
  '2026-Q4',
  '2026-Q3',
  '2026-Q2',
  '2026-Q1',
  '2025-Q4',
  '2025-Q3',
  '2025-Q2',
  '2025-Q1',
];

export default function PerformanceManagement() {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // State
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('ALL');
  const [selectedRating, setSelectedRating] = useState('ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // Add Review Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    employee_id: '',
    review_period: '2026-Q3',
    rating: 4,
    feedback: '',
    goals: '',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  // Edit Review Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    employee_id: '',
    employee_name: '',
    review_period: '',
    rating: 3,
    feedback: '',
    goals: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // View Details Modal
  const [selectedReview, setSelectedReview] = useState(null);

  // Delete Confirmation Modal
  const [deleteConfirmReview, setDeleteConfirmReview] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch employee list if HR or Admin
  useEffect(() => {
    let isMounted = true;
    if (isHrOrAdmin) {
      const fetchEmps = async () => {
        try {
          const fetchFn =
            typeof employeeApi.list === 'function'
              ? employeeApi.list
              : employeeApi.getAll;
          if (typeof fetchFn === 'function') {
            const data = await fetchFn();
            if (isMounted) {
              if (Array.isArray(data)) setEmployees(data);
              else if (data && Array.isArray(data.items)) setEmployees(data.items);
              else setEmployees([]);
            }
          }
        } catch (err) {
          console.warn('Could not load employees for performance filters:', err);
          if (isMounted) setEmployees([]);
        }
      };
      fetchEmps();
    }
    return () => {
      isMounted = false;
    };
  }, [isHrOrAdmin]);

  // Load summary metrics
  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const targetEmpId = isHrOrAdmin
        ? selectedEmployeeId || undefined
        : user?.employee_id;
      const data = await performanceApi.getSummary(targetEmpId);
      setSummary(data || null);
    } catch (err) {
      console.warn('Failed to load performance summary:', err);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Load reviews list
  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (selectedPeriod && selectedPeriod !== 'ALL') {
        params.review_period = selectedPeriod;
      }
      if (selectedRating && selectedRating !== 'ALL') {
        params.rating = selectedRating;
      }
      if (isHrOrAdmin && selectedEmployeeId) {
        params.employee_id = selectedEmployeeId;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const data = await performanceApi.list(params);
      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch performance reviews:', err);
      setError(err.message || 'Failed to fetch performance reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  // Load reviews on mount and when dropdown filters change
  useEffect(() => {
    fetchReviews();
    fetchSummary();
  }, [selectedPeriod, selectedRating, selectedEmployeeId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReviews();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedPeriod('ALL');
    setSelectedRating('ALL');
    setSelectedEmployeeId('');
    setTimeout(() => {
      fetchReviews();
      fetchSummary();
    }, 0);
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setAddError(null);
    const defaultEmpId = selectedEmployeeId || (employees[0]?.id ? String(employees[0].id) : '');
    setAddForm({
      employee_id: defaultEmpId,
      review_period: '2026-Q3',
      rating: 4,
      feedback: '',
      goals: '',
    });
    setShowAddModal(true);
  };

  // Submit Add Review
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.employee_id) {
      setAddError('Please select an employee.');
      return;
    }
    if (!addForm.feedback.trim() || addForm.feedback.trim().length < 5) {
      setAddError('Feedback must be at least 5 characters long.');
      return;
    }

    try {
      setAddLoading(true);
      setAddError(null);
      await performanceApi.create({
        employee_id: parseInt(addForm.employee_id, 10),
        review_period: addForm.review_period,
        rating: parseInt(addForm.rating, 10),
        feedback: addForm.feedback.trim(),
        goals: addForm.goals.trim() || null,
      });

      setShowAddModal(false);
      setSuccessMessage('Performance review created successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchReviews();
      fetchSummary();
    } catch (err) {
      setAddError(err.message || 'Failed to create performance review');
    } finally {
      setAddLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (review) => {
    setEditError(null);
    setEditForm({
      id: review.id,
      employee_id: review.employee_id,
      employee_name: review.employee_name || `Employee #${review.employee_id}`,
      review_period: review.review_period,
      rating: review.rating,
      feedback: review.feedback,
      goals: review.goals || '',
    });
    setShowEditModal(true);
  };

  // Submit Edit Review
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.feedback.trim() || editForm.feedback.trim().length < 5) {
      setEditError('Feedback must be at least 5 characters long.');
      return;
    }

    try {
      setEditLoading(true);
      setEditError(null);
      await performanceApi.update(editForm.id, {
        review_period: editForm.review_period,
        rating: parseInt(editForm.rating, 10),
        feedback: editForm.feedback.trim(),
        goals: editForm.goals.trim() || null,
      });

      setShowEditModal(false);
      setSuccessMessage('Performance review updated successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchReviews();
      fetchSummary();
    } catch (err) {
      setEditError(err.message || 'Failed to update performance review');
    } finally {
      setEditLoading(false);
    }
  };

  // Submit Delete Review
  const handleDeleteSubmit = async () => {
    if (!deleteConfirmReview) return;
    try {
      setDeleteLoading(true);
      await performanceApi.delete(deleteConfirmReview.id);
      setDeleteConfirmReview(null);
      setSuccessMessage('Performance review deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchReviews();
      fetchSummary();
    } catch (err) {
      alert(`Failed to delete review: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Render Stars
  const renderStars = (ratingCount, starColor = '#f59e0b', size = 16) => {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map((starIndex) => (
          <Star
            key={starIndex}
            size={size}
            fill={starIndex <= ratingCount ? starColor : 'transparent'}
            color={starIndex <= ratingCount ? starColor : '#cbd5e1'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="performance-management-page" style={{ paddingBottom: '3rem' }}>
      {/* ------------------------------------------------------------- */}
      {/* 1. PAGE HEADER                                                */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                color: '#fff',
                padding: '8px',
                borderRadius: '10px',
                display: 'inline-flex',
              }}
            >
              <Award size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Performance Management System
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '3px 0 0' }}>
                Track employee performance evaluations, ratings, constructive feedback, and growth targets
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              fetchReviews();
              fetchSummary();
            }}
            disabled={loading || summaryLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
            title="Refresh reviews"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {isHrOrAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAddModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
              }}
            >
              <Plus size={16} />
              <span>Add Review</span>
            </button>
          )}
        </div>
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {successMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '1.25rem',
          }}
        >
          <CheckCircle2 size={18} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{successMessage}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '1.25rem',
          }}
        >
          <AlertCircle size={18} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY METRICS CARDS                                      */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Total Reviews */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#eef2ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Total Reviews
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {summary ? summary.total_reviews : reviews.length}
            </div>
          </div>
        </div>

        {/* Average Rating */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#fffbeb',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Star size={24} fill="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Average Rating
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {summary ? `${summary.average_rating}` : '0.0'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 5.0</span>
            </div>
          </div>
        </div>

        {/* Distinct Employees Evaluated */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Employees Evaluated
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {summary ? summary.employees_reviewed : '0'}
            </div>
          </div>
        </div>

        {/* Rating Score Breakdown */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
            Rating Breakdown
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[5, 4, 3, 2, 1].map((rScore) => {
              const count = summary?.rating_distribution?.[String(rScore)] || 0;
              const cfg = RATING_CONFIG[rScore];
              return (
                <span
                  key={rScore}
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: cfg.bg,
                    color: cfg.color,
                    border: `1px solid ${cfg.border}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                  title={`${cfg.label}: ${count}`}
                >
                  <span>{rScore}★:</span>
                  <span>{count}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. FILTERS & SEARCH CONTROLS                                  */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '14px 18px',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder={isHrOrAdmin ? 'Search employee name or feedback...' : 'Search in feedback or goals...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Period Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.88rem',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Periods</option>
              {DEFAULT_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </div>

          {/* Rating Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.88rem',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Ratings</option>
              <option value="5">5 — Exceptional</option>
              <option value="4">4 — Exceeds Expectations</option>
              <option value="3">3 — Meets Expectations</option>
              <option value="2">2 — Below Expectations</option>
              <option value="1">1 — Needs Improvement</option>
            </select>
          </div>

          {/* Employee Filter (HR/Admin only) */}
          {isHrOrAdmin && (
            <div style={{ minWidth: '200px' }}>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.88rem',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Employees</option>
                {(employees || []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.department})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. PERFORMANCE REVIEWS TABLE / LIST                           */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner-large" style={{ margin: '0 auto 16px' }}></div>
            <p style={{ fontWeight: 600 }}>Loading performance evaluations...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#f1f5f9',
                color: '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Award size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
              No Performance Reviews Found
            </h3>
            <p style={{ fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 20px' }}>
              {searchQuery || selectedPeriod !== 'ALL' || selectedRating !== 'ALL' || selectedEmployeeId
                ? 'No reviews match your selected filter criteria. Try clearing or broadening your search.'
                : isHrOrAdmin
                ? 'No performance reviews have been recorded yet. Click "Add Review" above to evaluate an employee.'
                : 'No performance reviews have been published for your profile yet.'}
            </p>
            {isHrOrAdmin && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                <Plus size={16} />
                <span>Create First Review</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: '#475569' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Employee</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Period</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Rating</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Feedback Preview</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Evaluated By</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((rev) => {
                  const cfg = RATING_CONFIG[rev.rating] || RATING_CONFIG[3];

                  return (
                    <tr
                      key={rev.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                    >
                      {/* Employee Info */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {rev.employee_name || `Employee #${rev.employee_id}`}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {rev.employee_designation || 'Staff'} {rev.employee_department ? `• ${rev.employee_department}` : ''}
                        </div>
                      </td>

                      {/* Period */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                          }}
                        >
                          <Calendar size={13} />
                          <span>{rev.review_period}</span>
                        </span>
                      </td>

                      {/* Rating Badge */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              background: cfg.bg,
                              color: cfg.color,
                              border: `1px solid ${cfg.border}`,
                              width: 'fit-content',
                            }}
                          >
                            <Star size={13} fill={cfg.starColor} color={cfg.starColor} />
                            <span>
                              {rev.rating} — {rev.rating_label}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Feedback Preview */}
                      <td style={{ padding: '14px 18px' }}>
                        <div
                          style={{
                            maxWidth: '300px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                          }}
                          title={rev.feedback}
                        >
                          {rev.feedback}
                        </div>
                        {rev.goals && (
                          <div
                            style={{
                              fontSize: '0.76rem',
                              color: '#059669',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '2px',
                            }}
                          >
                            <Target size={12} />
                            <span>Goals specified</span>
                          </div>
                        )}
                      </td>

                      {/* Reviewer */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {rev.reviewer_name ? `By @${rev.reviewer_name}` : 'HR Team'}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {rev.created_at
                          ? new Date(rev.created_at).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedReview(rev)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                            title="View Full Evaluation"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>

                          {isHrOrAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(rev)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  background: '#e0e7ff',
                                  color: '#4338ca',
                                  border: '1px solid #c7d2fe',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                }}
                                title="Edit Review"
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeleteConfirmReview(rev)}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fecaca',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                                title="Delete Review"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
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

      {/* ------------------------------------------------------------- */}
      {/* 5. ADD PERFORMANCE REVIEW MODAL                               */}
      {/* ------------------------------------------------------------- */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    background: '#e0e7ff',
                    color: '#4f46e5',
                    padding: '8px',
                    borderRadius: '8px',
                  }}
                >
                  <Award size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Create Performance Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSubmit} style={{ padding: '24px', overflowY: 'auto' }}>
              {addError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{addError}</span>
                </div>
              )}

              {/* Employee Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Target Employee <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={addForm.employee_id}
                  onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    background: '#fff',
                  }}
                >
                  <option value="">Select an employee...</option>
                  {(employees || []).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.department} — {emp.designation})
                    </option>
                  ))}
                </select>
              </div>

              {/* Review Period */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Review Period <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={addForm.review_period}
                  onChange={(e) => setAddForm({ ...addForm, review_period: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    background: '#fff',
                  }}
                >
                  {DEFAULT_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rating Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
                  Performance Rating <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map((score) => {
                    const isSelected = addForm.rating === score;
                    const cfg = RATING_CONFIG[score];
                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setAddForm({ ...addForm, rating: score })}
                        style={{
                          padding: '10px 4px',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${cfg.starColor}` : '1px solid var(--border-color)',
                          background: isSelected ? cfg.bg : '#fff',
                          color: isSelected ? cfg.color : '#334155',
                          cursor: 'pointer',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Star size={16} fill={isSelected ? cfg.starColor : 'transparent'} color={cfg.starColor} />
                        <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{score}</span>
                        <span style={{ fontSize: '0.66rem', lineHeight: 1.1, textAlign: 'center' }}>
                          {cfg.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '0.84rem', fontWeight: 700, color: RATING_CONFIG[addForm.rating]?.color }}>
                  Selected: {addForm.rating} — {RATING_CONFIG[addForm.rating]?.label}
                </div>
              </div>

              {/* Feedback Textarea */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    Constructive Feedback <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {addForm.feedback.length}/5000 chars (min 5)
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail key strengths, project milestones, competencies, and areas for improvement..."
                  value={addForm.feedback}
                  onChange={(e) => setAddForm({ ...addForm, feedback: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Goals Textarea */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Key Goals & Development Targets (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Lead Q4 sprint, Complete Cloud Certification..."
                  value={addForm.goals}
                  onChange={(e) => setAddForm({ ...addForm, goals: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={addLoading}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: addLoading ? '#94a3b8' : '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: addLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {addLoading ? (
                    <>
                      <div className="spinner-small" style={{ width: '14px', height: '14px' }}></div>
                      <span>Saving Review...</span>
                    </>
                  ) : (
                    <span>Save Evaluation</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. EDIT PERFORMANCE REVIEW MODAL                              */}
      {/* ------------------------------------------------------------- */}
      {showEditModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    background: '#e0e7ff',
                    color: '#4f46e5',
                    padding: '8px',
                    borderRadius: '8px',
                  }}
                >
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Edit Performance Review
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Employee: {editForm.employee_name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} style={{ padding: '24px', overflowY: 'auto' }}>
              {editError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{editError}</span>
                </div>
              )}

              {/* Review Period */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Review Period <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={editForm.review_period}
                  onChange={(e) => setEditForm({ ...editForm, review_period: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    background: '#fff',
                  }}
                >
                  {DEFAULT_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rating Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
                  Performance Rating <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map((score) => {
                    const isSelected = editForm.rating === score;
                    const cfg = RATING_CONFIG[score];
                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, rating: score })}
                        style={{
                          padding: '10px 4px',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${cfg.starColor}` : '1px solid var(--border-color)',
                          background: isSelected ? cfg.bg : '#fff',
                          color: isSelected ? cfg.color : '#334155',
                          cursor: 'pointer',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Star size={16} fill={isSelected ? cfg.starColor : 'transparent'} color={cfg.starColor} />
                        <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{score}</span>
                        <span style={{ fontSize: '0.66rem', lineHeight: 1.1, textAlign: 'center' }}>
                          {cfg.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '0.84rem', fontWeight: 700, color: RATING_CONFIG[editForm.rating]?.color }}>
                  Selected: {editForm.rating} — {RATING_CONFIG[editForm.rating]?.label}
                </div>
              </div>

              {/* Feedback Textarea */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    Constructive Feedback <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {editForm.feedback.length}/5000 chars (min 5)
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={editForm.feedback}
                  onChange={(e) => setEditForm({ ...editForm, feedback: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Goals Textarea */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Key Goals & Development Targets (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editForm.goals}
                  onChange={(e) => setEditForm({ ...editForm, goals: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={editLoading}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: editLoading ? '#94a3b8' : '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: editLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {editLoading ? (
                    <>
                      <div className="spinner-small" style={{ width: '14px', height: '14px' }}></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. VIEW DETAILS MODAL                                         */}
      {/* ------------------------------------------------------------- */}
      {selectedReview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '620px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    background: RATING_CONFIG[selectedReview.rating]?.bg || '#eef2ff',
                    color: RATING_CONFIG[selectedReview.rating]?.color || '#4f46e5',
                    padding: '10px',
                    borderRadius: '10px',
                  }}
                >
                  <Award size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Performance Evaluation
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Period: <strong>{selectedReview.review_period}</strong> &bull; Evaluated{' '}
                    {new Date(selectedReview.created_at).toLocaleDateString([], {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Employee & Rating Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Employee</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {selectedReview.employee_name || `Employee #${selectedReview.employee_id}`}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {selectedReview.employee_designation} {selectedReview.employee_department ? `• ${selectedReview.employee_department}` : ''}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score & Rating</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    {renderStars(selectedReview.rating, RATING_CONFIG[selectedReview.rating]?.starColor, 18)}
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: RATING_CONFIG[selectedReview.rating]?.color }}>
                      {selectedReview.rating}/5
                    </span>
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: RATING_CONFIG[selectedReview.rating]?.color,
                    }}
                  >
                    {selectedReview.rating_label}
                  </span>
                </div>
              </div>

              {/* Feedback Block */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Performance Feedback
                </div>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    color: '#334155',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedReview.feedback}
                </div>
              </div>

              {/* Goals Block */}
              {selectedReview.goals && (
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#047857', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Target size={15} />
                    <span>Future Goals & Development Targets</span>
                  </div>
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      fontSize: '0.88rem',
                      lineHeight: 1.5,
                      color: '#166534',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedReview.goals}
                  </div>
                </div>
              )}

              {/* Evaluator Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <span>Evaluator: @{selectedReview.reviewer_name || 'HR Team'}</span>
                <span>Last updated: {new Date(selectedReview.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. DELETE CONFIRMATION MODAL                                  */}
      {/* ------------------------------------------------------------- */}
      {deleteConfirmReview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Trash2 size={24} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>
              Delete Performance Review?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to delete the evaluation for{' '}
              <strong>"{deleteConfirmReview.employee_name || `Employee #${deleteConfirmReview.employee_id}`}"</strong> ({deleteConfirmReview.review_period})? This review will be permanently removed.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmReview(null)}
                disabled={deleteLoading}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={deleteLoading}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deleteLoading ? (
                  <>
                    <div className="spinner-small" style={{ width: '14px', height: '14px' }}></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

