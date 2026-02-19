import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Terminal, Send, Trash2, HelpCircle } from 'lucide-react';
import { Button } from '../components/UI';

interface TerminalViewProps {
  onClose?: () => void; // Optional prop to close the terminal
}

interface CommandOutput {
  id: string;
  command?: string;
  output: string | React.ReactNode;
  type: 'command' | 'output' | 'error';
}

const TerminalView: React.FC<TerminalViewProps> = ({ onClose }) => {
  const [commandHistory, setCommandHistory] = useState<CommandOutput[]>([]);
  const [inputValue, setInputValue] = useState('');
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commandHistory]);

  const handleCommandSubmit = () => {
    if (!inputValue.trim()) return;

    const command = inputValue.trim();
    setInputValue('');

    setCommandHistory(prev => [
      ...prev,
      { id: Date.now().toString() + '-cmd', command, output: '', type: 'command' }
    ]);

    processCommand(command);
  };

  const processCommand = (command: string) => {
    let output: string | React.ReactNode = '';
    let type: CommandOutput['type'] = 'output';

    const lowerCommand = command.toLowerCase();

    if (lowerCommand === 'help') {
      output = (
        <div>
          <p className="text-zinc-300 mb-1">Available commands:</p>
          <ul className="list-disc list-inside text-zinc-400">
            <li><span className="font-bold">help</span> - Display available commands.</li>
            <li><span className="font-bold">ls</span> - List files in the current directory.</li>
            <li><span className="font-bold">pwd</span> - Print working directory.</li>
            <li><span className="font-bold">clear</span> - Clear the terminal history.</li>
            <li><span className="font-bold">agents</span> - List active AI agents.</li>
            <li><span className="font-bold">status</span> - Display system status.</li>
          </ul>
          <p className="text-zinc-400 mt-2">Try typing one of them!</p>
        </div>
      );
    } else if (lowerCommand === 'ls') {
      output = "src/ pages/ components/ services/ public/ index.html index.tsx metadata.json types.ts";
    } else if (lowerCommand === 'pwd') {
      output = "/app/devforge";
    } else if (lowerCommand === 'clear') {
      setCommandHistory([]);
      return;
    } else if (lowerCommand === 'agents') {
      output = (
        <div>
          <p className="text-orange-400 font-bold mb-1">Active AI Agents:</p>
          <ul className="list-disc list-inside text-zinc-300">
            <li>Aarav (Product Manager) - Active</li>
            <li>Rohit (AI Architect) - Active</li>
            <li>Neha (Frontend Engineer) - Active</li>
            <li>Pooja (QA Tester) - Active</li>
            <li>Vikram (Backend Engineer) - Idle</li>
            <li>Kunal (DevOps Engineer) - Idle</li>
          </ul>
        </div>
      );
    } else if (lowerCommand === 'status') {
      output = (
        <div>
          <p className="text-green-400 font-bold mb-1">System Status: Operational</p>
          <p className="text-zinc-400">Uptime: 7 days, 14 hours</p>
          <p className="text-zinc-400">Current Load: Low (23%)</p>
          <p className="text-zinc-400">Memory Usage: 45%</p>
        </div>
      );
    }
    else {
      output = `Command not found: ${command}. Type 'help' for a list of commands.`;
      type = 'error';
    }

    setCommandHistory(prev => [
      ...prev,
      { id: Date.now().toString() + '-out', output, type }
    ]);
  };

  const handleClearTerminal = () => {
    setCommandHistory([]);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Terminal className="text-blue-400 shrink-0" size={20} />
            Integrated Terminal
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <Button 
            variant="outline"
            onClick={handleClearTerminal}
            className="text-xs h-8 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-red-400"
            title="Clear Terminal"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          <Button 
            variant="outline"
            onClick={() => processCommand('help')}
            className="text-xs h-8 text-zinc-400 border-zinc-700 hover:bg-zinc-800"
            title="Help"
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">Help</span>
          </Button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 text-sm">
        {commandHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <Terminal size={48} className="mb-4 text-blue-500/50" />
            <p className="text-lg">DevForge Shell</p>
            <p className="text-xs mt-2">Type 'help' for a list of commands.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {commandHistory.map((entry) => (
              <div key={entry.id}>
                {entry.type === 'command' && (
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">$</span>
                    <span className="text-white">{entry.command}</span>
                  </div>
                )}
                {entry.type === 'output' && (
                  <div className="text-zinc-300 whitespace-pre-wrap">{entry.output}</div>
                )}
                {entry.type === 'error' && (
                  <div className="text-red-400 whitespace-pre-wrap">{entry.output}</div>
                )}
              </div>
            ))}
            <div ref={outputEndRef} className="h-0" /> {/* Scroll target */}
          </div>
        )}
      </div>

      {/* Terminal Input */}
      <div className="shrink-0 p-4 md:p-6 border-t border-zinc-800 bg-zinc-900/95">
        <div className="flex bg-zinc-900 border border-zinc-700 rounded-lg p-1">
          <span className="text-green-400 px-3 py-2 shrink-0">$</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCommandSubmit()}
            className="flex-1 bg-transparent border-none text-white focus:ring-0 placeholder-zinc-500 outline-none"
            placeholder="Enter command..."
            autoFocus
          />
          <Button 
            onClick={handleCommandSubmit}
            className="h-10 px-4 shrink-0"
            disabled={!inputValue.trim()}
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TerminalView;