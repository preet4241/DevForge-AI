import { create, insert, search, remove, AnyOrama } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';
import { get, set } from 'idb-keyval';
import { MemoryItem } from './memoryService';

const ALGEBRA_DB_KEY = 'devforge_algebradb_v1';

export class AlgebraDB {
  private db: AnyOrama | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      const rawData = await get(ALGEBRA_DB_KEY);
      if (rawData) {
        this.db = await restore('json', rawData as string);
      } else {
        this.db = create({
          schema: {
            id: 'string',
            agentId: 'string',
            type: 'string',
            content: 'string',
            timestamp: 'number',
            embedding: 'vector[768]'
          }
        });
        
        // Migrate existing data
        const { IdbStorage } = await import('./idbStorage');
        const vectorData = await IdbStorage.get<Record<string, MemoryItem[]>>('devforge_vector_memory');
        if (vectorData) {
          for (const [agentId, items] of Object.entries(vectorData)) {
            for (const item of items) {
              await insert(this.db, {
                id: item.id,
                agentId,
                type: item.type,
                content: item.content,
                timestamp: item.timestamp,
                embedding: item.embedding || new Array(768).fill(0)
              });
            }
          }
          await this.save();
        }
      }
      this.initialized = true;
    } catch (e) {
      console.error("Failed to initialize AlgebraDB:", e);
      // Fallback to fresh DB
      this.db = create({
        schema: {
          id: 'string',
          agentId: 'string',
          type: 'string',
          content: 'string',
          timestamp: 'number',
          embedding: 'vector[768]'
        }
      });
      this.initialized = true;
    }
  }

  async insertMemory(agentId: string, item: MemoryItem) {
    if (!this.initialized || !this.db) await this.initialize();
    
    await insert(this.db!, {
      id: item.id,
      agentId,
      type: item.type,
      content: item.content,
      timestamp: item.timestamp,
      embedding: item.embedding || new Array(768).fill(0)
    });

    await this.save();
  }

  async searchMemory(agentId: string, queryEmbedding: number[], topK: number = 5): Promise<(MemoryItem & { similarity: number })[]> {
    if (!this.initialized || !this.db) await this.initialize();

    const results = await search(this.db!, {
      mode: 'vector',
      vector: {
        value: queryEmbedding,
        property: 'embedding'
      },
      where: {
        agentId
      },
      limit: topK,
      similarity: 0.6 // Minimum similarity threshold
    });

    return results.hits.map(hit => ({
      id: hit.document.id as string,
      type: hit.document.type as any,
      content: hit.document.content as string,
      timestamp: hit.document.timestamp as number,
      useCount: 0,
      similarity: hit.score
    }));
  }

  async getAllMemories(): Promise<Record<string, MemoryItem[]>> {
    if (!this.initialized || !this.db) await this.initialize();

    const results = await search(this.db!, {
      limit: 10000
    });

    const memories: Record<string, MemoryItem[]> = {};
    for (const hit of results.hits) {
      const agentId = hit.document.agentId as string;
      if (!memories[agentId]) {
        memories[agentId] = [];
      }
      memories[agentId].push({
        id: hit.document.id as string,
        type: hit.document.type as any,
        content: hit.document.content as string,
        timestamp: hit.document.timestamp as number,
        useCount: 0,
      });
    }
    return memories;
  }

  async clearAgentMemory(agentId: string) {
    if (!this.initialized || !this.db) await this.initialize();
    
    const results = await search(this.db!, {
      where: { agentId },
      limit: 10000
    });
    
    for (const hit of results.hits) {
      await remove(this.db!, hit.id);
    }
    
    await this.save();
  }

  private async save() {
    if (!this.db) return;
    const serialized = await persist(this.db, 'json');
    await set(ALGEBRA_DB_KEY, serialized);
  }
}

export const algebraDb = new AlgebraDB();
