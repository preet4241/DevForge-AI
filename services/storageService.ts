
import { db } from './firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Project } from '../types';

export class StorageService {
  
  // --- PROJECTS ---

  static async getProjects(): Promise<Project[]> {
    try {
      if (db) {
        const projectsRef = collection(db, 'projects');
        const q = query(projectsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      }
    } catch (error) {
      console.warn('Firebase Fetch Error, falling back to local:', error);
    }

    // Fallback to LocalStorage (for now, keeping it simple as per request to remove complex DB logic)
    const saved = localStorage.getItem('projects');
    return saved ? JSON.parse(saved) : [];
  }

  static async saveProject(project: Project): Promise<void> {
    try {
      if (db) {
        await setDoc(doc(db, 'projects', project.id), project);
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
  }

  static async deleteProject(id: string): Promise<void> {
    try {
      if (db) {
        await deleteDoc(doc(db, 'projects', id));
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
