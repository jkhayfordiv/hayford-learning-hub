import { Award, BookOpen, Trophy } from 'lucide-react';

export default function RegionCard({ region, isRecommended, onClick }) {
  const { region: regionName, total_nodes, completed_nodes, bronze_count, silver_count, gold_count } = region;
  
  const progressPercentage = total_nodes > 0 ? Math.round((completed_nodes / total_nodes) * 100) : 0;
  
  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white rounded-xl p-6 cursor-pointer
        transition-all duration-300 hover:shadow-lift hover:-translate-y-1
        ${isRecommended ? 'border-2 border-brand-gold shadow-glow-gold' : 'border border-gray-200 shadow-soft'}
      `}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-gold text-white px-4 py-1 rounded-full text-xs font-semibold">
          Recommended
        </div>
      )}
      
      <div className="mb-4">
        <h3 className="font-serif text-2xl text-brand-sangria mb-2">{regionName}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <BookOpen size={16} />
          <span>{completed_nodes} / {total_nodes} nodes completed</span>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Progress</span>
          <span className="text-sm font-semibold text-brand-sangria">{progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-brand-sangria rounded-full h-2 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
      
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-amber-600" />
          <span className="text-gray-600">{bronze_count} Bronze</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-gray-600">{silver_count} Silver</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-brand-gold" />
          <span className="text-gray-600">{gold_count} Gold</span>
        </div>
      </div>
    </div>
  );
}
