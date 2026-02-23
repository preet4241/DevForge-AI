import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { StorageService } from '../../services/storageService';

// --- Types ---

export interface FileNode {
  path: string; // Full path (unique ID)
  name: string; // Display name
  type: 'file' | 'folder';
  content?: string;
  language?: string;
  isOpen?: boolean;
  isUnsaved?: boolean;
  children?: FileNode[]; // For tree structure
}

interface FileSystemState {
  files: Record<string, FileNode>; // Map path -> FileNode (flat structure for easy lookup)
  openTabs: string[]; // List of paths
  activeTab: string | null;
  unsavedFiles: Set<string>; // Paths with unsaved changes
  project: any | null;
}

type Action =
  | { type: 'SET_PROJECT'; payload: any }
  | { type: 'LOAD_FILES'; payload: FileNode[] }
  | { type: 'ADD_FILE'; payload: FileNode }
  | { type: 'UPDATE_FILE_CONTENT'; payload: { path: string; content: string } }
  | { type: 'RENAME_NODE'; payload: { oldPath: string; newPath: string } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'OPEN_TAB'; payload: string }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'CLOSE_OTHER_TABS'; payload: string }
  | { type: 'CLOSE_ALL_TABS' }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SAVE_FILE'; payload: string }
  | { type: 'SET_UNSAVED'; payload: { path: string; isUnsaved: boolean } };

// --- Initial State ---

const initialState: FileSystemState = {
  files: {},
  openTabs: [],
  activeTab: null,
  unsavedFiles: new Set(),
  project: null,
};

// --- Reducer ---

function fileSystemReducer(state: FileSystemState, action: Action): FileSystemState {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: action.payload };

    case 'LOAD_FILES': {
      const fileMap: Record<string, FileNode> = {};
      action.payload.forEach(f => {
        fileMap[f.path] = f;
      });
      return { ...state, files: fileMap };
    }

    case 'ADD_FILE':
      return {
        ...state,
        files: { ...state.files, [action.payload.path]: action.payload },
        openTabs: action.payload.type === 'file' ? [...state.openTabs, action.payload.path] : state.openTabs,
        activeTab: action.payload.type === 'file' ? action.payload.path : state.activeTab,
      };

    case 'UPDATE_FILE_CONTENT':
      if (!state.files[action.payload.path]) return state;
      return {
        ...state,
        files: {
          ...state.files,
          [action.payload.path]: { ...state.files[action.payload.path], content: action.payload.content }
        },
        unsavedFiles: new Set(state.unsavedFiles).add(action.payload.path)
      };

    case 'SET_UNSAVED': {
      const newUnsaved = new Set(state.unsavedFiles);
      if (action.payload.isUnsaved) newUnsaved.add(action.payload.path);
      else newUnsaved.delete(action.payload.path);
      return { ...state, unsavedFiles: newUnsaved };
    }

    case 'SAVE_FILE': {
      const newUnsaved = new Set(state.unsavedFiles);
      newUnsaved.delete(action.payload);
      return { ...state, unsavedFiles: newUnsaved };
    }

    case 'RENAME_NODE': {
      const { oldPath, newPath } = action.payload;
      const newFiles = { ...state.files };
      const newOpenTabs = [...state.openTabs];
      let newActiveTab = state.activeTab;
      const newUnsaved = new Set(state.unsavedFiles);

      // Helper to rename a path
      const renamePath = (p: string) => {
        if (p === oldPath) return newPath;
        if (p.startsWith(oldPath + '/')) return p.replace(oldPath + '/', newPath + '/');
        return p;
      };

      // 1. Update Files Map
      Object.keys(newFiles).forEach(key => {
        if (key === oldPath || key.startsWith(oldPath + '/')) {
          const file = newFiles[key];
          const renamedPath = renamePath(key);
          const renamedName = key === oldPath ? newPath.split('/').pop()! : file.name;
          
          delete newFiles[key];
          newFiles[renamedPath] = { ...file, path: renamedPath, name: renamedName };
        }
      });

      // 2. Update Tabs
      const updatedTabs = newOpenTabs.map(renamePath);
      
      // 3. Update Active Tab
      if (newActiveTab) {
        newActiveTab = renamePath(newActiveTab);
      }

      // 4. Update Unsaved
      const updatedUnsaved = new Set<string>();
      newUnsaved.forEach(p => updatedUnsaved.add(renamePath(p)));

      return {
        ...state,
        files: newFiles,
        openTabs: updatedTabs,
        activeTab: newActiveTab,
        unsavedFiles: updatedUnsaved
      };
    }

    case 'DELETE_NODE': {
      const pathToDelete = action.payload;
      const newFiles = { ...state.files };
      
      // Remove file and children
      Object.keys(newFiles).forEach(key => {
        if (key === pathToDelete || key.startsWith(pathToDelete + '/')) {
          delete newFiles[key];
        }
      });

      // Close tabs
      const newOpenTabs = state.openTabs.filter(p => p !== pathToDelete && !p.startsWith(pathToDelete + '/'));
      
      // Update active tab if needed
      let newActiveTab = state.activeTab;
      if (newActiveTab && (newActiveTab === pathToDelete || newActiveTab.startsWith(pathToDelete + '/'))) {
        newActiveTab = newOpenTabs.length > 0 ? newOpenTabs[newOpenTabs.length - 1] : null;
      }

      const newUnsaved = new Set(state.unsavedFiles);
      newUnsaved.forEach(p => {
        if (p === pathToDelete || p.startsWith(pathToDelete + '/')) newUnsaved.delete(p);
      });

      return {
        ...state,
        files: newFiles,
        openTabs: newOpenTabs,
        activeTab: newActiveTab,
        unsavedFiles: newUnsaved
      };
    }

    case 'OPEN_TAB':
      if (state.openTabs.includes(action.payload)) {
        return { ...state, activeTab: action.payload };
      }
      return {
        ...state,
        openTabs: [...state.openTabs, action.payload],
        activeTab: action.payload
      };

    case 'CLOSE_TAB': {
      const newTabs = state.openTabs.filter(t => t !== action.payload);
      let newActive = state.activeTab;
      if (state.activeTab === action.payload) {
        newActive = newTabs.length > 0 ? newTabs[newTabs.length - 1] : null;
      }
      return { ...state, openTabs: newTabs, activeTab: newActive };
    }

    case 'CLOSE_OTHER_TABS':
      return { ...state, openTabs: [action.payload], activeTab: action.payload };

    case 'CLOSE_ALL_TABS':
      return { ...state, openTabs: [], activeTab: null };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    default:
      return state;
  }
}

