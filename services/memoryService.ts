
import { IdbStorage } from './idbStorage';

export type MemoryType = 'rule' | 'pattern' | 'anti-pattern';

export interface MemoryItem {
  id: string;
  type: MemoryType;
  content: string;
  domain?: string; 
  timestamp: number;
  useCount: number;
}

export interface LearningLog {
  id: string;
  timestamp: number;
  summary: string;
}

export interface AgentStats {
  level: number;
  xp: number;
  maxXp: number;
  skillCounts: Record<string, number>;
  badges: string[];
}

export interface AgentMemoryStore {
  agentId: string;
  isEnabled: boolean;
  stats: AgentStats;
  rules: MemoryItem[];
  patterns: MemoryItem[];
  antiPatterns: MemoryItem[];
  logs?: LearningLog[];
}

// Fix: Added missing Badge interface exported for AgentDashboard
export interface Badge {
  name: string;
  description: string;
  icon: string;
}

// Fix: Added missing AGENT_BADGES mapping exported for AgentDashboard
export const AGENT_BADGES: Record<string, Badge> = {
  'Code': { name: 'Code Expert', description: 'Advanced code generation and review.', icon: 'Code' },
  'Zap': { name: 'Efficiency Pro', description: 'Fast task completion.', icon: 'Zap' },
  'Shield': { name: 'Security Auditor', description: 'Deep vulnerability scanning.', icon: 'Shield' },
  'Hexagon': { name: 'Architecture Master', description: 'Complex system design.', icon: 'Hexagon' },
  'Star': { name: 'Visionary', description: 'Innovative product leadership.', icon: 'Star' }
};

const STORAGE_KEY = 'devforge_memory_v1';
const IDB_RULES_KEY = 'devforge_vector_memory';

const createEmptyMemory = (agentId: string): AgentMemoryStore => ({
  agentId, isEnabled: true, stats: { level: 1, xp: 0, maxXp: 1000, skillCounts: {}, badges: [] },
  rules: [], patterns: [], antiPatterns: []
});

export class MemoryController {
  private static memoryCache: Record<string, AgentMemoryStore> = {};
  private static initialized = false;

  static async initialize() {
    if (this.initialized) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.keys(parsed).forEach(k => this.memoryCache[k] = parsed[k]);
    }
    this.initialized = true;
  }

  static getAgentMemory(agentId: string): AgentMemoryStore {
    if (!this.initialized) this.initialize();
    if (!this.memoryCache[agentId]) this.memoryCache[agentId] = createEmptyMemory(agentId);
    return this.memoryCache[agentId];
  }

  static toggleMemory(agentId: string) {
    const mem = this.getAgentMemory(agentId);
    mem.isEnabled = !mem.isEnabled;
    this.saveStats();
    return mem.isEnabled;
  }

  static async clearMemory(agentId: string) {
    this.memoryCache[agentId] = createEmptyMemory(agentId);
    this.saveStats();
  }

  static async retrieveRelevantContext(agentId: string, query: string): Promise<string> {
    const mem = this.getAgentMemory(agentId);
    if (!mem.isEnabled) return "";
    let context = `\n[NEURAL MEMORY: ${agentId}]\n`;
    const items = [...mem.rules, ...mem.patterns].slice(0, 5);
    items.forEach(i => context += `- [${i.type}] ${i.content}\n`);
    return context;
  }

  private static saveStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memoryCache));
  }

  static addExperience(agentId: string, amount: number, skillsUsed: string[]) {
    const mem = this.getAgentMemory(agentId);
    mem.stats.xp += amount;
    if (mem.stats.xp >= mem.stats.maxXp) {
      mem.stats.level += 1;
      mem.stats.xp -= mem.stats.maxXp;
      mem.stats.maxXp = Math.floor(mem.stats.maxXp * 1.5);
    }
    this.saveStats();
  }

  static async learn(agentId: string, type: MemoryType, content: string) {
    const mem = this.getAgentMemory(agentId);
    const newItem: MemoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      type, content: content.trim(), timestamp: Date.now(), useCount: 0
    };
    if (type === 'rule') mem.rules.unshift(newItem);
    else if (type === 'pattern') mem.patterns.unshift(newItem);
    else mem.antiPatterns.unshift(newItem);
    this.saveStats();
  }
}

export class GlobalMemoryController {
  private static getGlobalStore() {
    const s = localStorage.getItem('devforge_global_memory_v1');
    return s ? JSON.parse(s) : { rules: [], patterns: [], antiPatterns: [], logs: [] };
  }

  static learn(type: MemoryType, content: string, domain = 'general') {
    const s = this.getGlobalStore();
    s.rules.unshift({ content, domain, timestamp: Date.now() });
    localStorage.setItem('devforge_global_memory_v1', JSON.stringify(s));
  }

  static logEvent(summary: string) {
    const s = this.getGlobalStore();
    s.logs.unshift({ id: Math.random().toString(), timestamp: Date.now(), summary });
    localStorage.setItem('devforge_global_memory_v1', JSON.stringify(s));
  }

  static retrieveContext() {
    const s = this.getGlobalStore();
    return s.rules.length ? `[GLOBAL RULES]: ${s.rules.slice(0,3).map((r:any)=>r.content).join('; ')}` : "";
  }

  static getFullStore() { return this.getGlobalStore(); }
}
