
import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Connection,
  Edge,
  Node,
  useReactFlow,
  Panel,
  NodeMouseHandler,
  NodeDragHandler
} from 'reactflow';
import { useNavigate } from 'react-router-dom';
import { 
  Database, Lock, Server, Layout, CreditCard, Bot, Code, 
  Workflow, Save, Play, Trash2, Plus, ArrowLeft,
  ChevronLeft, X, Menu, Smartphone, Globe, Box, Layers, 
  Cpu, Link as LinkIcon, Zap, Cloud, FileJson, Clock, 
  Webhook, Mail, Shield, Grid, Radio, Undo, Redo, FileCode,
  HardDrive, Monitor, Container, Terminal, Eye, Activity
} from 'lucide-react';
import { Button, Card, Tooltip } from '../components/UI';
import { useToast } from '../components/Toast';
import { StorageService } from '../services/storageService';

// --- CATEGORIES & BLOCK TYPES CONFIG ---

const CATEGORIES = [
  { id: 'generic', label: 'Generic / Abstract' },
  { id: 'client', label: 'Client Apps' },
  { id: 'server', label: 'Backend & APIs' },
  { id: 'data', label: 'Data & Storage' },
  { id: 'ai', label: 'AI & ML' },
  { id: 'logic', label: 'Logic & Services' },
  { id: 'infra', label: 'Infrastructure' },
];

