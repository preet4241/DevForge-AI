import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, ChevronLeft, Wrench, MessageSquare, Monitor, Terminal, Paperclip, X, FileCode, 
  ArrowUp, Activity, MoreVertical, Rocket, Zap, Globe, Download, Code, Maximize2, Minimize2, Copy, Check,
  Ghost, MessageCircleWarning, Trash2, BookOpen, Sparkles, Book, BrainCircuit, Save,
  Play, Square, Eye, Layout
} from 'lucide-react';
import { Button, Badge, Tooltip } from '../components/UI';
import { Orchestrator } from '../services/orchestrator';
import { generateShadowCritique } from '../services/geminiService';
import { LearningService, DiaryEntry } from '../services/learningService';
import { MemoryController } from '../services/memoryService';
import { useNavigate } from 'react-router-dom';
import { Markdown } from '../components/Markdown';
import { ActivityLogPanel } from '../components/ActivityLogPanel';
import { ActivityLogEntry } from '../types';
import { useToast } from '../components/Toast';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  agentName?: string;
  isStreaming?: boolean;
}

interface Artifact {
  id: string;
  language: string;
  title: string;
  content: string;
  agent: string;
  timestamp: number;
}

interface Whisper {
  id: string;
  critique: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
}

const SAMPLE_LOGS = [
  "🔍 Analyzing neural weights for project consistency...",
  "📦 Loading agent dependencies: Aarav, Rohit, Neha, Vikram...",
  "🚀 Initializing sandbox environment for logic verification...",
  "✨ Syncing project state with local database...",
  "✅ Handshake with Gemini 3.0 Pro successful.",
  "🌐 Monitoring active sockets for real-time updates...",
  "🛡️ Cipher agent: Scanning input for adversarial patterns...",
  "⚠️ Memory warning: Conversation history approaching context limit.",
  "🔥 Hot-reload active for code artifact generation.",
  "🐘 DB Client: Persistent session established.",
  "🧠 Thinking budget allocated: 2048 tokens."
];

