import { ApiConfigService, ApiKeyConfig, KeyStatus } from "./apiConfigService";

interface QueueItem {
  agentName: string;
  resolve: (config: ApiKeyConfig) => void;
  reject: (error: Error) => void;
}

export class KeyPoolService {
  private static queue: QueueItem[] = [];
  private static activeRequests: Map<string, string> = new Map(); // keyId -> agentName
  private static COOLDOWN_MS = 60000; // 60 seconds default cooldown

  /**
   * Acquires an API key for an agent based on priority logic:
   * 1. Personal key (if available and not exhausted/rate-limited)
   * 2. Global pool (if available)
   * 3. Queue (if all keys are busy)
   */
  static async acquireKey(agentName: string): Promise<ApiKeyConfig> {
    const configs = ApiConfigService.getConfigs().filter(c => c.enabled);
    
    // 1. Priority: Personal Key
    const personalKey = configs.find(c => c.scope === agentName);
    if (personalKey) {
      if (this.isKeyAvailable(personalKey)) {
        this.markKeyInUse(personalKey.id, agentName);
        return personalKey;
      }
      
      // If fallback is enabled, skip to Global Pool logic
      if (personalKey.fallbackEnabled) {
        // Continue to Global Pool check below...
      } else {
        // Fallback disabled: Must wait for personal key
        return new Promise((resolve, reject) => {
          this.queue.push({ agentName, resolve, reject });
        });
      }
    }

    // 2. Global Pool
    const globalKeys = configs.filter(c => c.scope === 'global');
    const availableGlobalKey = globalKeys.find(k => this.isKeyAvailable(k));

    if (availableGlobalKey) {
      this.markKeyInUse(availableGlobalKey.id, agentName);
      return availableGlobalKey;
    }

    // 3. Fallback to System Environment Key (if available)
    // This prevents hanging if no user keys are configured
    if (process.env.GEMINI_API_KEY) {
        // Create a temporary config for the system key
        const systemKeyConfig: ApiKeyConfig = {
            id: 'system-env-key',
            provider: 'gemini',
            key: process.env.GEMINI_API_KEY,
            scope: 'global',
            modelId: 'gemini-2.0-flash-exp', // Default model
            label: 'System Environment Key',
            enabled: true,
            status: 'idle',
            totalCalls: 0,
            errorCount: 0,
            successRate: 100,
            currentRpm: 0
        };
        return systemKeyConfig;
    }

    // 4. No keys available and no system key -> REJECT immediately
    // Do not queue if there are no keys at all, otherwise it hangs forever.
    if (configs.length === 0) {
        throw new Error("API key not found. Please add your key in Settings.");
    }

    // 5. Keys exist but are busy -> Join queue
    return new Promise((resolve, reject) => {
      this.queue.push({ agentName, resolve, reject });
    });
  }

  /**
   * Releases a key back to the pool and triggers the next item in queue
   */
  static releaseKey(keyId: string, success: boolean = true) {
    this.activeRequests.delete(keyId);
    
    const configs = ApiConfigService.getConfigs();
    const config = configs.find(c => c.id === keyId);
    if (!config) return;

    const updates: Partial<ApiKeyConfig> = {
      status: config.status === 'in_use' ? 'idle' : config.status,
      totalCalls: config.totalCalls + 1,
      errorCount: success ? config.errorCount : config.errorCount + 1,
      lastUsed: Date.now()
    };

    // Update success rate
    const total = updates.totalCalls || config.totalCalls;
    const errors = updates.errorCount || config.errorCount;
    updates.successRate = Math.round(((total - errors) / total) * 100);

    ApiConfigService.updateConfig(keyId, updates);

    // Process queue
    this.processQueue();
  }

  /**
   * Marks a key as rate limited
   */
  static reportRateLimit(keyId: string) {
    const cooldownUntil = Date.now() + this.COOLDOWN_MS;
    ApiConfigService.updateConfig(keyId, {
      status: 'rate_limited',
      cooldownUntil
    });

    // Schedule recovery
    setTimeout(() => {
      const configs = ApiConfigService.getConfigs();
      const config = configs.find(c => c.id === keyId);
      if (config && config.status === 'rate_limited') {
        ApiConfigService.updateConfig(keyId, { status: 'idle' });
        this.processQueue();
      }
    }, this.COOLDOWN_MS);
  }

  private static isKeyAvailable(config: ApiKeyConfig): boolean {
    if (!config.enabled) return false;
    if (config.status === 'in_use') return false;
    if (config.status === 'rate_limited') {
      if (config.cooldownUntil && Date.now() > config.cooldownUntil) {
        return true;
      }
      return false;
    }
    if (config.status === 'exhausted') return false;
    
    // Preemptive RPM check
    if (config.rpmLimit && config.currentRpm >= config.rpmLimit) {
      // Check if window has passed
      if (config.rpmWindowStart && Date.now() - config.rpmWindowStart > 60000) {
        return true;
      }
      return false;
    }

    return true;
  }

  private static markKeyInUse(keyId: string, agentName: string) {
    this.activeRequests.set(keyId, agentName);
    ApiConfigService.updateConfig(keyId, { status: 'in_use' });
  }

  private static processQueue() {
    if (this.queue.length === 0) return;

    const configs = ApiConfigService.getConfigs().filter(c => c.enabled);
    
    // Try to satisfy queue items
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      
      // Check for personal key first
      const personalKey = configs.find(c => c.scope === item.agentName);
      if (personalKey && this.isKeyAvailable(personalKey)) {
        this.markKeyInUse(personalKey.id, item.agentName);
        item.resolve(personalKey);
        this.queue.splice(i, 1);
        i--;
        continue;
      }

      // Check for global key
      const globalKey = configs.find(c => c.scope === 'global' && this.isKeyAvailable(c));
      if (globalKey) {
        this.markKeyInUse(globalKey.id, item.agentName);
        item.resolve(globalKey);
        this.queue.splice(i, 1);
        i--;
        continue;
      }
    }
  }
}
