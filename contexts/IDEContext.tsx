import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { StorageService } from '../services/storageService';

// --- Types ---
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: Record<string, FileNode>;
  content?: string;
  language?: string;
  status?: 'pending' | 'generating' | 'completed' | 'error';
}

interface IDEState {
  fileSystem: FileNode; // Root node
  openTabs: string[]; // Array of file paths
  activeTab: string | null; // Path of currently active file
  editorContents: Record<string, string>; // Map of path -> content (unsaved changes)
  unsavedFiles: Set<string>; // Set of paths with unsaved changes
  expandedFolders: Set<string>; // Set of expanded folder paths
  searchQuery: string;
}

type IDEAction =
  | { type: 'SET_FILE_SYSTEM'; payload: FileNode }
  | { type: 'OPEN_FILE'; payload: string }
  | { type: 'CLOSE_FILE'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'UPDATE_CONTENT'; payload: { path: string; content: string } }
  | { type: 'SAVE_FILE'; payload: string }
  | { type: 'TOGGLE_FOLDER'; payload: string }
  | { type: 'SET_EXPANDED_FOLDERS'; payload: Set<string> }
  | { type: 'RENAME_NODE'; payload: { oldPath: string; newPath: string } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'CREATE_NODE'; payload: { path: string; type: 'file' | 'folder'; content?: string } }
  | { type: 'SET_SEARCH_QUERY'; payload: string };

const initialState: IDEState = {
  fileSystem: { id: 'root', name: 'root', path: '', type: 'folder', children: {} },
  openTabs: [],
  activeTab: null,
  editorContents: {},
  unsavedFiles: new Set(),
  expandedFolders: new Set(['root']),
  searchQuery: '',
};

// --- Helper Functions ---
const findNode = (root: FileNode, path: string): FileNode | null => {
  if (root.path === path) return root;
  const parts = path.split('/').filter(p => p);
  let current = root;
  for (const part of parts) {
    if (current.children[part]) {
      current = current.children[part];
    } else {
      return null;
    }
  }
  return current;
};

const updateNodePath = (node: FileNode, oldPrefix: string, newPrefix: string) => {
  if (node.path.startsWith(oldPrefix)) {
    node.path = node.path.replace(oldPrefix, newPrefix);
    node.id = node.path; // Assuming ID is path for simplicity
    if (node.name === oldPrefix.split('/').pop()) {
        node.name = newPrefix.split('/').pop() || node.name;
    }
  }
  if (node.children) {
    Object.values(node.children).forEach(child => updateNodePath(child, oldPrefix, newPrefix));
  }
};

const addNodeToTree = (root: FileNode, path: string, type: 'file' | 'folder', content?: string): FileNode => {
  const newRoot = JSON.parse(JSON.stringify(root)); // Deep copy for simplicity
  const parts = path.split('/').filter(p => p);
  const name = parts.pop()!;
  
  let current = newRoot;
  let currentPath = '';
  
  for (const part of parts) {
    currentPath += (currentPath ? '/' : '') + part;
    if (!current.children[part]) {
      current.children[part] = {
        id: currentPath,
        name: part,
        path: currentPath,
        type: 'folder',
        children: {}
      };
    }
    current = current.children[part];
  }
  
  current.children[name] = {
    id: path,
    name,
    path,
    type,
    children: {},
    content
  };
  
  return newRoot;
};

const deleteNodeFromTree = (root: FileNode, path: string): FileNode => {
  const newRoot = JSON.parse(JSON.stringify(root));
  const parts = path.split('/').filter(p => p);
  const name = parts.pop()!;
  
  let current = newRoot;
  for (const part of parts) {
    if (current.children[part]) {
      current = current.children[part];
    } else {
      return newRoot; // Path not found
    }
  }
  
  delete current.children[name];
  return newRoot;
};

