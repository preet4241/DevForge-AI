import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Code2, ChevronRight, ChevronDown,
  FileCode, RefreshCw, FilePlus, 
  FolderPlus, Folder, FolderOpen, X, FileJson, FileType, 
  Hash, FileText, Image as ImageIcon,
  Save, Play, Menu, Trash2, Edit2, 
  MoreHorizontal, Search, ArrowLeft,
  Upload, Download, Terminal, Square,
  Copy, Scissors, Clipboard, Check, AlertCircle,
  Split, Minimize2, Maximize2, GripVertical,
  LayoutTemplate, Search as SearchIcon
} from 'lucide-react';
import { Button, Card, Tooltip } from '../components/UI';
import { generateCodeModule, generateArchitecture } from '../services/geminiService';
import { useToast } from '../components/Toast';
import { StorageService } from '../services/storageService';
import Editor, { useMonaco } from '@monaco-editor/react';
import JSZip from 'jszip';

// --- Types ---
interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: Record<string, FileNode>;
  fileData?: any;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'file' | 'folder' | 'root' | 'tab';
  path?: string;
  file?: any;
}

// --- Icons & Helpers ---
const getFileInfo = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return { icon: Code2, color: 'text-blue-400', lang: 'typescript' };
    case 'js': case 'jsx': return { icon: FileCode, color: 'text-yellow-400', lang: 'javascript' };
    case 'css': case 'scss': return { icon: Hash, color: 'text-blue-300', lang: 'css' };
    case 'html': return { icon: FileCode, color: 'text-orange-500', lang: 'html' };
    case 'json': return { icon: FileJson, color: 'text-yellow-300', lang: 'json' };
    case 'md': return { icon: FileText, color: 'text-zinc-400', lang: 'markdown' };
    case 'py': return { icon: FileCode, color: 'text-green-400', lang: 'python' };
    default: return { icon: FileType, color: 'text-zinc-500', lang: 'plaintext' };
  }
};

