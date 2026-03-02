
import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, Paperclip, Send, X, FileText, Image as ImageIcon, 
  BrainCircuit, ShieldAlert, Skull,
  Book, Search, Zap, AlertTriangle, History, Layers, Calendar, List, Clock, Users,
  FileArchive, FileCode, File as FileIcon
} from 'lucide-react';
import { Button, Badge } from '../components/UI';
import { LearningService } from '../services/learningService';
import { GlobalMemoryController, MemoryItem, LearningLog } from '../services/memoryService';
import { Markdown } from '../components/Markdown';
import { useToast } from '../components/Toast'; // Added Toast for error handling

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string | null; // Base64 data or text content
  isBinary: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  agentName?: string;
  isRelevant?: boolean;
  attachments?: AttachedFile[]; // Updated to support multiple files
}

const AGENTS_LIST = [
  { name: 'Aarav', role: 'Product', color: 'bg-blue-500' },
  { name: 'Rohit', role: 'Architect', color: 'bg-orange-500' },
  { name: 'Vikram', role: 'Backend', color: 'bg-green-500' },
  { name: 'Neha', role: 'Frontend', color: 'bg-pink-500' },
  { name: 'Kunal', role: 'DevOps', color: 'bg-cyan-500' },
  { name: 'Pooja', role: 'QA', color: 'bg-red-500' },
  { name: 'Cipher', role: 'Red Team', color: 'bg-zinc-500' },
];

