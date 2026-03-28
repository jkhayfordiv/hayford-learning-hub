import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * AuthSuccess - Google OAuth redirect landing page.
 *
 * The backend redirects here as:
 *   /auth/success?token=<JWT>
 *
 * This component reads the token from the URL, stores it in localStorage,
 * and immediately navigates to /dashboard — just like a normal login.
 */
export default function AuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error || !token) {
      console.error('Google Auth Failed:', error);
      navigate('/login?error=google_auth_failed', { replace: true });
      return;
    }

    try {
      // Decode the JWT payload (middle segment, base64url)
      const payloadBase64 = token.split('.')[1];
      const json = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const decoded = JSON.parse(json);

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(decoded.user));

      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('AuthSuccess: failed to decode token', err);
      navigate('/login?error=google_auth_failed', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-900 gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
        <Loader2 size={64} className="animate-spin text-brand-sangria absolute inset-0" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Authenticating...</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Completing your secure sign-in with Google.</p>
      </div>
    </div>
  );
}
