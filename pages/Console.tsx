import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, ChevronLeft, Trash2, MousePointer2, Play, Pause, Info, AlertTriangle, XCircle, CheckCircle2, Bot } from 'lucide-react';
import { Button, Card } from '../components/UI';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'system';
  message: string;
}

interface ConsoleProps {
  onClose?: () => void; // Optional prop to close the console, useful when used as an overlay
}

const LOG_TYPES = ['info', 'warning', 'error', 'success', 'system'] as const;
const SAMPLE_MESSAGES = {
  info: [
    "Agent 'Rohit' is initializing the planning phase.",
    "Data validation successful for user input.",
    "Loading project dependencies...",
    "Resource allocation updated.",
    "API connection established with Gemini-3-Pro."
  ],
  warning: [
    "High memory usage detected in Agent 'Neha'.",
    "External API responded with a non-critical error: rate limit approaching.",
    "File attachment size exceeds recommended limits.",
    "Potential performance bottleneck identified in query optimizer."
  ],
  error: [
    "Critical error: Agent 'Vikram' failed to connect to database.",
    "Deployment failed: Insufficient permissions.",
    "Parsing error in generated code block. Reverting...",
    "Authentication token expired. Re-authenticate.",
    "Memory context overflow for Agent 'Aarav'."
  ],
  success: [
    "Project plan generated successfully!",
    "Module 'userAuth.js' compiled without errors.",
    "Deployment to preview environment completed.",
    "Neural learning session finished. New patterns added.",
    "Database migration applied successfully."
  ],
  system: [
    "System checkpoint saved.",
    "Orchestrator initiated a new agent collaboration.",
    "Auto-recovery sequence engaged.",
    "Global memory synchronized.",
    "Build process started."
  ]
};

const Console: React.FC<ConsoleProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  // Fix: Replace NodeJS.Timeout with 'number' for browser's setInterval return type
  const logIntervalRef = useRef<number | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when logs change and auto-scrolling is enabled
    if (isAutoScrolling && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScrolling]);

  useEffect(() => {
    // Start simulating logs when component mounts
    startLogSimulation();

    // Clear interval when component unmounts
    return () => {
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current);
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

  const startLogSimulation = () => {
    if (logIntervalRef.current) {
      clearInterval(logIntervalRef.current);
    }
    logIntervalRef.current = setInterval(() => {
      addRandomLog();
    }, 1500); // Add a new log every 1.5 seconds
  };

  const addLog = (type: LogEntry['type'], message: string) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: timestamp,
      type: type,
      message: message,
    };
    setLogs((prevLogs) => [...prevLogs, newLog]);
  };

  const addRandomLog = () => {
    const randomTypeIndex = Math.floor(Math.random() * LOG_TYPES.length);
    const randomType = LOG_TYPES[randomTypeIndex];
    
    const messagesOfType = SAMPLE_MESSAGES[randomType];
    const randomMessageIndex = Math.floor(Math.random() * messagesOfType.length);
    const randomMessage = messagesOfType[randomMessageIndex];

    addLog(randomType, randomMessage);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const toggleAutoScroll = () => {
    setIsAutoScrolling((prev) => !prev);
  };

  const getLogTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'info': return <Info size={14} className="text-blue-400" />;
      case 'warning': return <AlertTriangle size={14} className="text-amber-400" />;
      case 'error': return <XCircle size={14} className="text-red-400" />;
      case 'success': return <CheckCircle2 size={14} className="text-green-400" />;
      case 'system': return <Bot size={14} className="text-zinc-400" />;
      default: return <Terminal size={14} className="text-zinc-500" />;
    }
  };

  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'info': return 'text-blue-400';
      case 'warning': return 'text-amber-400';
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'system': return 'text-zinc-400';
      default: return 'text-zinc-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={onClose || (() => navigate('/chat'))} // Use onClose if provided, otherwise fallback to navigate
            className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Terminal className="text-orange-500 shrink-0" size={20} />
            System Console
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <Button 
            variant="outline"
            onClick={toggleAutoScroll}
            className={`text-xs h-8 ${isAutoScrolling ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
            title={isAutoScrolling ? "Pause Auto-scroll" : "Resume Auto-scroll"}
          >
            {isAutoScrolling ? <Pause size={14} /> : <Play size={14} />}
            <span className="hidden sm:inline">{isAutoScrolling ? 'Pause' : 'Resume'}</span>
          </Button>
          <Button 
            variant="outline"
            onClick={clearLogs}
            className="text-xs h-8 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-red-400"
            title="Clear Logs"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>

      {/* Console Log Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 font-mono text-sm bg-zinc-950">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <Terminal size={48} className="mb-4" />
            <p>No logs yet. System is idle or processing.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 pr-2">
                <span className="text-zinc-600 flex-shrink-0">{log.timestamp}</span>
                <span className={`flex items-center gap-1 font-bold flex-shrink-0 ${getLogTypeColor(log.type)}`}>
                  {getLogTypeIcon(log.type)}
                  [{log.type.toUpperCase()}]
                </span>
                <pre className={`flex-1 whitespace-pre-wrap ${getLogTypeColor(log.type)}`}>
                  {log.message}
                </pre>
              </div>
            ))}
            <div ref={consoleEndRef} className="h-0" /> {/* Scroll target */}
          </div>
        )}
      </div>
    </div>
  );
};

export default Console;