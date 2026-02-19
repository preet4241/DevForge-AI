
export type ApiProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama';

export interface ApiKeyConfig {
  id: string;
  provider: ApiProvider;
  key: string;
  scope: 'global' | string; // 'global' or Agent name
  modelId: string;         // e.g., 'gpt-4o', 'anthropic/claude-3.5-sonnet', 'llama3'
  baseUrl?: string;        // Optional override for local LLMs (e.g. http://localhost:11434/v1)
  label: string;
}

const STORAGE_KEY = 'devforge_api_registry';

export class ApiConfigService {
  static getConfigs(): ApiKeyConfig[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static saveConfig(config: Omit<ApiKeyConfig, 'id'>) {
    const configs = this.getConfigs();
    const newConfig = {
      ...config,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4)
    };
    configs.push(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    return newConfig;
  }

  static removeConfig(id: string) {
    const configs = this.getConfigs().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  }

  static getConfigForAgent(agentName: string, preferredProvider?: ApiProvider): ApiKeyConfig | undefined {
    const configs = this.getConfigs();
    
    // 1. Check for agent-specific key
    const agentSpecific = configs.find(c => c.scope === agentName && (!preferredProvider || c.provider === preferredProvider));
    if (agentSpecific) return agentSpecific;

    // 2. Check for global custom key
    const globalKey = configs.find(c => c.scope === 'global' && (!preferredProvider || c.provider === preferredProvider));
    return globalKey;
  }
}
