
import React, { useState, useEffect } from 'react';
import { 
  Cpu, Database, Trash2, Shield, Zap, Monitor, 
  HardDrive, AlertTriangle, Check, Terminal,
  Brain, Sliders, Eraser, Activity, Lock, Plus, Key, Globe, User, ExternalLink, Eye, EyeOff, Globe2, ChevronRight, MousePointer2, ChevronDown,
  RefreshCw, Power, Settings as SettingsIcon, MoreVertical, List, Layers, Clock, BarChart3
} from 'lucide-react';
import { Card, Button, Badge, Tooltip } from '../components/UI';
import { ApiConfigService, ApiKeyConfig, ApiProvider } from '../services/apiConfigService';

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button 
    onClick={onChange}
    className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-orange-600' : 'bg-zinc-700'}`}
  >
    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

const Section = ({ title, icon: Icon, children, description }: { title: string, icon: any, children?: React.ReactNode, description?: string }) => (
  <div className="space-y-4">
    <div className="flex items-start gap-3 border-b border-zinc-800 pb-2 mb-4">
      <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {description && <p className="text-sm text-zinc-500">{description}</p>}
      </div>
    </div>
    <div className="grid gap-4">
      {children}
    </div>
  </div>
);

const AGENT_OPTIONS = [
  { group: 'System', options: [
    { value: 'global', label: 'Global (Default)' }
  ]},
  { group: 'Core Team', options: [
    { value: 'Aarav', label: 'Aarav (Team Leader)' },
    { value: 'Sanya', label: 'Sanya (Researcher)' },
    { value: 'Arjun', label: 'Arjun (Product Manager)' },
    { value: 'Rohit', label: 'Rohit (Architect)' },
    { value: 'Vikram', label: 'Vikram (Backend)' },
    { value: 'Neha', label: 'Neha (Frontend)' },
    { value: 'Kunal', label: 'Kunal (DevOps)' },
    { value: 'Pooja', label: 'Pooja (QA)' },
    { value: 'Cipher', label: 'Cipher (Red Team)' },
    { value: 'Shadow', label: 'Shadow (Critic)' },
    { value: 'Maya', label: 'Maya (Preview)' }
  ]},
  { group: 'Creative & Design', options: [
    { value: 'Priya', label: 'Priya (UI/UX)' },
    { value: 'Riya', label: 'Riya (Copywriter)' },
    { value: 'Zara', label: 'Zara (3D/Animation)' }
  ]},
  { group: 'AI & Data', options: [
    { value: 'Aditya', label: 'Aditya (AI/ML)' },
    { value: 'Meera', label: 'Meera (Data Analyst)' },
    { value: 'Vivaan', label: 'Vivaan (Context)' }
  ]},
  { group: 'Specialized Tech', options: [
    { value: 'Karan', label: 'Karan (Mobile)' },
    { value: 'Aryan', label: 'Aryan (Game Dev)' },
    { value: 'Kabir', label: 'Kabir (Blockchain)' }
  ]},
  { group: 'Business', options: [
    { value: 'Ananya', label: 'Ananya (Business)' },
    { value: 'Dev', label: 'Dev (Marketing)' }
  ]},
  { group: 'Infrastructure', options: [
    { value: 'Ishan', label: 'Ishan (DB Admin)' },
    { value: 'Naina', label: 'Naina (API Specialist)' }
  ]},
  { group: 'Support', options: [
    { value: 'Tara', label: 'Tara (UX Research)' }
  ]}
];