const BLOCK_TYPES = [
  // --- GENERIC (Technology Agnostic) ---
  { type: 'gen_app', label: 'Application', icon: Monitor, category: 'generic', tech: 'Any Tech', color: 'zinc' },
  { type: 'gen_db', label: 'Database', icon: Database, category: 'generic', tech: 'Any DB', color: 'zinc' },
  { type: 'gen_api', label: 'API Service', icon: Server, category: 'generic', tech: 'REST/GQL', color: 'zinc' },
  { type: 'gen_cloud', label: 'Cloud Resource', icon: Cloud, category: 'generic', tech: 'AWS/GCP/Azure', color: 'zinc' },
  { type: 'gen_logic', label: 'Logic Module', icon: Code, category: 'generic', tech: 'Business Logic', color: 'zinc' },

  // --- CLIENT ---
  { type: 'frontend', label: 'React App', icon: Layout, category: 'client', tech: 'React/Next.js', color: 'pink' },
  { type: 'vue', label: 'Vue App', icon: Layout, category: 'client', tech: 'Vue/Nuxt', color: 'pink' },
  { type: 'angular', label: 'Angular App', icon: Layout, category: 'client', tech: 'Angular', color: 'pink' },
  { type: 'svelte', label: 'Svelte App', icon: Layout, category: 'client', tech: 'SvelteKit', color: 'pink' },
  { type: 'mobile_rn', label: 'React Native', icon: Smartphone, category: 'client', tech: 'iOS/Android', color: 'pink' },
  { type: 'mobile_flutter', label: 'Flutter App', icon: Smartphone, category: 'client', tech: 'Dart', color: 'pink' },
  { type: 'landing', label: 'Landing Page', icon: Globe, category: 'client', tech: 'HTML/Tailwind', color: 'pink' },
  
  // --- SERVER ---
  { type: 'backend_node', label: 'Node API', icon: Server, category: 'server', tech: 'Express/Fastify', color: 'blue' },
  { type: 'backend_py', label: 'Python API', icon: FileCode, category: 'server', tech: 'FastAPI/Django', color: 'blue' },
  { type: 'backend_go', label: 'Go Server', icon: Terminal, category: 'server', tech: 'Go/Gin', color: 'blue' },
  { type: 'backend_java', label: 'Java API', icon: FileCode, category: 'server', tech: 'Spring Boot', color: 'blue' },
  { type: 'graphql', label: 'GraphQL API', icon: Grid, category: 'server', tech: 'Apollo', color: 'blue' },
  { type: 'websocket', label: 'Socket Server', icon: Radio, category: 'server', tech: 'Socket.io', color: 'blue' },

  // --- DATA ---
  { type: 'db_postgres', label: 'PostgreSQL', icon: Database, category: 'data', tech: 'Relational DB', color: 'green' },
  { type: 'db_mysql', label: 'MySQL', icon: Database, category: 'data', tech: 'Relational DB', color: 'green' },
  { type: 'db_mongo', label: 'MongoDB', icon: FileJson, category: 'data', tech: 'NoSQL', color: 'green' },
  { type: 'db_firebase', label: 'Firebase', icon: Zap, category: 'data', tech: 'Realtime DB', color: 'green' },
  { type: 'db_redis', label: 'Redis', icon: Zap, category: 'data', tech: 'Cache', color: 'green' },
  { type: 'db_cassandra', label: 'Cassandra', icon: HardDrive, category: 'data', tech: 'Wide Column', color: 'green' },
  { type: 'storage', label: 'Object Storage', icon: Cloud, category: 'data', tech: 'S3/R2', color: 'green' },

  // --- AI ---
  { type: 'ai_llm', label: 'LLM Model', icon: Bot, category: 'ai', tech: 'Gemini/GPT', color: 'orange' },
  { type: 'ai_vector', label: 'Vector DB', icon: Cpu, category: 'ai', tech: 'Pinecone/Weaviate', color: 'orange' },
  { type: 'ai_speech', label: 'Speech AI', icon: LinkIcon, category: 'ai', tech: 'Whisper/TTS', color: 'orange' },
  { type: 'ai_vision', label: 'Computer Vision', icon: Eye, category: 'ai', tech: 'OpenCV/ML', color: 'orange' },

  // --- LOGIC ---
  { type: 'auth', label: 'Auth Provider', icon: Lock, category: 'logic', tech: 'Supabase/Auth0', color: 'purple' },
  { type: 'function', label: 'Serverless Fn', icon: Code, category: 'logic', tech: 'Lambda/Edge', color: 'purple' },
  { type: 'cron', label: 'Scheduler', icon: Clock, category: 'logic', tech: 'Cron/Queue', color: 'purple' },
  { type: 'webhook', label: 'Webhook', icon: Webhook, category: 'logic', tech: 'Event Trigger', color: 'purple' },
  { type: 'payment', label: 'Payments', icon: CreditCard, category: 'logic', tech: 'Stripe/PayPal', color: 'amber' },
  { type: 'email', label: 'Email Service', icon: Mail, category: 'logic', tech: 'SMTP/Resend', color: 'amber' },
  { type: 'analytics', label: 'Analytics', icon: Activity, category: 'logic', tech: 'Mixpanel/GA', color: 'amber' },

  // --- INFRA ---
  { type: 'docker', label: 'Docker Container', icon: Container, category: 'infra', tech: 'Docker', color: 'zinc' },
  { type: 'k8s', label: 'Kubernetes', icon: Grid, category: 'infra', tech: 'K8s Cluster', color: 'zinc' },
  { type: 'cdn', label: 'CDN', icon: Globe, category: 'infra', tech: 'Cloudflare', color: 'zinc' },
  { type: 'msg_queue', label: 'Message Queue', icon: Layers, category: 'infra', tech: 'Kafka/RabbitMQ', color: 'zinc' },
  { type: 'terraform', label: 'IaC', icon: Code, category: 'infra', tech: 'Terraform', color: 'zinc' },
];

const getColorClasses = (color: string) => {
  const map: Record<string, string> = {
    pink: 'bg-pink-500/10 border-pink-500 text-pink-400',
    blue: 'bg-blue-500/10 border-blue-500 text-blue-400',
    green: 'bg-green-500/10 border-green-500 text-green-400',
    orange: 'bg-orange-500/10 border-orange-500 text-orange-400',
    purple: 'bg-purple-500/10 border-purple-500 text-purple-400',
    amber: 'bg-amber-500/10 border-amber-500 text-amber-400',
    zinc: 'bg-zinc-500/10 border-zinc-500 text-zinc-400',
  };
  return map[color] || map.zinc;
};

