import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { fetchRegionNodes, fetchUserProgress } from '../services/api';
import GrammarNode from '../components/GrammarNode';

const nodeTypes = {
  grammarNode: GrammarNode,
};

// Inner component so we can use the useReactFlow hook
function RegionFlowMap({ nodes, edges }) {
  const { fitView, setCenter } = useReactFlow();
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (!nodes.length || hasCenteredRef.current) return;

    // Find the first 'actionable' (current) node to focus on
    const currentNode = nodes.find(n => n.data.state === 'actionable');
    
    if (currentNode) {
      hasCenteredRef.current = true;
      // Short delay to allow ReactFlow to complete its initial layout
      setTimeout(() => {
        setCenter(currentNode.position.x + 80, currentNode.position.y + 40, {
          zoom: 1.2,
          duration: 800,
        });
      }, 150);
    } else {
      // Fallback: fit all nodes if none are actionable
      hasCenteredRef.current = true;
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 600 });
      }, 150);
    }
  }, [nodes, setCenter, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      minZoom={0.3}
      maxZoom={1.5}
      className="bg-gradient-to-br from-gray-50 to-gray-100"
    >
      <Background
        color="#5E1914"
        gap={20}
        size={1}
        variant="dots"
        className="opacity-20"
      />
      <Controls
        className="bg-white rounded-lg shadow-lg border border-gray-200"
      />
    </ReactFlow>
  );
}

export default function RegionView() {
  const { regionName } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  const displayName = regionName
    ? regionName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'Unknown Region';

  useEffect(() => {
    loadRegionData();
  }, [regionName]);

  const loadRegionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [regionData, progressData] = await Promise.all([
        fetchRegionNodes(regionName),
        fetchUserProgress(),
      ]);

      const regionNodes = regionData.nodes || [];
      const completedNodes = new Set(
        progressData.by_region
          ?.find(r => r.region.toLowerCase().replace(/\s+/g, '-') === regionName)
          ?.completed_nodes || []
      );

      // Calculate node positions using a mathematical layout
      const flowNodes = regionNodes.map((node, index) => {
        const position = calculateNodePosition(index, regionNodes.length);
        const state = getNodeState(node, completedNodes, regionNodes);

        return {
          id: node.node_id,
          type: 'grammarNode',
          position,
          data: {
            title: node.title,
            tier: node.tier,
            state,
            onClick: () => handleNodeClick(node.node_id, state),
          },
        };
      });

      // Create edges from prerequisites
      const flowEdges = [];
      regionNodes.forEach(node => {
        if (node.prerequisites && node.prerequisites.length > 0) {
          node.prerequisites.forEach(prereqId => {
            flowEdges.push({
              id: `${prereqId}-${node.node_id}`,
              source: prereqId,
              target: node.node_id,
              animated: true,
              style: { stroke: '#5E1914', strokeWidth: 2 },
              type: 'smoothstep',
            });
          });
        }
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      console.error('Error loading region data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateNodePosition = (index, totalNodes) => {
    // Use a sine wave pattern for elegant, non-overlapping layout
    const nodesPerRow = 4;
    const row = Math.floor(index / nodesPerRow);
    const col = index % nodesPerRow;
    
    const horizontalSpacing = 300;
    const verticalSpacing = 250;
    const waveAmplitude = 80;
    
    let x = col * horizontalSpacing + 100;
    let y = row * verticalSpacing + 100;
    
    // Add sine wave offset for visual interest
    const waveOffset = Math.sin(index * 0.5) * waveAmplitude;
    x += waveOffset;
    
    return { x, y };
  };

  const getNodeState = (node, completedNodes, allNodes) => {
    if (completedNodes.has(node.node_id)) return 'cleared';

    if (!node.prerequisites || node.prerequisites.length === 0) return 'actionable';

    const allPrereqsMet = node.prerequisites.every(prereqId => 
      completedNodes.has(prereqId)
    );

    return allPrereqsMet ? 'actionable' : 'locked';
  };

  const handleNodeClick = (nodeId, state) => {
    if (state !== 'locked') {
      navigate(`/node/${nodeId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand-sangria border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Pathway Map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md shadow-soft">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="font-serif text-2xl text-brand-sangria mb-2 text-center">Error Loading Map</h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={loadRegionData}
            className="w-full bg-brand-sangria text-white px-6 py-3 rounded-xl hover:bg-opacity-90 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <header className="bg-gradient-to-r from-brand-sangria to-brand-navy text-white shadow-lg z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/hub')}
            className="flex items-center gap-2 text-white hover:text-gray-200 transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            <span>Back to Hub</span>
          </button>
          <h1 className="font-serif text-3xl md:text-4xl">{displayName}</h1>
          <p className="text-gray-200 text-sm mt-1">Interactive Pathway Map — zoomed to your current node</p>
        </div>
      </header>

      <main className="flex-1 relative" style={{ height: 'calc(100vh - 140px)', minHeight: '400px' }}>
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <ReactFlowProvider>
            <RegionFlowMap nodes={nodes} edges={edges} />
          </ReactFlowProvider>
        </div>
      </main>
    </div>
  );
}