const buildFileTree = (files: any[]) => {
  const root: FileNode = { id: 'root', name: 'root', path: '', type: 'folder', children: {} };
  files.forEach(file => {
    const path = file.name.replace(/^\//, ''); 
    const parts = path.split('/').filter((p: string) => p);
    let current = root;
    parts.forEach((part: string, index: number) => {
      const isLast = index === parts.length - 1;
      const currentPath = parts.slice(0, index + 1).join('/');
      if (!current.children[part]) {
        current.children[part] = {
          id: currentPath,
          name: part,
          path: currentPath,
          type: isLast && file.type !== 'folder' ? 'file' : 'folder', 
          children: {}
        };
      }
      if (isLast && file.type !== 'folder') {
        current.children[part].fileData = file;
      }
      current = current.children[part];
    });
  });
  return root;
};

// --- Components ---

const ContextMenu = ({ x, y, options, onClose }: { x: number, y: number, options: { label: string, icon?: any, action: () => void, danger?: boolean }[], onClose: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div 
      ref={ref}
      className="fixed z-[100] bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 min-w-[160px] animate-fade-in"
      style={{ top: y, left: x }}
    >
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => { opt.action(); onClose(); }}
          className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-zinc-800 ${opt.danger ? 'text-red-400' : 'text-zinc-300'}`}
        >
          {opt.icon && <opt.icon size={14} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const FileTreeItem = ({ 
  node, level, onSelect, selectedFile, expandedFolders, onToggle, 
  onContextMenu, onRename, onDelete, onCreate, 
  renamingId, setRenamingId, onRenameSubmit,
  creatingState, setCreatingState, onCreateSubmit,
  onDragStart, onDrop
}: any) => {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedFile === node.path;
  const isRenaming = renamingId === node.path;
  const [renameValue, setRenameValue] = useState(node.name);
  
  // Creation State for children
  const isCreatingChild = creatingState?.parentPath === node.path;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  const handleDragStartInternal = (e: React.DragEvent) => {
    e.stopPropagation();
    onDragStart(e, node);
  };

  const handleDropInternal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(e, node);
  };

  const FileIcon = () => {
    if (node.type === 'folder') {
        return isExpanded 
            ? <FolderOpen size={16} className="text-orange-400" />
            : <Folder size={16} className="text-zinc-500" />;
    }
    const info = getFileInfo(node.name);
    const Icon = info.icon;
    return <Icon size={16} className={info.color} />;
  };

  return (
    <div className="select-none">
      {node.id !== 'root' && (
        <div 
          draggable
          onDragStart={handleDragStartInternal}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropInternal}
          onContextMenu={handleContextMenu}
          className={`
            group flex items-center gap-1 py-1 px-2 cursor-pointer transition-all duration-150 text-sm relative border-l-2
            ${isSelected ? 'bg-zinc-800/80 text-orange-400 border-orange-500' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border-transparent'}
          `}
          style={{ paddingLeft: `${Math.max(4, level * 16 + 4)}px` }}
          onClick={(e) => {
            e.stopPropagation();
            if (node.type === 'folder') onToggle(node.path);
            else onSelect(node.fileData);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setRenamingId(node.path);
            setRenameValue(node.name);
          }}
        >
          <span className="shrink-0 flex items-center justify-center w-5 h-5">
             <FileIcon />
          </span>
          
          {isRenaming ? (
            <input 
              autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameSubmit(node.path, renameValue);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onBlur={() => setRenamingId(null)}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-950 border border-orange-500 rounded px-1 py-0.5 text-xs text-white w-full outline-none"
            />
          ) : (
            <span className="truncate flex-1 font-medium">{node.name}</span>
          )}
        </div>
      )}

      {(isExpanded || node.id === 'root') && (
        <div>
          {/* Inline Creation Input */}
          {isCreatingChild && (
             <div 
               className="flex items-center gap-1 py-1 px-2 text-sm"
               style={{ paddingLeft: `${Math.max(4, (level + 1) * 16 + 4)}px` }}
             >
                <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {creatingState.type === 'folder' ? <Folder size={16} className="text-zinc-500" /> : <FilePlus size={16} className="text-zinc-500" />}
                </span>
                <input 
                  autoFocus
                  type="text"
                  placeholder={`New ${creatingState.type}...`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCreateSubmit(e.currentTarget.value);
                    if (e.key === 'Escape') setCreatingState(null);
                  }}
                  onBlur={() => setCreatingState(null)}
                  className="bg-zinc-950 border border-orange-500 rounded px-1 py-0.5 text-xs text-white w-full outline-none"
                />
             </div>
          )}

          {Object.values(node.children)
            .sort((a: any, b: any) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
            .map((child: any) => (
              <FileTreeItem 
                key={child.id} 
                node={child} 
                level={level + 1} 
                onSelect={onSelect} 
                selectedFile={selectedFile}
                expandedFolders={expandedFolders}
                onToggle={onToggle}
                onContextMenu={onContextMenu}
                onRename={onRename}
                onDelete={onDelete}
                onCreate={onCreate}
                renamingId={renamingId}
                setRenamingId={setRenamingId}
                onRenameSubmit={onRenameSubmit}
                creatingState={creatingState}
                setCreatingState={setCreatingState}
                onCreateSubmit={onCreateSubmit}
                onDragStart={onDragStart}
                onDrop={onDrop}
              />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

const CodeGenerator = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const monaco = useMonaco();
  
  // --- State ---
  const [files, setFiles] = useState<any[]>([]);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [unsavedFiles, setUnsavedFiles] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [currentProject, setCurrentProject] = useState<any>(null);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showConsole, setShowConsole] = useState(false);
  const [isAppRunning, setIsAppRunning] = useState(false);
  const [logs, setLogs] = useState<{id: number, time: string, text: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [minimapEnabled, setMinimapEnabled] = useState(true);
  
  // Context Menu & Operations
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creatingState, setCreatingState] = useState<{ parentPath: string, type: 'file' | 'folder' } | null>(null);
  
  // Status Bar Info
  const [cursorPos, setCursorPos] = useState({ ln: 1, col: 1 });
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('currentProject');
      if (!stored) { navigate('/projects'); return; }
      const project = JSON.parse(stored);
      setCurrentProject(project);
      
      if (project.codeFiles) {
        setFiles(project.codeFiles.map((f: any) => ({...f, type: 'file', status: 'completed'})));
      } else {
        // Fallback or initial generation logic (simplified for this update)
        setFiles([{ name: 'README.md', content: '# New Project', type: 'file' }]);
      }
      
      // Restore tabs
      const savedTabs = localStorage.getItem(`tabs_${project.id}`);
      if (savedTabs) {
        const { open, active } = JSON.parse(savedTabs);
        setOpenFiles(open);
        setActiveFile(active);
      }
    };
    init();
  }, [navigate]);

  // Persist Tabs
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem(`tabs_${currentProject.id}`, JSON.stringify({ open: openFiles, active: activeFile }));
    }
  }, [openFiles, activeFile, currentProject]);

  // --- File Operations ---

  const handleSave = useCallback(async () => {
    if (currentProject && files.length > 0) {
      const updatedProject = { ...currentProject, codeFiles: files.filter(f => f.type !== 'folder') };
      await StorageService.saveProject(updatedProject);
      setUnsavedFiles(new Set());
      showToast("Project saved", "success");
    }
  }, [currentProject, files, showToast]);

  const handleCodeChange = (newCode: string | undefined) => {
    if (activeFile && newCode !== undefined) {
      setFiles(prev => prev.map(f => f.name === activeFile ? { ...f, content: newCode } : f));
      
      setUnsavedFiles(prev => new Set(prev).add(activeFile));
      
      // Debounced Auto-Save
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        // In a real app, we might save to IDB here, but for now we update the main state which is enough
        // We just clear the unsaved indicator visually if we want "auto-save" to mean "persisted"
        // But typically auto-save means saving to disk. Here we save to StorageService.
        handleSave();
      }, 2000); // 2s debounce for full save
    }
  };

  const handleCreateSubmit = (name: string) => {
    if (!creatingState || !name.trim()) return;
    const { parentPath, type } = creatingState;
    const prefix = parentPath ? `${parentPath}/` : '';
    const newPath = `${prefix}${name.trim()}`;
    
    if (files.some(f => f.name === newPath)) {
      showToast("Name already exists", "error");
      return;
    }

    const newFile = {
      name: newPath,
      type: type,
      content: type === 'file' ? '' : undefined,
      language: type === 'file' ? getFileInfo(newPath).lang : undefined
    };

    setFiles(prev => [...prev, newFile]);
    setExpandedFolders(prev => new Set(prev).add(parentPath || 'root'));
    setCreatingState(null);
    
    if (type === 'file') {
      setOpenFiles(prev => [...prev, newPath]);
      setActiveFile(newPath);
    }
    handleSave();
  };

  const handleRenameSubmit = (oldPath: string, newNameShort: string) => {
    if (!newNameShort.trim()) return;
    const parts = oldPath.split('/');
    parts.pop();
    const prefix = parts.join('/');
    const newPath = prefix ? `${prefix}/${newNameShort}` : newNameShort;

    if (files.some(f => f.name === newPath)) {
      showToast("Name already exists", "error");
      return;
    }

    setFiles(prev => prev.map(f => {
      if (f.name === oldPath) return { ...f, name: newPath };
      if (f.name.startsWith(oldPath + '/')) return { ...f, name: f.name.replace(oldPath, newPath) };
      return f;
    }));

    setOpenFiles(prev => prev.map(f => f === oldPath ? newPath : f.startsWith(oldPath + '/') ? f.replace(oldPath, newPath) : f));
    if (activeFile === oldPath) setActiveFile(newPath);
    else if (activeFile?.startsWith(oldPath + '/')) setActiveFile(activeFile.replace(oldPath, newPath));

    setRenamingId(null);
    handleSave();
  };

  const handleDelete = (path: string) => {
    if (!window.confirm(`Delete ${path}? This cannot be undone.`)) return;
    setFiles(prev => prev.filter(f => f.name !== path && !f.name.startsWith(path + '/')));
    setOpenFiles(prev => prev.filter(f => f !== path && !f.startsWith(path + '/')));
    if (activeFile === path || activeFile?.startsWith(path + '/')) setActiveFile(null);
    handleSave();
  };

  const handleDragDrop = (e: React.DragEvent, targetNode: any) => {
    const draggedPath = e.dataTransfer.getData('text/plain');
    if (!draggedPath || draggedPath === targetNode.path) return;
    
    // Prevent dropping parent into child
    if (targetNode.path.startsWith(draggedPath + '/')) return;

    const targetDir = targetNode.type === 'folder' ? targetNode.path : targetNode.path.split('/').slice(0, -1).join('/');
    const fileName = draggedPath.split('/').pop();
    const newPath = targetDir ? `${targetDir}/${fileName}` : fileName;

    if (files.some(f => f.name === newPath)) return;

    setFiles(prev => prev.map(f => {
      if (f.name === draggedPath) return { ...f, name: newPath };
      if (f.name.startsWith(draggedPath + '/')) return { ...f, name: f.name.replace(draggedPath, newPath) };
      return f;
    }));
    handleSave();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const newFiles: any[] = [];
    
    for (const file of Array.from(fileList)) {
      const text = await file.text();
      const path = (file as any).webkitRelativePath || file.name;
      const cleanPath = (activeFile ? activeFile.split('/').slice(0, -1).join('/') + '/' : '') + path;
      newFiles.push({ name: cleanPath, content: text, type: 'file', language: getFileInfo(cleanPath).lang });
    }

    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      const filtered = newFiles.filter(f => !existing.has(f.name));
      return [...prev, ...filtered];
    });
    showToast(`Uploaded ${newFiles.length} files`, "success");
    handleSave();
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    files.forEach(f => {
      if (f.type === 'file') zip.file(f.name, f.content);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentProject?.name || 'project'}.zip`;
    link.click();
    showToast("Downloading ZIP...", "success");
  };

  // --- Computed ---
  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const filteredFiles = useMemo(() => {
    if (!searchTerm) return files;
    return files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || (f.content && f.content.toLowerCase().includes(searchTerm.toLowerCase())));
  }, [files, searchTerm]);

  const activeFileData = files.find(f => f.name === activeFile);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-white font-sans" onContextMenu={(e) => e.preventDefault()}>
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-[#141414] border-r border-zinc-800 transition-all duration-300 flex flex-col`}>
        <div className="h-10 flex items-center justify-between px-3 border-b border-zinc-800 bg-[#141414]">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Explorer</span>
          <div className="flex items-center gap-1">
             <button onClick={() => setShowSearch(!showSearch)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400"><SearchIcon size={14} /></button>
             <button onClick={() => setExpandedFolders(new Set())} className="p-1 hover:bg-zinc-800 rounded text-zinc-400"><Minimize2 size={14} /></button>
          </div>
        </div>

        {showSearch && (
          <div className="p-2 border-b border-zinc-800">
            <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
              <SearchIcon size={12} className="text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search files..." 
                className="bg-transparent border-none outline-none text-xs text-white ml-2 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        )}

        <div 
          className="flex-1 overflow-y-auto custom-scrollbar"
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, type: 'root', path: '' });
          }}
        >
          <FileTreeItem 
            node={fileTree} 
            level={-1}
            selectedFile={activeFile}
            expandedFolders={expandedFolders}
            onToggle={(path: string) => setExpandedFolders(prev => {
              const next = new Set(prev);
              if (next.has(path)) next.delete(path); else next.add(path);
              return next;
            })}
            onSelect={(file: any) => {
              if (!openFiles.includes(file.name)) setOpenFiles(prev => [...prev, file.name]);
              setActiveFile(file.name);
            }}
            onContextMenu={(e: any, node: any) => setContextMenu({ x: e.clientX, y: e.clientY, type: node.type, path: node.path })}
            renamingId={renamingId}
            setRenamingId={setRenamingId}
            onRenameSubmit={handleRenameSubmit}
            creatingState={creatingState}
            setCreatingState={setCreatingState}
            onCreateSubmit={handleCreateSubmit}
            onDragStart={(e: any, node: any) => e.dataTransfer.setData('text/plain', node.path)}
            onDrop={handleDragDrop}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        
        {/* Top Bar */}
        <div className="h-12 bg-[#141414] border-b border-zinc-800 flex items-center justify-between px-4">
           <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-zinc-400 hover:text-white"><Menu size={18} /></button>
              <div className="h-4 w-[1px] bg-zinc-700 mx-1" />
              <Button variant="secondary" className="h-8 text-xs gap-2" onClick={() => fileInputRef.current?.click()}>
                 <Upload size={14} /> Upload
              </Button>
              <Button variant="secondary" className="h-8 text-xs gap-2" onClick={handleDownloadZip}>
                 <Download size={14} /> ZIP
              </Button>
              <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
           </div>
           <div className="flex items-center gap-2">
              <Button onClick={() => setIsAppRunning(!isAppRunning)} className={`h-8 text-xs gap-2 ${isAppRunning ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}>
                 {isAppRunning ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                 {isAppRunning ? 'Stop' : 'Run'}
              </Button>
              <Button variant="secondary" className="h-8 w-8 p-0" onClick={() => setShowConsole(!showConsole)}><Terminal size={14} /></Button>
              <Button variant="secondary" className="h-8 w-8 p-0" onClick={() => setSplitView(!splitView)}><Split size={14} /></Button>
           </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#141414] border-b border-zinc-800 overflow-x-auto no-scrollbar">
           {openFiles.map(path => {
             const isActive = activeFile === path;
             const isUnsaved = unsavedFiles.has(path);
             const info = getFileInfo(path);
             const Icon = info.icon;
             return (
               <div 
                 key={path}
                 onClick={() => setActiveFile(path)}
                 onContextMenu={(e) => {
                   e.preventDefault();
                   setContextMenu({ x: e.clientX, y: e.clientY, type: 'tab', path });
                 }}
                 className={`
                   group flex items-center gap-2 px-3 py-2.5 text-xs border-r border-zinc-800 cursor-pointer min-w-[120px] max-w-[200px] relative
                   ${isActive ? 'bg-[#1e1e1e] text-white' : 'text-zinc-500 hover:bg-[#1e1e1e]/50'}
                 `}
               >
                 {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />}
                 <Icon size={14} className={info.color} />
                 <span className="truncate flex-1">{path.split('/').pop()}</span>
                 {isUnsaved ? (
                   <div className="w-2 h-2 rounded-full bg-orange-500" />
                 ) : (
                   <button 
                     onClick={(e) => { e.stopPropagation(); setOpenFiles(prev => prev.filter(p => p !== path)); }}
                     className="opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded p-0.5"
                   >
                     <X size={12} />
                   </button>
                 )}
               </div>
             );
           })}
        </div>

        {/* Breadcrumbs */}
        {activeFile && (
          <div className="h-6 bg-[#1e1e1e] flex items-center px-4 text-[10px] text-zinc-500 border-b border-zinc-800/50">
             {activeFile.split('/').map((part, i, arr) => (
               <React.Fragment key={i}>
                 <span className="hover:text-zinc-300 cursor-pointer">{part}</span>
                 {i < arr.length - 1 && <ChevronRight size={10} className="mx-1" />}
               </React.Fragment>
             ))}
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 relative flex">
           {activeFileData ? (
             <div className="flex-1 h-full relative">
               <Editor
                 height="100%"
                 theme="vs-dark"
                 path={activeFileData.name}
                 defaultLanguage={activeFileData.language || 'plaintext'}
                 value={activeFileData.content}
                 onChange={handleCodeChange}
                 onMount={(editor, monaco) => {
                   editor.onDidChangeCursorPosition((e) => {
                     setCursorPos({ ln: e.position.lineNumber, col: e.position.column });
                   });
                 }}
                 options={{
                   minimap: { enabled: minimapEnabled },
                   fontSize: 14,
                   fontFamily: 'JetBrains Mono, monospace',
                   padding: { top: 16 },
                   scrollBeyondLastLine: false,
                   smoothScrolling: true,
                   cursorBlinking: 'smooth',
                   cursorSmoothCaretAnimation: 'on',
                   formatOnPaste: true,
                   formatOnType: true
                 }}
               />
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
               <Code2 size={64} className="opacity-20 mb-4" />
               <p>Select a file to edit</p>
               <div className="flex gap-2 mt-4 text-xs">
                 <span className="px-2 py-1 bg-zinc-800 rounded">Cmd+S Save</span>
                 <span className="px-2 py-1 bg-zinc-800 rounded">Cmd+P Search</span>
               </div>
             </div>
           )}
           
           {/* Split View Placeholder */}
           {splitView && activeFileData && (
             <div className="w-1/2 border-l border-zinc-800 h-full bg-[#1e1e1e] flex items-center justify-center text-zinc-600 text-xs">
                Split View (Preview)
             </div>
           )}
        </div>

        {/* Console */}
        {showConsole && (
          <div className="h-48 bg-[#141414] border-t border-zinc-800 flex flex-col">
             <div className="h-8 flex items-center justify-between px-4 border-b border-zinc-800 bg-[#141414]">
                <span className="text-xs font-bold text-zinc-400 uppercase">Console</span>
                <button onClick={() => setLogs([])} className="text-xs text-zinc-500 hover:text-white">Clear</button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 font-mono text-xs text-zinc-300">
                {logs.map(log => (
                  <div key={log.id} className="mb-1">
                    <span className="text-zinc-600 mr-2">[{log.time}]</span>
                    {log.text}
                  </div>
                ))}
                <div ref={consoleEndRef} />
             </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-[10px] select-none">
           <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><GitBranch size={10} /> main</span>
              <span>{unsavedFiles.size > 0 ? 'Unsaved' : 'Saved'}</span>
              {unsavedFiles.size === 0 && <Check size={10} />}
           </div>
           <div className="flex items-center gap-4">
              <span>Ln {cursorPos.ln}, Col {cursorPos.col}</span>
              <span>UTF-8</span>
              <span>{activeFileData?.language?.toUpperCase() || 'TXT'}</span>
              <button onClick={() => setMinimapEnabled(!minimapEnabled)} className="hover:bg-white/20 px-1 rounded">Minimap</button>
           </div>
        </div>

      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={() => setContextMenu(null)}
          options={[
            ...(contextMenu.type === 'folder' || contextMenu.type === 'root' ? [
              { label: 'New File', icon: FilePlus, action: () => setCreatingState({ parentPath: contextMenu.path || '', type: 'file' }) },
              { label: 'New Folder', icon: FolderPlus, action: () => setCreatingState({ parentPath: contextMenu.path || '', type: 'folder' }) },
              { label: 'Upload Files', icon: Upload, action: () => fileInputRef.current?.click() },
            ] : []),
            ...(contextMenu.type !== 'root' && contextMenu.type !== 'tab' ? [
              { label: 'Rename', icon: Edit2, action: () => setRenamingId(contextMenu.path!) },
              { label: 'Delete', icon: Trash2, danger: true, action: () => handleDelete(contextMenu.path!) },
            ] : []),
            ...(contextMenu.type === 'tab' ? [
              { label: 'Close', icon: X, action: () => setOpenFiles(prev => prev.filter(p => p !== contextMenu.path)) },
              { label: 'Close Others', icon: X, action: () => setOpenFiles([contextMenu.path!]) },
              { label: 'Close All', icon: X, action: () => setOpenFiles([]) },
            ] : [])
          ]}
        />
      )}
    </div>
  );
};

// Helper for status bar
const GitBranch = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="6" y1="3" x2="6" y2="15"></line>
    <circle cx="18" cy="6" r="3"></circle>
    <circle cx="6" cy="18" r="3"></circle>
    <path d="M18 9a9 9 0 0 1-9 9"></path>
  </svg>
);

export default CodeGenerator;