const AgentSelect = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedOption = AGENT_OPTIONS.flatMap(g => g.options).find(o => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 pr-10 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none flex items-center justify-between hover:border-zinc-700 transition-colors"
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto overflow-x-hidden animate-fade-in">
            {AGENT_OPTIONS.map((group) => (
              <div key={group.group} className="p-1">
                <div className="px-3 py-1.5 text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900/50 sticky top-0 z-10">
                  {group.group}
                </div>
                <div className="space-y-0.5 mt-1">
                  {group.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all flex items-center justify-between group ${
                        value === opt.value 
                          ? 'bg-orange-500/10 text-orange-400 font-bold' 
                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {value === opt.value && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Settings = () => {
  const [preferences, setPreferences] = useState({
    thinkingBudget: 2048,
    devMode: false,
    autoScroll: true,
    globalMemory: true
  });

  const [apiConfigs, setApiConfigs] = useState<ApiKeyConfig[]>([]);
  const [showAddApi, setShowAddApi] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newApi, setNewApi] = useState<Omit<ApiKeyConfig, 'id' | 'status' | 'totalCalls' | 'errorCount' | 'successRate' | 'currentRpm' | 'enabled'>>({
    provider: 'gemini',
    key: '',
    scope: 'global',
    modelId: 'gemini-3-pro-preview',
    label: '',
    baseUrl: '',
    rpmLimit: 15,
    fallbackEnabled: false
  });
  
  // Database Settings
  const [dbStatus, setDbStatus] = useState(false);
  const [isEnvManaged, setIsEnvManaged] = useState(false);

  const [storageStats, setStorageStats] = useState({
    projects: 0,
    memories: 0,
    size: '0 KB'
  });

  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('devforge_prefs');
    if (saved) setPreferences(JSON.parse(saved));
    setApiConfigs(ApiConfigService.getConfigs());

    const projects = JSON.parse(localStorage.getItem('projects') || '[]');
    const memoryStore = JSON.parse(localStorage.getItem('devforge_memory_v1') || '{}');
    const totalChars = JSON.stringify(projects).length + JSON.stringify(memoryStore).length;
    setStorageStats({
      projects: projects.length,
      memories: Object.keys(memoryStore).length,
      size: `${(totalChars / 1024).toFixed(2)} KB`
    });

    // Check DB status on mount
    const hasFirebase = !!import.meta.env.VITE_FIREBASE_API_KEY;
    setDbStatus(hasFirebase);
    setIsEnvManaged(hasFirebase);
  }, []);

  const savePref = (key: string, value: any) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    localStorage.setItem('devforge_prefs', JSON.stringify(newPrefs));
  };

  const showNotification = (msg: string) => {
    setNotification({ msg, type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddApi = () => {
    if (!newApi.label || !newApi.modelId) return;
    if (newApi.provider !== 'ollama' && !newApi.key) return;

    ApiConfigService.saveConfig(newApi);
    setApiConfigs(ApiConfigService.getConfigs());
    setShowAddApi(false);
    setNewApi({ provider: 'gemini', key: '', scope: 'global', modelId: 'gemini-3-pro-preview', label: '', baseUrl: '', rpmLimit: 15, fallbackEnabled: false });
    showNotification("API Connection established.");
  };

  const handleBulkAdd = () => {
    const lines = bulkText.split('\n').filter(l => l.trim());
    if (lines.length > 15) {
      alert("Max 15 keys at once.");
      return;
    }

    const configs = lines.map(line => {
      const [key, label, scope] = line.split(',').map(s => s.trim());
      return {
        provider: newApi.provider,
        key: key || '',
        label: label || `Key ${Math.random().toString(36).substr(2, 4)}`,
        scope: scope || 'global',
        modelId: newApi.modelId,
        rpmLimit: newApi.rpmLimit,
        fallbackEnabled: false
      };
    });

    ApiConfigService.saveBulk(configs);
    setApiConfigs(ApiConfigService.getConfigs());
    setBulkMode(false);
    setBulkText('');
    showNotification(`${configs.length} keys added.`);
  };

  const handleToggleKey = (id: string, enabled: boolean) => {
    ApiConfigService.updateConfig(id, { enabled });
    setApiConfigs(ApiConfigService.getConfigs());
  };

  const handleResetCooldown = (id: string) => {
    ApiConfigService.updateConfig(id, { status: 'idle', cooldownUntil: undefined });
    setApiConfigs(ApiConfigService.getConfigs());
    showNotification("Cooldown reset.");
  };

  const handleRemoveApi = (id: string) => {
    ApiConfigService.removeConfig(id);
    setApiConfigs(ApiConfigService.getConfigs());
    showNotification("Connection removed.");
  };

  const getModelHint = (provider: ApiProvider) => {
    switch(provider) {
      case 'openrouter': return 'Format: provider/model (e.g. meta-llama/llama-3-70b-instruct)';
      case 'openai': return 'e.g. gpt-4o, gpt-4-turbo';
      case 'anthropic': return 'e.g. claude-3-5-sonnet-20240620';
      case 'gemini': return 'e.g. gemini-3-pro-preview, gemini-3-flash-preview';
      case 'ollama': return 'e.g. llama3, mistral, deepseek-r1';
      default: return '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-8 bg-zinc-800 border border-green-500/30 text-white px-4 py-2 rounded-lg shadow-2xl flex items-center gap-2 z-50 animate-fade-in">
          <Check size={16} className="text-green-500" />
          {notification.msg}
        </div>
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Sliders className="text-orange-500" /> Settings
        </h1>
        <p className="text-zinc-400">Configure your neural engine, connections, and storage preferences.</p>
      </div>

      {/* --- DATABASE SETTINGS --- */}
      <Section title="Database & Storage" icon={Database} description="Data persistence status.">
        <Card className={`border-2 transition-colors ${dbStatus ? 'border-orange-500/20 bg-orange-500/5' : 'border-zinc-800'}`}>
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${dbStatus ? 'bg-orange-500/10 text-orange-500' : 'bg-zinc-800 text-zinc-500'}`}>
                   <Database size={24} />
                </div>
                <div>
                   <h3 className="font-bold text-white">Firebase Firestore</h3>
                   <div className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${dbStatus ? 'bg-orange-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                      <span className={dbStatus ? 'text-orange-400' : 'text-zinc-500'}>
                        {dbStatus 
                          ? 'Connected (Environment Managed)' 
                          : 'Disconnected (Missing Config)'}
                      </span>
                   </div>
                </div>
             </div>
             {dbStatus && (
               <Badge color="orange">Auto-Managed</Badge>
             )}
          </div>
        </Card>
      </Section>

      {/* --- API CONNECTIONS --- */}
      <Section title="Model Connections" icon={Cpu} description="Manage LLM providers and API keys for specific agents.">
        
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Card className="p-3 flex flex-col items-center justify-center bg-zinc-900/30">
            <span className="text-xl font-bold text-white">{apiConfigs.length}</span>
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Total Keys</span>
          </Card>
          <Card className="p-3 flex flex-col items-center justify-center bg-zinc-900/30">
            <span className="text-xl font-bold text-green-500">{apiConfigs.filter(k => k.status === 'idle').length}</span>
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Available</span>
          </Card>
          <Card className="p-3 flex flex-col items-center justify-center bg-zinc-900/30">
            <span className="text-xl font-bold text-orange-500">{apiConfigs.filter(k => k.status === 'rate_limited').length}</span>
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Rate Limited</span>
          </Card>
          <Card className="p-3 flex flex-col items-center justify-center bg-zinc-900/30">
            <span className="text-xl font-bold text-blue-500">{apiConfigs.filter(k => k.scope === 'global').length}</span>
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Global Pool</span>
          </Card>
        </div>

        {/* Existing Configs */}
        <div className="grid gap-3">
           {apiConfigs.map(config => (
             <Card key={config.id} className={`group relative overflow-hidden transition-all border-l-4 ${
               !config.enabled ? 'opacity-50 border-zinc-700' : 
               config.status === 'rate_limited' ? 'border-orange-500' :
               config.status === 'in_use' ? 'border-blue-500' :
               'border-green-500'
             }`}>
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      config.provider === 'gemini' ? 'bg-blue-500/10 text-blue-400' :
                      config.provider === 'openai' ? 'bg-green-500/10 text-green-400' :
                      config.provider === 'anthropic' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {config.provider === 'gemini' && <Zap size={20} />}
                      {config.provider === 'openai' && <Brain size={20} />}
                      {config.provider === 'anthropic' && <Activity size={20} />}
                      {config.provider === 'ollama' && <Terminal size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{config.label}</h4>
                        <span className="text-[10px] font-mono text-zinc-600">{config.key.substring(0, 8)}...</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge color={config.status === 'idle' ? 'green' : config.status === 'rate_limited' ? 'orange' : 'blue'}>
                          {config.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                          {config.provider} • {config.modelId}
                        </span>
                        {config.scope !== 'global' ? (
                          <Badge color="purple" className="text-[9px] px-1.5 py-0">Agent: {config.scope}</Badge>
                        ) : (
                          <Badge color="blue" className="text-[9px] px-1.5 py-0">Global Pool</Badge>
                        )}
                        {config.scope !== 'global' && (
                          <button 
                            onClick={() => {
                              ApiConfigService.updateConfig(config.id, { fallbackEnabled: !config.fallbackEnabled });
                              setApiConfigs(ApiConfigService.getConfigs());
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${config.fallbackEnabled ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}
                            title="If personal key fails, use Global Pool"
                          >
                            Fallback: {config.fallbackEnabled ? 'ON' : 'OFF'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden md:flex flex-col items-end mr-4 text-right">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase">Success Rate</div>
                      <div className={`text-xs font-mono font-bold ${config.successRate > 90 ? 'text-green-400' : 'text-orange-400'}`}>
                        {config.successRate}% ({config.totalCalls} calls)
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {config.status === 'rate_limited' && (
                        <button 
                          onClick={() => handleResetCooldown(config.id)}
                          className="p-2 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                          title="Reset Cooldown"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleToggleKey(config.id, !config.enabled)}
                        className={`p-2 rounded-lg transition-colors ${config.enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-zinc-500 hover:bg-zinc-500/10'}`}
                        title={config.enabled ? "Disable" : "Enable"}
                      >
                        <Power size={16} />
                      </button>
                      <button 
                        onClick={() => handleRemoveApi(config.id)} 
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Progress bar for RPM if limit exists */}
                {config.rpmLimit && config.enabled && (
                  <div className="h-1 bg-zinc-800 w-full mt-auto">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500" 
                      style={{ width: `${Math.min((config.currentRpm / config.rpmLimit) * 100, 100)}%` }}
                    />
                  </div>
                )}
             </Card>
           ))}
           {apiConfigs.length === 0 && (
             <div className="text-center py-10 border-2 border-dashed border-zinc-800 rounded-xl">
               <Key className="mx-auto text-zinc-700 mb-2" size={32} />
               <p className="text-zinc-500 text-sm">No API keys connected yet.</p>
             </div>
           )}
        </div>

        {/* Add New Button */}
        {!showAddApi ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => { setShowAddApi(true); setBulkMode(false); }} className="border-dashed py-4 text-zinc-400 hover:text-white hover:border-zinc-600">
              <Plus size={16} /> Single Key
            </Button>
            <Button variant="outline" onClick={() => { setShowAddApi(true); setBulkMode(true); }} className="border-dashed py-4 text-zinc-400 hover:text-white hover:border-zinc-600">
              <Layers size={16} /> Bulk Add (Max 15)
            </Button>
          </div>
        ) : (
          <Card className="animate-fade-in border-orange-500/30">
             <div className="flex justify-between items-center mb-4">
               <h4 className="font-bold text-white">{bulkMode ? 'Bulk Key Addition' : 'New Connection'}</h4>
               <button onClick={() => setShowAddApi(false)}><Key size={16} className="text-zinc-500" /></button>
             </div>
             
             <div className="grid gap-4">
                <div className="grid md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase">Provider</label>
                      <select 
                        value={newApi.provider}
                        onChange={(e) => setNewApi({...newApi, provider: e.target.value as ApiProvider})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="ollama">Ollama (Local)</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase">Model ID</label>
                      <input 
                        type="text"
                        value={newApi.modelId}
                        onChange={(e) => setNewApi({...newApi, modelId: e.target.value})}
                        placeholder={getModelHint(newApi.provider)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                   </div>
                </div>

                {bulkMode ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-zinc-400 uppercase">Bulk Input (CSV Format)</label>
                      <span className="text-[10px] text-zinc-500">Format: key, label, scope</span>
                    </div>
                    <textarea 
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="sk-..., Key 1, global&#10;sk-..., Key 2, Vikram&#10;sk-..., Key 3, Neha"
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none font-mono"
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-400 uppercase">Label (Name)</label>
                          <input 
                            type="text"
                            value={newApi.label}
                            onChange={(e) => setNewApi({...newApi, label: e.target.value})}
                            placeholder="My Pro Key"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-400 uppercase">Scope (Agent)</label>
                          <AgentSelect 
                            value={newApi.scope}
                            onChange={(val) => setNewApi({...newApi, scope: val})}
                          />
                          {newApi.scope !== 'global' && (
                            <div className="flex items-center gap-2 mt-2">
                              <input 
                                type="checkbox" 
                                id="fallback"
                                checked={newApi.fallbackEnabled}
                                onChange={(e) => setNewApi({...newApi, fallbackEnabled: e.target.checked})}
                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-orange-500 focus:ring-orange-500"
                              />
                              <label htmlFor="fallback" className="text-xs text-zinc-400 cursor-pointer select-none">
                                Fallback to Global Pool if busy
                              </label>
                            </div>
                          )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase">API Key</label>
                      <input 
                          type="password"
                          value={newApi.key}
                          onChange={(e) => setNewApi({...newApi, key: e.target.value})}
                          placeholder="sk-..."
                          disabled={newApi.provider === 'ollama'}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50"
                      />
                    </div>
                  </>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase">RPM Limit</label>
                    <input 
                      type="number"
                      value={newApi.rpmLimit || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setNewApi({...newApi, rpmLimit: isNaN(val) ? 0 : val});
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                  {newApi.provider === 'ollama' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase">Base URL</label>
                      <input 
                          type="text"
                          value={newApi.baseUrl}
                          onChange={(e) => setNewApi({...newApi, baseUrl: e.target.value})}
                          placeholder="http://localhost:11434/v1"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-2">
                   <Button variant="secondary" onClick={() => setShowAddApi(false)}>Cancel</Button>
                   <Button onClick={bulkMode ? handleBulkAdd : handleAddApi}>
                     {bulkMode ? `Add ${bulkText.split('\n').filter(l => l.trim()).length} Keys` : 'Save Connection'}
                   </Button>
                </div>
             </div>
          </Card>
        )}
      </Section>

      {/* --- PREFERENCES --- */}
      <Section title="Engine Preferences" icon={Sliders} description="Fine-tune how the neural engine behaves.">
         <Card className="divide-y divide-zinc-800">
            <div className="flex items-center justify-between py-4 first:pt-0">
               <div className="flex gap-3 items-center">
                  <Brain className="text-zinc-500" size={20} />
                  <div>
                    <div className="font-medium text-white">Thinking Budget (Tokens)</div>
                    <div className="text-xs text-zinc-500">Max tokens allocated for Gemini 2.0 reasoning.</div>
                  </div>
               </div>
               <select 
                 value={preferences.thinkingBudget}
                 onChange={(e) => savePref('thinkingBudget', parseInt(e.target.value))}
                 className="bg-zinc-900 border border-zinc-800 text-sm rounded-lg px-3 py-1 text-white outline-none focus:border-orange-500"
               >
                 <option value="0">Disabled (Fastest)</option>
                 <option value="1024">1k (Balanced)</option>
                 <option value="2048">2k (Standard)</option>
                 <option value="4096">4k (Deep)</option>
                 <option value="8192">8k (Maximum)</option>
               </select>
            </div>

            <div className="flex items-center justify-between py-4">
               <div className="flex gap-3 items-center">
                  <Terminal className="text-zinc-500" size={20} />
                  <div>
                    <div className="font-medium text-white">Developer Mode</div>
                    <div className="text-xs text-zinc-500">Show raw JSON outputs and system prompts in chat.</div>
                  </div>
               </div>
               <Toggle checked={preferences.devMode} onChange={() => savePref('devMode', !preferences.devMode)} />
            </div>

            <div className="flex items-center justify-between py-4 last:pb-0">
               <div className="flex gap-3 items-center">
                  <MousePointer2 className="text-zinc-500" size={20} />
                  <div>
                    <div className="font-medium text-white">Auto-Scroll Chat</div>
                    <div className="text-xs text-zinc-500">Automatically scroll to bottom when agents generate text.</div>
                  </div>
               </div>
               <Toggle checked={preferences.autoScroll} onChange={() => savePref('autoScroll', !preferences.autoScroll)} />
            </div>
         </Card>
      </Section>

      {/* --- DATA MANAGEMENT --- */}
      <Section title="Data & Storage" icon={HardDrive} description="Manage local browser storage and cache.">
         <div className="grid md:grid-cols-3 gap-4 mb-4">
            <Card className="flex flex-col items-center justify-center py-6">
               <span className="text-2xl font-bold text-white">{storageStats.projects}</span>
               <span className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Projects</span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-6">
               <span className="text-2xl font-bold text-white">{storageStats.memories}</span>
               <span className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Memory Nodes</span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-6">
               <span className="text-2xl font-bold text-white">{storageStats.size}</span>
               <span className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Local Storage</span>
            </Card>
         </div>
         
         <Card className="border-red-500/10">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                     <h4 className="font-bold text-white">Factory Reset</h4>
                     <p className="text-xs text-zinc-500">Clear all projects, settings, and memories.</p>
                  </div>
               </div>
               <Button 
                 variant="outline" 
                 onClick={() => {
                   if(confirm('Are you absolutely sure? This cannot be undone.')) {
                     localStorage.clear();
                     window.location.reload();
                   }
                 }}
                 className="text-red-400 hover:bg-red-500/10 border-red-500/20"
               >
                 Clear Data
               </Button>
            </div>
         </Card>
      </Section>

    </div>
  );
};

export default Settings;
