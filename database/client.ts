
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration interface
interface DbConfig {
  url: string;
  key: string;
  enabled: boolean;
  isEnv?: boolean;
}

const STORAGE_KEY = 'devforge_db_config';

export class DbClient {
  private static instance: SupabaseClient | null = null;
  private static config: DbConfig = { url: '', key: '', enabled: false };
  private static initialized = false;

  static initialize() {
    if (this.initialized) return;

    // 1. Check for Environment Variables (Auto-connect from Hosting)
    // Supports standard Vite, Next.js, and Generic naming conventions often used by hosting providers
    const envUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const envKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

    if (envUrl && envKey) {
      try {
        this.instance = createClient(envUrl, envKey);
        this.config = { 
          url: envUrl, 
          key: envKey, 
          enabled: true, 
          isEnv: true 
        };
        this.initialized = true;
        console.log('PostgreSQL (Supabase) connected automatically via Hosting Environment.');
        return;
      } catch (e) {
        console.warn('Failed to auto-connect via Environment Variables:', e);
      }
    }

    // 2. Fallback to Manual Config from LocalStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.enabled && parsed.url && parsed.key) {
        try {
          this.instance = createClient(parsed.url, parsed.key);
          this.config = { ...parsed, isEnv: false };
          this.initialized = true;
          console.log('PostgreSQL (Supabase) connected via Manual Configuration.');
        } catch (e) {
          console.error('Failed to initialize DB client manually', e);
          this.instance = null;
        }
      }
    }
  }

  static getClient(): SupabaseClient | null {
    if (!this.instance) this.initialize();
    return this.instance;
  }

  static saveConfig(url: string, key: string) {
    this.config = { url, key, enabled: true, isEnv: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    this.instance = null;
    this.initialized = false;
    this.initialize();
  }

  static disable() {
    if (this.config.isEnv) {
      console.warn("Cannot disconnect Environment-managed database.");
      return;
    }
    this.config.enabled = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    this.instance = null;
    this.initialized = false;
  }

  static isEnabled(): boolean {
    if (!this.instance) this.initialize();
    return !!this.instance;
  }
  
  static isEnvManaged(): boolean {
    if (!this.instance) this.initialize();
    return !!this.config.isEnv;
  }

  static getConfig() {
    return this.config;
  }
}
