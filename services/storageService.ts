
import { DbClient } from '../database/client';
import { Project, CodeFile } from '../types';
import { IdbStorage } from './idbStorage';

// Abstracting data access to support seamless switching
export class StorageService {
  
  // --- PROJECTS ---

  static async getProjects(): Promise<Project[]> {
    const client = DbClient.getClient();
    if (client) {
      const { data, error } = await client
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) return data as Project[];
      console.warn('DB Fetch Error, falling back:', error);
    }

    // Fallback to IndexedDB (previously LocalStorage)
    const saved = await IdbStorage.get<Project[]>('projects');
    return saved || [];
  }

  static async saveProject(project: Project): Promise<void> {
    const client = DbClient.getClient();
    if (client) {
      // Upsert project
      const { error } = await client
        .from('projects')
        .upsert({
          id: project.id,
          name: project.name,
          description: project.description,
          type: project.type,
          created_at: project.createdAt,
          status: 'active',
          metadata: { plan: project.plan, architecture: project.architecture }
        });

      if (error) console.error('DB Save Error:', error);

      // Save files if they exist in the object
      if (project.codeFiles && project.codeFiles.length > 0) {
        const fileRows = project.codeFiles.map(f => ({
          project_id: project.id,
          name: f.name,
          language: f.language,
          content: f.content,
          path: f.name.includes('/') ? f.name.substring(0, f.name.lastIndexOf('/')) : '/'
        }));

        // Delete old files for this project to ensure sync (simplified strategy)
        await client.from('code_files').delete().eq('project_id', project.id);
        await client.from('code_files').insert(fileRows);
      }
    }

    // Always update IndexedDB as cache/backup
    const projects = await this.getLocalProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.unshift(project);
    }
    await IdbStorage.set('projects', projects);
    
    // Also save current project ref in localStorage for synchronous session checks if needed, 
    // but full data goes to IDB.
    // For Chat.tsx sync reading, we might still want this, or migrate Chat.tsx to async.
    // We will keep a light version in localStorage for now.
    localStorage.setItem('currentProject', JSON.stringify({ 
      ...project, 
      codeFiles: [] // Don't store heavy files in localStorage
    }));
  }

  static async deleteProject(id: string): Promise<void> {
    const client = DbClient.getClient();
    if (client) {
      await client.from('projects').delete().eq('id', id);
    }

    const projects = await this.getLocalProjects();
    const filtered = projects.filter(p => p.id !== id);
    await IdbStorage.set('projects', filtered);
  }

  // --- HELPERS ---

  private static async getLocalProjects(): Promise<Project[]> {
    const saved = await IdbStorage.get<Project[]>('projects');
    return saved || [];
  }
}
