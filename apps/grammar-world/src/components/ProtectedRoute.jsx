import { isAuthenticated } from '../utils/auth';

export default function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    // Redirect to hub-dashboard login if not authenticated
    window.location.href = `${window.location.origin}/login`;
    return null;
  }
  
  return children;
}
