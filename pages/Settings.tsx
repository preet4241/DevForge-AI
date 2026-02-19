
import React, { useState, useEffect } from 'react';
import { 
  Cpu, Database, Trash2, Shield, Zap, Monitor, 
  HardDrive, AlertTriangle, Check, Terminal,
  Brain, Sliders, Eraser, Activity, Lock, Plus, Key, Globe, User, ExternalLink, Eye, EyeOff, Globe2, ChevronRight, MousePointer2
} from 'lucide-react';
import { Card, Button, Badge, Tooltip } from '../components/UI';
import { ApiConfigService, ApiKeyConfig, ApiProvider } from '../services/apiConfigService';
import { DbClient } from '../database/client';

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

const Settings = () => {
  const [preferences, setPreferences] = useState({
    thinkingBudget: 2048,
    devMode: false,
    autoScroll: true,
    globalMemory: true
  });

  const [apiConfigs, setApiConfigs] = useState<ApiKeyConfig[]>([]);
  const [showAddApi, setShowAddApi] = useState(false);
  const [newApi, setNewApi] = useState<Omit<ApiKeyConfig, 'id'>>({
    provider: 'gemini',
    key: '',
    scope: 'global',
    modelId: 'gemini-3-pro-preview',
    label: '',
    baseUrl: ''
  });
  
  // Database Settings
  const [dbConfig, setDbConfig] = useState(DbClient.getConfig());
  const [dbStatus, setDbStatus] = useState(DbClient.isEnabled());
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
    setDbStatus(DbClient.isEnabled());
    setIsEnvManaged(DbClient.isEnvManaged());
    setDbConfig(DbClient.getConfig());
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
    setNewApi({ provider: 'gemini', key: '', scope: 'global', modelId: 'gemini-3-pro-preview', label: '', baseUrl: '' });
    showNotification("API Connection established.");
  };

  const handleRemoveApi = (id: string) => {
    ApiConfigService.removeConfig(id);
    setApiConfigs(ApiConfigService.getConfigs());
    showNotification("Connection removed.");
  };

  const handleDbSave = () => {
    if (!dbConfig.url || !dbConfig.key) {
      alert("Please enter both URL and API Key");
      return;
    }
    DbClient.saveConfig(dbConfig.url, dbConfig.key);
    setDbStatus(DbClient.isEnabled());
    setIsEnvManaged(false);
    showNotification("Database Settings Saved & Connected");
  };

  const handleDbDisconnect = () => {
    if (isEnvManaged) return;
    DbClient.disable();
    setDbConfig({ ...dbConfig, enabled: false });
    setDbStatus(false);
    showNotification("Database Disconnected");
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
      <Section title="PostgreSQL Database" icon={Database} description="Connect to Supabase to persist projects and logs across sessions.">
        <Card className={`border-2 transition-colors ${dbStatus ? 'border-green-500/20 bg-green-500/5' : 'border-zinc-800'}`}>
          <div className="flex justify-between items-start mb-6">
             <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${dbStatus ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-500'}`}>
                   <Database size={24} />
                </div>
                <div>
                   <h3 className="font-bold text-white">Supabase Connection</h3>
                   <div className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${dbStatus ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                      <span className={dbStatus ? 'text-green-400' : 'text-zinc-500'}>
                        {dbStatus 
                          ? (isEnvManaged ? 'Connected automatically (Hosting Provider)' : 'Connected (Manual)') 
                          : 'Disconnected (Using LocalStorage)'}
                      </span>
                   </div>
                </div>
             </div>
             {dbStatus && !isEnvManaged && (
               <Button variant="outline" onClick={handleDbDisconnect} className="text-xs h-8 border-red-500/30 text-red-400 hover:bg-red-500/10">
                 Disconnect
               </Button>
             )}
             {isEnvManaged && (
               <Badge color="green">Auto-Managed</Badge>
             )}
          </div>

          <div className="space-y-4">
             <div className="grid md:grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-xs font-bold text-zinc-400 uppercase">Project URL</label>
                 <input 
                   type="text"
                   value={dbConfig.url}
                   onChange={(e) => setDbConfig({...dbConfig, url: e.target.value})}
                   placeholder="https://xyz.supabase.co"
                   disabled={isEnvManaged}
                   className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-green-500/50 outline-none placeholder:text-zinc-600 ${isEnvManaged ? 'opacity-50 cursor-not-allowed' : ''}`}
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold text-zinc-400 uppercase">API Key (Anon/Public)</label>
                 <div className="relative">
                   <input 
                     type="password"
                     value={isEnvManaged ? '••••••••••••••••' : dbConfig.key}
                     onChange={(e) => setDbConfig({...dbConfig, key: e.target.value})}
                     placeholder="eyJhbGciOiJIUzI1NiIsInR5c..."
                     disabled={isEnvManaged}
                     className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-green-500/50 outline-none placeholder:text-zinc-600 ${isEnvManaged ? 'opacity-50 cursor-not-allowed' : ''}`}
                   />
                 </div>
               </div>
             </div>
             
             {!dbStatus && !isEnvManaged && (
               <div className="flex justify-end pt-2">
                  <Button onClick={handleDbSave} className="bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20">
                     Connect Database
                  </Button>
               </div>
             )}
          </div>
        </Card>
      </Section>

      {/* --- API CONNECTIONS --- */}
      <Section title="Model Connections" icon={Cpu} description="Manage LLM providers and API keys for specific agents.">
        
        {/* Existing Configs */}
        <div className="grid gap-4">
           {apiConfigs.map(config => (
             <Card key={config.id} className="flex items-center justify-between p-4 bg-zinc-900/50">
                <div className="flex items-center gap-4">
                   <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                     {config.provider === 'gemini' && <Zap size={20} className="text-blue-400" />}
                     {config.provider === 'openai' && <Brain size={20} className="text-green-400" />}
                     {config.provider === 'anthropic' && <Activity size={20} className="text-amber-400" />}
                     {config.provider === 'ollama' && <Terminal size={20} className="text-white" />}
                   </div>
                   <div>
                      <h4 className="font-bold text-white text-sm">{config.label}</h4>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                         <Badge>{config.provider}</Badge>
                         <span>{config.modelId}</span>
                         {config.scope !== 'global' && <Badge color="purple">Agent: {config.scope}</Badge>}
                      </div>
                   </div>
                </div>
                <button onClick={() => handleRemoveApi(config.id)} className="text-zinc-500 hover:text-red-400 p-2">
                  <Trash2 size={16} />
                </button>
             </Card>
           ))}
        </div>

        {/* Add New Button */}
        {!showAddApi ? (
          <Button variant="outline" onClick={() => setShowAddApi(true)} className="border-dashed w-full py-4 text-zinc-400 hover:text-white hover:border-zinc-600">
            <Plus size={16} /> Add New Connection
          </Button>
        ) : (
          <Card className="animate-fade-in border-orange-500/30">
             <div className="flex justify-between items-center mb-4">
               <h4 className="font-bold text-white">New Connection</h4>
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
                      <label className="text-xs font-bold text-zinc-400 uppercase">Label (Name)</label>
                      <input 
                        type="text"
                        value={newApi.label}
                        onChange={(e) => setNewApi({...newApi, label: e.target.value})}
                        placeholder="My Pro Key"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                      />
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

                <div className="grid md:grid-cols-2 gap-4">
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
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase">Scope</label>
                      <select 
                        value={newApi.scope}
                        onChange={(e) => setNewApi({...newApi, scope: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 outline-none"
                      >
                        <option value="global">Global (Default)</option>
                        <option value="Cipher">Cipher (Red Team)</option>
                        <option value="Sanya">Sanya (Research)</option>
                        <option value="Rohit">Rohit (Architect)</option>
                        <option value="Vikram">Vikram (Backend)</option>
                      </select>
                   </div>
                </div>

                <div className="flex justify-end gap-3 mt-2">
                   <Button variant="secondary" onClick={() => setShowAddApi(false)}>Cancel</Button>
                   <Button onClick={handleAddApi}>Save Connection</Button>
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
