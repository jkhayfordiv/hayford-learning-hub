import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchUserProgress } from '../services/api';
import { isAuthenticated, getUser } from '../utils/auth';

const STAFF_ROLES = ['teacher', 'admin', 'super_admin'];

export default function DiagnosticGuard({ children }) {
  const user = getUser();
  const isStaff = !!(user && STAFF_ROLES.includes(user.role));

  const [loading, setLoading] = useState(!isStaff);
  const [diagnosticCompleted, setDiagnosticCompleted] = useState(isStaff);

  useEffect(() => {
    if (isStaff) return;
    checkDiagnosticStatus();
  }, []);

  const checkDiagnosticStatus = async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    try {
      const progress = await fetchUserProgress();
      setDiagnosticCompleted(progress.diagnostic_completed || false);
    } catch (error) {
      console.error('Error checking diagnostic status:', error);
      setDiagnosticCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand-sangria border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Checking...</p>
        </div>
      </div>
    );
  }

  if (!diagnosticCompleted) {
    return <Navigate to="/diagnostic" replace />;
  }

  return children;
}
