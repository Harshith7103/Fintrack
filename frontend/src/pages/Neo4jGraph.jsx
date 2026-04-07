import React, { useEffect, useState, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Loader } from 'lucide-react';

const Neo4jGraph = () => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const containerRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || '';
                const response = await fetch(`${apiUrl}/api/graph`);
                const data = await response.json();
                setGraphData(data);
            } catch (err) {
                console.error('Failed to fetch Neo4j graph data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchGraph();
    }, []);

    useEffect(() => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.clientWidth,
                height: window.innerHeight - 200
            });
        }
    }, [loading]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">Neo4j Knowledge Graph <span className="text-purple-400">Visualization</span></h2>
                <p className="text-slate-400">View relationships between Users, Accounts, Transactions, and Categories</p>
            </div>

            <div className="glass-panel p-2 rounded-xl overflow-hidden" ref={containerRef}>
                <ForceGraph2D
                    graphData={graphData}
                    nodeLabel={(node) => `${node.label}: ${node.properties.name || node.properties.amount || node.id}`}
                    nodeAutoColorBy="label"
                    width={dimensions.width}
                    height={dimensions.height}
                    linkColor={() => 'rgba(255,255,255,0.2)'}
                    nodeCanvasObject={(node, ctx, globalScale) => {
                        const label = node.properties.name || node.properties.amount || node.id;
                        const fontSize = 12/globalScale;
                        ctx.font = `${fontSize}px Sans-Serif`;
                        const textWidth = ctx.measureText(label).width;
                        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                        ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = node.color;
                        ctx.fillText(label, node.x, node.y);

                        node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
                    }}
                    nodePointerAreaPaint={(node, color, ctx) => {
                        ctx.fillStyle = color;
                        const bckgDimensions = node.__bckgDimensions;
                        bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
                    }}
                />
            </div>
        </div>
    );
};

export default Neo4jGraph;
