import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, FileText, Calendar, PlusCircle, Trash2, CheckCircle2, Loader2 } from 'lucide-react';

export default function ClassDetails({ classId, onBack, user, apiBase }) {
  const [classData, setClassData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  useEffect(() => {
    fetchClassDetails();
  }, [classId]);

  const fetchClassDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/classes/${classId}/details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch class details');
      }

      const data = await res.json();
      setClassData(data);
    } catch (err) {
      console.error('Error fetching class details:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={48} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <p className="text-red-600 font-bold">{error}</p>
        <button onClick={onBack} className="mt-4 text-red-700 underline">Go Back</button>
      </div>
    );
  }

  if (!classData) return null;

  const { class: classInfo, students, assignments } = classData;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold mb-4 transition-colors"
        >
          <ArrowLeft size={20} /> Back to Classes
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{classInfo.class_name}</h2>
            <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
              <span>Code: <span className="font-black text-slate-900">{classInfo.class_code}</span></span>
              {classInfo.institution_name && <span>• {classInfo.institution_name}</span>}
              {classInfo.teacher_first_name && (
                <span>• Teacher: {classInfo.teacher_first_name} {classInfo.teacher_last_name}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Students</span>
              <p className="text-2xl font-black text-slate-900">{students.length}</p>
            </div>
            <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Assignments</span>
              <p className="text-2xl font-black text-slate-900">{assignments.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enrolled Students Section */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-black text-xl text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="text-slate-400" /> Enrolled Students
            </h3>
          </div>
          
          <div className="p-6">
            {students.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <Users size={48} className="text-slate-300 mx-auto mb-4" />
                <h4 className="font-bold text-lg text-slate-900 mb-2">No students enrolled yet</h4>
                <p className="text-slate-500 font-medium max-w-sm mx-auto">
                  Students can join using the class code, or you can add them from the Users directory.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900">
                          {student.first_name} {student.last_name}
                        </h4>
                        <p className="text-sm text-slate-500 font-medium">{student.email}</p>
                      </div>
                      <div className="text-xs text-slate-400 font-medium">
                        Joined {new Date(student.joined_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Class Assignments Section */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-black text-xl text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="text-slate-400" /> Class Assignments
            </h3>
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="bg-slate-900 text-white font-bold text-sm px-4 py-2 rounded-xl hover:bg-slate-950 transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusCircle size={16} /> Assign to Class
            </button>
          </div>
          
          <div className="p-6">
            {assignments.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <FileText size={48} className="text-slate-300 mx-auto mb-4" />
                <h4 className="font-bold text-lg text-slate-900 mb-2">No assignments yet</h4>
                <p className="text-slate-500 font-medium max-w-sm mx-auto mb-4">
                  Create assignments for this class to get started.
                </p>
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="bg-slate-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-slate-950 transition-colors inline-flex items-center gap-2"
                >
                  <PlusCircle size={18} /> Create First Assignment
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 mb-1">
                          {assignment.assignment_type === 'vocabulary' ? 'Vocabulary Builder' : assignment.module_name}
                        </h4>
                        <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                          {assignment.instructions || 'No specific instructions provided.'}
                        </p>
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {assignment.due_date && (
                            <span className="flex items-center gap-1.5">
                              <Calendar size={12} /> Due: {new Date(assignment.due_date).toLocaleDateString()}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-slate-200 rounded-md border border-slate-300">
                            {assignment.assignment_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center bg-white px-3 py-2 rounded-lg border border-slate-200 shrink-0">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Progress</span>
                        <span className={`text-lg font-black ${
                          assignment.completed_count === assignment.total_assigned ? 'text-green-600' : 'text-slate-900'
                        }`}>
                          {assignment.completed_count} / {assignment.total_assigned}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assignment Modal Placeholder */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800">
              <h3 className="font-black text-2xl text-white tracking-tight">Assign to Class</h3>
              <p className="text-sm text-slate-300 mt-1">Create assignment for {classInfo.class_name}</p>
            </div>
            <div className="p-8 text-center">
              <p className="text-slate-600 font-medium mb-6">
                Assignment creation modal will be integrated with the existing assignment form, pre-filling class_id: <span className="font-black text-slate-900">{classId}</span>
              </p>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-950 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