// --- Context ---

const FileSystemContext = createContext<{
  state: FileSystemState;
  dispatch: React.Dispatch<Action>;
  getTree: () => FileNode[];
  saveFile: (path: string) => Promise<void>;
  createItem: (path: string, type: 'file' | 'folder') => Promise<void>;
  deleteItem: (path: string) => Promise<void>;
  renameItem: (oldPath: string, newName: string) => Promise<void>;
} | null>(null);

// --- Provider ---

export const FileSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(fileSystemReducer, initialState);

  // Load from LocalStorage on mount
  useEffect(() => {
    const loadProject = async () => {
      const storedProject = localStorage.getItem('currentProject');
      if (storedProject) {
        const project = JSON.parse(storedProject);
        dispatch({ type: 'SET_PROJECT', payload: project });

        if (project.codeFiles) {
          const nodes: FileNode[] = project.codeFiles.map((f: any) => ({
            path: f.name,
            name: f.name.split('/').pop(),
            type: f.type || 'file',
            content: f.content,
            language: f.language
          }));
          dispatch({ type: 'LOAD_FILES', payload: nodes });
        }
      }
      
      // Restore tabs
      const savedTabs = localStorage.getItem('openTabs');
      const savedActive = localStorage.getItem('activeTab');
      if (savedTabs) {
        JSON.parse(savedTabs).forEach((t: string) => dispatch({ type: 'OPEN_TAB', payload: t }));
      }
      if (savedActive) {
        dispatch({ type: 'SET_ACTIVE_TAB', payload: savedActive });
      }
    };
    loadProject();
  }, []);

  // Persist Tabs
  useEffect(() => {
    localStorage.setItem('openTabs', JSON.stringify(state.openTabs));
    localStorage.setItem('activeTab', state.activeTab || '');
  }, [state.openTabs, state.activeTab]);

  // Persist Project (Debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (state.project && Object.keys(state.files).length > 0) {
        const codeFiles = Object.values(state.files).map(f => ({
          name: f.path,
          type: f.type,
          content: f.content,
          language: f.language
        }));
        const updatedProject = { ...state.project, codeFiles };
        StorageService.saveProject(updatedProject);
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [state.files, state.project]);

  // --- Helpers ---

  const getTree = useCallback(() => {
    const root: FileNode[] = [];
    const map: Record<string, FileNode> = {};

    // Deep copy to avoid mutating state directly in tree construction
    const nodes = Object.values(state.files).map(f => ({ ...f, children: [] }));
    
    // Sort: Folders first, then files. Alphabetical.
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    nodes.forEach(node => {
      map[node.path] = node;
    });

    nodes.forEach(node => {
      const parts = node.path.split('/');
      if (parts.length === 1) {
        root.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        if (map[parentPath]) {
          map[parentPath].children?.push(node);
        } else {
          // Orphaned or parent missing, add to root (fallback)
          root.push(node);
        }
      }
    });

    return root;
  }, [state.files]);

  const saveFile = async (path: string) => {
    dispatch({ type: 'SAVE_FILE', payload: path });
    // Trigger persistence immediately
    const file = state.files[path];
    if (file && state.project) {
       // Logic handled by the debounced effect, but we can force it here if needed
    }
  };

  const createItem = async (path: string, type: 'file' | 'folder') => {
    if (state.files[path]) throw new Error("Item already exists");
    const name = path.split('/').pop() || '';
    dispatch({ type: 'ADD_FILE', payload: { path, name, type, content: type === 'file' ? '' : undefined } });
  };

  const deleteItem = async (path: string) => {
    dispatch({ type: 'DELETE_NODE', payload: path });
  };

  const renameItem = async (oldPath: string, newName: string) => {
    const parentPath = oldPath.split('/').slice(0, -1).join('/');
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;
    if (state.files[newPath]) throw new Error("Name already exists");
    dispatch({ type: 'RENAME_NODE', payload: { oldPath, newPath } });
  };

  return (
    <FileSystemContext.Provider value={{ state, dispatch, getTree, saveFile, createItem, deleteItem, renameItem }}>
      {children}
    </FileSystemContext.Provider>
  );
};

export const useFileSystem = () => {
  const context = useContext(FileSystemContext);
  if (!context) throw new Error("useFileSystem must be used within a FileSystemProvider");
  return context;
};