const MAX_FILES = 30;
const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const TrainingChat = () => {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'model',
      text: "Neural Training Module Online. \n\nThis channel is for **Scenario Analysis** and **Constraint Learning**. \n\nSubmit edge cases, complex requirements, or security scenarios. The agents will **Analyze** and debate limitations and feasibility. \n\n*No casual conversation.*",
      agentName: 'System'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [rawMode, setRawMode] = useState(false);
  
  // Knowledge Modal State
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'rules' | 'patterns' | 'risks' | 'scenarios' | 'logs'>('rules');
  const [knowledgeItems, setKnowledgeItems] = useState<{ 
    rules: MemoryItem[], 
    patterns: MemoryItem[], 
    antiPatterns: MemoryItem[],
    scenarios: MemoryItem[],
    logs: LearningLog[] 
  }>({ rules: [], patterns: [], antiPatterns: [], scenarios: [], logs: [] });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    refreshKnowledge();
  }, [showKnowledgeModal]);

  const refreshKnowledge = () => {
    setKnowledgeItems(GlobalMemoryController.getFullStore() as any);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith('image/')) return <ImageIcon size={14} className="text-purple-400" />;
    if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || name.endsWith('.tar')) return <FileArchive size={14} className="text-amber-400" />;
    if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.py') || name.endsWith('.html') || name.endsWith('.css') || name.endsWith('.json')) return <FileCode size={14} className="text-blue-400" />;
    return <FileIcon size={14} className="text-zinc-400" />;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files: File[] = Array.from(e.target.files);
    
    // 1. Check Count Limit
    if (attachedFiles.length + files.length > MAX_FILES) {
      showToast(`Cannot upload more than ${MAX_FILES} files at once.`, 'error');
      return;
    }

    const newAttachments: AttachedFile[] = [];
    const oversizedFiles: string[] = [];

    // 2. Process Files
    for (const file of files) {
      // Check Size Limit
      if (file.size > MAX_FILE_SIZE_BYTES) {
        oversizedFiles.push(file.name);
        continue;
      }

      const isImage = file.type.startsWith('image/');
      const isText = file.type.startsWith('text/') || 
                     (file.name.match(/\.(json|js|jsx|ts|tsx|py|md|html|css|scss|xml|csv|log)$/i) !== null);
      
      let fileData: string | null = null;
      let isBinary = !isText;

      try {
        if (isImage) {
          // Read image as DataURL for preview/sending
          fileData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          isBinary = false; // We treat base64 images as non-binary for UI rendering purposes here
        } else if (isText) {
          // Read text content
          fileData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsText(file);
          });
          isBinary = false;
        } else {
          // For binary files (zip, rar, exe, pdf etc), we don't load content into memory 
          // to save browser performance, just track metadata.
          // Unless we really need to upload the blob later.
          // For now, we'll store a placeholder or read as base64 if needed for API.
          // Let's read as DataURL just in case we need to send it, but mark as binary.
          // Note: Reading 200MB zip as Base64 is heavy. We'll skip reading content for large binaries
          // to prevent browser crash, unless it's strictly required by the current API implementation.
          // Current implementation sends text prompts.
          fileData = "[Binary File Data]"; 
          isBinary = true;
        }

        newAttachments.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: fileData,
          isBinary
        });

      } catch (err) {
        console.error("Error reading file:", file.name, err);
        showToast(`Failed to read ${file.name}`, 'error');
      }
    }

    if (oversizedFiles.length > 0) {
      showToast(`${oversizedFiles.length} file(s) skipped (exceeded ${MAX_FILE_SIZE_MB}MB limit).`, 'warning');
    }

    setAttachedFiles(prev => [...prev, ...newAttachments]);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && attachedFiles.length === 0) || isProcessing) return;

    const currentText = inputValue;
    const currentFiles = [...attachedFiles];

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: currentText,
      attachments: currentFiles
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAttachedFiles([]);
    setIsProcessing(true);
    setActiveSpeaker(null);

    try {
      // Construct Analysis Content
      let analysisContent = currentText;
      
      if (currentFiles.length > 0) {
        analysisContent += `\n\n--- ATTACHED FILES SUMMARY ---`;
        currentFiles.forEach(f => {
           analysisContent += `\n- File: ${f.name} (${formatBytes(f.size)})`;
           if (!f.isBinary && f.data && !f.type.startsWith('image/')) {
              // Append text content for analysis
              // Limit very large text files to start/end to save context window if needed
              // For now, appending full content as per "upload" request logic
              analysisContent += `\n[CONTENT START]\n${f.data.substring(0, 50000)}\n[CONTENT END]\n`;
              if (f.data.length > 50000) analysisContent += `...(truncated)\n`;
           }
        });
      }
      
      // Determine if we have a primary image to send to the vision model
      // The current service supports one image inline. We'll pick the first image found.
      const firstImage = currentFiles.find(f => f.type.startsWith('image/') && f.data);
      const imageData = firstImage ? firstImage.data : undefined;
      
      await LearningService.startTeamDiscussion(
        analysisContent, 
        (agent, text, isNewTurn) => {
          setActiveSpeaker(agent);
          
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            
            // If it's a new turn or the last message wasn't from this agent, add new message
            if (isNewTurn || !lastMsg || lastMsg.agentName !== agent) {
               return [...prev, {
                 id: Math.random().toString(),
                 role: 'model',
                 text: text,
                 agentName: agent,
                 isRelevant: true
               }];
            } else {
               // Append to existing message (Typing effect)
               const updated = [...prev];
               updated[updated.length - 1] = {
                 ...lastMsg,
                 text: lastMsg.text + text
               };
               return updated;
            }
          });
        }, 
        imageData, // Pass first image data if available
        firstImage?.name,
        rawMode
      );

      refreshKnowledge();

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Neural link disrupted. Error processing request.",
        agentName: 'System'
      }]);
    } finally {
      setIsProcessing(false);
      setActiveSpeaker(null);
    }
  };

  const getFilteredItems = (items: MemoryItem[]) => {
    if (!knowledgeSearch) return items;
    const lowerSearch = knowledgeSearch.toLowerCase();
    return items.filter(i => 
      i.content.toLowerCase().includes(lowerSearch) || 
      (i.domain && i.domain.toLowerCase().includes(lowerSearch))
    );
  };

  const renderContent = () => {
    let items: MemoryItem[] = [];
    let EmptyState = () => <div className="text-zinc-500 italic p-4">No data available.</div>;

    switch(activeTab) {
      case 'rules':
        items = getFilteredItems(knowledgeItems.rules);
        EmptyState = () => <div className="text-zinc-500 italic p-4">No constraints learned yet.</div>;
        break;
      case 'patterns':
        items = getFilteredItems(knowledgeItems.patterns);
        EmptyState = () => <div className="text-zinc-500 italic p-4">No best practices recorded.</div>;
        break;
      case 'risks':
        items = getFilteredItems(knowledgeItems.antiPatterns);
        EmptyState = () => <div className="text-zinc-500 italic p-4">No risks identified.</div>;
        break;
      case 'scenarios':
        items = getFilteredItems(knowledgeItems.scenarios || []);
        EmptyState = () => <div className="text-zinc-500 italic p-4">No scenarios simulated yet.</div>;
        break;
      case 'logs':
        // Logs handled separately below
        break;
    }

    if (activeTab === 'logs') {
      const logs = knowledgeItems.logs || [];
      if (logs.length === 0) return <div className="text-zinc-500 italic p-4">No learning history recorded.</div>;
      
      return (
        <div className="relative pl-6 border-l border-zinc-800 space-y-8 animate-fade-in">
          {logs.map(log => (
            <div key={log.id} className="relative group">
              <div className="absolute -left-[29px] top-1.5 w-3 h-3 rounded-full bg-zinc-800 border-2 border-zinc-950 ring-2 ring-zinc-950 group-hover:bg-orange-500 transition-colors"></div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-mono text-zinc-500 flex items-center gap-2">
                  <Clock size={12} />
                  {new Date(log.timestamp).toLocaleString(undefined, { 
                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </span>
                <div className="text-zinc-300 text-sm bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900 transition-all">
                  <div className="flex items-center gap-2 mb-1 text-orange-400/80 text-[10px] font-bold uppercase tracking-wider">
                     <BrainCircuit size={12} /> Insight Learned
                  </div>
                  {log.summary}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) return <EmptyState />;

    return (
      <div className="space-y-3 animate-fade-in">
        {items.map(item => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex gap-4 hover:border-zinc-700 transition-colors group">
             <div className="mt-1 shrink-0">
               {activeTab === 'rules' && <ShieldAlert className="text-blue-500" size={20} />}
               {activeTab === 'patterns' && <Zap className="text-green-500" size={20} />}
               {activeTab === 'risks' && <AlertTriangle className="text-red-500" size={20} />}
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 leading-relaxed font-medium">{item.content}</p>
                <div className="flex items-center gap-3 mt-3">
                   {item.domain && (
                     <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded group-hover:border-zinc-700 group-hover:text-zinc-400 transition-colors">
                       {item.domain}
                     </span>
                   )}
                   <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                     <Calendar size={10} /> {new Date(item.timestamp).toLocaleDateString()}
                   </span>
                </div>
             </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden relative">
      
      {/* REDESIGNED KNOWLEDGE MODAL */}
      {showKnowledgeModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl animate-fade-in overflow-hidden">
             
             {/* Header */}
             <div className="p-5 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                     <BrainCircuit size={24} />
                   </div>
                   <div>
                     <h2 className="text-xl font-bold text-white">Neural Knowledge Base</h2>
                     <p className="text-zinc-500 text-xs">Persistent constraints & learning history</p>
                   </div>
                </div>
                <button onClick={() => setShowKnowledgeModal(false)} className="text-zinc-500 hover:text-white p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                  <X size={24} />
                </button>
             </div>

             <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
               {/* Sidebar Tabs */}
               <div className="w-full md:w-64 bg-zinc-900/50 border-r border-zinc-800 flex flex-row md:flex-col p-2 md:p-4 gap-2 shrink-0 overflow-x-auto">
                  <button 
                    onClick={() => setActiveTab('rules')}
                    className={`whitespace-nowrap md:whitespace-normal text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 transition-all ${activeTab === 'rules' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                  >
                    <ShieldAlert size={18} /> Constraints
                  </button>
                  <button 
                    onClick={() => setActiveTab('patterns')}
                    className={`whitespace-nowrap md:whitespace-normal text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 transition-all ${activeTab === 'patterns' ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-sm' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                  >
                    <Zap size={18} /> Best Practices
                  </button>
                  <button 
                    onClick={() => setActiveTab('risks')}
                    className={`whitespace-nowrap md:whitespace-normal text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 transition-all ${activeTab === 'risks' ? 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                  >
                    <AlertTriangle size={18} /> Risks
                  </button>
                  <button 
                    onClick={() => setActiveTab('scenarios')}
                    className={`whitespace-nowrap md:whitespace-normal text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 transition-all ${activeTab === 'scenarios' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                  >
                    <BrainCircuit size={18} /> Scenarios
                  </button>
                  
                  <div className="hidden md:block h-px bg-zinc-800 my-2"></div>
                  
                  <button 
                    onClick={() => setActiveTab('logs')}
                    className={`whitespace-nowrap md:whitespace-normal text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 transition-all ${activeTab === 'logs' ? 'bg-zinc-800 text-white shadow-inner border border-zinc-700' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                  >
                    <History size={18} /> Learning Logs
                  </button>
               </div>

               {/* Content Area */}
               <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 overflow-hidden">
                  {/* Search Bar (Only for data tabs) */}
                  {activeTab !== 'logs' && (
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                      <div className="relative max-w-md">
                        <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                        <input 
                          type="text" 
                          placeholder="Search database..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-orange-500 outline-none placeholder:text-zinc-600 transition-all focus:ring-1 focus:ring-orange-500/50"
                          value={knowledgeSearch}
                          onChange={(e) => setKnowledgeSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === 'logs' && (
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                       <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                         <Layers size={14} /> Chronological Learning History
                       </h3>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-4 md:p-8">
                     {renderContent()}
                  </div>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* 1. TOP NAV BAR */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md flex items-center px-4 shrink-0 z-20 absolute top-0 left-0 right-0 w-full justify-between">
        <div className="flex items-center gap-4">
           <div className="flex justify-start lg:hidden">
             <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
               <Menu size={24} />
             </button>
           </div>
           
           <div className="flex justify-center items-center gap-2">
            <BrainCircuit className="text-orange-500" size={20} />
            <h1 className="font-bold text-lg tracking-wide hidden md:block">Neural Training</h1>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
           <Button 
             variant="outline" 
             onClick={() => setShowKnowledgeModal(true)}
             className="hidden md:flex text-xs h-8 gap-2 border-zinc-700 hover:border-orange-500/50 hover:text-orange-400"
           >
             <Book size={14} /> Knowledge Graph
           </Button>
           <button 
             onClick={() => setShowKnowledgeModal(true)}
             className="md:hidden p-2 text-zinc-400 hover:text-white"
           >
             <Book size={20} />
           </button>
           
           {/* Raw Mode Toggle */}
           <button 
             onClick={() => setRawMode(!rawMode)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${rawMode ? 'bg-red-900/20 border-red-500/50 text-red-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
             title={rawMode ? "Unrestricted Analysis Active" : "Enable Raw Mode (Use Local LLM)"}
           >
             <Skull size={14} className={rawMode ? "animate-pulse" : ""} />
             <span className="text-[10px] uppercase font-bold hidden sm:inline">{rawMode ? 'RAW MODE' : 'SAFE'}</span>
           </button>
        </div>
      </header>

      {/* 2. CHAT CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pt-16 pb-4 px-4 md:px-20 lg:px-40 space-y-6 scroll-smooth">
        
        <div className="mt-4 mx-auto max-w-lg">
          <div className={`border rounded-lg px-4 py-3 text-center shadow-lg transition-colors ${rawMode ? 'bg-red-900/10 border-red-500/20' : 'bg-zinc-900 border-zinc-800'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-1 ${rawMode ? 'text-red-400' : 'text-zinc-400'}`}>
              {rawMode ? <Skull size={12} /> : <ShieldAlert size={12} className="text-orange-500" />}
              {rawMode ? "Unrestricted Learning Protocol" : "Constraint Learning Active"}
            </p>
            <p className="text-xs text-zinc-500">
               {rawMode ? "Cipher agent active. Using configured Local LLM if available." : "Agents will analyze feasibility and reject unsafe patterns."}
            </p>
          </div>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
            
            <div className="flex items-center gap-2 mb-1 px-1">
              {msg.role === 'model' && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${msg.agentName === 'System' ? 'bg-zinc-800 text-zinc-400' : msg.agentName === 'Cipher' ? 'bg-red-900/30 text-red-400 border border-red-500/20' : 'bg-orange-500/10 text-orange-400'}`}>
                  {msg.agentName}
                </span>
              )}
              {msg.role === 'user' && (
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">You</span>
              )}
            </div>

            <div className={`
              max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-lg
              ${msg.role === 'user' 
                ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm' 
                : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-sm'}
              ${msg.agentName === 'Cipher' ? 'border-red-900/30 bg-red-950/10' : ''}
            `}>
              
              {/* ATTACHMENT DISPLAY IN MESSAGE */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mb-3 grid grid-cols-1 gap-2">
                  {msg.attachments.map((file, idx) => (
                    <div key={idx} className="p-2 bg-black/20 rounded-lg border border-white/5 flex items-center gap-3">
                      <div className="shrink-0">
                        {getFileIcon(file.type, file.name)}
                      </div>
                      <div className="flex-1 overflow-hidden min-w-0">
                         <div className="flex justify-between items-center">
                            <p className="text-xs font-bold text-white truncate">{file.name}</p>
                            <span className="text-[9px] text-zinc-500 whitespace-nowrap ml-2">{formatBytes(file.size)}</span>
                         </div>
                      </div>
                    </div>
                  ))}
                  {/* Image Preview for first image if exists */}
                  {msg.attachments.find(f => f.type.startsWith('image/') && f.data) && (
                     <div className="mt-1">
                        <img 
                          src={msg.attachments.find(f => f.type.startsWith('image/') && f.data)?.data || ''} 
                          alt="First Preview" 
                          className="rounded-lg max-h-48 object-cover border border-zinc-700/50" 
                        />
                     </div>
                  )}
                </div>
              )}
              
              {msg.text && <Markdown text={msg.text} />}
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* 3. BOTTOM INPUT AREA */}
      <div className="p-4 md:p-6 bg-zinc-950/80 backdrop-blur-lg border-t border-zinc-900 z-20 shrink-0">
        <div className={`max-w-4xl mx-auto bg-zinc-900 border rounded-2xl overflow-hidden shadow-2xl relative transition-all focus-within:ring-1 ${rawMode ? 'border-red-900/30 focus-within:border-red-500/50 focus-within:ring-red-500/50' : 'border-zinc-800 focus-within:border-orange-500/50 focus-within:ring-orange-500/50'}`}>
          
          {/* File Staging Area */}
          {attachedFiles.length > 0 && (
             <div className="px-3 pt-3 pb-0 flex flex-wrap gap-2 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                {attachedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 bg-zinc-950 px-2 py-1.5 rounded-lg border border-zinc-800 group animate-fade-in">
                     {getFileIcon(file.type, file.name)}
                     <div className="flex flex-col">
                        <span className="text-xs text-white truncate max-w-[120px] leading-tight">{file.name}</span>
                        <span className="text-[8px] text-zinc-500">{formatBytes(file.size)}</span>
                     </div>
                     <button onClick={() => removeAttachment(file.id)} className="text-zinc-500 hover:text-red-400 ml-1 rounded-full p-0.5 hover:bg-zinc-800 transition-colors">
                       <X size={12} />
                     </button>
                  </div>
                ))}
             </div>
          )}

          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={rawMode ? "Enter unrestricted scenario for Cipher..." : "Describe a scenario. Agents will Analyze & Debate constraints..."}
            className="w-full bg-transparent border-none text-zinc-200 placeholder-zinc-600 px-4 py-3 focus:ring-0 resize-none h-20 text-sm"
          />

          <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/50 border-t border-zinc-800/50">
            <div className="flex items-center gap-2">
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple={true} // Allow multiple files
                  onChange={handleFileSelect}
               />
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="p-2 text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-all flex items-center gap-2 group"
                 title="Attach Files (Max 30, up to 200MB each)"
               >
                 <Paperclip size={20} className="group-hover:rotate-45 transition-transform" />
                 <span className="text-[10px] hidden sm:inline group-hover:text-orange-400/80">
                    {attachedFiles.length > 0 ? `${attachedFiles.length} files` : 'Attach'}
                 </span>
               </button>

               <div className="h-4 w-px bg-zinc-800 mx-1"></div>

               <span className="text-[10px] text-zinc-500 font-medium">
                 {inputValue.length > 0 || attachedFiles.length > 0 ? "Analyzing Feasibility" : "Waiting for input..."}
               </span>
            </div>

            <Button 
              onClick={handleSendMessage}
              disabled={(!inputValue.trim() && attachedFiles.length === 0) || isProcessing}
              className={`rounded-xl px-6 py-2 h-10 shadow-lg ${rawMode ? 'bg-red-900 hover:bg-red-800 shadow-red-900/20' : 'shadow-orange-900/20'}`}
            >
               Analyze <BrainCircuit size={16} />
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TrainingChat;
