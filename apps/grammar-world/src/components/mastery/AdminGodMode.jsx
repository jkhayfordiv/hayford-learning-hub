import { useState } from 'react';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';
import { updateNode } from '../../services/api';

export default function AdminGodMode({ node, onExit }) {
  const [editedQuestions, setEditedQuestions] = useState(
    node?.mastery_check?.activity_data?.questions || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const handleQuestionChange = (index, newText) => {
    const updated = [...editedQuestions];
    updated[index] = { ...updated[index], question: newText };
    setEditedQuestions(updated);
  };

  const handleAnswerChange = (index, newAnswerStr) => {
    // Attempt to parse arrays, or fallback to exact string
    let parsedAnswer;
    try {
      if (newAnswerStr.startsWith('[') && newAnswerStr.endsWith(']')) {
        parsedAnswer = JSON.parse(newAnswerStr);
      } else {
        parsedAnswer = newAnswerStr;
      }
    } catch (e) {
      parsedAnswer = newAnswerStr;
    }
    const updated = [...editedQuestions];
    updated[index] = { ...updated[index], correct_answer: parsedAnswer };
    setEditedQuestions(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('');
    try {
      // Reconstruct full node
      const updatedNodeContent = {
        ...node,
        mastery_check: {
          ...node.mastery_check,
          activity_data: {
            ...node.mastery_check.activity_data,
            questions: editedQuestions
          }
        }
      };

      await updateNode(node.node_id, updatedNodeContent);
      setSaveStatus('success');
      setTimeout(() => onExit(), 1500);
    } catch (err) {
      setSaveStatus('error');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-red-50 rounded-xl p-8 shadow-soft border-4 border-red-500">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="font-serif text-3xl text-red-700 font-bold mb-1">God Mode: Curriculum Editor</h2>
          <p className="text-red-500 text-sm">You are editing the live database. Changes will be saved permanently.</p>
        </div>
        <button 
          onClick={onExit}
          className="text-gray-500 hover:text-gray-700 underline"
        >
          Cancel
        </button>
      </div>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {editedQuestions.map((q, idx) => {
          // Format correct answer for input box
          const answerVal = Array.isArray(q.correct_answer) 
            ? JSON.stringify(q.correct_answer) 
            : q.correct_answer;

          return (
            <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-red-200">
              <div className="mb-3 flex justify-between items-center text-sm font-bold text-gray-500">
                <span>Question {idx + 1}</span>
                {q.type && <span className="bg-gray-100 px-2 py-1 rounded">{q.type}</span>}
              </div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Prompt / Question (Markdown OK)</label>
              <textarea
                value={q.question || ''}
                onChange={(e) => handleQuestionChange(idx, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded mb-3 focus:outline-none focus:border-red-400"
                rows="2"
              />

              <label className="block text-sm font-semibold mb-1 text-gray-700">Correct Answer(s)</label>
              <input
                value={answerVal || ''}
                onChange={(e) => handleAnswerChange(idx, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-red-400"
                placeholder="String or Array format: ['jumped', 'did jump']"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-red-200 pt-6">
        <div>
          {saveStatus === 'success' && <span className="text-green-600 flex items-center gap-2"><CheckCircle size={20}/> Saved successfully!</span>}
          {saveStatus === 'error' && <span className="text-red-600 flex items-center gap-2"><AlertCircle size={20}/> Error saving to database.</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold shadow hover:bg-red-700 flex items-center gap-2"
        >
          <Save size={20} />
          {isSaving ? 'Saving to Database...' : 'Save Live Curriculum'}
        </button>
      </div>
    </div>
  );
}
