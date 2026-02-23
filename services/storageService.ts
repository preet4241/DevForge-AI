
import { rtdb } from './firebase';
import { ref, get, set, remove, child, update } from 'firebase/database';
import { Project, CodeFile } from '../types';

export class StorageService {
  
  // --- PROJECTS ---

  static async getProjects(): Promise<Project[]> {
    try {
      if (rtdb) {
        const projectsRef = ref(rtdb, 'projects');
        const snapshot = await get(projectsRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          // Convert object to array and sort by createdAt desc
          const projects = Object.values(data).map((p: any) => p.project_info) as Project[];
          return projects.sort((a, b) => b.createdAt - a.createdAt);
        }
        return [];
      }
    } catch (error) {
      console.warn('Firebase Fetch Error, falling back to local:', error);
    }

    // Fallback to LocalStorage
    const saved = localStorage.getItem('projects');
    return saved ? JSON.parse(saved) : [];
  }

  static async getProject(id: string): Promise<Project | null> {
    try {
      if (rtdb) {
        const projectRef = ref(rtdb, `projects/${id}`);
        const snapshot = await get(projectRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          const projectInfo = data.project_info as Project;
          
          // Fetch workspace files
          // In RTDB, we can store them nested under 'workspace' or separate.
          // Let's assume they are under `projects/{id}/workspace`
          const workspace = data.workspace || {};
          const codeFiles: CodeFile[] = Object.values(workspace);

          return { ...projectInfo, codeFiles };
        }
      }
    } catch (error) {
      console.error('Firebase Get Project Error:', error);
    }
    
    // Fallback
    const projects = await this.getLocalProjects();
    return projects.find(p => p.id === id) || null;
  }

  static async saveProject(project: Project): Promise<void> {
    try {
      if (rtdb) {
        const projectRef = ref(rtdb, `projects/${project.id}`);
        
        // Separate metadata and files
        const { codeFiles, ...projectInfo } = project;
        
        // Prepare updates object for atomic update
        const updates: any = {};
        updates[`projects/${project.id}/project_info`] = projectInfo;
        updates[`projects/${project.id}/secret`] = {}; // Placeholder

        // Save files to workspace path
        if (codeFiles && codeFiles.length > 0) {
          codeFiles.forEach(file => {
            // Use encoded name as key
            const fileId = btoa(file.name).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
            updates[`projects/${project.id}/workspace/${fileId}`] = file;
          });
        }

        await update(ref(rtdb), updates);
      }
    } catch (error) {
      console.error('Firebase Save Error:', error);
    }

    // Always update LocalStorage as cache/backup
    const projects = await this.getLocalProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.unshift(project);
    }
    localStorage.setItem('projects', JSON.stringify(projects));
    
    // Update current project cache
    localStorage.setItem('currentProject', JSON.stringify(project));
  }

  static async deleteProject(id: string): Promise<void> {
    try {
      if (rtdb) {
        await remove(ref(rtdb, `projects/${id}`));
      }
    } catch (error) {
      console.error('Firebase Delete Error:', error);
    }

    const projects = await this.getLocalProjects();
    const filtered = projects.filter(p => p.id !== id);
    localStorage.setItem('projects', JSON.stringify(filtered));
  }

  // --- HELPERS ---

  private static async getLocalProjects(): Promise<Project[]> {
    const saved = localStorage.getItem('projects');
    return saved ? JSON.parse(saved) : [];
  }
}
