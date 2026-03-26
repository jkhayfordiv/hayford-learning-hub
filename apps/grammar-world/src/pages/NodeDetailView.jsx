import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, ArrowLeft, AlertCircle, Award } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { fetchNode } from '../services/api';
import MasteryCheckEngine from '../components/MasteryCheckEngine';

export default function NodeDetailView() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nodeData, setNodeData] = useState(null);

  useEffect(() => {
    loadNode();
  }, [nodeId]);

  const loadNode = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchNode(nodeId);
      setNodeData(data);
    } catch (err) {
      console.error('Error loading node:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTierBadgeColor = (tier) => {
    switch (tier) {
      case 'Bronze':
        return 'bg-amber-600';
      case 'Silver':
        return 'bg-gray-400';
      case 'Gold':
        return 'bg-brand-gold';
      case 'Diagnostic':
        return 'bg-purple-600';
      default:
        return 'bg-gray-500';
    }
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
          <h2 className="font-serif text-2xl text-brand-sangria mb-2 text-center">Cannot Load Lesson</h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={loadNode}
            className="w-full bg-brand-sangria text-white px-6 py-3 rounded-xl hover:bg-opacity-90 transition-all mb-2"
          >
            Retry
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-300 transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-gradient-to-r from-brand-sangria to-brand-navy text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white hover:text-gray-200 transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen size={32} />
                <h1 className="font-serif text-3xl md:text-4xl">{nodeData?.title}</h1>
              </div>
              <p className="text-gray-200">{nodeData?.description || ''}</p>
            </div>
            <div className={`${getTierBadgeColor(nodeData?.tier)} text-white px-4 py-2 rounded-full font-semibold flex items-center gap-2`}>
              <Award size={16} />
              {nodeData?.tier}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Lesson Content */}
        <div className="bg-white rounded-xl p-8 shadow-soft mb-8">
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="font-serif text-4xl text-brand-sangria mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="font-serif text-3xl text-brand-sangria mb-3 mt-6">{children}</h2>,
                h3: ({ children }) => <h3 className="font-serif text-2xl text-brand-navy mb-2 mt-4">{children}</h3>,
                h4: ({ children }) => <h4 className="font-serif text-xl text-brand-navy mb-2 mt-3">{children}</h4>,
                p: ({ children }) => <p className="font-sans text-gray-700 mb-4 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="font-sans text-gray-700 mb-4 ml-6 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="font-sans text-gray-700 mb-4 ml-6 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="mb-2">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-brand-sangria">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-brand-sangria pl-4 italic text-gray-600 my-4">
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-brand-navy">
                    {children}
                  </code>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-6">
                    <table className="min-w-full border-collapse border border-gray-300">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-brand-sangria text-white">{children}</thead>,
                th: ({ children }) => <th className="border border-gray-300 px-4 py-2 text-left">{children}</th>,
                td: ({ children }) => <td className="border border-gray-300 px-4 py-2">{children}</td>,
                hr: () => <hr className="my-8 border-t-2 border-gray-200" />,
              }}
            >
              {nodeData?.lesson_content_markdown || ''}
            </ReactMarkdown>
          </div>
        </div>

        {/* Mastery Check Engine */}
        <MasteryCheckEngine 
          node={nodeData} 
          regionName={nodeData?.region?.toLowerCase().replace(/\s+/g, '-') || 'time-matrix'}
        />
      </main>
    </div>
  );
}
