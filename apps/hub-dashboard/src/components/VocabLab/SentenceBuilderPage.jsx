import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StudySession from './StudySession';

function darkenHex(hex, pct = 0.4) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return '#1a0008';
  return `#${[parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)]
    .map(v => Math.round(v * (1 - pct)).toString(16).padStart(2,'0'))
    .join('')}`;
}

export default function SentenceBuilderPage() {
  const location = useLocation();
  const navigate = useNavigate();

  let branding = {};
  try { branding = JSON.parse(localStorage.getItem('branding') || '{}'); } catch (_) {}
  const brandPrimary = branding.primary_color || '#800020';
  const brandDark    = darkenHex(brandPrimary);

  const words = location.state?.words ?? [];

  if (words.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
        style={{ background: `linear-gradient(160deg, ${brandDark} 0%, #0f172a 100%)` }}
      >
        <p className="text-5xl">⭐</p>
        <p className="text-xl font-black text-white">No words passed</p>
        <p className="text-sm text-white/50 text-center max-w-xs">
          Star some words in Vocab Lab first, then tap Sentence Builder.
        </p>
        <button
          onClick={() => navigate('/vocab-lab')}
          className="mt-4 px-6 py-3 rounded-2xl font-bold text-sm text-white bg-white/20 hover:bg-white/30 transition-colors"
        >
          Back to Vocab Lab
        </button>
      </div>
    );
  }

  const handleExit = () => navigate('/vocab-lab');

  return (
    <StudySession
      words={words}
      isSandboxMode={true}
      isFamilyMode={false}
      isMasteredReview={false}
      brandPrimary={brandPrimary}
      brandDark={brandDark}
      onClose={handleExit}
      onComplete={handleExit}
    />
  );
}
