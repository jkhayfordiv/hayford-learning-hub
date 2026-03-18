import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, PlayCircle, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function WordBank({ user }) {
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://hayford-learning-hub.onrender.com');

  const [words, setWords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchWords();
  }, []);

  const fetchWords = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/wordbank`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch word bank');
      }

      const data = await res.json();
      setWords(data);
    } catch (err) {
      console.error('Error fetching word bank:', err);
      showMessage('error', 'Failed to load your word bank');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWord = async (e) => {
    e.preventDefault();
    
    if (!newWord.trim()) {
      showMessage('error', 'Please enter a word');
      return;
    }

    setIsAdding(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/wordbank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ word: newWord.trim(), source: 'manual' })
      });

      const data = await res.json();

      if (data.duplicate) {
        showMessage('warning', 'This word is already in your word bank');
      } else if (res.ok) {
        showMessage('success', 'Word added to your word bank!');
        setNewWord('');
        await fetchWords();
      } else {
        throw new Error(data.error || 'Failed to add word');
      }
    } catch (err) {
      console.error('Error adding word:', err);
      showMessage('error', err.message || 'Failed to add word');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteWord = async (wordId, word) => {
    if (!window.confirm(`Remove "${word}" from your word bank?`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/api/wordbank/${wordId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to delete word');
      }

      showMessage('success', 'Word removed from your word bank');
      await fetchWords();
    } catch (err) {
      console.error('Error deleting word:', err);
      showMessage('error', 'Failed to delete word');
    }
  };

  const handlePracticeWords = () => {
    console.log('Practice My Words clicked!');
    console.log('Words to practice:', words.map(w => w.word));
    showMessage('info', 'Practice feature coming soon! Check the console for your word list.');
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
            <BookOpen className="text-amber-600 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">My Word Bank</h2>
            <p className="text-slate-500 font-medium">Save and practice your vocabulary words</p>
          </div>
        </div>
      </div>

      {/* Message Toast */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message.type === 'success' && <CheckCircle size={20} />}
          {message.type === 'error' && <AlertCircle size={20} />}
          {message.type === 'warning' && <AlertCircle size={20} />}
          {message.type === 'info' && <AlertCircle size={20} />}
          <span className="font-bold text-sm">{message.text}</span>
        </div>
      )}

      {/* Practice Button */}
      <div className="mb-8">
        <button
          onClick={handlePracticeWords}
          disabled={words.length === 0}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg disabled:shadow-none"
        >
          <PlayCircle size={24} />
          <span className="text-lg">Practice My Words ({words.length})</span>
        </button>
      </div>

      {/* Add Word Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Add New Word</h3>
        <form onSubmit={handleAddWord} className="flex gap-3">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="Enter a vocabulary word..."
            className="flex-1 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            disabled={isAdding}
          />
          <button
            type="submit"
            disabled={isAdding || !newWord.trim()}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
          >
            {isAdding ? (
              <><Loader2 size={18} className="animate-spin" /> Adding...</>
            ) : (
              <><Plus size={18} /> Add Word</>
            )}
          </button>
        </form>
      </div>

      {/* Words List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">
          Your Saved Words ({words.length})
        </h3>

        {isLoading ? (
          <div className="text-center py-12 text-slate-400">
            <Loader2 size={32} className="animate-spin mx-auto mb-3" />
            <p className="font-medium">Loading your word bank...</p>
          </div>
        ) : words.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <BookOpen size={48} className="text-slate-300 mx-auto mb-4" />
            <h4 className="font-bold text-lg text-slate-900 mb-2">No words yet!</h4>
            <p className="text-slate-500 font-medium max-w-sm mx-auto">
              Start building your vocabulary by adding words above. Words you struggle with in the Vocab Lab will also appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {words.map((wordItem) => (
              <div
                key={wordItem.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all group relative"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-slate-900 mb-1">{wordItem.word}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        wordItem.source === 'manual' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {wordItem.source === 'manual' ? 'Manual' : 'Vocab Lab'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {new Date(wordItem.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteWord(wordItem.id, wordItem.word)}
                    className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                    title="Delete word"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
