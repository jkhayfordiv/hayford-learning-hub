import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, BookOpen, Trophy, AlertCircle, ArrowLeft } from 'lucide-react';
import { fetchUserProgress, fetchRegions, fetchRecommendation } from '../services/api';
import { getUser } from '../utils/auth';
import RegionCard from '../components/RegionCard';

export default function GrammarHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [regions, setRegions] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [progressData, regionsData, recommendationData] = await Promise.all([
        fetchUserProgress(),
        fetchRegions(),
        fetchRecommendation(),
      ]);

      setProgress(progressData);
      setRegions(regionsData.regions || []);
      setRecommendation(recommendationData);

      // Check if diagnostic is completed
      if (!progressData.diagnostic_completed) {
        setShowDiagnosticModal(true);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegionClick = (regionName) => {
    if (showDiagnosticModal) return;
    const slug = regionName.toLowerCase().replace(/\s+/g, '-');
    navigate(`/region/${slug}`);
  };

  const handleStartDiagnostic = () => {
    navigate('/diagnostic');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand-sangria border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md shadow-soft">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="font-serif text-2xl text-brand-sangria mb-2 text-center">Cannot Load Page</h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={loadData}
            className="w-full bg-brand-sangria text-white px-6 py-3 rounded-xl hover:bg-opacity-90 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-brand-sangria to-brand-navy text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 text-white hover:text-gray-200 transition-colors mb-4 opacity-80 hover:opacity-100"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Hub</span>
          </button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl md:text-4xl mb-1">Grammar Lessons</h1>
              <p className="text-gray-200 text-sm">Welcome back, {user?.name || 'Student'}</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={20} className="text-brand-gold" />
                  <span className="text-2xl font-bold">{progress?.overall?.mastery_points || 0}</span>
                </div>
                <p className="text-xs text-gray-200">Mastery Points</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-2 mb-1">
                  <Award size={20} className="text-brand-gold" />
                  <span className="text-2xl font-bold">
                    {(progress?.by_region?.reduce((sum, r) => sum + r.bronze_medals + r.silver_medals + r.gold_medals, 0)) || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-200">Total Medals</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="font-serif text-3xl text-brand-sangria mb-2">Choose Your Path</h2>
          <p className="text-gray-600">Learn grammar step by step</p>
        </div>

        {/* Regions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regions.map((region) => (
            <RegionCard
              key={region.region}
              region={region}
              isRecommended={recommendation?.recommended_region === region.region}
              onClick={() => handleRegionClick(region.region)}
            />
          ))}
        </div>
      </main>

      {/* Diagnostic Modal */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-brand-sangria bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="text-brand-sangria" size={40} />
              </div>
              <h2 className="font-serif text-3xl text-brand-sangria mb-3">Grammar Test</h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                First, take a test. We will find the best lessons for you.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-brand-navy mb-3">What You Will Do:</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-brand-sangria mt-1">•</span>
                  <span>25 questions about grammar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-sangria mt-1">•</span>
                  <span>About 10-15 minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-sangria mt-1">•</span>
                  <span>We will show you the best lessons for you</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-sangria mt-1">•</span>
                  <span>No time limit—take your time</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleStartDiagnostic}
              className="w-full bg-brand-sangria text-white px-8 py-4 rounded-xl hover:bg-opacity-90 transition-all font-semibold text-lg shadow-lg hover:shadow-xl"
            >
              Start Test
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
