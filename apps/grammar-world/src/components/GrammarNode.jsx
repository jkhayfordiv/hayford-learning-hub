import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Lock, CheckCircle, Sparkles } from 'lucide-react';

const GrammarNode = memo(({ data }) => {
  const { title, tier, state, onClick } = data;

  const getNodeStyles = () => {
    switch (state) {
      case 'locked':
        return {
          container: 'bg-gray-300 border-gray-400 opacity-50 cursor-not-allowed',
          text: 'text-gray-600',
          icon: <Lock size={20} className="text-gray-600" />,
        };
      case 'actionable':
        return {
          container: 'bg-brand-sangria border-brand-sangria shadow-lg hover:shadow-xl cursor-pointer animate-pulse-subtle',
          text: 'text-white',
          icon: <Sparkles size={20} className="text-white" />,
        };
      case 'cleared':
        return {
          container: 'bg-brand-navy border-brand-gold border-2 shadow-lg hover:shadow-xl cursor-pointer',
          text: 'text-white',
          icon: <CheckCircle size={20} className="text-brand-gold" />,
        };
      default:
        return {
          container: 'bg-white border-gray-300',
          text: 'text-gray-800',
          icon: null,
        };
    }
  };

  const styles = getNodeStyles();

  const getTierBadgeColor = () => {
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

  return (
    <div
      onClick={state !== 'locked' ? onClick : undefined}
      className={`
        relative px-6 py-4 rounded-xl border-2 transition-all duration-300
        min-w-[200px] max-w-[250px]
        ${styles.container}
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-brand-sangria border-2 border-white"
      />

      {/* Tier Badge */}
      <div className={`absolute -top-2 -right-2 ${getTierBadgeColor()} text-white text-xs px-2 py-1 rounded-full font-semibold`}>
        {tier}
      </div>

      {/* Node Content */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {styles.icon}
        </div>
        <div className="flex-1">
          <h3 className={`font-serif text-sm font-semibold leading-tight ${styles.text}`}>
            {title}
          </h3>
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-brand-sangria border-2 border-white"
      />
    </div>
  );
});

GrammarNode.displayName = 'GrammarNode';

export default GrammarNode;
