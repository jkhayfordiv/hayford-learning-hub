import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, ChevronLeft, Save, HelpCircle, Mail, Goal } from 'lucide-react';

export default function Profile({ user, onLogout }) {
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    target_score: user?.target_score || '7.0'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDeleteAccount = async () => {
    if (user?.role !== 'student') {
      alert('Only student accounts can be deleted.');
      return;
    }
    const confirmed = window.confirm('Delete your account permanently? This will remove your submissions and cannot be undone.');
    if (!confirmed) return;

    setDeleteError('');
    setIsDeletingAccount(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const res = await fetch(`${apiBase}/api/users/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      let data = {};
      try {
        data = text && contentType.includes('application/json') ? JSON.parse(text) : {};
      } catch (_) {
        data = {};
      }

      if (!res.ok) {
        console.error('Delete account failed:', { status: res.status, data, text });
        throw new Error(data.error || data.msg || text || 'Failed to delete account');
      }

      // Successfully deleted
      alert('Your account has been deleted successfully.');
      onLogout();
    } catch (err) {
      console.error('Delete account error:', err);
      setDeleteError(err.message || 'Failed to delete account');
      setIsDeletingAccount(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulating an API save request for target score and profile updates
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage('Profile settings saved successfully.');
      
      // Update local storage so the dashboard picks up the new target score if they go back
      const updatedUser = { ...user, ...formData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setTimeout(() => setSaveMessage(''), 3000);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white font-sans pb-20">
      
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight leading-none text-lg">My Account</h1>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Profile Settings</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12 animate-in fade-in duration-500 relative">
         
         {saveMessage && (
           <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-50 text-green-700 px-6 py-3 rounded-full text-sm font-bold border border-green-200 shadow-sm animate-in slide-in-from-top-4 fade-in z-50">
             {saveMessage}
           </div>
         )}

         <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 flex items-end gap-6 relative overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
               <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full border-4 border-white/20 flex items-center justify-center relative z-10 shadow-glow">
                  <User className="text-white w-10 h-10" />
               </div>
               <div className="relative z-10 text-white mb-2">
                  <h2 className="text-2xl font-black tracking-tight">{formData.first_name} {formData.last_name}</h2>
                  <p className="text-indigo-200 text-sm font-medium flex items-center gap-2 mt-1">
                    <Shield size={14} /> {
                      user?.role === 'super_admin' ? 'Super Admin Account' :
                      user?.role === 'admin' ? 'Admin Account' :
                      user?.role === 'teacher' ? 'Instructor Account' :
                      'Student Account'
                    }
                  </p>
               </div>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">First Name</label>
                    <input name="first_name" value={formData.first_name} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last Name</label>
                    <input name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                 </div>
               </div>

               <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address (Read Only)</label>
                  <input readOnly value={formData.email} className="w-full bg-slate-100 border border-slate-200 text-slate-500 px-4 py-3 rounded-xl text-sm font-medium cursor-not-allowed outline-none" />
               </div>

               {user?.role === 'student' && (
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Goal size={14} className="text-indigo-500" /> Target IELTS Band Score</label>
                    <select name="target_score" value={formData.target_score} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none text-indigo-700">
                       <option value="5.5">5.5</option>
                       <option value="6.0">6.0</option>
                       <option value="6.5">6.5</option>
                       <option value="7.0">7.0</option>
                       <option value="7.5">7.5</option>
                       <option value="8.0">8.0</option>
                       <option value="8.5">8.5</option>
                       <option value="9.0">9.0</option>
                    </select>
                 </div>
               )}

               <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all shadow-soft disabled:opacity-50">
                    <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
               </div>
            </form>
         </div>

         <div className="bg-slate-100 rounded-3xl p-8 border border-slate-200">
            <h3 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2 mb-4"><HelpCircle className="text-slate-400" /> Need Assistance?</h3>
            <p className="text-slate-600 text-sm font-medium leading-relaxed mb-6">
              If you are encountering issues with your dashboard, require a password reset, or need technical support with the IELTS AI marking tool, please reach out to our administration team.
            </p>
            <a href="mailto:support@hayfordglobal.com" className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-300 text-slate-700 font-bold text-sm rounded-xl shadow-sm hover:border-slate-400 hover:bg-slate-50 transition-all">
               <Mail size={16} /> Contact Support
            </a>
         </div>

         {user?.role === 'student' && (
           <div className="bg-red-50 rounded-3xl p-8 border border-red-200 mt-8">
             <h3 className="font-black text-lg text-red-700 tracking-tight mb-2">Danger Zone</h3>
             <p className="text-red-700/80 text-sm font-medium mb-5">
               You can permanently delete your account. This action cannot be undone.
             </p>
             {deleteError && (
               <div className="mb-4 p-3 bg-white text-red-700 text-xs font-bold rounded-lg border border-red-200">{deleteError}</div>
             )}
             <button
               onClick={handleDeleteAccount}
               disabled={isDeletingAccount}
               className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
             >
               {isDeletingAccount ? 'Deleting Account...' : 'Delete My Account'}
             </button>
           </div>
         )}

      </main>
    </div>
  );
}
