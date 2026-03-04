
export type ApiProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama';

export type KeyStatus = 'idle' | 'in_use' | 'rate_limited' | 'exhausted';

export interface ApiKeyConfig {
  id: string;
  provider: ApiProvider;
  key: string;
  scope: 'global' | string; // 'global' or Agent name
  modelId: string;         // e.g., 'gpt-4o', 'anthropic/claude-3.5-sonnet', 'llama3'
  baseUrl?: string;        // Optional override for local LLMs
  label: string;
  enabled: boolean;
  
  // Status & Stats
  status: KeyStatus;
  lastUsed?: number;
  cooldownUntil?: number;
  totalCalls: number;
  errorCount: number;
  successRate: number;
  
  // Rate Limits
  rpmLimit?: number;
  rpdLimit?: number;
  currentRpm: number;
  rpmWindowStart?: number;

  // Fallback Logic
  fallbackEnabled?: boolean; // If true, use global pool when this key is busy/limited
}

const STORAGE_KEY = 'devforge_api_registry';

export class ApiConfigService {
  static getConfigs(): ApiKeyConfig[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static saveConfig(config: Omit<ApiKeyConfig, 'id' | 'status' | 'totalCalls' | 'errorCount' | 'successRate' | 'currentRpm' | 'enabled'>) {
    const configs = this.getConfigs();
    const newConfig: ApiKeyConfig = {
      ...config,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      enabled: true,
      status: 'idle',
      totalCalls: 0,
      errorCount: 0,
      successRate: 100,
      currentRpm: 0
    };
    configs.push(newConfig);
    this.saveAll(configs);
    return newConfig;
  }

  static saveBulk(configs: Omit<ApiKeyConfig, 'id' | 'status' | 'totalCalls' | 'errorCount' | 'successRate' | 'currentRpm' | 'enabled'>[]) {
    const existing = this.getConfigs();
    const newConfigs = configs.map(c => ({
      ...c,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      enabled: true,
      status: 'idle' as KeyStatus,
      totalCalls: 0,
      errorCount: 0,
      successRate: 100,
      currentRpm: 0
    }));
    this.saveAll([...existing, ...newConfigs]);
  }

  static updateConfig(id: string, updates: Partial<ApiKeyConfig>) {
    const configs = this.getConfigs();
    const index = configs.findIndex(c => c.id === id);
    if (index !== -1) {
      configs[index] = { ...configs[index], ...updates };
      this.saveAll(configs);
    }
  }

  static saveAll(configs: ApiKeyConfig[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  }

  static removeConfig(id: string) {
    const configs = this.getConfigs().filter(c => c.id !== id);
    this.saveAll(configs);
  }

  static getConfigForAgent(agentName: string, preferredProvider?: ApiProvider): ApiKeyConfig | undefined {
    const configs = this.getConfigs().filter(c => c.enabled);
    
    // 1. Check for agent-specific key
    const agentSpecific = configs.find(c => c.scope === agentName && (!preferredProvider || c.provider === preferredProvider));
    if (agentSpecific) return agentSpecific;

    // 2. Check for global custom key
    const globalKey = configs.find(c => c.scope === 'global' && (!preferredProvider || c.provider === preferredProvider));
    return globalKey;
  }
}
