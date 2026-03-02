import { rtdb } from './firebase';
import { ref, get, set, push, query, orderByChild, limitToLast } from 'firebase/database';

export interface AgentMemoryEntry {
  id: string;
  topic: string;
  summary: string;
  connections: string[];
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
  // New fields for advanced training
  type?: 'rule' | 'pattern' | 'critique' | 'scenario' | 'debate_outcome';
  domain?: string; // e.g., 'security', 'performance'
  scenarioContext?: string;
}

export class AgentMemoryService {
  /**
   * Save a learning entry to a specific agent's memory in Firebase RTDB
   */
  static async saveMemory(agentId: string, entry: Omit<AgentMemoryEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      if (!rtdb) {
        console.warn('Firebase RTDB not initialized. Falling back to local storage for memory.');
        this.saveLocalMemory(agentId, entry);
        return;
      }

      const memoryRef = ref(rtdb, `agents/${agentId}/memories`);
      const newMemoryRef = push(memoryRef);
      
      const fullEntry: AgentMemoryEntry = {
        ...entry,
        id: newMemoryRef.key as string,
        timestamp: Date.now()
      };

      await set(newMemoryRef, fullEntry);
      console.log(`Memory saved for ${agentId}:`, fullEntry.topic);
    } catch (error) {
      console.error(`Error saving memory for ${agentId}:`, error);
      this.saveLocalMemory(agentId, entry);
    }
  }

  /**
   * Retrieve recent memories for a specific agent
   */
  static async getMemories(agentId: string, limit: number = 10): Promise<AgentMemoryEntry[]> {
    try {
      if (!rtdb) {
        return this.getLocalMemories(agentId);
      }

      const memoryRef = ref(rtdb, `agents/${agentId}/memories`);
      const q = query(memoryRef, orderByChild('timestamp'), limitToLast(limit));
      const snapshot = await get(q);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const memories: AgentMemoryEntry[] = Object.values(data);
        return memories.sort((a, b) => b.timestamp - a.timestamp);
      }
      return [];
    } catch (error) {
      console.error(`Error getting memories for ${agentId}:`, error);
      return this.getLocalMemories(agentId);
    }
  }

  // --- Local Fallbacks ---
  private static saveLocalMemory(agentId: string, entry: Omit<AgentMemoryEntry, 'id' | 'timestamp'>) {
    const memories = this.getLocalMemories(agentId);
    const fullEntry: AgentMemoryEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    };
    memories.unshift(fullEntry);
    localStorage.setItem(`agent_memory_${agentId}`, JSON.stringify(memories.slice(0, 50))); // Keep last 50 locally
  }

  private static getLocalMemories(agentId: string): AgentMemoryEntry[] {
    const saved = localStorage.getItem(`agent_memory_${agentId}`);
    return saved ? JSON.parse(saved) : [];
  }
}
