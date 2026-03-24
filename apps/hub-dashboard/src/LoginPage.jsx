import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import logo from './assets/logo.png';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', first_name: '', last_name: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTeacherInfo, setShowTeacherInfo] = useState(false);
  const navigate = useNavigate();

  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

  const handleToggle = () => {
    setIsLogin(!isLogin);
    setError('');
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { email: formData.email, password: formData.password, role: isTeacherMode ? 'teacher' : 'student' }
      : { ...formData, role: 'student' }; // Registration is always student

    try {
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      let data = {};
      try {
        data = text && contentType.includes('application/json') ? JSON.parse(text) : {};
      } catch (_) {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.error || data.msg || (text ? text : 'Authentication failed'));
      }

      if (isLogin) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        // Log them right in after successful registration
        const loginRes = await fetch(`${apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, password: formData.password, role: isTeacherMode ? 'teacher' : 'student' })
        });
        
        if (loginRes.ok) {
          const loginContentType = loginRes.headers.get('content-type') || '';
          const loginText = await loginRes.text();
          let loginData = {};
          try {
            loginData = loginText && loginContentType.includes('application/json') ? JSON.parse(loginText) : {};
          } catch (_) {
            loginData = {};
          }
          localStorage.setItem('token', loginData.token);
          localStorage.setItem('user', JSON.stringify(loginData.user));
          navigate('/dashboard');
        } else {
          setError('Registration successful. Please log in.');
          setIsLogin(true);
        }
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans overflow-hidden relative">
      
      {/* Teacher/Admin Access Button - Login Only */}
      {isLogin && (
        <div className="absolute top-8 right-8 z-50">
          <button 
            onClick={() => setIsTeacherMode(!isTeacherMode)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${isTeacherMode ? 'border-brand-navy text-brand-navy hover:bg-brand-navy hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-brand-navy' : 'border-brand-copper text-brand-copper hover:bg-brand-copper hover:text-white'}`}
          >
            {isTeacherMode ? 'Student Login →' : 'Teacher Login →'}
          </button>
        </div>
      )}

      {/* Left Side: Branding Panel */}
      <div className={`hidden lg:flex flex-col justify-between p-12 text-white relative transition-colors duration-500 ${isTeacherMode ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-brand-navy via-[#0A1930] to-slate-900'}`}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 flex items-center gap-4">
           <img src={logo} alt="Hayford Logo" onError={(e) => { e.target.onerror = null; e.target.src = '/logo.svg'; }} className="w-12 h-12 object-contain rounded-xl border-2 border-brand-copper/60 bg-white/10 backdrop-blur shadow-glow p-1" />
           <span className="font-extrabold text-2xl tracking-tight">Hayford Hub {isTeacherMode && <span className="opacity-50 font-normal">| Faculty</span>}</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className={`text-5xl font-black tracking-tighter mb-6 leading-[1.1] text-transparent bg-clip-text drop-shadow-sm ${isTeacherMode ? 'bg-gradient-to-r from-white to-slate-400' : 'bg-gradient-to-r from-white to-brand-copper'}`}>
            {isTeacherMode ? 'Manage your institution seamlessly.' : "Let's Level up your English."}
          </h1>
          <p className={`${isTeacherMode ? 'text-slate-300' : 'text-indigo-200'} text-lg font-medium leading-relaxed max-w-md`}>
            {isTeacherMode ? 'The centralized instructor portal for monitoring student progress, managing scores, and accelerating outcomes.' : 'Your smart English tutor. Master the IELTS, improve your grammar and vocabulary, and get instant AI feedback to reach your goals.'}
          </p>
        </div>

        <div className={`relative z-10 flex items-center gap-4 text-xs font-bold tracking-widest uppercase ${isTeacherMode ? 'text-slate-500' : 'text-brand-copper'}`}>
          <span>&copy; 2026 Hayford Global</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isTeacherMode ? 'bg-slate-500' : 'bg-brand-copper'}`}></span>
          <span>Terms & Privacy</span>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-brand-darkBg relative">
        <div className="w-full max-w-sm">
          
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
             <img src={logo} alt="Hayford Logo" onError={(e) => { e.target.onerror = null; e.target.src = '/logo.svg'; }} className="w-12 h-12 object-contain rounded-xl border-2 border-brand-navy shadow-soft bg-white p-1" />
             <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">Hayford Hub</span>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
              {isLogin ? 'Welcome back' : 'Create Student Account'}
            </h2>
            <p className="text-slate-500 font-medium text-sm">
              {isLogin ? 'Enter your details to access your dashboard.' : 'Join the hub to start your learning journey.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 shadow-sm animate-in fade-in slide-in-from-top-2">
               <AlertCircle size={18} className="shrink-0 mt-0.5" />
               <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          {/* BUG 3 FIX: Show form only for login OR student registration */}
          {(isLogin || !isTeacherMode) && (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black tracking-widest uppercase text-slate-400 ml-1">First Name</label>
                      <input required name="first_name" type="text" value={formData.first_name} placeholder="Jane" onChange={handleInputChange} className="w-full bg-slate-50 text-slate-900 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-sm placeholder:text-slate-300" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black tracking-widest uppercase text-slate-400 ml-1">Last Name</label>
                      <input required name="last_name" type="text" value={formData.last_name} placeholder="Smith" onChange={handleInputChange} className="w-full bg-slate-50 text-slate-900 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-sm placeholder:text-slate-300" />
                    </div>
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400 ml-1">Email Address</label>
                  <input required name="email" type="email" value={formData.email} placeholder="student@example.com" onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-copper focus:bg-white dark:focus:bg-slate-900 transition-all font-medium text-sm placeholder:text-slate-400" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center ml-1">
                     <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Password</label>
                     {isLogin && <a href="#" className="text-[10px] font-black text-brand-copper hover:text-brand-navy transition-colors">Forgot password?</a>}
                  </div>
                  <input required name="password" type="password" value={formData.password} placeholder="••••••••" onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-copper focus:bg-white dark:focus:bg-slate-900 transition-all font-medium text-sm placeholder:text-slate-400" />
                </div>

                <button disabled={isLoading} type="submit" className={`w-full text-white font-black py-4 rounded-xl mt-4 shadow-soft transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm tracking-wide ${isTeacherMode ? 'bg-[#5E1914] hover:bg-[#4A1510] disabled:bg-slate-300 shadow-xl' : 'bg-[#5E1914] hover:bg-[#4A1510] hover:shadow-glow disabled:bg-red-300'}`}>
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : isLogin ? 'Sign In' : 'Create Account'}
                  {!isLoading && <ArrowRight size={16} />}
                </button>
              </form>

              <div className="mt-8 text-center text-sm font-medium text-slate-500">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button onClick={handleToggle} className="font-bold transition-colors text-brand-copper hover:text-brand-navy">
                  {isLogin ? 'Sign up' : 'Log in instead'}
                </button>
              </div>

              {/* Teacher Account Request Message - Only show for student registration */}
              {!isLogin && (
                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div className="flex items-start gap-3">
                    <BookOpen size={20} className="text-brand-navy dark:text-brand-copper shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Need a Teacher or Admin account?
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Teacher and Admin accounts must be created by your Institution Administrator. Please contact your admin or email{' '}
                        <a href="mailto:support@hayfordglobal.com" className="text-brand-copper hover:text-brand-navy font-bold underline">
                          support@hayfordglobal.com
                        </a>
                        {' '}to request access.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* BUG 3 FIX: Teacher Registration - Show ONLY the message, no form */}
          {!isLogin && isTeacherMode && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-brand-navy dark:bg-brand-copper rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">
                  Teacher Account Required
                </h3>
                <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed mb-6">
                  Teacher and Admin accounts must be created by your Institution Administrator.
                </p>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    <strong className="text-slate-900 dark:text-white">To request access:</strong>
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Contact your admin or email{' '}
                    <a href="mailto:support@hayfordglobal.com" className="text-brand-copper hover:text-brand-navy font-bold underline">
                      support@hayfordglobal.com
                    </a>
                  </p>
                </div>
              </div>

              <div className="text-center text-sm font-medium text-slate-500">
                Already have an account?{' '}
                <button onClick={handleToggle} className="font-bold transition-colors text-brand-copper hover:text-brand-navy">
                  Log in instead
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
