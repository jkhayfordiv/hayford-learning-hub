import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, FileText, Calendar, PlusCircle, Trash2, CheckCircle2, Loader2 } from 'lucide-react';

export default function ClassDetails({ classId, onBack, onOpenAssignmentForm, user, apiBase, onOpenSubmissionReview }) {
  const [classData, setClassData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState(null);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

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

  const openSubmissionViewer = async (taskId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/scores/assignment/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch submission');
      
      if (onOpenSubmissionReview) {
        onOpenSubmissionReview(data);
      }
    } catch (err) {
      console.error('Fetch submission error:', err);
      alert('Error fetching submission: ' + err.message);
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
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
        <p className="text-red-600 dark:text-red-400 font-bold">{error}</p>
        <button onClick={onBack} className="mt-4 text-red-700 dark:text-red-300 underline">Go Back</button>
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
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold mb-4 transition-colors"
        >
          <ArrowLeft size={20} /> Back to Classes
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">{classInfo.class_name}</h2>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
              <span>Code: <span className="font-black text-slate-900 dark:text-white">{classInfo.class_code}</span></span>
              {classInfo.institution_name && <span>• {classInfo.institution_name}</span>}
              {classInfo.teacher_first_name && (
                <span>• Teacher: {classInfo.teacher_first_name} {classInfo.teacher_last_name}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Students</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{students.length}</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Assignments</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{assignments.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enrolled Students Section */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Users className="text-slate-400 dark:text-slate-500" /> Enrolled Students
            </h3>
          </div>
          
          <div className="p-6">
            {students.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/30">
                <Users size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">No students enrolled yet</h4>
                <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">
                  Students can join using the class code, or you can add them from the Users directory.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {student.first_name} {student.last_name}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{student.email}</p>
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
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
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <FileText className="text-slate-400 dark:text-slate-500" /> Class Assignments
            </h3>
            <button
              onClick={() => onOpenAssignmentForm && onOpenAssignmentForm(classId)}
              className="bg-slate-900 text-white font-bold text-sm px-4 py-2 rounded-xl hover:bg-slate-950 transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusCircle size={16} /> Assign to Class
            </button>
          </div>
          
          <div className="p-6">
            {assignments.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/30">
                <FileText size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">No assignments yet</h4>
                <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto mb-4">
                  Create assignments for this class to get started.
                </p>
                <button
                  onClick={() => onOpenAssignmentForm && onOpenAssignmentForm(classId)}
                  className="bg-slate-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-slate-950 transition-colors inline-flex items-center gap-2"
                >
                  <PlusCircle size={18} /> Create First Assignment
                </button>
              </div>
            ) : (
              (() => {
                // Separate active and completed assignments
                const activeAssignments = assignments.filter(a => a.completed_count < a.total_assigned);
                const completedAssignments = assignments.filter(a => a.completed_count === a.total_assigned);
                
                return (
                  <div className="space-y-6">
                    {/* Active Assignments */}
                    {activeAssignments.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                          <span className="w-8 h-[1px] bg-slate-200 dark:bg-slate-700"></span>
                          Active Assignments
                          <span className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-700"></span>
                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">{activeAssignments.length}</span>
                        </h4>
                        {activeAssignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                          >
                            <div 
                              className="bg-slate-50 dark:bg-slate-900/30 p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all"
                              onClick={() => setExpandedAssignmentId(expandedAssignmentId === assignment.id ? null : assignment.id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                                    {assignment.assignment_type === 'vocabulary' ? 'Vocabulary Builder' : assignment.module_name}
                                  </h4>
                                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                                    {assignment.instructions || 'No specific instructions provided.'}
                                  </p>
                                  <div className="flex items-center gap-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    {assignment.due_date && (
                                      <span className="flex items-center gap-1.5">
                                        <Calendar size={12} /> Due: {new Date(assignment.due_date).toLocaleDateString()}
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-600">
                                      {assignment.assignment_type}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Progress</span>
                                  <span className={`text-lg font-black ${
                                    assignment.completed_count === assignment.total_assigned ? 'text-green-600' : 'text-slate-900 dark:text-white'
                                  }`}>
                                    {assignment.completed_count} / {assignment.total_assigned}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Expanded Student List */}
                            {expandedAssignmentId === assignment.id && assignment.student_submissions && (
                              <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
                                <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1.5">Student Statuses</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {assignment.student_submissions.map(s => (
                                    <div 
                                      key={s.student_id} 
                                      onClick={s.status === 'completed' ? () => openSubmissionViewer(s.assignment_id) : undefined}
                                      className={`bg-slate-50 dark:bg-slate-900/30 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm transition-all ${
                                        s.status === 'completed' 
                                          ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600' 
                                          : ''
                                      }`}
                                    >
                                      <span className={`font-bold text-[13px] ${s.status === 'completed' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-600'}`}>
                                        {s.student_first_name} {s.student_last_name}
                                      </span>
                                      {s.status === 'completed' 
                                        ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-green-200 dark:border-green-800">
                                            <CheckCircle2 size={10} /> Complete
                                          </span>
                                        : <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-amber-200 dark:border-amber-800">Pending</span>
                                      }
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Completed Assignments */}
                    {completedAssignments.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                          <span className="w-8 h-[1px] bg-slate-200 dark:bg-slate-700"></span>
                          Completed Assignments
                          <span className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-700"></span>
                          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">{completedAssignments.length}</span>
                        </h4>
                        <div className="space-y-3 opacity-80 hover:opacity-100 transition-opacity">
                          {(showAllCompleted ? completedAssignments : completedAssignments.slice(0, 5)).map((assignment) => (
                            <div
                              key={assignment.id}
                              className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                            >
                              <div 
                                className="bg-slate-50 dark:bg-slate-900/30 p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all"
                                onClick={() => setExpandedAssignmentId(expandedAssignmentId === assignment.id ? null : assignment.id)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                                      {assignment.assignment_type === 'vocabulary' ? 'Vocabulary Builder' : assignment.module_name}
                                    </h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                                      {assignment.instructions || 'No specific instructions provided.'}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                      {assignment.due_date && (
                                        <span className="flex items-center gap-1.5">
                                          <Calendar size={12} /> Due: {new Date(assignment.due_date).toLocaleDateString()}
                                        </span>
                                      )}
                                      <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-600">
                                        {assignment.assignment_type}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Progress</span>
                                    <span className="text-lg font-black text-green-600">
                                      {assignment.completed_count} / {assignment.total_assigned}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Expanded Student List */}
                              {expandedAssignmentId === assignment.id && assignment.student_submissions && (
                                <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
                                  <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1.5">Student Statuses</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {assignment.student_submissions.map(s => (
                                      <div 
                                        key={s.student_id} 
                                        onClick={s.status === 'completed' ? () => openSubmissionViewer(s.assignment_id) : undefined}
                                        className={`bg-slate-50 dark:bg-slate-900/30 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm transition-all ${
                                          s.status === 'completed' 
                                            ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600' 
                                            : ''
                                        }`}
                                      >
                                        <span className={`font-bold text-[13px] ${s.status === 'completed' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-600'}`}>
                                          {s.student_first_name} {s.student_last_name}
                                        </span>
                                        {s.status === 'completed' 
                                          ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-green-200 dark:border-green-800">
                                              <CheckCircle2 size={10} /> Complete
                                            </span>
                                          : <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-amber-200 dark:border-amber-800">Pending</span>
                                        }
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {completedAssignments.length > 5 && (
                          <div className="flex justify-center pt-4">
                            <button
                              onClick={() => setShowAllCompleted(!showAllCompleted)}
                              className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                            >
                              {showAllCompleted ? 'Show Less' : `Show ${completedAssignments.length - 5} More Completed`}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
