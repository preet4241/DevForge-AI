
import { MemoryItem, MemoryType } from '../types';
import { getEmbedding } from './geminiService';
import { db } from './firebase';
import { collection, getDocs, addDoc, query, where, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export interface LearningLog {
  id: string;
  timestamp: number;
  summary: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  description: string;
  promptMod: string; // The "Elite Instruction" added to the LLM
}

export interface AgentStats {
  level: number;
  xp: number;
  maxXp: number;
  skillCounts: Record<string, number>; // e.g., { 'python': 5, 'react': 10 }
  badges: string[]; // List of Badge IDs
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

const STORAGE_KEY = 'devforge_memory_v1';

// --- BADGE DEFINITIONS ---
export const AGENT_BADGES: Record<string, Badge> = {
  'python_master': {
    id: 'python_master',
    name: 'Python Cobra',
    icon: 'Code',
    description: 'Built 5+ Python backends.',
    promptMod: 'You are a Python Grandmaster. Use advanced typing, decorators, context managers, and efficient list comprehensions. Prefer Pydantic models.'
  },
  'react_wizard': {
    id: 'react_wizard',
    name: 'React Wizard',
    icon: 'Zap',
    description: 'Created 5+ React interfaces.',
    promptMod: 'You are a React Specialist. Always use custom hooks, efficient memoization, and atomic component structure.'
  },
  'security_guardian': {
    id: 'security_guardian',
    name: 'Iron Guardian',
    icon: 'Shield',
    description: 'Conducted 10+ Security Audits.',
    promptMod: 'Your paranoia level is maxed. Assume every input is an attack. Suggest OWASP Top 10 mitigations for every endpoint.'
  },
  'architect_prime': {
    id: 'architect_prime',
    name: 'Architect Prime',
    icon: 'Hexagon',
    description: 'Designed 5+ System Architectures.',
    promptMod: 'You see the matrix. Focus on microservices, event-driven patterns, and infinite scalability.'
  },
  'veteran': {
    id: 'veteran',
    name: 'Veteran',
    icon: 'Star',
    description: 'Reached Level 5.',
    promptMod: 'You are highly experienced. Be concise, authoritative, and extremely technically accurate.'
  }
};

const createEmptyMemory = (agentId: string): AgentMemoryStore => ({
  agentId, 
  isEnabled: true, 
  stats: {
    level: 1,
    xp: 0,
    maxXp: 1000,
    skillCounts: {},
    badges: []
  },
  rules: [], 
  patterns: [], 
  antiPatterns: []
});

const INITIAL_MEMORY: Record<string, AgentMemoryStore> = {
  Aarav: createEmptyMemory('Aarav'),
  Sanya: createEmptyMemory('Sanya'),
  Arjun: createEmptyMemory('Arjun'),
  Rohit: createEmptyMemory('Rohit'),
  Vikram: createEmptyMemory('Vikram'),
  Neha: createEmptyMemory('Neha'),
  Kunal: createEmptyMemory('Kunal'),
  Pooja: createEmptyMemory('Pooja'),
  Cipher: createEmptyMemory('Cipher'),
  Shadow: createEmptyMemory('Shadow'),
  // Expanded Team...
  Priya: createEmptyMemory('Priya'),
  Riya: createEmptyMemory('Riya'),
  Aditya: createEmptyMemory('Aditya'),
  Meera: createEmptyMemory('Meera'),
  Karan: createEmptyMemory('Karan'),
  Ananya: createEmptyMemory('Ananya'),
  Dev: createEmptyMemory('Dev'),
  Aryan: createEmptyMemory('Aryan'),
  Zara: createEmptyMemory('Zara'),
  Kabir: createEmptyMemory('Kabir'),
  Ishan: createEmptyMemory('Ishan'),
  Naina: createEmptyMemory('Naina'),
  Vivaan: createEmptyMemory('Vivaan'),
  Tara: createEmptyMemory('Tara'),
  Maya: createEmptyMemory('Maya'), // Live Preview Agent
  Rudra: createEmptyMemory('Rudra'),
  Kavya: createEmptyMemory('Kavya'),
  Dhruv: createEmptyMemory('Dhruv'),
  Nyaya: createEmptyMemory('Nyaya'),
  Sarva: createEmptyMemory('Sarva'),
  Kuber: createEmptyMemory('Kuber')
};

// --- VECTOR MATH ---
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

// --- CONTROLLERS ---

export class MemoryController {
  
  // Cache for UI sync
  private static memoryCache: Record<string, AgentMemoryStore> = INITIAL_MEMORY;
  private static initialized = false;

  static async initialize() {
    if (this.initialized) return;
    
    // 1. Load Stats/XP from LocalStorage (Sync/Fast)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge stats into cache
      Object.keys(parsed).forEach(key => {
        if (parsed[key]?.stats) {
          if (!this.memoryCache[key]) this.memoryCache[key] = createEmptyMemory(key);
          this.memoryCache[key].stats = parsed[key].stats;
          this.memoryCache[key].isEnabled = parsed[key].isEnabled;
        }
      });
    }

    // 2. Load Content from Firestore
    try {
      const memoriesRef = collection(db, 'agent_memories');
      const snapshot = await getDocs(memoriesRef);
      
      snapshot.forEach(doc => {
        const data = doc.data() as MemoryItem & { agentId: string };
        const agentId = data.agentId;
        
        if (agentId && this.memoryCache[agentId]) {
          const item: MemoryItem = {
            id: doc.id,
            type: data.type,
            content: data.content,
            timestamp: data.timestamp,
            useCount: data.useCount,
            embedding: data.embedding,
            domain: data.domain,
            scenarioContext: data.scenarioContext,
            critiqueTarget: data.critiqueTarget
          };

          if (item.type === 'rule') this.memoryCache[agentId].rules.push(item);
          else if (item.type === 'pattern') this.memoryCache[agentId].patterns.push(item);
          else if (item.type === 'anti-pattern') this.memoryCache[agentId].antiPatterns.push(item);
        }
      });
    } catch (e) {
      console.error("Failed to load vector memory from Firestore", e);
    }

    this.initialized = true;
  }

  // --- SYNC ACCESSORS FOR UI (Fast) ---
  
  static getAgentMemory(agentId: string): AgentMemoryStore {
    // If not initialized, trigger init but return default immediately to not block UI
    if (!this.initialized) this.initialize(); 
    
    if (!this.memoryCache[agentId]) {
      this.memoryCache[agentId] = createEmptyMemory(agentId);
    }
    return this.memoryCache[agentId];
  }

  static toggleMemory(agentId: string) {
    const mem = this.getAgentMemory(agentId);
    mem.isEnabled = !mem.isEnabled;
    this.saveStats();
    return mem.isEnabled;
  }

  static async clearMemory(agentId: string) {
    const mem = this.getAgentMemory(agentId);
    mem.rules = [];
    mem.patterns = [];
    mem.antiPatterns = [];
    
    // Delete from Firestore
    try {
      const memoriesRef = collection(db, 'agent_memories');
      const q = query(memoriesRef, where('agentId', '==', agentId));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (e) {
      console.error("Failed to clear memory from Firestore", e);
    }

    // Don't clear stats
    this.saveStats();
  }

  // --- RAG RETRIEVAL (Async) ---

  static async retrieveRelevantContext(agentId: string, query: string): Promise<string> {
    if (!this.initialized) await this.initialize();
    
    const mem = this.getAgentMemory(agentId);
    const globalContext = GlobalMemoryController.retrieveContext(); // keep global simple for now
    
    let context = globalContext;

    // Inject Badges/Levels
    if (mem.stats.badges.length > 0) {
        context += `\n[CAREER STATUS: Level ${mem.stats.level}]\n`;
        context += `EARNED BADGES (ACTIVE BUFFS):\n`;
        mem.stats.badges.forEach(bid => {
            const badge = AGENT_BADGES[bid];
            if (badge) context += `- ${badge.name}: ${badge.promptMod}\n`;
        });
    }

    if (!mem.isEnabled) return context;

    context += `\n\n[NEURAL MEMORY: ${agentId.toUpperCase()}]\n`;
    
    // Perform Vector Search
    const relevantItems = await this.vectorSearch(agentId, query);
    
    if (relevantItems.length > 0) {
      context += `RELEVANT LEARNED RULES (RAG):\n`;
      relevantItems.forEach(item => {
        context += `- [${item.type.toUpperCase()}] ${item.content} (Confidence: ${(item.similarity * 100).toFixed(0)}%)\n`;
      });
    } else {
      context += `(No relevant specific memories found for this context)\n`;
    }

    return context;
  }

  // --- INTERNAL LOGIC ---

  private static saveStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memoryCache));
  }

  private static async vectorSearch(agentId: string, query: string, topK: number = 5): Promise<(MemoryItem & { similarity: number })[]> {
    // 1. Get embedding for query
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) return []; // Fallback if embedding fails

    // 2. Search using In-Memory Cache (loaded from Firestore)
    const mem = this.getAgentMemory(agentId);
    const allItems = [...mem.rules, ...mem.patterns, ...mem.antiPatterns];
    
    const scoredItems = allItems.map(item => {
      if (!item.embedding || item.embedding.length === 0) return { ...item, similarity: 0 };
      return {
        ...item,
        similarity: cosineSimilarity(queryEmbedding, item.embedding)
      };
    });

    // Filter by threshold and sort
    return scoredItems
      .filter(item => item.similarity > 0.65) // Threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  static addExperience(agentId: string, amount: number, skillsUsed: string[]) {
      // Sync update cache
      const mem = this.getAgentMemory(agentId);
      
      mem.stats.xp += amount;
      
      if (mem.stats.xp >= mem.stats.maxXp) {
          mem.stats.level += 1;
          mem.stats.xp = mem.stats.xp - mem.stats.maxXp;
          mem.stats.maxXp = Math.floor(mem.stats.maxXp * 1.5);
          
          if (mem.stats.level >= 5 && !mem.stats.badges.includes('veteran')) {
              mem.stats.badges.push('veteran');
          }
      }

      skillsUsed.forEach(skill => {
          const lowerSkill = skill.toLowerCase();
          mem.stats.skillCounts[lowerSkill] = (mem.stats.skillCounts[lowerSkill] || 0) + 1;

          if ((lowerSkill.includes('python') || lowerSkill.includes('django') || lowerSkill.includes('flask')) 
               && mem.stats.skillCounts[lowerSkill] >= 5 
               && !mem.stats.badges.includes('python_master')) {
               mem.stats.badges.push('python_master');
          }

          if ((lowerSkill.includes('react') || lowerSkill.includes('frontend') || lowerSkill.includes('next')) 
               && mem.stats.skillCounts[lowerSkill] >= 5 
               && !mem.stats.badges.includes('react_wizard')) {
               mem.stats.badges.push('react_wizard');
          }
      });

      if (agentId === 'Rohit') {
         mem.stats.skillCounts['design'] = (mem.stats.skillCounts['design'] || 0) + 1;
         if (mem.stats.skillCounts['design'] >= 5 && !mem.stats.badges.includes('architect_prime')) {
             mem.stats.badges.push('architect_prime');
         }
      }

      // Save Stats Sync
      this.saveStats();
  }

  static async learn(agentId: string, type: MemoryType, content: string) {
    // 1. Generate Embedding
    const embedding = await getEmbedding(content);
    
    const newItem: MemoryItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      type,
      content: content.trim(),
      timestamp: Date.now(),
      useCount: 0,
      embedding: embedding || []
    };

    // 2. Save to Firestore
    try {
      await addDoc(collection(db, 'agent_memories'), {
        ...newItem,
        agentId
      });
    } catch (e) {
      console.error("Failed to save memory to Firestore", e);
    }

    // 3. Update In-Memory Cache for UI
    const mem = this.getAgentMemory(agentId);
    
    // Check duplicates in cache
    const allItems = [...mem.rules, ...mem.patterns, ...mem.antiPatterns];
    if (!allItems.some(i => i.content === newItem.content)) {
        if (type === 'rule') mem.rules.unshift(newItem);
        else if (type === 'pattern') mem.patterns.unshift(newItem);
        else mem.antiPatterns.unshift(newItem);
    }
  }

  // Backward compatibility wrapper for sync usage (returns default full dump from cache)
  static retrieveContext(agentId: string): string {
    // This is strictly for fallback or non-RAG simple usage
    const mem = this.getAgentMemory(agentId);
    let context = "";
    mem.rules.forEach(r => context += `- ${r.content}\n`);
    return context;
  }
}

