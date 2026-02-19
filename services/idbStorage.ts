
import { get, set, del, clear, keys } from 'idb-keyval';

export const IdbStorage = {
  get: async <T>(key: string): Promise<T | undefined> => get(key),
  set: async (key: string, val: any) => set(key, val),
  del: async (key: string) => del(key),
  clear: async () => clear(),
  keys: async () => keys(),
};
