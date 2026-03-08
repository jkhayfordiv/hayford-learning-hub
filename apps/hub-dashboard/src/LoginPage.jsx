import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', first_name: '', last_name: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
      : { ...formData, role: isTeacherMode ? 'teacher' : 'student' };

    try {
      const response = await fetch(`https://hayford-learning-hub.onrender.com${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (isLogin) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        // Log them right in after successful registration
        const loginRes = await fetch('https://hayford-learning-hub.onrender.com/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, password: formData.password, role: isTeacherMode ? 'teacher' : 'student' })
        });
        
        if (loginRes.ok) {
          const loginData = await loginRes.json();
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
      
      {/* Absolute Teacher Toggle Button Top Right */}
      <div className="absolute top-8 right-8 z-50">
         <button 
           onClick={() => setIsTeacherMode(!isTeacherMode)}
           className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${isTeacherMode ? 'border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white' : 'border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
         >
           {isTeacherMode ? 'Student Access →' : 'Teacher Access →'}
         </button>
      </div>

      {/* Left Side: Branding Panel */}
      <div className={`hidden lg:flex flex-col justify-between p-12 text-white relative transition-colors duration-500 ${isTeacherMode ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800'}`}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10 flex items-center gap-4">
           <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/20 shadow-glow">
              <BookOpen className="text-white w-6 h-6" />
           </div>
           <span className="font-extrabold text-2xl tracking-tight">Hayford Hub {isTeacherMode && <span className="opacity-50 font-normal">| Faculty</span>}</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className={`text-5xl font-black tracking-tighter mb-6 leading-[1.1] text-transparent bg-clip-text drop-shadow-sm ${isTeacherMode ? 'bg-gradient-to-r from-white to-slate-400' : 'bg-gradient-to-r from-white to-indigo-200'}`}>
            {isTeacherMode ? 'Manage your institution seamlessly.' : 'Elevate your global learning journey.'}
          </h1>
          <p className={`${isTeacherMode ? 'text-slate-300' : 'text-indigo-200'} text-lg font-medium leading-relaxed max-w-md`}>
            {isTeacherMode ? 'The centralized instructor portal for monitoring student progress, managing scores, and accelerating outcomes.' : 'The proprietary learning suite for mastering IELTS, tracking your scores, and receiving world-class AI feedback.'}
          </p>
        </div>

        <div className={`relative z-10 flex items-center gap-4 text-xs font-bold tracking-widest uppercase ${isTeacherMode ? 'text-slate-500' : 'text-indigo-400'}`}>
          <span>&copy; 2026 Hayford Global</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isTeacherMode ? 'bg-slate-500' : 'bg-indigo-400'}`}></span>
          <span>Terms & Privacy</span>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="flex flex-col items-center justify-center p-8 bg-white relative">
        <div className="w-full max-w-sm">
          
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-soft">
                <BookOpen className="text-white w-5 h-5" />
             </div>
             <span className="font-extrabold text-xl tracking-tight text-slate-900">Hayford Hub</span>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
              {isLogin ? 'Welcome back' : 'Create an account'}
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
              <input required name="email" type="email" value={formData.email} placeholder="student@example.com" onChange={handleInputChange} className="w-full bg-slate-50 text-slate-900 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-sm placeholder:text-slate-300" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center ml-1">
                 <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Password</label>
                 {isLogin && <a href="#" className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors">Forgot password?</a>}
              </div>
              <input required name="password" type="password" value={formData.password} placeholder="••••••••" onChange={handleInputChange} className="w-full bg-slate-50 text-slate-900 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-sm placeholder:text-slate-300" />
            </div>

            <button disabled={isLoading} type="submit" className={`w-full text-white font-black py-4 rounded-xl mt-4 shadow-soft transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm tracking-wide ${isTeacherMode ? 'bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 shadow-xl' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-glow disabled:bg-indigo-300'}`}>
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : isLogin ? 'Sign In' : 'Create Account'}
              {!isLoading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-8 text-center text-sm font-medium text-slate-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={handleToggle} className={`font-bold transition-colors ${isTeacherMode ? 'text-slate-800 hover:text-slate-600' : 'text-indigo-600 hover:text-indigo-800'}`}>
              {isLogin ? 'Sign up' : 'Log in instead'}
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}
