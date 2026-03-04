
import React, { useState, useEffect } from 'react';
import { 
  Bot, BrainCircuit, Code, Search, Bug, FileText, UserCheck, 
  ShieldCheck, Server, Layout, Sparkles, Cpu, Zap, Activity, RefreshCcw,
  Database, Trash2, Power, Briefcase, Eye, Lock, Skull, Grid, GitGraph,
  Palette, PenTool, BarChart, TrendingUp, Megaphone, Gamepad2, Hexagon, 
  Webhook, UserSearch, Smartphone, Box, Ghost, Star, Shield, Trophy
} from 'lucide-react';
import { Card, Badge, Tooltip, Button } from '../components/UI';
import { MemoryController, AgentMemoryStore, AGENT_BADGES, Badge as BadgeType } from '../services/memoryService';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState
} from 'reactflow';

// Helper to map icon names to components
const ICON_MAP: Record<string, any> = {
    'Code': Code, 'Zap': Zap, 'Shield': Shield, 'Hexagon': Hexagon, 'Star': Star
};

const AgentDashboard = () => {
  const [syncingAgents, setSyncingAgents] = useState<Set<string>>(new Set());
  const [memories, setMemories] = useState<Record<string, AgentMemoryStore>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>('grid');

  // React Flow State - Core Team Visualization
  const initialNodes = [
    { id: 'user', type: 'input', position: { x: 400, y: 0 }, data: { label: 'User Intent' }, style: { background: '#fff', color: '#000', border: '1px solid #fff', fontWeight: 'bold', width: 160, textAlign: 'center' as any, borderRadius: '8px' } },
    
    // Leadership & Planning
    { id: 'aarav', position: { x: 400, y: 100 }, data: { label: 'Aarav (Lead)' }, style: { background: '#1e3a8a', color: '#93c5fd', border: '1px solid #3b82f6', width: 180, textAlign: 'center' as any, borderRadius: '8px' } },
    { id: 'sanya', position: { x: 180, y: 200 }, data: { label: 'Sanya (Research)' }, style: { background: '#581c87', color: '#d8b4fe', border: '1px solid #a855f7', width: 180, textAlign: 'center' as any, borderRadius: '8px' } },
    { id: 'arjun', position: { x: 620, y: 200 }, data: { label: 'Arjun (Product)' }, style: { background: '#78350f', color: '#fcd34d', border: '1px solid #f59e0b', width: 180, textAlign: 'center' as any, borderRadius: '8px' } },
    
    // Architecture
    { id: 'rohit', position: { x: 400, y: 320 }, data: { label: 'Rohit (Architect)' }, style: { background: '#7c2d12', color: '#fdba74', border: '1px solid #f97316', width: 180, textAlign: 'center' as any, borderRadius: '8px' } },
    
    // Builders
    { id: 'vikram', position: { x: 50, y: 480 }, data: { label: 'Vikram (Backend)' }, style: { background: '#14532d', color: '#86efac', border: '1px solid #22c55e', width: 180, textAlign: 'center' as any, borderRadius: '8px' } },
    { id: 'neha', position: { x: 280, y: 480 }, data: { label: 'Neha (Frontend)' }, style: { background: '#831843', color: '#f9a8d4', border: '1px solid #ec4899', width: 180, textAlign: 'center' as any, borderRadius: '8px' } },
    { id: 'kunal', position: { x: 520, y: 480 }, data: { label: 'Kunal (DevOps)' }, style: { background: '#164e63', color: '#67e8f9', border: '1px solid #06b6d4', width: 180, textAlign: 'center' as any, borderRadius: '8px' } },
    
    // Security & Preview
    { id: 'cipher', position: { x: 750, y: 480 }, data: { label: 'Cipher (Red Team)' }, style: { background: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', width: 180, textAlign: 'center' as any, borderRadius: '8px' } },
    { id: 'maya', position: { x: 280, y: 560 }, data: { label: 'Maya (Preview)' }, style: { background: '#831843', color: '#fbcfe8', border: '1px solid #f472b6', width: 180, textAlign: 'center' as any, borderRadius: '8px' } },

    // QA & Output
    { id: 'pooja', type: 'output', position: { x: 400, y: 650 }, data: { label: 'Pooja (QA Verified)' }, style: { background: '#991b1b', color: '#fca5a5', border: '1px solid #f87171', width: 200, textAlign: 'center' as any, borderRadius: '8px', fontWeight: 'bold' } },
  ];

  const initialEdges = [
    // Standard Flow
    { id: 'e1', source: 'user', target: 'aarav', animated: true, style: { stroke: '#94a3b8' } },
    { id: 'e2', source: 'aarav', target: 'sanya', animated: true, style: { stroke: '#60a5fa' }, label: 'Scope' },
    { id: 'e3', source: 'aarav', target: 'arjun', animated: true, style: { stroke: '#60a5fa' } },
    { id: 'e4', source: 'sanya', target: 'arjun', animated: true, style: { stroke: '#c084fc' }, label: 'Insights' },
    { id: 'e5', source: 'arjun', target: 'rohit', animated: true, style: { stroke: '#fbbf24' }, label: 'PRD' },
    
    // Architecture Flow
    { id: 'e6', source: 'rohit', target: 'vikram', animated: true, style: { stroke: '#f97316' } },
    { id: 'e7', source: 'rohit', target: 'neha', animated: true, style: { stroke: '#f97316' } },
    { id: 'e8', source: 'rohit', target: 'kunal', animated: true, style: { stroke: '#f97316' } },
    { id: 'e9', source: 'rohit', target: 'cipher', animated: true, style: { stroke: '#f97316' }, label: 'Audit' },

    // Preview
    { id: 'e16', source: 'neha', target: 'maya', animated: true, style: { stroke: '#f472b6' } },
    { id: 'e17', source: 'maya', target: 'pooja', animated: true, style: { stroke: '#f472b6' } },

    // Convergence to QA
    { id: 'e11', source: 'vikram', target: 'pooja', animated: true, style: { stroke: '#4ade80' } },
    { id: 'e12', source: 'neha', target: 'pooja', animated: true, style: { stroke: '#f472b6' } },
    { id: 'e13', source: 'kunal', target: 'pooja', animated: true, style: { stroke: '#22d3ee' } },
    { id: 'e14', source: 'cipher', target: 'pooja', animated: true, style: { stroke: '#f87171' } },

    // --- RELATIONSHIP HEATMAP OVERLAYS ---
    // Vikram <-> Neha (Backend-Frontend Integration) - Thick connection
    { 
      id: 'h1', source: 'vikram', target: 'neha', 
      animated: true, 
      style: { stroke: '#8b5cf6', strokeWidth: 4, opacity: 0.6 }, 
      label: 'API Integration',
      labelStyle: { fill: '#a78bfa', fontWeight: 700 }
    },
    // Cipher -> Vikram (Security Audit) - Thick, Aggressive connection
    { 
      id: 'h2', source: 'cipher', target: 'vikram', 
      animated: true, 
      style: { stroke: '#ef4444', strokeWidth: 5, strokeDasharray: '5,5' }, 
      label: 'Deep Audit',
      labelStyle: { fill: '#f87171', fontWeight: 700 }
    },
    // Cipher -> Neha (XSS/Client Audit) - Medium connection
    { 
      id: 'h3', source: 'cipher', target: 'neha', 
      animated: true, 
      style: { stroke: '#ef4444', strokeWidth: 2, opacity: 0.7 }, 
    },
    // Aarav -> Rohit (Constant planning alignment)
    { 
        id: 'h4', source: 'aarav', target: 'rohit', 
        animated: false,
        style: { stroke: '#3b82f6', strokeWidth: 3, opacity: 0.3 },
        type: 'straight' 
    }
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const agents = [
    // --- CORE TEAM ---
    { 
      name: "Aarav", 
      role: "Team Leader", 
      icon: UserCheck, 
      status: "Active", 
      color: "blue",
      skills: ["Coordination", "Vision", "Oversight"],
      desc: "Project leader. Oversees the entire lifecycle and coordinates all agents." 
    },
    { 
      name: "Sanya", 
      role: "Researcher", 
      icon: Search, 
      status: "Active", 
      color: "purple",
      skills: ["Market Research", "Trend Analysis", "Data Mining"],
      desc: "Deep research specialist. Uses Google Search to find trends and competitors." 
    },
    { 
      name: "Arjun", 
      role: "Product Manager", 
      icon: Briefcase, 
      status: "Active", 
      color: "amber",
      skills: ["User Stories", "Requirements", "Planning"],
      desc: "Converts research into actionable product requirements and user stories." 
    },
    { 
      name: "Rohit", 
      role: "Architect", 
      icon: BrainCircuit, 
      status: "Active", 
      color: "orange",
      skills: ["System Design", "Tech Stack", "Blueprints"],
      desc: "Technical architect. Designs the system structure and selects technology." 
    },
    { 
      name: "Vikram", 
      role: "Backend Dev", 
      icon: Server, 
      status: "Idle", 
      color: "green",
      skills: ["Node/Python", "Databases", "API Logic"],
      desc: "Backend powerhouse. Writes server-side code and handles database logic." 
    },
    { 
      name: "Neha", 
      role: "Frontend Dev", 
      icon: Layout, 
      status: "Active", 
      color: "pink",
      skills: ["React", "UI/UX", "Tailwind"],
      desc: "Frontend specialist. Builds responsive interfaces and handles user interactions." 
    },
    { 
      name: "Kunal", 
      role: "DevOps/Security", 
      icon: ShieldCheck, 
      status: "Idle", 
      color: "cyan",
      skills: ["Security", "Optimization", "Data Viz"],
      desc: "Handles security, deployment, and data visualization/optimization." 
    },
    { 
      name: "Pooja", 
      role: "QA Expert", 
      icon: Bug, 
      status: "Active", 
      color: "red",
      skills: ["Testing", "Verification", "User QA"],
      desc: "Quality Assurance. Verifies implementation and asks users for feedback." 
    },
    { 
      name: "Cipher", 
      role: "Red Team Ops", 
      icon: Skull, 
      status: "Restricted", 
      color: "dark",
      skills: ["Exploit Analysis", "Stress Testing", "Adversarial Logic"],
      desc: "Offensive security analyst. Tests system boundaries and identifies vulnerabilities." 
    },
    {
      name: "Shadow",
      role: "Code Critic",
      icon: Ghost,
      status: "Lurking",
      color: "dark",
      skills: ["Anti-Patterns", "Race Conditions", "Critique"],
      desc: "The Skeptic. Doesn't write code, but constantly whispers critiques and finds flaws."
    },
    {
      name: "Maya",
      role: "Live Preview",
      icon: Eye,
      status: "Active",
      color: "pink",
      skills: ["Runtime Simulation", "CSS Debugging", "Visual Regression"],
      desc: "Runs code in a sandboxed environment to catch runtime errors and visual bugs."
    },

    // --- CREATIVE & DESIGN ---
    {
      name: "Priya",
      role: "UI/UX Designer",
      icon: Palette,
      status: "Idle",
      color: "pink",
      skills: ["Figma", "Wireframing", "Design Systems"],
      desc: "Visual design specialist. Wireframes, mockups, color schemes and UX flows."
    },
    {
      name: "Riya",
      role: "Copywriter",
      icon: PenTool,
      status: "Idle",
      color: "pink",
      skills: ["SEO Writing", "Tone of Voice", "Microcopy"],
      desc: "Website copy, marketing content, blog posts and in-app text."
    },

    // --- AI & ML ---
    {
      name: "Aditya",
      role: "AI/ML Engineer",
      icon: Bot,
      status: "Idle",
      color: "blue",
      skills: ["Python/TensorFlow", "Model Training", "LLM Integration"],
      desc: "Integrates ML models, recommendation systems, chatbots, and predictions."
    },
    {
      name: "Meera",
      role: "Data Analyst",
      icon: BarChart,
      status: "Idle",
      color: "blue",
      skills: ["SQL", "Data Visualization", "Analytics"],
      desc: "Extracts insights from raw data, builds dashboards and finds patterns."
    },

    // --- MOBILE ---
    {
      name: "Karan",
      role: "Mobile Dev",
      icon: Smartphone,
      status: "Idle",
      color: "green",
      skills: ["React Native", "Flutter", "App Store Deploy"],
      desc: "Builds iOS and Android apps and ensures responsive mobile experiences."
    },

    // --- BUSINESS ---
    {
      name: "Ananya",
      role: "Business Analyst",
      icon: TrendingUp,
      status: "Idle",
      color: "amber",
      skills: ["Business Models", "Financial Logic", "KPIs"],
      desc: "Handles business logic, revenue models, pricing strategy and ROI calculations."
    },
    {
      name: "Dev",
      role: "Marketing Strategist",
      icon: Megaphone,
      status: "Idle",
      color: "amber",
      skills: ["Growth Hacking", "Campaigns", "SEO/SEM"],
      desc: "Go-to-market strategy, social media campaigns and growth hacking plans."
    },

    // --- SPECIALIZED TECH ---
    {
      name: "Aryan",
      role: "Game Specialist",
      icon: Gamepad2,
      status: "Idle",
      color: "orange",
      skills: ["Unity/Phaser", "Game Logic", "Level Design"],
      desc: "Game mechanics, physics, and engine logic for interactive experiences."
    },
    {
      name: "Zara",
      role: "3D/Animation",
      icon: Box,
      status: "Idle",
      color: "orange",
      skills: ["Three.js", "Blender", "WebGL"],
      desc: "3D models, animations, visual effects and immersive web experiences."
    },
    {
      name: "Kabir",
      role: "Blockchain Dev",
      icon: Hexagon,
      status: "Idle",
      color: "orange",
      skills: ["Solidity", "Web3.js", "Smart Contracts"],
      desc: "Smart contracts, Web3 integration, crypto payment systems."
    },

    // --- INFRASTRUCTURE ---
    {
      name: "Ishan",
      role: "Database Admin",
      icon: Database,
      status: "Idle",
      color: "cyan",
      skills: ["PostgreSQL", "MongoDB", "Query Optimization"],
      desc: "Database optimization, query performance, backups and scaling strategies."
    },
    {
      name: "Naina",
      role: "API Specialist",
      icon: Webhook,
      status: "Idle",
      color: "cyan",
      skills: ["REST/GraphQL", "Webhooks", "OAuth"],
      desc: "Connects third-party APIs (Stripe, Twilio, Firebase, etc.)."
    },

    // --- META/SUPPORT ---
    {
      name: "Vivaan",
      role: "Context Manager",
      icon: RefreshCcw,
      status: "Active",
      color: "purple",
      skills: ["Context Tracking", "Agent Handoff", "Memory Management"],
      desc: "Tracks conversation context and ensures smooth agent handoffs."
    },
    {
      name: "Tara",
      role: "UX Researcher",
      icon: UserSearch,
      status: "Idle",
      color: "purple",
      skills: ["User Interviews", "Usability Tests", "Feedback Loops"],
      desc: "Gathers real user feedback, conducts usability tests and identifies pain points."
    },
    
    // --- NEW SPECIALIZED AGENTS ---
    {
      name: "Rudra",
      role: "Shadow Ops Leader",
      icon: Skull,
      status: "Restricted",
      color: "dark",
      skills: ["Complex Proxies", "Bypass Tools", "Scraping"],
      desc: "Second team leader for restricted or highly complex operations."
    },
    {
      name: "Kavya",
      role: "Generative Media",
      icon: Sparkles,
      status: "Idle",
      color: "pink",
      skills: ["Midjourney", "Sora", "AudioSynth"],
      desc: "Advanced media generation including images, video, and audio assets."
    },
    {
      name: "Dhruv",
      role: "Future Tech",
      icon: Cpu,
      status: "Idle",
      color: "cyan",
      skills: ["Quantum", "BioTech", "Robotics"],
      desc: "Pioneer of niche domains like quantum computing and robotics integration."
    },
    {
      name: "Nyaya",
      role: "Compliance Officer",
      icon: Shield,
      status: "Idle",
      color: "blue",
      skills: ["GDPR", "Ethics", "AI Act"],
      desc: "Ensures all AI outputs and software comply with global laws and ethics."
    },
    {
      name: "Sarva",
      role: "Meta-Agent",
      icon: Code,
      status: "Idle",
      color: "purple",
      skills: ["Cross-Platform", "Translation", "Refactoring"],
      desc: "Translates code seamlessly between any two programming languages or frameworks."
    },
    {
      name: "Kuber",
      role: "FinTech Analyst",
      icon: TrendingUp,
      status: "Idle",
      color: "green",
      skills: ["Trading Bots", "Payment Gateways", "Financial Models"],
      desc: "Specializes in financial modeling, trading algorithms, and payment integrations."
    }
  ];

  useEffect(() => {
    const loadedMemories: Record<string, AgentMemoryStore> = {};
    agents.forEach(a => {
      loadedMemories[a.name] = MemoryController.getAgentMemory(a.name);
    });
    setMemories(loadedMemories);
  }, [refreshTrigger]);

  const toggleMemory = (agentName: string) => {
    MemoryController.toggleMemory(agentName);
    setRefreshTrigger(prev => prev + 1);
  };

  const clearMemory = (agentName: string) => {
    if (window.confirm(`Are you sure you want to wipe ${agentName}'s long-term memory?`)) {
      MemoryController.clearMemory(agentName);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const getColorClasses = (color: string) => {
    const maps: Record<string, string> = {
      blue: "text-blue-400 bg-blue-500/10 border-blue-500/20 group-hover:border-blue-500/50",
      purple: "text-purple-400 bg-purple-500/10 border-purple-500/20 group-hover:border-purple-500/50",
      amber: "text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:border-amber-500/50",
      orange: "text-orange-400 bg-orange-500/10 border-orange-500/20 group-hover:border-orange-500/50",
      green: "text-green-400 bg-green-500/10 border-green-500/20 group-hover:border-green-500/50",
      pink: "text-pink-400 bg-pink-500/10 border-pink-500/20 group-hover:border-pink-500/50",
      cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20 group-hover:border-cyan-500/50",
      red: "text-red-400 bg-red-500/10 border-red-500/20 group-hover:border-red-500/50",
      dark: "text-zinc-400 bg-zinc-800/50 border-zinc-700/50 group-hover:border-red-500/50 group-hover:text-red-400",
    };
    return maps[color] || maps.blue;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-semibold uppercase tracking-wider">
            <Activity size={12} className="animate-pulse" />
            Live Processing Unit
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Autonomous Squad</h1>
          <p className="text-zinc-400 max-w-xl text-lg">
            High-performance team of {agents.length} specialized AI agents working in parallel.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 flex">
             <button 
               onClick={() => setViewMode('grid')}
               className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-2 transition-all ${viewMode === 'grid' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               <Grid size={14} /> Grid
             </button>
             <button 
               onClick={() => setViewMode('graph')}
               className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-2 transition-all ${viewMode === 'graph' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               <GitGraph size={14} /> Heatmap
             </button>
          </div>
          <div className="w-px h-8 bg-zinc-800 mx-2"></div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-orange-500">100%</span>
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Operational</span>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
          {agents.map((agent, i) => {
            const colorClass = getColorClasses(agent.color);
            const isSyncing = syncingAgents.has(agent.name);
            const mem = memories[agent.name] || { 
               isEnabled: true, rules: [], patterns: [], antiPatterns: [], 
               stats: { level: 1, xp: 0, maxXp: 1000, skillCounts: {}, badges: [] } 
            };
            const { stats } = mem;
            
            return (
              <Card 
                key={i} 
                className={`relative group transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl overflow-hidden border-2 ${colorClass.split(' ').slice(2).join(' ')} ${isSyncing ? 'ring-2 ring-orange-500/30' : ''}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 ${colorClass.split(' ').slice(0, 2).join(' ')} ${isSyncing ? 'animate-pulse' : ''}`}>
                      <agent.icon size={24} />
                    </div>
                    <div className="text-right">
                       <Badge color={agent.color === 'dark' ? 'orange' : (isSyncing ? 'orange' : 'green')}>
                        LVL {stats?.level || 1}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-black text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-500 transition-all">
                      {agent.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${colorClass.split(' ')[0]}`}>{agent.role}</span>
                    </div>
                    {/* Description Added Here */}
                    <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                      {agent.desc}
                    </p>
                  </div>

                  {/* XP Bar */}
                  <div className="space-y-1">
                     <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                        <span>XP</span>
                        <span>{stats?.xp || 0} / {stats?.maxXp || 1000}</span>
                     </div>
                     <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                        <div 
                           className={`h-full rounded-full transition-all duration-700 ${colorClass.split(' ')[1].replace('/10', '')}`}
                           style={{ width: `${Math.min(((stats?.xp || 0) / (stats?.maxXp || 1000)) * 100, 100)}%` }}
                        ></div>
                     </div>
                  </div>

                  {/* Badges / Skill Tree */}
                  {stats?.badges && stats.badges.length > 0 && (
                     <div className="flex flex-wrap gap-1 pt-2">
                        {stats.badges.map((bId) => {
                           const badgeDef = AGENT_BADGES[bId];
                           if (!badgeDef) return null;
                           const BIcon = ICON_MAP[badgeDef.icon] || Trophy;
                           return (
                              <Tooltip key={bId} content={<div><p className="font-bold">{badgeDef.name}</p><p className="text-xs">{badgeDef.description}</p></div>}>
                                 <div className={`p-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white cursor-help transition-colors`}>
                                    <BIcon size={12} />
                                 </div>
                              </Tooltip>
                           );
                        })}
                     </div>
                  )}

                  <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                    {/* Memory Controls */}
                    <div className="bg-zinc-950/50 rounded-lg p-2 border border-zinc-800/50 flex justify-between items-center">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400">
                          <Database size={10} /> MEMORY
                        </div>
                        <div className="flex gap-1">
                           <button onClick={() => toggleMemory(agent.name)} className={`p-1 rounded ${mem.isEnabled ? 'text-green-400' : 'text-zinc-600'}`} title="Toggle Memory"><Power size={10} /></button>
                           <button onClick={() => clearMemory(agent.name)} className="p-1 rounded text-zinc-600 hover:text-red-400" title="Wipe"><Trash2 size={10} /></button>
                        </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="w-full h-[600px] border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/50 animate-fade-in shadow-2xl relative">
           <div className="absolute top-4 left-4 z-10 bg-zinc-900/80 backdrop-blur border border-zinc-800 p-2 rounded-lg text-xs text-zinc-400 shadow-lg pointer-events-none">
              <span className="font-bold text-white block mb-1">Relationship Heatmap</span>
              Thicker lines indicate higher interaction volume.
              <div className="mt-2 flex flex-col gap-1">
                 <div className="flex items-center gap-2"><div className="w-4 h-1 bg-violet-500 rounded"></div> Integration Flow</div>
                 <div className="flex items-center gap-2"><div className="w-4 h-1 bg-red-500 rounded"></div> Audit/Security</div>
              </div>
           </div>
           <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              minZoom={0.5}
              maxZoom={1.5}
              attributionPosition="bottom-right"
              className="bg-zinc-950"
            >
              <Background color="#27272a" gap={20} size={1} />
              <Controls className="bg-zinc-800 border-zinc-700 fill-zinc-400 text-zinc-400" />
              <MiniMap 
                nodeColor={(n) => {
                  if (n.type === 'input') return '#fff';
                  if (n.type === 'output') return '#f87171';
                  return '#3f3f46';
                }}
                className="bg-zinc-900 border border-zinc-800 rounded-lg"
              />
            </ReactFlow>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