export class GlobalMemoryController {
  // Keeping global memory simple for now (no RAG) as it's small, but could be upgraded too
  private static getGlobalStore(): Omit<AgentMemoryStore, 'agentId' | 'stats'> & { scenarios: MemoryItem[], critiques: MemoryItem[] } {
    const stored = localStorage.getItem('devforge_global_memory_v1');
    return stored ? JSON.parse(stored) : { isEnabled: true, rules: [], patterns: [], antiPatterns: [], scenarios: [], critiques: [], logs: [] };
  }

  private static saveGlobalStore(store: any) {
    localStorage.setItem('devforge_global_memory_v1', JSON.stringify(store));
  }

  static learn(type: MemoryType, content: string, domain: string = 'general') {
    const store = this.getGlobalStore();
    const newItem: MemoryItem = {
      id: 'g_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
      type,
      content: content.trim(),
      domain,
      timestamp: Date.now(),
      useCount: 0,
      source: 'training_chat'
    };

    let targetArray;
    if (type === 'rule') targetArray = store.rules;
    else if (type === 'pattern') targetArray = store.patterns;
    else if (type === 'scenario') targetArray = store.scenarios;
    else if (type === 'critique') targetArray = store.critiques;
    else targetArray = store.antiPatterns;

    if (!targetArray) targetArray = []; // Fallback if missing in old store

    if (targetArray.some(item => item.content === newItem.content)) return;

    targetArray.unshift(newItem);
    if (targetArray.length > 50) targetArray.pop();

    // Re-assign back to store to ensure it's saved if it was missing
    if (type === 'rule') store.rules = targetArray;
    else if (type === 'pattern') store.patterns = targetArray;
    else if (type === 'scenario') store.scenarios = targetArray;
    else if (type === 'critique') store.critiques = targetArray;
    else store.antiPatterns = targetArray;

    this.saveGlobalStore(store);
  }

  static logEvent(summary: string) {
    const store = this.getGlobalStore();
    if (!store.logs) store.logs = [];
    
    store.logs.unshift({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      timestamp: Date.now(),
      summary: summary
    });
    
    if (store.logs.length > 50) store.logs.pop();
    this.saveGlobalStore(store);
  }

  static retrieveContext(): string {
    const store = this.getGlobalStore();
    if (!store.isEnabled) return "";

    let context = `\n[GLOBAL SHARED KNOWLEDGE]\n`;
    if (store.rules.length > 0) {
      context += `UNIVERSAL RULES:\n`;
      store.rules.slice(0, 10).forEach(r => context += `- ${r.content} [${r.domain || 'general'}]\n`);
    }
    return context;
  }

  static getFullStore() {
    return this.getGlobalStore();
  }

  static clear() {
    localStorage.removeItem('devforge_global_memory_v1');
  }
}
