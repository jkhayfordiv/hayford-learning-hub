import React, { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';

const USERS_PER_PAGE = 15;
const INSTITUTIONS_PER_PAGE = 5;
const CLASSES_PER_PAGE = 10;

export default function PlatformManager({ user, apiBase, navigationView, classes, onInstitutionsLoad }) {
  // Platform Management state
  const [institutions, setInstitutions] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [userEditForm, setUserEditForm] = useState({ role: '', institution_id: '', class_id: '' });
  const [isCreateInstitutionModalOpen, setIsCreateInstitutionModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);
  const [newInstitutionForm, setNewInstitutionForm] = useState({ name: '', address: '', contact_email: '' });
  const [newUserForm, setNewUserForm] = useState({ 
    first_name: '', last_name: '', email: '', password: '', role: 'student', institution_id: '' 
  });
  const [newClassForm, setNewClassForm] = useState({ 
    class_name: '', institution_id: '', teacher_id: '', start_date: '', end_date: '' 
  });
  const [globalUsersSearch, setGlobalUsersSearch] = useState('');
  const [globalUsersPage, setGlobalUsersPage] = useState(1);
  const [globalUsersSort, setGlobalUsersSort] = useState({ key: 'id', direction: 'asc' });
  const [institutionsSearch, setInstitutionsSearch] = useState('');
  const [institutionsPage, setInstitutionsPage] = useState(1);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [isEditInstitutionModalOpen, setIsEditInstitutionModalOpen] = useState(false);
  const [allClasses, setAllClasses] = useState([]);
  const [classesSearch, setClassesSearch] = useState('');
  const [classesPage, setClassesPage] = useState(1);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');

  // Fetch functions
  const fetchInstitutions = async () => {
    if (user.role !== 'super_admin' && user.role !== 'admin') return;
    setPlatformLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/institutions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstitutions(data);
        if (onInstitutionsLoad) onInstitutionsLoad(data);
      }
    } catch (err) {
      console.error('Failed to fetch institutions', err);
    } finally {
      setPlatformLoading(false);
    }
  };

  const fetchGlobalUsers = async () => {
    if (user.role !== 'super_admin' && user.role !== 'admin') return;
    setPlatformLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Users fetched:', data);
        setGlobalUsers(data);
      } else {
        console.error('Failed to fetch users - HTTP', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setPlatformLoading(false);
    }
  };

  const fetchAllClasses = async () => {
    if (user.role !== 'super_admin' && user.role !== 'admin') return;
    setPlatformLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/classes/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllClasses(data);
      }
    } catch (err) {
      console.error('Failed to fetch all classes', err);
    } finally {
      setPlatformLoading(false);
    }
  };

  // Event handlers
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(userEditForm)
      });

      if (!res.ok) throw new Error('Failed to update user');

      await fetchGlobalUsers();
      setIsUserEditModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      alert(err.message || 'Failed to update user');
    }
  };

  const handleCreateInstitution = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/institutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newInstitutionForm)
      });

      if (!res.ok) throw new Error('Failed to create institution');

      await fetchInstitutions();
      setIsCreateInstitutionModalOpen(false);
      setNewInstitutionForm({ name: '', address: '', contact_email: '' });
    } catch (err) {
      alert(err.message || 'Failed to create institution');
    }
  };
  
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newUserForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      alert('User created successfully');
      setIsCreateUserModalOpen(false);
      setNewUserForm({ first_name: '', last_name: '', email: '', password: '', role: 'student', institution_id: '' });
      await fetchGlobalUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newClassForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create class');
      alert('Class created successfully. Code: ' + data.class_code);
      setIsCreateClassModalOpen(false);
      setNewClassForm({ class_name: '', institution_id: '', teacher_id: '', start_date: '', end_date: '' });
      await fetchAllClasses();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Permanently delete ${userName}? This will remove all their data including scores, assignments, and progress. This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      alert('User deleted successfully');
      await fetchGlobalUsers();
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleDeleteInstitution = async (institutionId, institutionName) => {
    if (!window.confirm(`Permanently delete "${institutionName}"? This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/institutions/${institutionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete institution');

      alert('Institution deleted successfully');
      await fetchInstitutions();
    } catch (err) {
      alert(err.message || 'Failed to delete institution');
    }
  };

  // Fetch data when the navigation view changes
  useEffect(() => {
    if (navigationView === 'institutions') fetchInstitutions();
    else if (navigationView === 'users') {
      fetchGlobalUsers();
      fetchInstitutions();
      fetchAllClasses();
    }
    else if (navigationView === 'classes') fetchAllClasses();
  }, [navigationView]);

  return (
    <>
      {/* Classes Directory View */}
      {navigationView === 'classes' && (
        <div className="space-y-6">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Classes Directory</h2>
              <p className="text-slate-500 font-medium">
                {user.role === 'super_admin' ? 'View and manage all classes across all institutions' : 'View and manage classes in your institution'}
              </p>
            </div>
            <button
              onClick={() => setIsCreateClassModalOpen(true)}
              className="flex items-center gap-2 bg-[#800000] hover:bg-[#600000] text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              <PlusCircle size={16} /> Create New Class
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                placeholder="Search classes by name, teacher, or institution..."
                value={classesSearch}
                onChange={e => {
                  setClassesSearch(e.target.value);
                  setClassesPage(1);
                }}
                className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
            <div className="p-8">
              {platformLoading ? (
                <div className="text-center py-12 text-slate-400">Loading classes...</div>
              ) : allClasses.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No classes found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                        <th className="px-6 py-4">Class Name</th>
                        <th className="px-6 py-4">Teacher</th>
                        {user.role === 'super_admin' && <th className="px-6 py-4">Institution</th>}
                        <th className="px-6 py-4">Students</th>
                        <th className="px-6 py-4">Start Date</th>
                        <th className="px-6 py-4">End Date</th>
                        <th className="px-6 py-4">Class Code</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                      {(() => {
                        const filtered = allClasses.filter(cls => {
                          const searchLower = classesSearch.toLowerCase();
                          return !classesSearch ||
                            cls.class_name.toLowerCase().includes(searchLower) ||
                            `${cls.teacher_first_name} ${cls.teacher_last_name}`.toLowerCase().includes(searchLower) ||
                            (cls.institution_name && cls.institution_name.toLowerCase().includes(searchLower));
                        });

                        const startIdx = (classesPage - 1) * CLASSES_PER_PAGE;
                        const endIdx = startIdx + CLASSES_PER_PAGE;
                        const paginated = filtered.slice(startIdx, endIdx);

                        return paginated.map((cls) => (
                          <tr key={cls.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">{cls.class_name}</td>
                            <td className="px-6 py-4 text-slate-600">
                              {cls.teacher_first_name} {cls.teacher_last_name}
                            </td>
                            {user.role === 'super_admin' && (
                              <td className="px-6 py-4 text-slate-600">{cls.institution_name || 'N/A'}</td>
                            )}
                            <td className="px-6 py-4 text-center">
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold">
                                {cls.student_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {cls.start_date ? new Date(cls.start_date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {cls.end_date ? new Date(cls.end_date).toLocaleDateString() : 'Ongoing'}
                            </td>
                            <td className="px-6 py-4">
                              <code className="bg-purple-100 text-purple-700 px-3 py-1 rounded font-mono text-xs font-bold">
                                {cls.class_code}
                              </code>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {(() => {
                    const filtered = allClasses.filter(cls => {
                      const searchLower = classesSearch.toLowerCase();
                      return !classesSearch ||
                        cls.class_name.toLowerCase().includes(searchLower) ||
                        `${cls.teacher_first_name} ${cls.teacher_last_name}`.toLowerCase().includes(searchLower) ||
                        (cls.institution_name && cls.institution_name.toLowerCase().includes(searchLower));
                    });
                    const totalPages = Math.ceil(filtered.length / CLASSES_PER_PAGE);

                    if (totalPages <= 1) return null;

                    return (
                      <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
                        <div className="text-sm text-slate-600">
                          Showing {((classesPage - 1) * CLASSES_PER_PAGE) + 1} - {Math.min(classesPage * CLASSES_PER_PAGE, filtered.length)} of {filtered.length} classes
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setClassesPage(prev => Math.max(1, prev - 1))}
                            disabled={classesPage === 1}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                              <button
                                key={page}
                                onClick={() => setClassesPage(page)}
                                className={`px-3 py-2 font-bold rounded-lg transition-colors ${
                                  page === classesPage
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setClassesPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={classesPage === totalPages}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Institutions View */}
      {navigationView === 'institutions' && user.role === 'super_admin' && (
        <div className="space-y-6">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Institutions Directory</h2>
              <p className="text-slate-500 font-medium">Manage all institutions in the platform</p>
            </div>
            <button
              onClick={() => setIsCreateInstitutionModalOpen(true)}
              className="flex items-center gap-2 bg-[#800000] hover:bg-[#600000] text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              <PlusCircle size={16} /> Create New Institution
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                placeholder="Search institutions..."
                value={institutionsSearch}
                onChange={e => {
                  setInstitutionsSearch(e.target.value);
                  setInstitutionsPage(1);
                }}
                className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#800000] focus:outline-none"
              />
            </div>
            <div className="p-8">
              {platformLoading ? (
                <div className="text-center py-12 text-slate-400">Loading institutions...</div>
              ) : institutions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No institutions found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Contact Email</th>
                        <th className="px-6 py-4 text-center">Users</th>
                        <th className="px-6 py-4">Created</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                      {(() => {
                        const filtered = institutions.filter(inst => {
                          const searchLower = institutionsSearch.toLowerCase();
                          return !institutionsSearch || inst.name.toLowerCase().includes(searchLower);
                        });

                        const startIdx = (institutionsPage - 1) * INSTITUTIONS_PER_PAGE;
                        const endIdx = startIdx + INSTITUTIONS_PER_PAGE;
                        const paginated = filtered.slice(startIdx, endIdx);

                        return paginated.map((inst) => (
                          <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-[#800000]">{inst.id}</td>
                            <td className="px-6 py-4 font-bold text-slate-900">{inst.name}</td>
                            <td className="px-6 py-4 text-slate-600">{inst.contact_email || 'N/A'}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold">
                                {inst.user_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {inst.created_at ? new Date(inst.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setSelectedInstitution(inst);
                                    setIsEditInstitutionModalOpen(true);
                                  }}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteInstitution(inst.id, inst.name)}
                                  className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {(() => {
                    const filtered = institutions.filter(inst => {
                      const searchLower = institutionsSearch.toLowerCase();
                      return !institutionsSearch || inst.name.toLowerCase().includes(searchLower);
                    });
                    const totalPages = Math.ceil(filtered.length / INSTITUTIONS_PER_PAGE);

                    if (totalPages <= 1) return null;

                    return (
                      <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
                        <div className="text-sm text-slate-600">
                          Showing {((institutionsPage - 1) * INSTITUTIONS_PER_PAGE) + 1} - {Math.min(institutionsPage * INSTITUTIONS_PER_PAGE, filtered.length)} of {filtered.length} institutions
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setInstitutionsPage(prev => Math.max(1, prev - 1))}
                            disabled={institutionsPage === 1}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                              <button
                                key={page}
                                onClick={() => setInstitutionsPage(page)}
                                className={`px-3 py-2 font-bold rounded-lg transition-colors ${
                                  page === institutionsPage
                                    ? 'bg-[#800000] text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setInstitutionsPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={institutionsPage === totalPages}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Users View */}
      {navigationView === 'users' && (user.role === 'super_admin' || user.role === 'admin') && (
        <div className="space-y-6">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                {user.role === 'super_admin' ? 'Global Users Directory' : 'Users Directory'}
              </h2>
              <p className="text-slate-500 font-medium">
                {user.role === 'super_admin' ? 'Manage all users across all institutions' : 'Manage users in your institution'}
              </p>
            </div>
            <button
              onClick={() => setIsCreateUserModalOpen(true)}
              className="flex items-center gap-2 bg-[#800000] hover:bg-[#600000] text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              <PlusCircle size={16} /> Create New User
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={globalUsersSearch}
                onChange={e => {
                  setGlobalUsersSearch(e.target.value);
                  setGlobalUsersPage(1);
                }}
                className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#800000] focus:outline-none"
              />
            </div>
            <div className="p-8">
              {platformLoading ? (
                <div className="text-center py-12 text-slate-400">Loading users...</div>
              ) : globalUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No users found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
                        <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                          setGlobalUsersSort(prev => ({
                            key: 'id',
                            direction: prev.key === 'id' && prev.direction === 'asc' ? 'desc' : 'asc'
                          }));
                        }}>
                          ID {globalUsersSort.key === 'id' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                          setGlobalUsersSort(prev => ({
                            key: 'name',
                            direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc'
                          }));
                        }}>
                          Name {globalUsersSort.key === 'name' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                          setGlobalUsersSort(prev => ({
                            key: 'email',
                            direction: prev.key === 'email' && prev.direction === 'asc' ? 'desc' : 'asc'
                          }));
                        }}>
                          Email {globalUsersSort.key === 'email' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                          setGlobalUsersSort(prev => ({
                            key: 'role',
                            direction: prev.key === 'role' && prev.direction === 'asc' ? 'desc' : 'asc'
                          }));
                        }}>
                          Role {globalUsersSort.key === 'role' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                          setGlobalUsersSort(prev => ({
                            key: 'institution',
                            direction: prev.key === 'institution' && prev.direction === 'asc' ? 'desc' : 'asc'
                          }));
                        }}>
                          Institution {globalUsersSort.key === 'institution' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => {
                          setGlobalUsersSort(prev => ({
                            key: 'class',
                            direction: prev.key === 'class' && prev.direction === 'asc' ? 'desc' : 'asc'
                          }));
                        }}>
                          Class {globalUsersSort.key === 'class' && (globalUsersSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                      {(() => {
                        const filtered = globalUsers.filter(u => {
                          const searchLower = globalUsersSearch.toLowerCase();
                          return !globalUsersSearch ||
                            `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchLower) ||
                            u.email.toLowerCase().includes(searchLower);
                        });

                        const sorted = [...filtered].sort((a, b) => {
                          let aVal, bVal;
                          if (globalUsersSort.key === 'name') {
                            aVal = `${a.first_name} ${a.last_name}`.toLowerCase();
                            bVal = `${b.first_name} ${b.last_name}`.toLowerCase();
                          } else if (globalUsersSort.key === 'institution') {
                            aVal = (a.institution_name || '').toLowerCase();
                            bVal = (b.institution_name || '').toLowerCase();
                          } else if (globalUsersSort.key === 'class') {
                            aVal = (a.class_name || '').toLowerCase();
                            bVal = (b.class_name || '').toLowerCase();
                          } else {
                            aVal = a[globalUsersSort.key];
                            bVal = b[globalUsersSort.key];
                          }

                          if (aVal < bVal) return globalUsersSort.direction === 'asc' ? -1 : 1;
                          if (aVal > bVal) return globalUsersSort.direction === 'asc' ? 1 : -1;
                          return 0;
                        });

                        const startIdx = (globalUsersPage - 1) * USERS_PER_PAGE;
                        const endIdx = startIdx + USERS_PER_PAGE;
                        const paginated = sorted.slice(startIdx, endIdx);

                        return paginated.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-[#800000]">{u.id}</td>
                            <td className="px-6 py-4 font-bold text-slate-900">{u.first_name} {u.last_name}</td>
                            <td className="px-6 py-4 text-slate-600">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                                u.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                u.role === 'teacher' ? 'bg-green-100 text-green-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{u.institution_name || 'None'}</td>
                            <td className="px-6 py-4 text-slate-600">{u.class_name || 'None'}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    const instId = u.institution_id || '';
                                    setSelectedInstitutionId(instId);
                                    setUserEditForm({
                                      role: u.role,
                                      institution_id: instId,
                                      class_id: u.class_id || ''
                                    });
                                    setIsUserEditModalOpen(true);
                                  }}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, `${u.first_name} ${u.last_name}`)}
                                  className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {(() => {
                    const filtered = globalUsers.filter(u => {
                      const searchLower = globalUsersSearch.toLowerCase();
                      return !globalUsersSearch ||
                        `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchLower) ||
                        u.email.toLowerCase().includes(searchLower);
                    });
                    const totalPages = Math.ceil(filtered.length / USERS_PER_PAGE);

                    if (totalPages <= 1) return null;

                    return (
                      <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
                        <div className="text-sm text-slate-600">
                          Showing {((globalUsersPage - 1) * USERS_PER_PAGE) + 1} - {Math.min(globalUsersPage * USERS_PER_PAGE, filtered.length)} of {filtered.length} users
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setGlobalUsersPage(prev => Math.max(1, prev - 1))}
                            disabled={globalUsersPage === 1}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                              let page;
                              if (totalPages <= 5) {
                                page = i + 1;
                              } else if (globalUsersPage <= 3) {
                                page = i + 1;
                              } else if (globalUsersPage >= totalPages - 2) {
                                page = totalPages - 4 + i;
                              } else {
                                page = globalUsersPage - 2 + i;
                              }
                              return (
                                <button
                                  key={page}
                                  onClick={() => setGlobalUsersPage(page)}
                                  className={`px-3 py-2 font-bold rounded-lg transition-colors ${
                                    page === globalUsersPage
                                      ? 'bg-[#800000] text-white'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => setGlobalUsersPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={globalUsersPage === totalPages}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Institution Modal */}
      {isCreateInstitutionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-blue-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Create New Institution</h3>
            </div>
            <form onSubmit={handleCreateInstitution} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution Name</label>
                <input
                  required
                  type="text"
                  value={newInstitutionForm.name}
                  onChange={e => setNewInstitutionForm({...newInstitutionForm, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="e.g., Springfield High School"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Address (Optional)</label>
                <input
                  type="text"
                  value={newInstitutionForm.address}
                  onChange={e => setNewInstitutionForm({...newInstitutionForm, address: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="123 Main St, City, State"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Contact Email</label>
                <input
                  required
                  type="email"
                  value={newInstitutionForm.contact_email}
                  onChange={e => setNewInstitutionForm({...newInstitutionForm, contact_email: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="admin@school.edu"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateInstitutionModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                >
                  Create Institution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isUserEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Edit User</h3>
              <p className="text-sm text-blue-100 mt-1">{selectedUser.first_name} {selectedUser.last_name} ({selectedUser.email})</p>
            </div>
            <form onSubmit={handleUpdateUser} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Role</label>
                <select
                  required
                  value={userEditForm.role}
                  onChange={e => setUserEditForm({...userEditForm, role: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution</label>
                <select
                  value={userEditForm.institution_id}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedInstitutionId(val);
                    setUserEditForm({...userEditForm, institution_id: val, class_id: ''});
                  }}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">None</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class</label>
                <select
                  value={userEditForm.class_id}
                  onChange={e => setUserEditForm({...userEditForm, class_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  disabled={!selectedInstitutionId}
                >
                  <option value="">None</option>
                  {(() => {
                    const filteredClasses = allClasses.filter(c => String(c.institution_id) === String(selectedInstitutionId));
                    return filteredClasses.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                    ));
                  })()}
                </select>
                {!userEditForm.institution_id && (
                  <p className="text-xs text-slate-500 mt-1">Select an institution first to assign a class</p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserEditModalOpen(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Create New User</h3>
            </div>
            <form onSubmit={handleCreateUser} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">First Name</label>
                  <input
                    required
                    type="text"
                    value={newUserForm.first_name}
                    onChange={e => setNewUserForm({...newUserForm, first_name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Last Name</label>
                  <input
                    required
                    type="text"
                    value={newUserForm.last_name}
                    onChange={e => setNewUserForm({...newUserForm, last_name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Email Address</label>
                <input
                  required
                  type="email"
                  value={newUserForm.email}
                  onChange={e => setNewUserForm({...newUserForm, email: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Password</label>
                <input
                  required
                  type="password"
                  value={newUserForm.password}
                  onChange={e => setNewUserForm({...newUserForm, password: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Role</label>
                  <select
                    value={newUserForm.role}
                    onChange={e => setNewUserForm({...newUserForm, role: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                    {user.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution</label>
                  <select
                    value={newUserForm.institution_id}
                    onChange={e => setNewUserForm({...newUserForm, institution_id: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    disabled={user.role === 'admin'}
                  >
                    <option value="">{user.role === 'admin' ? 'Your Institution' : 'None'}</option>
                    {institutions.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {isCreateClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-indigo-600">
              <h3 className="font-black text-2xl text-white tracking-tight">Create New Class</h3>
            </div>
            <form onSubmit={handleCreateClass} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Class Name</label>
                <input
                  required
                  type="text"
                  value={newClassForm.class_name}
                  onChange={e => setNewClassForm({...newClassForm, class_name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="e.g., IELTS Academic Block A"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Institution</label>
                <select
                  required
                  value={newClassForm.institution_id}
                  onChange={e => setNewClassForm({...newClassForm, institution_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  disabled={user.role === 'admin'}
                >
                  <option value="">{user.role === 'admin' ? 'Your Institution' : 'Select Institution'}</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Teacher</label>
                <select
                  required
                  value={newClassForm.teacher_id}
                  onChange={e => setNewClassForm({...newClassForm, teacher_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">Select Teacher</option>
                  {globalUsers.filter(u => u.role === 'teacher' || u.role === 'admin').map(tea => (
                    <option key={tea.id} value={tea.id}>{tea.first_name} {tea.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">Start Date</label>
                  <input
                    type="date"
                    value={newClassForm.start_date}
                    onChange={e => setNewClassForm({...newClassForm, start_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black tracking-widest uppercase text-slate-400">End Date (Optional)</label>
                  <input
                    type="date"
                    value={newClassForm.end_date}
                    onChange={e => setNewClassForm({...newClassForm, end_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateClassModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