const Chat = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [project, setProject] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'chat' | 'preview'>('chat');
  
  // Artifacts
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [showArtifacts, setShowArtifacts] = useState(false);

  // Shadow / Whispers
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [showWhispers, setShowWhispers] = useState(false);
  const [isShadowThinking, setIsShadowThinking] = useState(false);

  // Console & Runtime
  const [showConsole, setShowConsole] = useState(false);
  const [logs, setLogs] = useState<{id: number, time: string, text: string}[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [isAppRunning, setIsAppRunning] = useState(false);
  
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<{agent: string, status: string} | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('currentProject');
    if (stored) {
      try {
        const proj = JSON.parse(stored);
        setProject(proj);
        
        if (messages.length === 0) {
          if (proj.description) {
            const initialUserMsg: Message = {
              id: Date.now().toString(),
              role: 'user',
              text: `Building: ${proj.description}`,
              timestamp: Date.now()
            };
            setMessages([initialUserMsg]);
            processOrchestratedMessage(initialUserMsg.text, []);
          } else {
            setMessages([{
              id: 'welcome',
              role: 'model',
              text: "Ready to build. Describe your project requirements to start.",
              timestamp: Date.now(),
              agentName: 'SYSTEM'
            }]);
          }
        }
      } catch (e) {
        navigate('/projects');
      }
    } else {
      navigate('/projects');
    }
  }, []);

  // Simulated Console Logs
  useEffect(() => {
    let interval: any;
    if (isAppRunning) {
      interval = setInterval(() => {
        const newLog = {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          text: SAMPLE_LOGS[Math.floor(Math.random() * SAMPLE_LOGS.length)]
        };
        setLogs(prev => [...prev, newLog].slice(-50));
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isAppRunning]);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const extractArtifactsFromText = (text: string, agentName: string) => {
    const foundArtifacts: Artifact[] = [];
    const cleanText = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      const title = `${agentName} Snippet`;
      foundArtifacts.push({
        id,
        language: lang || 'text',
        content: code,
        title,
        agent: agentName,
        timestamp: Date.now()
      });
      return `\n> **Artifact Generated**: [${lang || 'Code'}] ${title}\n> *Check the Artifacts Panel to view full code.*\n`;
    });
    return { cleanText, foundArtifacts };
  };

  const processOrchestratedMessage = async (text: string, history: Message[]) => {
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      await Orchestrator.handleUserMessage(
        text, 
        history, 
        (agent, status) => {
          setCurrentStatus({ agent, status });
          handleAddLog({
            agentId: agent,
            type: 'working',
            text: status,
            editable: false,
            done: false
          });
        },
        (agentName, rawText) => {
          const { cleanText, foundArtifacts } = extractArtifactsFromText(rawText, agentName);
          
          if (foundArtifacts.length > 0) {
             setArtifacts(prev => [...prev, ...foundArtifacts]);
             setActiveArtifactId(foundArtifacts[0].id);
             // Logic to auto-switch to preview if desired, but user might want to stay in chat
          }

          const msgId = Date.now().toString() + Math.random();
          const newMsg: Message = {
            id: msgId,
            role: 'model',
            text: cleanText,
            timestamp: Date.now(),
            agentName: agentName,
            isStreaming: true 
          };

          setMessages(prev => [...prev, newMsg]);
        },
        signal
      );
    } catch (e: any) {
      if (e.message !== "Process stopped by user.") {
        showToast("Agent process failed", "error");
      }
    } finally {
      setCurrentStatus(null);
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue;
    setInputValue('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    processOrchestratedMessage(text, [...messages, userMsg]);
  };

  const handleAddLog = (log: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    const newLog: ActivityLogEntry = {
      ...log,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now()
    };
    setActivityLogs(prev => [...prev, newLog]);
  };

  useEffect(() => {
    if (viewMode === 'chat') {
       messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentStatus, viewMode]);

  // Derive activeArtifact from the artifacts array using activeArtifactId
  const activeArtifact = artifacts.find(art => art.id === activeArtifactId) || artifacts[artifacts.length - 1];

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-200 overflow-hidden font-inter relative">
      {/* HEADER */}
      <header className="h-14 border-b border-zinc-900 flex items-center justify-between px-3 md:px-4 bg-zinc-950 shrink-0 z-20">
        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
          <button 
            onClick={() => navigate('/projects')} 
            className="p-1.5 md:p-2 text-zinc-400 hover:text-white transition-colors rounded-lg focus:ring-2 focus:ring-orange-500 shrink-0"
          >
            <ChevronLeft size={20} className="md:w-6 md:h-6" />
          </button>
          <div className="flex flex-col min-w-0">
             <h1 className="text-sm font-bold text-zinc-100 truncate pr-2">{project?.name || 'Untitled Project'}</h1>
             <span className="text-[10px] text-green-500 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span> Agent Cluster Online
             </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-3">
           <Tooltip content="Manage Artifacts">
             <button 
               onClick={() => setShowArtifacts(!showArtifacts)}
               className={`p-2 rounded-lg transition-colors ${showArtifacts ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}`}
             >
               <FileCode size={20} />
             </button>
           </Tooltip>
           <button 
             onClick={() => navigate('/code')}
             className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
           >
              <Terminal size={14} className="text-orange-500" />
              <span>Full IDE</span>
           </button>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIEW AREA (CHAT OR PREVIEW) */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
          
          {/* CONTENT SWITCHER */}
          {viewMode === 'chat' ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 md:px-6 py-4 md:py-8 space-y-6 md:space-y-8">
              {messages.map((msg, i) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                  {msg.role === 'model' && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center text-[10px] font-black text-white border border-orange-400/30">
                         {msg.agentName?.[0] || 'A'}
                      </div>
                      <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">{msg.agentName || 'AI Agent'}</span>
                    </div>
                  )}
                  <div className={`
                    max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 md:p-5 shadow-sm
                    ${msg.role === 'user' 
                      ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm border border-zinc-700' 
                      : 'bg-zinc-900/50 border border-zinc-800 text-zinc-300 rounded-tl-sm'}
                  `}>
                    <Markdown text={msg.text} />
                  </div>
                </div>
              ))}
              
              {/* AGENT STATUS INDICATOR */}
              {isLoading && currentStatus && (
                <div className="flex flex-col items-start animate-fade-in">
                   <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                         <Activity size={10} className="text-orange-500 animate-pulse" />
                      </div>
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{currentStatus.agent}</span>
                   </div>
                   <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></div>
                      <span className="text-sm italic text-zinc-500">{currentStatus.status}</span>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-10 shrink-0" />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col bg-zinc-900/20 animate-fade-in">
               {activeArtifact ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                     <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                        <div className="flex items-center gap-2">
                           <FileCode className="text-orange-500" size={18} />
                           <span className="text-sm font-bold text-white truncate">{activeArtifact.title}</span>
                           <Badge color="orange">{activeArtifact.language}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => { navigator.clipboard.writeText(activeArtifact.content); showToast("Copied code", "success"); }}
                             className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all"
                           >
                              <Copy size={16} />
                           </button>
                           <button className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all">
                              <Download size={16} />
                           </button>
                        </div>
                     </div>
                     <div className="flex-1 overflow-auto bg-black/30 p-6 font-mono text-sm leading-relaxed">
                        <pre className="text-zinc-300">
                           <code>{activeArtifact.content}</code>
                        </pre>
                     </div>
                  </div>
               ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-4">
                     <Monitor size={48} className="opacity-20" />
                     <p className="text-lg font-medium italic">No visual output generated yet.</p>
                     <Button variant="outline" onClick={() => setViewMode('chat')}>Back to Chat</Button>
                  </div>
               )}
            </div>
          )}

          {/* BOTTOM CONSOLE PANEL (Drawer) */}
          {showConsole && (
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-zinc-950 border-t border-zinc-800 shadow-2xl z-40 flex flex-col animate-slide-up">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-orange-500" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    System Console {isAppRunning && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setLogs([])} className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase font-bold tracking-wider">Clear</button>
                  <button onClick={() => setShowConsole(false)} className="text-zinc-500 hover:text-white p-1"><X size={14} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-zinc-400 custom-scrollbar">
                {!isAppRunning && logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3">
                    <Terminal size={24} className="opacity-20" />
                    <p className="italic">No logs yet. Run the app to see output.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, idx) => (
                      <div key={idx} className="flex gap-3 border-l border-zinc-800 pl-3">
                        <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                        <span className="break-all">{log.text}</span>
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INPUT AREA */}
          <div className="p-3 md:p-6 bg-zinc-950 border-t border-zinc-900/50 shrink-0 z-10">
            <div className="max-w-4xl mx-auto flex flex-col gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/50 transition-all shadow-xl">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask the swarm to modify, build or explain..."
                  className="w-full bg-transparent border-none text-zinc-200 placeholder-zinc-600 px-4 py-3 focus:ring-0 resize-none h-14 md:h-20 text-sm"
                />
                <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/50 border-t border-zinc-800/50">
                  <div className="flex items-center gap-1 md:gap-2">
                    <Tooltip content="Attach Context">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-zinc-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-all"
                      >
                        <Paperclip size={20} />
                      </button>
                    </Tooltip>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => showToast(`Attached ${e.target.files?.length} files.`)} />
                    
                    <div className="h-4 w-px bg-zinc-800 mx-1"></div>

                    <Tooltip content="Toggle System Console">
                      <button 
                        onClick={() => setShowConsole(!showConsole)}
                        className={`p-2 rounded-xl transition-all ${showConsole ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-500 hover:text-white'}`}
                      >
                        <Terminal size={20} />
                      </button>
                    </Tooltip>

                    <Tooltip content={isAppRunning ? "Stop Execution" : "Run Execution"}>
                      <button 
                        onClick={() => setIsAppRunning(!isAppRunning)}
                        className={`p-2 rounded-xl transition-all ${isAppRunning ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 hover:text-green-400'}`}
                      >
                        {isAppRunning ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                      </button>
                    </Tooltip>
                  </div>

                  <Button 
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="rounded-xl px-4 py-2 h-10 md:px-6 shadow-lg shadow-orange-900/20"
                  >
                    <span className="hidden sm:inline">Dispatch Swarm</span>
                    <ArrowUp size={18} />
                  </Button>
                </div>
              </div>

              {/* VIEW TOGGLE & STATUS - REFINED POSITION */}
              <div className="flex items-center justify-between px-1">
                 <div className="flex items-center gap-4 text-[10px] text-zinc-600 font-bold uppercase tracking-widest overflow-hidden">
                    <span className="hidden md:flex items-center gap-1 shrink-0"><Zap size={10} className="text-orange-500" /> 24ms</span>
                    <span className="flex items-center gap-1 shrink-0"><BrainCircuit size={10} /> Reasoning</span>
                 </div>

                 {/* SLIDING PILL TOGGLE */}
                 <div className="relative flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl h-9 w-40 shadow-inner">
                    <div 
                      className={`absolute top-1 bottom-1 w-[calc(50%-4px)] transition-all duration-300 ease-out rounded-lg ${
                        viewMode === 'chat' 
                          ? 'translate-x-0 bg-zinc-800 shadow-md border border-zinc-700/30' 
                          : 'translate-x-full bg-orange-600 shadow-lg shadow-orange-900/40'
                      }`}
                    />
                    <button
                      onClick={() => setViewMode('chat')}
                      className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 transition-colors duration-300 text-[10px] font-black uppercase tracking-widest focus:outline-none ${
                        viewMode === 'chat' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <MessageSquare size={12} /> Chat
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 transition-colors duration-300 text-[10px] font-black uppercase tracking-widest focus:outline-none ${
                        viewMode === 'preview' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <Eye size={12} /> Preview
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* ARTIFACTS PANEL (Right Sidebar) */}
        {showArtifacts && (
           <div className="w-full md:w-[450px] lg:w-[500px] border-l border-zinc-900 bg-zinc-950 flex flex-col z-30 fixed inset-y-0 right-0 md:static animate-slide-in-right shadow-2xl">
              <div className="h-14 border-b border-zinc-900 flex items-center justify-between px-4 bg-zinc-950 shrink-0">
                 <div className="flex items-center gap-2">
                    <FileCode className="text-orange-500" size={18} />
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">Artifacts Explorer</h2>
                 </div>
                 <button onClick={() => setShowArtifacts(false)} className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white">
                    <X size={20} />
                 </button>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                 {/* Artifact Tabs */}
                 <div className="flex border-b border-zinc-900 bg-zinc-950/50 overflow-x-auto no-scrollbar shrink-0">
                    {artifacts.length === 0 ? (
                       <div className="px-4 py-3 text-xs text-zinc-600 italic">No artifacts generated yet.</div>
                    ) : (
                       artifacts.map((art) => (
                          <button
                             key={art.id}
                             onClick={() => { setActiveArtifactId(art.id); setViewMode('preview'); }}
                             className={`px-4 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${activeArtifactId === art.id ? 'border-orange-500 text-orange-400 bg-orange-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                          >
                             {art.title}
                          </button>
                       ))
                    )}
                 </div>

                 {/* Content Area */}
                 <div className="flex-1 overflow-y-auto bg-zinc-900/30 p-0 relative">
                    {activeArtifact ? (
                       <div className="h-full flex flex-col">
                          <div className="p-3 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/50">
                             <Badge color="orange">{activeArtifact.language}</Badge>
                             <div className="flex gap-2">
                                <Tooltip content="Copy Code">
                                  <button onClick={() => {navigator.clipboard.writeText(activeArtifact.content); showToast("Copied to clipboard", "success");}} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors">
                                     <Copy size={16} />
                                  </button>
                                </Tooltip>
                                <Tooltip content="Download File">
                                  <button className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors">
                                     <Download size={16} />
                                  </button>
                                </Tooltip>
                             </div>
                          </div>
                          <pre className="p-4 md:p-6 text-xs font-mono text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre">
                             <code>{activeArtifact.content}</code>
                          </pre>
                       </div>
                    ) : (
                       <div className="h-full flex flex-col items-center justify-center text-zinc-600 p-8 text-center">
                          <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                             <FileCode size={32} />
                          </div>
                          <h3 className="font-bold text-zinc-500">No Artifact Selected</h3>
                          <p className="text-sm mt-2">Select an item from the tabs above to view the generated source code.</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default Chat;