const renameNodeInTree = (root: FileNode, oldPath: string, newPath: string): FileNode => {
  const newRoot = JSON.parse(JSON.stringify(root));
  const oldParts = oldPath.split('/').filter(p => p);
  const oldName = oldParts.pop()!;
  
  let currentOldParent = newRoot;
  for (const part of oldParts) {
    if (currentOldParent.children[part]) {
      currentOldParent = currentOldParent.children[part];
    } else {
      return newRoot; // Path not found
    }
  }
  
  const nodeToRename = currentOldParent.children[oldName];
  if (!nodeToRename) return newRoot;
  
  delete currentOldParent.children[oldName];
  
  const newParts = newPath.split('/').filter(p => p);
  const newName = newParts.pop()!;
  
  let currentNewParent = newRoot;
  let currentPath = '';
  for (const part of newParts) {
    currentPath += (currentPath ? '/' : '') + part;
    if (!currentNewParent.children[part]) {
      currentNewParent.children[part] = {
        id: currentPath,
        name: part,
        path: currentPath,
        type: 'folder',
        children: {}
      };
    }
    currentNewParent = currentNewParent.children[part];
  }
  
  nodeToRename.name = newName;
  updateNodePath(nodeToRename, oldPath, newPath);
  currentNewParent.children[newName] = nodeToRename;
  
  return newRoot;
};

// --- Reducer ---
const ideReducer = (state: IDEState, action: IDEAction): IDEState => {
  switch (action.type) {
    case 'SET_FILE_SYSTEM':
      return { ...state, fileSystem: action.payload };
    
    case 'OPEN_FILE':
      if (!state.openTabs.includes(action.payload)) {
        return { ...state, openTabs: [...state.openTabs, action.payload], activeTab: action.payload };
      }
      return { ...state, activeTab: action.payload };

    case 'CLOSE_FILE':
      const newTabs = state.openTabs.filter(t => t !== action.payload);
      let newActive = state.activeTab;
      if (state.activeTab === action.payload) {
        newActive = newTabs.length > 0 ? newTabs[newTabs.length - 1] : null;
      }
      const newContents = { ...state.editorContents };
      delete newContents[action.payload];
      const newUnsaved = new Set(state.unsavedFiles);
      newUnsaved.delete(action.payload);
      return { ...state, openTabs: newTabs, activeTab: newActive, editorContents: newContents, unsavedFiles: newUnsaved };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'UPDATE_CONTENT':
      const newUnsavedFiles = new Set(state.unsavedFiles);
      newUnsavedFiles.add(action.payload.path);
      
      // Also update the fileSystem content if it's a file
      const updatedFS = JSON.parse(JSON.stringify(state.fileSystem));
      const nodeToUpdate = findNode(updatedFS, action.payload.path);
      if (nodeToUpdate && nodeToUpdate.type === 'file') {
        nodeToUpdate.content = action.payload.content;
      }
      
      return {
        ...state,
        fileSystem: updatedFS,
        editorContents: { ...state.editorContents, [action.payload.path]: action.payload.content },
        unsavedFiles: newUnsavedFiles,
      };

    case 'SAVE_FILE':
      const savedUnsaved = new Set(state.unsavedFiles);
      savedUnsaved.delete(action.payload);
      return { ...state, unsavedFiles: savedUnsaved };

    case 'TOGGLE_FOLDER':
      const newExpanded = new Set(state.expandedFolders);
      if (newExpanded.has(action.payload)) {
        newExpanded.delete(action.payload);
      } else {
        newExpanded.add(action.payload);
      }
      return { ...state, expandedFolders: newExpanded };
    
    case 'SET_EXPANDED_FOLDERS':
        return { ...state, expandedFolders: action.payload };

    case 'CREATE_NODE':
      return {
        ...state,
        fileSystem: addNodeToTree(state.fileSystem, action.payload.path, action.payload.type, action.payload.content)
      };

    case 'RENAME_NODE':
        const { oldPath, newPath } = action.payload;
        const renamedTabs = state.openTabs.map(t => t === oldPath ? newPath : (t.startsWith(oldPath + '/') ? t.replace(oldPath, newPath) : t));
        const renamedActive = state.activeTab === oldPath ? newPath : (state.activeTab?.startsWith(oldPath + '/') ? state.activeTab.replace(oldPath, newPath) : state.activeTab);
        
        // Update unsaved files set
        const renamedUnsaved = new Set<string>();
        state.unsavedFiles.forEach(f => {
            if (f === oldPath) renamedUnsaved.add(newPath);
            else if (f.startsWith(oldPath + '/')) renamedUnsaved.add(f.replace(oldPath, newPath));
            else renamedUnsaved.add(f);
        });

        // Update editor contents keys
        const renamedContents: Record<string, string> = {};
        Object.entries(state.editorContents).forEach(([k, v]) => {
            if (k === oldPath) renamedContents[newPath] = v;
            else if (k.startsWith(oldPath + '/')) renamedContents[k.replace(oldPath, newPath)] = v;
            else renamedContents[k] = v;
        });

        return { 
            ...state, 
            fileSystem: renameNodeInTree(state.fileSystem, oldPath, newPath),
            openTabs: renamedTabs, 
            activeTab: renamedActive, 
            unsavedFiles: renamedUnsaved,
            editorContents: renamedContents
        };

    case 'DELETE_NODE':
        const pathToDelete = action.payload;
        const filteredTabs = state.openTabs.filter(t => t !== pathToDelete && !t.startsWith(pathToDelete + '/'));
        let nextActive = state.activeTab;
        if (state.activeTab === pathToDelete || state.activeTab?.startsWith(pathToDelete + '/')) {
            nextActive = filteredTabs.length > 0 ? filteredTabs[filteredTabs.length - 1] : null;
        }
        
        const filteredUnsaved = new Set(state.unsavedFiles);
        filteredUnsaved.delete(pathToDelete);
        // Also delete children from unsaved
        state.unsavedFiles.forEach(f => {
            if (f.startsWith(pathToDelete + '/')) filteredUnsaved.delete(f);
        });

        const filteredContents = { ...state.editorContents };
        delete filteredContents[pathToDelete];
        Object.keys(filteredContents).forEach(k => {
            if (k.startsWith(pathToDelete + '/')) delete filteredContents[k];
        });

        return { 
            ...state, 
            fileSystem: deleteNodeFromTree(state.fileSystem, pathToDelete),
            openTabs: filteredTabs, 
            activeTab: nextActive, 
            unsavedFiles: filteredUnsaved,
            editorContents: filteredContents
        };

    case 'SET_SEARCH_QUERY':
        return { ...state, searchQuery: action.payload };

    default:
      return state;
  }
};

