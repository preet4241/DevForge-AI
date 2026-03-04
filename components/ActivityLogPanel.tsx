
import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Check, X, Trash2, Edit2, Filter, Plus, 
  Play, Pause, FileText, Terminal, Clock, AlertCircle, Loader2
} from 'lucide-react';
import { ActivityLogEntry, ActivityLogType } from '../types';
import { Button, Badge } from './UI';

interface Props {
  logs: ActivityLogEntry[];
  onUpdateLog: (id: string, updates: Partial<ActivityLogEntry>) => void;
  onDeleteLog: (id: string) => void;
  onClearLogs: () => void;
  onAddLog: (log: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void;
  onClose: () => void;
}

const AGENT_COLORS: Record<string, string> = {
  'Aarav': 'text-blue-400 bg-blue-500/10',
  'Sanya': 'text-pink-400 bg-pink-500/10',
  'Arjun': 'text-emerald-400 bg-emerald-500/10',
  'Rohit': 'text-orange-400 bg-orange-500/10',
  'Vikram': 'text-green-400 bg-green-500/10',
  'Neha': 'text-purple-400 bg-purple-500/10',
  'Kunal': 'text-amber-400 bg-amber-500/10',
  'Pooja': 'text-red-400 bg-red-500/10',
  'Cipher': 'text-zinc-400 bg-zinc-800/50',
  'Shadow': 'text-zinc-400 bg-zinc-800/50',
  'Priya': 'text-indigo-400 bg-indigo-500/10',
  'Riya': 'text-rose-400 bg-rose-500/10',
  'Aditya': 'text-cyan-400 bg-cyan-500/10',
  'Meera': 'text-fuchsia-400 bg-fuchsia-500/10',
  'Karan': 'text-lime-400 bg-lime-500/10',
  'Ananya': 'text-violet-400 bg-violet-500/10',
  'Dev': 'text-sky-400 bg-sky-500/10',
  'Aryan': 'text-teal-400 bg-teal-500/10',
  'Zara': 'text-pink-400 bg-pink-500/10',
  'Kabir': 'text-orange-400 bg-orange-500/10',
  'Ishan': 'text-blue-400 bg-blue-500/10',
  'Naina': 'text-purple-400 bg-purple-500/10',
  'Vivaan': 'text-green-400 bg-green-500/10',
  'Tara': 'text-amber-400 bg-amber-500/10',
  'Maya': 'text-pink-400 bg-pink-500/10',
  'Rudra': 'text-zinc-400 bg-zinc-800/50',
  'Kavya': 'text-pink-400 bg-pink-500/10',
  'Dhruv': 'text-cyan-400 bg-cyan-500/10',
  'Nyaya': 'text-blue-400 bg-blue-500/10',
  'Sarva': 'text-purple-400 bg-purple-500/10',
  'Kuber': 'text-green-400 bg-green-500/10',
  'System': 'text-zinc-400 bg-zinc-500/10',
};

const TYPE_COLORS: Record<ActivityLogType, string> = {
  working: 'bg-amber-500',
  created: 'bg-green-500',
  editing: 'bg-blue-500',
  edited: 'bg-blue-400',
  reading: 'bg-purple-500',
  running: 'bg-emerald-500',
  done: 'bg-zinc-500',
  error: 'bg-red-500',
  thinking: 'bg-pink-500',
  waiting: 'bg-zinc-700',
};

export const ActivityLogPanel: React.FC<Props> = ({ 
  logs, onUpdateLog, onDeleteLog, onClearLogs, onAddLog, onClose 
}) => {
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // New Log State
  const [newLogData, setNewLogData] = useState({ agent: 'System', type: 'working', text: '', detail: '' });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    if (filterAgent !== 'all' && log.agentId !== filterAgent) return false;
    if (filterType !== 'all' && log.type !== filterType) return false;
    return true;
  });

  const handleAddSubmit = () => {
    if (!newLogData.text) return;
    onAddLog({
      agentId: newLogData.agent,
      type: newLogData.type as ActivityLogType,
      text: newLogData.text,
      detail: newLogData.detail,
      editable: true,
      done: false
    });
    setIsAdding(false);
    setNewLogData({ agent: 'System', type: 'working', text: '', detail: '' });
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 1000) return 'now';
    if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    return new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800 w-full md:w-96 animate-fade-in">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-orange-500" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Agent Activity</h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsAdding(!isAdding)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Add Entry">
            <Plus size={14} />
          </button>
          <button onClick={onClearLogs} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Clear All">
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white md:hidden">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-2 border-b border-zinc-800 grid grid-cols-2 gap-2 bg-zinc-900/30 shrink-0">
        <select 
          value={filterAgent} 
          onChange={(e) => setFilterAgent(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-orange-500"
        >
          <option value="all">All Agents</option>
          {Object.keys(AGENT_COLORS).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-orange-500"
        >
          <option value="all">All Types</option>
          {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="p-3 border-b border-zinc-800 bg-zinc-900/80 space-y-2 animate-fade-in shrink-0">
          <div className="flex gap-2">
            <select 
              value={newLogData.agent}
              onChange={(e) => setNewLogData({...newLogData, agent: e.target.value})}
              className="bg-zinc-800 text-xs text-white rounded p-1 flex-1 border border-zinc-700"
            >
              {Object.keys(AGENT_COLORS).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select 
              value={newLogData.type}
              onChange={(e) => setNewLogData({...newLogData, type: e.target.value})}
              className="bg-zinc-800 text-xs text-white rounded p-1 flex-1 border border-zinc-700"
            >
              {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input 
            type="text" 
            placeholder="Action description..." 
            value={newLogData.text}
            onChange={(e) => setNewLogData({...newLogData, text: e.target.value})}
            className="w-full bg-zinc-800 text-xs text-white rounded p-1.5 border border-zinc-700 placeholder-zinc-500"
          />
          <input 
            type="text" 
            placeholder="Target file (optional)..." 
            value={newLogData.detail}
            onChange={(e) => setNewLogData({...newLogData, detail: e.target.value})}
            className="w-full bg-zinc-800 text-xs text-white rounded p-1.5 border border-zinc-700 placeholder-zinc-500"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAdding(false)} className="text-xs text-zinc-400 hover:text-white">Cancel</button>
            <button onClick={handleAddSubmit} className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-500">Add</button>
          </div>
        </div>
      )}

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
        {filteredLogs.length === 0 ? (
          <div className="text-center text-zinc-600 text-xs py-8 italic">No activity recorded.</div>
        ) : (
          filteredLogs.map((log) => (
            <LogItem 
              key={log.id} 
              log={log} 
              onUpdate={(updates) => onUpdateLog(log.id, updates)}
              onDelete={() => onDeleteLog(log.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

const LogItem: React.FC<{ 
  log: ActivityLogEntry, 
  onUpdate: (u: Partial<ActivityLogEntry>) => void,
  onDelete: () => void 
}> = ({ log, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(log.text);
  const [editDetail, setEditDetail] = useState(log.detail || '');

  const isActive = !log.done && ['working', 'editing', 'running', 'thinking', 'reading'].includes(log.type);
  const agentStyle = AGENT_COLORS[log.agentId] || 'text-zinc-400 bg-zinc-500/10';
  const dotColor = TYPE_COLORS[log.type] || 'bg-zinc-500';

  const handleSave = () => {
    onUpdate({ text: editText, detail: editDetail });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setIsEditing(false);
  };

  return (
    <div className={`group relative flex gap-3 text-xs font-mono animate-fade-in ${log.done ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] ${agentStyle}`}>
        {log.agentId.substring(0, 1)}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className={`font-bold ${agentStyle.split(' ')[0]}`}>{log.agentId}</span>
          
          {/* Status Dot */}
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isActive ? 'animate-pulse shadow-[0_0_8px_currentColor]' : ''}`} />
            <span className="text-[10px] text-zinc-500 uppercase">{log.type}</span>
          </div>
          
          <span className="text-[10px] text-zinc-600 ml-auto whitespace-nowrap">
            <TimeAgo timestamp={log.timestamp} />
          </span>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-1 mt-1">
            <input 
              autoFocus
              className="w-full bg-black border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 outline-none focus:border-blue-500"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <input 
              className="w-full bg-black border border-zinc-700 rounded px-1.5 py-0.5 text-blue-300 outline-none focus:border-blue-500"
              value={editDetail}
              placeholder="Filename..."
              onChange={e => setEditDetail(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} className="text-[10px] text-green-400 hover:underline">Save</button>
              <button onClick={() => setIsEditing(false)} className="text-[10px] text-zinc-500 hover:underline">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="text-zinc-300 break-words leading-relaxed">
            {log.text} 
            {log.detail && (
              <span className="ml-1.5 text-blue-400 bg-blue-500/5 px-1 rounded border border-blue-500/10 inline-block">
                {log.detail}
              </span>
            )}
          </div>
        )}

        {/* Actions (Hover) */}
        <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {log.editable && !log.done && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-blue-400">
              <Edit2 size={10} /> Edit
            </button>
          )}
          {!log.done && (
            <button onClick={() => onUpdate({ done: true, type: 'done' })} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-green-400">
              <Check size={10} /> Done
            </button>
          )}
          <button onClick={onDelete} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-400 ml-auto">
            <Trash2 size={10} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Separate component for live time updates
const TimeAgo = ({ timestamp }: { timestamp: number }) => {
  const [text, setText] = useState('');
  
  useEffect(() => {
    const update = () => {
      const diff = Date.now() - timestamp;
      if (diff < 1000) setText('now');
      else if (diff < 60000) setText(`${Math.floor(diff/1000)}s`);
      else if (diff < 3600000) setText(`${Math.floor(diff/60000)}m`);
      else setText(new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    };
    update();
    const interval = setInterval(update, 15000); // Update every 15s
    return () => clearInterval(interval);
  }, [timestamp]);

  return <>{text}</>;
};
