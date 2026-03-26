import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';

export default function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    // Redirect to hub-dashboard login if not authenticated
    window.location.href = 'http://localhost:5173/login';
    return null;
  }
  
  return children;
}