// --- Context ---
const IDEContext = createContext<{
  state: IDEState;
  dispatch: React.Dispatch<IDEAction>;
  getFileContent: (path: string) => string;
}>({
  state: initialState,
  dispatch: () => null,
  getFileContent: () => '',
});

export const IDEProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(ideReducer, initialState, (initial) => {
      // Load from localStorage
      const savedTabs = localStorage.getItem('ide_openTabs');
      const savedActive = localStorage.getItem('ide_activeTab');
      const savedExpanded = localStorage.getItem('ide_expandedFolders');
      
      return {
          ...initial,
          openTabs: savedTabs ? JSON.parse(savedTabs) : [],
          activeTab: savedActive || null,
          expandedFolders: savedExpanded ? new Set(JSON.parse(savedExpanded)) : new Set(['root']),
      };
  });

  // Persist state
  useEffect(() => {
      localStorage.setItem('ide_openTabs', JSON.stringify(state.openTabs));
      if (state.activeTab) localStorage.setItem('ide_activeTab', state.activeTab);
      localStorage.setItem('ide_expandedFolders', JSON.stringify(Array.from(state.expandedFolders)));
  }, [state.openTabs, state.activeTab, state.expandedFolders]);

  const getFileContent = (path: string) => {
      if (state.editorContents[path] !== undefined) {
          return state.editorContents[path];
      }
      // Fallback to finding in fileSystem if not in editor buffer
      const node = findNode(state.fileSystem, path);
      return node?.content || '';
  };

  return (
    <IDEContext.Provider value={{ state, dispatch, getFileContent }}>
      {children}
    </IDEContext.Provider>
  );
};

export const useIDE = () => useContext(IDEContext);
