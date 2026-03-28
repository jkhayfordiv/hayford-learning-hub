import { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertTriangle, FileText, Award, Sparkles, RefreshCw } from 'lucide-react';
import { fetchCohortProgress, fetchHeatMap, fetchRecentSubmissions } from '../services/grammarApi';

export default function GrammarAnalytics() {
  const [cohortData, setCohortData] = useState(null);
  const [heatMapData, setHeatMapData] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [cohort, heatMap, recentSubs] = await Promise.all([
        fetchCohortProgress(),
        fetchHeatMap(),
        fetchRecentSubmissions(),
      ]);

      setCohortData(cohort);
      setHeatMapData(heatMap);
      setSubmissions(recentSubs);
    } catch (err) {
      console.error('Error loading grammar analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#5E1914] border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading Grammar Analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="text-red-500 mx-auto mb-3" size={48} />
        <h3 className="font-bold text-red-900 mb-2">Error Loading Analytics</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={loadAnalytics}
          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const getMedalColor = (tier) => {
    switch (tier) {
      case 'Bronze': return 'text-amber-600';
      case 'Silver': return 'text-gray-400';
      case 'Gold': return 'text-[#D4AF37]';
      default: return 'text-gray-500';
    }
  };

  const formatErrorTag = (tag) => {
    return tag
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Grammar World Analytics
          </h2>
          <p className="text-slate-500 font-medium">Track cohort progress and identify curriculum bottlenecks.</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="flex items-center gap-2 bg-[#5E1914] text-white px-4 py-2 rounded-xl hover:bg-opacity-90 transition-all font-semibold"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Top Class Weaknesses Panel */}
      {cohortData?.top_class_weaknesses && cohortData.top_class_weaknesses.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h3 className="font-black text-xl text-[#5E1914] tracking-tight mb-6 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <AlertTriangle size={24} />
            Top Class Weaknesses
          </h3>
          <div className="space-y-3">
            {cohortData.top_class_weaknesses.map((weakness, idx) => (
              <div 
                key={weakness.error_tag}
                className={`
                  rounded-xl p-2 flex items-center justify-between
                  ${idx === 0 
                    ? 'bg-[#5E1914] text-white' 
                    : 'bg-slate-50 text-slate-900'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="font-black text-lg">#{idx + 1}</span>
                  <span className="font-semibold text-sm">
                    {formatErrorTag(weakness.error_tag)}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`font-black text-lg ${idx === 0 ? 'text-white' : 'text-[#5E1914]'}`}>
                    {weakness.total_errors} errors
                  </div>
                  <div className={`text-xs ${idx === 0 ? 'text-white opacity-80' : 'text-slate-500'}`}>
                    {weakness.students_affected} students affected
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cohort Overview Panel */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <h3 className="font-black text-xl text-[#5E1914] tracking-tight mb-6 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <Users size={24} />
          Cohort Overview
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
            <div className="text-sm font-semibold text-blue-700 mb-1">Total Students</div>
            <div className="text-4xl font-black text-blue-900">{cohortData?.total_students || 0}</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
            <div className="text-sm font-semibold text-green-700 mb-1">Diagnostic Complete</div>
            <div className="text-4xl font-black text-green-900">{cohortData?.diagnostic_completed || 0}</div>
          </div>
          
          <div className="bg-gradient-to-br from-[#D4AF37] from-opacity-20 to-[#D4AF37] to-opacity-30 rounded-xl p-6">
            <div className="text-sm font-semibold text-[#5E1914] mb-1">Total Mastery Points</div>
            <div className="text-4xl font-black text-[#5E1914]">{cohortData?.total_mastery_points?.toLocaleString() || 0}</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
            <div className="text-sm font-semibold text-purple-700 mb-1">Medals Earned</div>
            <div className="flex items-center gap-3 mt-2">
              {cohortData?.medals?.map(medal => (
                <div key={medal.medal_tier} className="flex items-center gap-1">
                  <Award className={getMedalColor(medal.medal_tier)} size={20} />
                  <span className="font-bold text-slate-900">{medal.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Region Progress */}
        <div>
          <h4 className="font-bold text-slate-900 mb-4">Completion by Region</h4>
          <div className="space-y-3">
            {cohortData?.region_progress?.map(region => (
              <div key={region.region} className="border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-slate-900">{region.region}</span>
                  <span className="text-sm text-slate-600">
                    {region.completed_nodes}/{region.total_nodes} nodes ({region.completion_rate}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-[#5E1914] h-2 rounded-full transition-all"
                    style={{ width: `${region.completion_rate}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottleneck Heat Map Panel */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <h3 className="font-black text-xl text-[#5E1914] tracking-tight mb-6 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <AlertTriangle size={24} />
          Bottleneck Heat Map
        </h3>
        <p className="text-slate-600 mb-6">Nodes with high failure rates require additional instruction in live classes.</p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-4 font-black text-xs uppercase tracking-wider text-slate-600">Node</th>
                <th className="text-left py-3 px-4 font-black text-xs uppercase tracking-wider text-slate-600">Region</th>
                <th className="text-left py-3 px-4 font-black text-xs uppercase tracking-wider text-slate-600">Tier</th>
                <th className="text-center py-3 px-4 font-black text-xs uppercase tracking-wider text-slate-600">Attempts</th>
                <th className="text-center py-3 px-4 font-black text-xs uppercase tracking-wider text-slate-600">Failure Rate</th>
                <th className="text-center py-3 px-4 font-black text-xs uppercase tracking-wider text-slate-600">Avg Attempts</th>
              </tr>
            </thead>
            <tbody>
              {heatMapData?.bottlenecks?.length > 0 ? (
                heatMapData.bottlenecks.map((node, idx) => {
                  const isHighRisk = parseFloat(node.failure_rate) >= 40;
                  return (
                    <tr
                      key={node.node_id}
                      className={`border-b border-slate-100 ${isHighRisk ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{node.title}</div>
                        <div className="text-xs text-slate-500">{node.node_id}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{node.region}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                          node.tier === 'Bronze' ? 'bg-amber-100 text-amber-700' :
                          node.tier === 'Silver' ? 'bg-gray-100 text-gray-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {node.tier}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-900">{node.total_attempts}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold ${isHighRisk ? 'text-red-600' : 'text-slate-900'}`}>
                          {node.failure_rate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-900">{node.avg_attempts_per_student}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    No bottleneck data available yet. Students need to complete more activities.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Review Queue Panel */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <h3 className="font-black text-xl text-[#5E1914] tracking-tight mb-6 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <Sparkles size={24} />
          AI Review Queue
        </h3>
        <p className="text-slate-600 mb-6">Recent AI-graded submissions for quality assurance.</p>

        <div className="space-y-4">
          {submissions?.submissions?.length > 0 ? (
            submissions.submissions.map((sub) => (
              <div
                key={sub.id}
                className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-bold text-slate-900">{sub.student_name}</div>
                    <div className="text-sm text-slate-500">{sub.student_email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-700">{sub.node_title}</div>
                    <div className="text-xs text-slate-500">{sub.region}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(sub.submitted_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                  <div className="text-xs font-bold text-slate-600 mb-2">Student Response:</div>
                  <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                    {typeof sub.user_response === 'object' ? sub.user_response.userText : sub.user_response}
                  </div>
                </div>

                {sub.ai_feedback && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-3">
                    <div className="text-xs font-bold text-blue-900 mb-2">AI Feedback:</div>
                    <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">
                      {sub.ai_feedback}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      sub.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {sub.passed ? 'PASSED' : 'FAILED'}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      Score: {sub.score}%
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-500">
              <FileText className="mx-auto mb-3 text-slate-300" size={48} />
              <p>No AI-graded submissions yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