// --- UNDO/REDO HOOK ---
const useUndoRedo = () => {
  const [past, setPast] = useState<{nodes: Node[], edges: Edge[]}[]>([]);
  const [future, setFuture] = useState<{nodes: Node[], edges: Edge[]}[]>([]);

  const takeSnapshot = useCallback((nodes: Node[], edges: Edge[]) => {
    setPast(prev => [...prev, { nodes, edges }]);
    setFuture([]);
  }, []);

  const undo = useCallback((setNodes: any, setEdges: any, currentNodes: Node[], currentEdges: Edge[]) => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setFuture(prev => [{ nodes: currentNodes, edges: currentEdges }, ...prev]);
    setPast(newPast);
    
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [past]);

  const redo = useCallback((setNodes: any, setEdges: any, currentNodes: Node[], currentEdges: Edge[]) => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(prev => [...prev, { nodes: currentNodes, edges: currentEdges }]);
    setFuture(newFuture);
    
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [future]);

  return { takeSnapshot, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
};

// --- RESPONSIVE SIDEBAR ---
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (type: string, label: string, tech: string, color: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onAddNode }) => {
  const [activeCategory, setActiveCategory] = useState('generic');

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string, tech: string, color: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: 'default', nodeType, label, tech, color }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredBlocks = BLOCK_TYPES.filter(b => b.category === activeCategory);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed lg:static inset-x-0 bottom-0 z-50 lg:z-auto
        w-full lg:w-72 bg-zinc-900 border-t lg:border-t-0 lg:border-r border-zinc-800 
        flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        h-[60vh] lg:h-full shadow-2xl lg:shadow-none
      `}>
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Workflow size={16} className="text-orange-500" />
              Logic Blocks
            </h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">Drag to canvas • Tap on mobile</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Categories - Horizontal Scroll */}
        <div className="px-3 py-3 border-b border-zinc-800 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`
                  whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all
                  ${activeCategory === cat.id 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}
                `}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Blocks List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-8 lg:pb-3">
          {filteredBlocks.map((block) => {
            const styles = getColorClasses(block.color);
            return (
              <div
                key={block.type}
                onDragStart={(event) => onDragStart(event, block.type, block.label, block.tech, block.color)}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                     onAddNode(block.type, block.label, block.tech, block.color);
                     onClose();
                  }
                }}
                draggable
                className={`
                  p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 
                  hover:border-orange-500/50 hover:bg-zinc-900 transition-all cursor-grab active:cursor-grabbing
                  flex items-center gap-3 touch-manipulation group select-none
                `}
              >
                <div className={`p-2 rounded-lg ${styles.split(' ').slice(0, 2).join(' ')} bg-opacity-20`}>
                  <block.icon size={18} className={styles.split(' ').pop()} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-zinc-200 truncate group-hover:text-white">{block.label}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{block.tech}</div>
                </div>
                <div className="ml-auto lg:hidden">
                  <Plus size={16} className="text-zinc-600" />
                </div>
              </div>
            );
          })}
          {filteredBlocks.length === 0 && (
            <div className="text-center py-8 text-zinc-600 text-xs italic">
              No blocks in this category.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

let id = 0;
const getId = () => `node_${id++}`;

const VisualBuilderContent = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo();
  
  const navigate = useNavigate();
  const { showToast } = useToast();

  const onConnect = useCallback((params: Connection) => {
    takeSnapshot(nodes, edges);
    setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      style: { stroke: '#f97316', strokeWidth: 2 } 
    }, eds));
  }, [nodes, edges, takeSnapshot, setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const createNode = (type: string, label: string, tech: string, color: string, position: { x: number, y: number }) => {
      // Base styles
      const style: React.CSSProperties = {
        background: '#18181b', // zinc-900
        color: '#fff',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderRadius: '12px',
        padding: '12px',
        minWidth: '150px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 600,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        borderColor: '#3f3f46' // default zinc-700
      };

      // Apply color specific borders
      if (color === 'pink') style.borderColor = '#ec4899';
      if (color === 'blue') style.borderColor = '#3b82f6';
      if (color === 'green') style.borderColor = '#22c55e';
      if (color === 'purple') style.borderColor = '#a855f7';
      if (color === 'orange') style.borderColor = '#f97316';
      if (color === 'amber') style.borderColor = '#f59e0b';

      const newNode: Node = {
        id: getId(),
        type: 'default', // Using default type which supports handles
        position,
        data: { label: `${label}\n(${tech})`, nodeType: type, tech },
        style,
        draggable: true,
        connectable: true,
        selectable: true,
      };
      return newNode;
  };

  // Helper for mobile "Click to Add"
  const handleAddNodeMobile = (type: string, label: string, tech: string, color: string) => {
     if (!reactFlowInstance) return;
     
     // Snapshot before adding
     takeSnapshot(nodes, edges);

     // Add to center of visible viewport
     const flowBounds = reactFlowWrapper.current?.getBoundingClientRect();
     
     if (flowBounds) {
        const position = reactFlowInstance.project({
           x: flowBounds.width / 2 - 75,
           y: flowBounds.height / 2 - 40
        });

        position.x += (Math.random() - 0.5) * 40;
        position.y += (Math.random() - 0.5) * 40;

        const newNode = createNode(type, label, tech, color, position);
        setNodes((nds) => nds.concat(newNode));
        showToast(`${label} added.`, "success");
     }
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;
      
      // Snapshot before adding
      takeSnapshot(nodes, edges);

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const dataStr = event.dataTransfer.getData('application/reactflow');
      
      if (!dataStr) return;
      
      const { label, tech, nodeType, color } = JSON.parse(dataStr);

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode = createNode(nodeType, label, tech, color, position);
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, nodes, edges, takeSnapshot, setNodes]
  );
  
  // Snapshot on drag start to allow undoing moves
  const onNodeDragStart: NodeDragHandler = useCallback(() => {
    takeSnapshot(nodes, edges);
  }, [nodes, edges, takeSnapshot]);

  // Snapshot on delete (keyboard)
  const onNodesDelete = useCallback(() => {
    takeSnapshot(nodes, edges);
  }, [nodes, edges, takeSnapshot]);

  const onEdgesDelete = useCallback(() => {
    takeSnapshot(nodes, edges);
  }, [nodes, edges, takeSnapshot]);

  const handleGenerate = async () => {
    if (nodes.length === 0) {
      showToast("Canvas is empty. Add blocks to start.", "warning");
      return;
    }

    // 1. Construct Prompt from Graph
    let prompt = `BUILD A SOFTWARE PROJECT based on this architecture:\n\nCOMPONENTS:\n`;
    nodes.forEach(n => {
      prompt += `- ${n.data.label.replace('\n', ' ')}\n`;
    });
    
    prompt += `\nDATA FLOW:\n`;
    if (edges.length === 0) {
      prompt += "Standard integration between components.\n";
    } else {
      edges.forEach(e => {
        const source = nodes.find(n => n.id === e.source);
        const target = nodes.find(n => n.id === e.target);
        if (source && target) {
          prompt += `- ${source.data.label.replace('\n', ' ')} connects to ${target.data.label.replace('\n', ' ')}\n`;
        }
      });
    }

    prompt += `\nINSTRUCTIONS:\nBuild a cohesive application using these components. Ensure all connections are secure and performant.`;

    const newProject = {
      id: Date.now().toString(),
      name: `Visual Build ${new Date().toLocaleDateString()}`,
      description: prompt,
      type: 'web', 
      createdAt: Date.now(),
      status: 'active',
      metadata: { source: 'visual_builder' }
    };

    await StorageService.saveProject(newProject as any);
    localStorage.setItem('currentProject', JSON.stringify(newProject));
    
    showToast("Architecture compiled! Starting build agent...", "success");
    setTimeout(() => {
        navigate('/chat');
    }, 1000);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onAddNode={handleAddNodeMobile}
      />
      
      <div className="flex-1 flex flex-col h-full relative">
        {/* Responsive Header Overlay */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
           <div className="pointer-events-auto flex items-center gap-2">
              <Button variant="secondary" onClick={() => navigate('/')} className="h-10 w-10 p-0 rounded-full flex items-center justify-center bg-zinc-900 border border-zinc-800 shadow-xl">
                 <ChevronLeft size={20} />
              </Button>
              {/* Mobile Menu Trigger */}
              <Button 
                variant="primary" 
                onClick={() => setIsSidebarOpen(true)} 
                className="lg:hidden h-10 px-4 rounded-full shadow-xl flex items-center gap-2 border border-orange-400/50"
              >
                 <Plus size={18} /> <span className="text-xs font-bold">Add Logic</span>
              </Button>
           </div>
           
           <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-2 rounded-xl shadow-2xl pointer-events-auto flex items-center gap-2 lg:gap-3">
              <div className="px-2 lg:px-3 hidden md:block">
                 <h1 className="text-sm font-bold text-white">Visual Logic Builder</h1>
                 <p className="text-[10px] text-zinc-500">{nodes.length} nodes • {edges.length} links</p>
              </div>
              <div className="h-8 w-px bg-zinc-800 hidden md:block"></div>
              
              {/* UNDO / REDO CONTROLS */}
              <div className="flex items-center gap-1">
                 <button 
                    onClick={() => undo(setNodes, setEdges, nodes, edges)} 
                    disabled={!canUndo}
                    className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 rounded-lg transition-all"
                    title="Undo"
                 >
                    <Undo size={16} />
                 </button>
                 <button 
                    onClick={() => redo(setNodes, setEdges, nodes, edges)} 
                    disabled={!canRedo}
                    className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 rounded-lg transition-all"
                    title="Redo"
                 >
                    <Redo size={16} />
                 </button>
              </div>

              <div className="h-8 w-px bg-zinc-800 hidden md:block"></div>
              
              <Button 
                onClick={() => { 
                   takeSnapshot(nodes, edges);
                   setNodes([]); 
                   setEdges([]); 
                }} 
                variant="outline" 
                className="h-9 w-9 p-0 lg:w-auto lg:px-3 text-red-400 hover:text-red-300 border-zinc-700 justify-center"
                title="Clear Canvas"
              >
                <Trash2 size={16} />
              </Button>
              <Button onClick={handleGenerate} className="h-9 px-3 lg:px-4 font-bold shadow-lg shadow-orange-900/20 text-xs lg:text-sm">
                <Play size={16} className="mr-0 lg:mr-2 fill-current" /> <span className="hidden lg:inline">Build This</span><span className="lg:hidden">Build</span>
              </Button>
           </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 h-full touch-none" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeDragStart={onNodeDragStart}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            fitView
            attributionPosition="bottom-right"
            className="bg-zinc-950"
            // Mobile Interaction Settings
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            panOnScroll={false} 
            zoomOnScroll={false}
            panOnDrag={true}
            zoomOnPinch={true}
            defaultEdgeOptions={{ type: 'smoothstep', animated: true, style: { stroke: '#52525b', strokeWidth: 2 } }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#27272a" gap={24} size={1} />
            <Controls className="bg-zinc-800 border-zinc-700 fill-zinc-400 text-zinc-400" />
            <MiniMap 
              nodeColor={(n) => {
                const type = n.data?.nodeType;
                if (['auth', 'function', 'cron', 'webhook'].includes(type)) return '#a855f7'; // Purple
                if (type?.startsWith('db') || type?.startsWith('storage')) return '#22c55e'; // Green
                if (type?.startsWith('ai')) return '#f97316'; // Orange
                if (['frontend', 'mobile_rn', 'mobile_flutter', 'vue', 'angular', 'svelte'].includes(type)) return '#ec4899'; // Pink
                if (type?.startsWith('backend')) return '#3b82f6'; // Blue
                return '#3f3f46';
              }}
              className="bg-zinc-900 border border-zinc-800 rounded-lg hidden md:block"
            />
            
            {nodes.length === 0 && (
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
                  <div className="text-center space-y-4 opacity-30">
                     <Workflow size={64} className="mx-auto text-zinc-500" strokeWidth={1} />
                     <h3 className="text-xl lg:text-2xl font-bold text-zinc-400">Start Building</h3>
                     <p className="max-w-xs mx-auto text-sm lg:text-base">
                        <span className="hidden lg:inline">Drag blocks from the sidebar.</span>
                        <span className="lg:hidden">Tap 'Add Logic' to open menu.</span>
                     </p>
                  </div>
               </div>
            )}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

const LogicBuilder = () => (
  <ReactFlowProvider>
    <VisualBuilderContent />
  </ReactFlowProvider>
);

export default LogicBuilder;
