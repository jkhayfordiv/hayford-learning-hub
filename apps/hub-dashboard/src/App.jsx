import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import StudentProfile from './StudentProfile';
import MyStats from './MyStats';
import Profile from './Profile';
import AuthSuccess from './AuthSuccess';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import WordBank from './components/WordBank';
import VocabLabDashboard from './components/VocabLab/VocabLabDashboard';
import SentenceBuilderPage from './components/VocabLab/SentenceBuilderPage';
import WritingLabApp from './components/WritingLab/WritingLabApp';

const AUTH_PAGES = ['/login', '/forgot-password', '/reset-password', '/auth/success'];

// Injects institution branding (colors, favicon, title) and theme (dark mode) from localStorage
// Re-runs on every route change so branding is always in sync
function BrandingInjector() {
  const location = useLocation();

  useEffect(() => {
    const isAuthPage = AUTH_PAGES.some(p => location.pathname.startsWith(p));

    try {
      // 1. Handle Brand Injection
      const branding = isAuthPage ? {} : JSON.parse(localStorage.getItem('branding') || '{}');
      const root = document.documentElement;

      root.style.setProperty('--brand-primary',   branding.primary_color   || '#800020');
      root.style.setProperty('--brand-secondary', branding.secondary_color || '#F7E7CE');

      document.title = branding.welcome_text || 'Hayford Hub';

      // Dynamically update favicon
      const faviconHref = branding.favicon_url || '/favicon.ico';
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = faviconHref;

      // 2. Handle Dark Mode Injection
      // This ensures that pages like /writing-lab maintain dark mode state even after reloads
      const theme = localStorage.getItem('theme') || 'light';
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } catch (e) {
      // Silently fail - branding is cosmetic, not critical
    }
  }, [location.pathname]);
  return null;
}

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <BrandingInjector />
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          <Route 
            path="/dashboard/*" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/student/:id" 
            element={
              <ProtectedRoute>
                <StudentProfile />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/my-stats"
            element={
              <ProtectedRoute>
                <MyStats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vocab"
            element={
              <ProtectedRoute>
                <WordBank user={JSON.parse(localStorage.getItem('user') || '{}')} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vocab-lab"
            element={
              <ProtectedRoute>
                <VocabLabDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sentence-builder"
            element={
              <ProtectedRoute>
                <SentenceBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile user={JSON.parse(localStorage.getItem('user') || '{}')} onLogout={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('branding'); window.location.href = '/login'; }} />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/writing-lab"
            element={
              <ProtectedRoute>
                <WritingLabApp user={JSON.parse(localStorage.getItem('user') || '{}')} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
