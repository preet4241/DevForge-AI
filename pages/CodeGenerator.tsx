import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Code2, ChevronRight, ChevronDown,
  FileCode, RefreshCw, FilePlus, 
  FolderPlus, Folder, X, FileJson, FileType, 
  Hash, FileText, Image as ImageIcon, FolderTree,
  Save, PlayCircle, Menu, Trash2, Edit2, 
  MoreHorizontal,
  Search,
  ArrowLeft,
  ChevronLeft,
  Upload,
  Download,
  Terminal,
  Play,
  Square
} from 'lucide-react';
import { Button, Card, Tooltip } from '../components/UI';
import { generateCodeModule, generateArchitecture } from '../services/geminiService';
import { useToast } from '../components/Toast';
import { StorageService } from '../services/storageService';
import Editor, { useMonaco } from '@monaco-editor/react';
import JSZip from 'jszip';

// --- File Type & Language Helper ---
const getFileInfo = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'ts':
    case 'tsx':
      return { icon: Code2, color: 'text-blue-400', label: 'TypeScript', bg: 'bg-blue-500/10', lang: 'typescript' };
    case 'js':
    case 'jsx':
      return { icon: FileCode, color: 'text-yellow-400', label: 'JavaScript', bg: 'bg-yellow-500/10', lang: 'javascript' };
    case 'css':
    case 'scss':
      return { icon: Hash, color: 'text-blue-300', label: 'Style', bg: 'bg-blue-400/10', lang: 'css' };
    case 'html':
      return { icon: FileCode, color: 'text-orange-500', label: 'HTML', bg: 'bg-orange-500/10', lang: 'html' };
    case 'json':
      return { icon: FileJson, color: 'text-yellow-300', label: 'JSON', bg: 'bg-yellow-400/10', lang: 'json' };
    case 'md':
      return { icon: FileText, color: 'text-zinc-400', label: 'Markdown', bg: 'bg-zinc-500/10', lang: 'markdown' };
    default:
      return { icon: FileType, color: 'text-zinc-500', label: 'File', bg: 'bg-zinc-500/10', lang: 'plaintext' };
  }
};

const SAMPLE_LOGS = [
  "🔍 Analyzing project architecture...",
  "📦 Installing dependencies: react, lucide-react, jszip...",
  "🚀 Starting development server on port 3000...",
  "✨ Compiling module: App.tsx",
  "✅ Compilation successful. No errors found.",
  "🌐 Network request: GET /api/v1/user/profile 200 OK",
  "🛡️ Security audit: No high-severity vulnerabilities detected.",
  "⚠️ Warning: useEffect in Header.tsx has a missing dependency.",
  "🔥 HMR (Hot Module Replacement) active.",
  "🐘 Database connection established.",
  "🧠 Memory usage stable: 156MB / 512MB"
];

// --- Tree Helper Functions ---
interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: Record<string, FileNode>;
  fileData?: any;
}

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
      
      if (isLast) {
        if (file.type !== 'folder') {
           current.children[part].fileData = file;
        }
      }
      
      current = current.children[part];
    });
  });

  return root;
};

const FileTreeItem = ({ 
  node, 
  level, 
  onSelect, 
  selectedFile, 
  expandedFolders, 
  onToggle, 
  onSelectFolder, 
  activeFolder,
  onDelete,
  onRename,
  onCreate
}: any) => {
  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedFile === node.fileData?.name;
  const isFolderActive = activeFolder === node.path;
  const isRoot = level === -1;
  
  const children = Object.values(node.children).sort((a: any, b: any) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const FileIcon = () => {
    if (node.type === 'folder') {
        return isExpanded 
            ? <ChevronDown size={16} className={isFolderActive ? 'text-orange-400' : 'text-zinc-500'} />
            : <ChevronRight size={16} className={isFolderActive ? 'text-orange-400' : 'text-zinc-500'} />;
    }
    const info = getFileInfo(node.name);
    const Icon = info.icon;
    return <Icon size={16} className={isSelected ? 'text-orange-500' : info.color} />;
  };

  const FolderIcon = () => (
      <Folder size={16} className={`mr-1.5 ${isFolderActive ? 'text-orange-400 fill-orange-500/20' : 'text-zinc-500'}`} />
  );

  return (
    <div className="select-none">
      {!isRoot && (
        <div 
          className={`
            group flex items-center gap-1 py-1 px-2 cursor-pointer transition-all duration-200 text-sm relative border-l-2
            ${isSelected 
              ? 'bg-zinc-800/80 text-orange-400 border-orange-500' 
              : isFolderActive 
                ? 'bg-zinc-800/40 text-zinc-200 border-zinc-600' 
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border-transparent'}
          `}
          style={{ paddingLeft: `${Math.max(4, level * 12 + 4)}px` }}
          onClick={(e) => {
            e.stopPropagation();
            if (node.type === 'folder') {
              onToggle(node.id);
              onSelectFolder(node.path);
            } else if (node.fileData) {
              onSelect(node.fileData);
            }
          }}
        >
          <span className="shrink-0 flex items-center justify-center w-5 h-5">
              <FileIcon />
          </span>
          
          {node.type === 'folder' && <FolderIcon />}
          
          <span className="truncate flex-1 font-medium">{node.name}</span>
          
          {/* Status Indicators */}
          {node.fileData?.status === 'generating' && <RefreshCw size={12} className="animate-spin text-orange-500 ml-2" />}
          
          {/* Hover Actions */}
          <div className="hidden group-hover:flex items-center gap-0.5 ml-auto bg-zinc-900 shadow-[-8px_0_8px_-4px_rgba(24,24,27,1)] pl-1 rounded-l z-10">
              {node.type === 'folder' && (
                  <>
                      <button 
                          onClick={(e) => { e.stopPropagation(); onCreate(node.path, 'file'); }}
                          className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                          title="New File inside"
                      >
                          <FilePlus size={13} />
                      </button>
                      <button 
                          onClick={(e) => { e.stopPropagation(); onCreate(node.path, 'folder'); }}
                          className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                          title="New Folder inside"
                      >
                          <FolderPlus size={13} />
                      </button>
                  </>
              )}
              <button 
                  onClick={(e) => { e.stopPropagation(); onRename(node.path); }}
                  className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                  title="Rename"
              >
                  <Edit2 size={13} />
              </button>
              <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(node.path, node.type); }}
                  className="p-1 hover:bg-red-900/30 hover:text-red-400 rounded text-zinc-400"
                  title="Delete"
              >
                  <Trash2 size={13} />
              </button>
          </div>
        </div>
      )}

      {(isExpanded || isRoot) && (
        <div>
            {children.length > 0 ? (
                children.map((child: any) => (
                    <FileTreeItem 
                      key={child.id} 
                      node={child} 
                      level={level + 1} 
                      onSelect={onSelect} 
                      selectedFile={selectedFile}
                      expandedFolders={expandedFolders}
                      onToggle={onToggle}
                      onSelectFolder={onSelectFolder}
                      activeFolder={activeFolder}
                      onDelete={onDelete}
                      onRename={onRename}
                      onCreate={onCreate}
                    />
                ))
            ) : !isRoot && (
                <div 
                    className="text-xs text-zinc-600 italic py-1 pl-4 select-none"
                    style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }}
                >
                    Empty
                </div>
            )}
        </div>
      )}
    </div>
  );
};

const CodeGenerator = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const monaco = useMonaco();
  
  const [architecture, setArchitecture] = useState<string>('');
  
  // State for File Management
  const [files, setFiles] = useState<any[]>([]);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  
  // File Creation & Navigation
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [createLocation, setCreateLocation] = useState('');
  
  // Upload State
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // --- CONSOLE & RUN STATE ---
  const [showConsole, setShowConsole] = useState(false);
  const [isAppRunning, setIsAppRunning] = useState(false);
  const [logs, setLogs] = useState<{id: number, time: string, text: string}[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (monaco) {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2015,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        typeRoots: ["node_modules/@types"]
      });
    }
  }, [monaco]);

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('currentProject');
      if (!stored) {
        navigate('/projects');
        return;
      }
      const project = JSON.parse(stored);
      setCurrentProject(project);

      const plan = localStorage.getItem('currentPlan');
      if (plan && !architecture) {
        if (project.codeFiles && project.codeFiles.length > 0) {
            setFiles(project.codeFiles.map((f: any) => ({...f, type: 'file', status: 'completed'})));
            setArchitecture(project.architecture || '');
        } else {
            setIsGenerating(true);
            try {
                const arch = await generateArchitecture(plan);
                setArchitecture(arch);
                
                const demoFiles = [
                  { name: 'src/App.tsx', lang: 'typescript', status: 'pending', type: 'file', content: '// Generating...' },
                  { name: 'src/components/Header.tsx', lang: 'typescript', status: 'pending', type: 'file', content: '// Generating...' },
                  { name: 'src/styles.css', lang: 'css', status: 'pending', type: 'file', content: '/* Styles */' },
                  { name: 'README.md', lang: 'markdown', status: 'pending', type: 'file', content: '# Project' },
                  { name: 'public/assets', type: 'folder' } 
                ];
                setFiles(demoFiles);
                setExpandedFolders(new Set(['root', 'src', 'src/components', 'public']));
                
                if (demoFiles[0]) {
                    handleGenerateFile(demoFiles[0].name, plan);
                    setOpenFiles([demoFiles[0].name]);
                    setActiveFile(demoFiles[0].name);
                }
            } catch (e) {
                showToast("Failed to generate architecture", "error");
            } finally {
                setIsGenerating(false);
            }
        }
      }
    };
    init();
  }, [navigate]);

  // Log Simulation Loop
  useEffect(() => {
    let interval: any;
    if (isAppRunning) {
      interval = setInterval(() => {
        const newLog = {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          text: SAMPLE_LOGS[Math.floor(Math.random() * SAMPLE_LOGS.length)]
        };
        setLogs(prev => [...prev, newLog].slice(-100)); // Keep last 100 logs
      }, 1500);
    } else {
      setLogs([]);
    }
    return () => clearInterval(interval);
  }, [isAppRunning]);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleGenerateFile = async (fileName: string, context: string) => {
    setFiles(prev => prev.map(f => f.name === fileName ? { ...f, status: 'generating' } : f));
    
    try {
        const content = await generateCodeModule(fileName, context);
        const cleanContent = content.replace(/```[a-z]*\n/g, '').replace(/```$/g, '');
        
        setFiles(prev => prev.map(f => f.name === fileName ? { ...f, content: cleanContent, status: 'completed' } : f));
        
        if (currentProject) {
            const updatedProject = { ...currentProject };
            if (!updatedProject.codeFiles) updatedProject.codeFiles = [];
            updatedProject.codeFiles = updatedProject.codeFiles.filter((f: any) => f.name !== fileName);
            updatedProject.codeFiles.push({ name: fileName, language: getFileInfo(fileName).lang, content: cleanContent });
            StorageService.saveProject(updatedProject);
        }

    } catch (e) {
        showToast(`Failed to generate ${fileName}`, "error");
        setFiles(prev => prev.map(f => f.name === fileName ? { ...f, status: 'error' } : f));
    }
  };

  const handleFileSelect = (file: any) => {
    if (!openFiles.includes(file.name)) {
      setOpenFiles([...openFiles, file.name]);
    }
    setActiveFile(file.name);
    setIsSidebarOpen(false);
    
    if (file.status === 'pending') {
        const plan = localStorage.getItem('currentPlan') || '';
        handleGenerateFile(file.name, plan);
    }
  };

  const handleCloseFile = (e: React.MouseEvent, fileName: string) => {
    e.stopPropagation();
    const newOpenFiles = openFiles.filter(f => f !== fileName);
    setOpenFiles(newOpenFiles);
    
    if (activeFile === fileName) {
      if (newOpenFiles.length > 0) {
        setActiveFile(newOpenFiles[newOpenFiles.length - 1]);
      } else {
        setActiveFile(null);
      }
    }
  };

  const handleToggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCodeChange = (newCode: string | undefined) => {
    if (activeFile && newCode !== undefined) {
      setFiles(prev => prev.map(f => f.name === activeFile ? { ...f, content: newCode } : f));
    }
  };

  // --- REFINED CRUD OPERATIONS ---

  const handleCreateRequest = (path: string, type: 'file' | 'folder') => {
      setCreateLocation(path); 
      setNewItemName('');
      setShowCreateModal(type);
  };

  const handleCreateItem = async () => {
    if (!newItemName.trim()) {
        showToast("Name cannot be empty", "warning");
        return;
    }

    try {
        const type = showCreateModal;
        let prefix = createLocation ? `${createLocation}/` : (activeFolder ? `${activeFolder}/` : '');
        prefix = prefix.replace(/\/+/g, '/');
        
        const name = `${prefix}${newItemName.trim()}`;
        
        if (files.some(f => f.name === name)) {
            throw new Error(`A ${type} with this name already exists.`);
        }

        const newFile = {
            name: name,
            language: type === 'file' ? getFileInfo(name).lang : undefined,
            content: type === 'file' ? '' : undefined,
            type: type,
            status: 'completed'
        };

        const updatedFiles = [...files, newFile];
        setFiles(updatedFiles);
        
        if (createLocation) {
            setExpandedFolders(prev => new Set(prev).add(createLocation));
        }

        if (currentProject) {
            const updatedProject = { ...currentProject, codeFiles: updatedFiles.filter(f => f.type !== 'folder') };
            await StorageService.saveProject(updatedProject);
        }

        showToast(`${type === 'file' ? 'File' : 'Folder'} created`, 'success');
        
        if (type === 'file') {
            handleFileSelect(newFile);
        }

        setShowCreateModal(null);
        setNewItemName('');
        setCreateLocation('');
    } catch (e: any) {
        showToast(e.message, 'error');
    }
  };

  const handleDeleteItem = async (path: string, type: string) => {
    if (!path) return;
    if (!window.confirm(`Are you sure you want to delete ${path}?${type === 'folder' ? ' All contents will be lost.' : ''}`)) return;

    try {
        setFiles(prev => {
            const updated = prev.filter(f => f.name !== path && !f.name.startsWith(path + '/'));
            
            // Update Tabs
            const newOpenFiles = openFiles.filter(f => f !== path && !f.startsWith(path + '/'));
            setOpenFiles(newOpenFiles);
            if (activeFile && (activeFile === path || activeFile.startsWith(path + '/'))) {
                 setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
            }

            if (currentProject) {
                StorageService.saveProject({ ...currentProject, codeFiles: updated.filter(f => f.type !== 'folder') });
            }
            return updated;
        });
        showToast("Deleted successfully", "success");
    } catch (e: any) {
        showToast(e.message, 'error');
    }
  };

  const handleRenameItem = async (oldName: string) => {
    if (!oldName) return;
    const nameParts = oldName.split('/');
    const currentShortName = nameParts.pop();
    const newNameShort = window.prompt("Enter new name:", currentShortName);
    
    if (!newNameShort || newNameShort.trim() === "" || newNameShort === currentShortName) return;

    try {
        const prefix = nameParts.join('/');
        const newName = prefix ? `${prefix}/${newNameShort}` : newNameShort;

        if (files.some(f => f.name === newName)) {
            throw new Error("Name already exists.");
        }

        setFiles(prev => {
            const updated = prev.map(f => {
                if (f.name === oldName) return { ...f, name: newName };
                if (f.name.startsWith(oldName + '/')) { 
                     return { ...f, name: f.name.replace(oldName + '/', newName + '/') };
                }
                return f;
            });

            // Update tabs
            setOpenFiles(prevOpen => prevOpen.map(f => {
                 if (f === oldName) return newName;
                 if (f.startsWith(oldName + '/')) return f.replace(oldName + '/', newName + '/');
                 return f;
            }));

            if (activeFile === oldName) setActiveFile(newName);
            else if (activeFile?.startsWith(oldName + '/')) setActiveFile(activeFile.replace(oldName + '/', newName + '/'));

            // Update expanded folders set
            setExpandedFolders(prevExpanded => {
                const next = new Set<string>();
                prevExpanded.forEach(id => {
                  if (id === oldName) next.add(newName);
                  else if (id.startsWith(oldName + '/')) next.add(id.replace(oldName + '/', newName + '/'));
                  else next.add(id);
                });
                return next;
            });

            if (currentProject) {
                 StorageService.saveProject({ ...currentProject, codeFiles: updated.filter(f => f.type !== 'folder') });
            }
            return updated;
        });
        showToast("Renamed successfully", "success");
    } catch (e: any) {
        showToast(e.message, 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles: any[] = [];
    const filesArray = Array.from(fileList) as File[];

    for (const file of filesArray) {
      try {
        const text = await file.text();
        const relativePath = (file as any).webkitRelativePath || file.name;
        const normalizedPath = (activeFolder ? `${activeFolder}/${relativePath}` : relativePath).replace(/^\//, '').replace(/\/+/g, '/');

        newFiles.push({
            name: normalizedPath,
            language: getFileInfo(normalizedPath).lang,
            content: text,
            type: 'file',
            status: 'completed'
        });
      } catch (err) {
        console.error("Failed to read file", file.name, err);
      }
    }

    if (newFiles.length > 0) {
        setFiles((prev: any[]) => {
            const map = new Map(prev.map((f: any) => [f.name, f]));
            newFiles.forEach((f: any) => map.set(f.name, f));
            const merged = Array.from(map.values());
            
            if (currentProject) {
               StorageService.saveProject({ ...currentProject, codeFiles: merged.filter((f: any) => f.type !== 'folder') });
            }
            return merged;
        });
        showToast(`Uploaded ${newFiles.length} files`, "success");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
    setShowUploadMenu(false);
  };

  const handleDownloadZip = async () => {
    try {
        const zip = new JSZip();
        let fileCount = 0;
        files.forEach(f => {
            if (f.type !== 'folder' && f.content !== undefined) {
                zip.file(f.name, f.content);
                fileCount++;
            }
        });

        if (fileCount === 0) {
            showToast("No files to download", "warning");
            return;
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentProject?.name || 'project'}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast("Project downloaded as ZIP", "success");
    } catch (e) {
        console.error(e);
        showToast("Failed to generate ZIP", "error");
    }
  };

  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const activeFileData = files.find(f => f.name === activeFile);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-white">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950/50">
           <div className="flex items-center gap-2 font-bold text-zinc-200">
             <Code2 className="text-orange-500" size={20} />
             <span>Explorer</span>
           </div>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        
        {/* Project Name / Root Actions */}
        <div 
            className={`px-4 py-3 flex items-center justify-between group cursor-pointer ${activeFolder === '' ? 'bg-zinc-800/50' : ''}`}
            onClick={() => setActiveFolder('')}
        >
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                <ChevronDown size={14} /> {currentProject?.name || 'PROJECT'}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => {e.stopPropagation(); handleCreateRequest('', 'file')}} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="New File"><FilePlus size={14} /></button>
                <button onClick={(e) => {e.stopPropagation(); handleCreateRequest('', 'folder')}} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="New Folder"><FolderPlus size={14} /></button>
                <button onClick={() => setExpandedFolders(new Set(['root']))} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="Reset Tree"><RefreshCw size={14} /></button>
            </div>
        </div>

        {/* Actions Toolbar */}
        <div className="p-2 border-b border-zinc-800 flex gap-1 bg-zinc-900/50 relative">
           <button onClick={() => handleCreateRequest(activeFolder, 'file')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white flex-1 flex justify-center" title="New File"><FilePlus size={16} /></button>
           <button onClick={() => handleCreateRequest(activeFolder, 'folder')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white flex-1 flex justify-center" title="New Folder"><FolderPlus size={16} /></button>
           
           <div className="relative flex-1 flex justify-center">
             <button onClick={() => setShowUploadMenu(!showUploadMenu)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white w-full flex justify-center" title="Upload"><Upload size={16} /></button>
             {showUploadMenu && (
               <div className="absolute top-full left-0 mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-left text-xs hover:bg-zinc-800 text-zinc-300 w-full">Upload Files</button>
                  <button onClick={() => folderInputRef.current?.click()} className="px-3 py-2 text-left text-xs hover:bg-zinc-800 text-zinc-300 w-full">Upload Folder</button>
               </div>
             )}
           </div>
           
           <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
           <input type="file" multiple ref={folderInputRef} className="hidden" onChange={handleFileUpload} {...{ webkitdirectory: "", directory: "" } as any} />
        </div>

        {/* Tree Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
           <FileTreeItem 
             node={fileTree} 
             level={-1} 
             onSelect={handleFileSelect} 
             selectedFile={activeFile}
             expandedFolders={expandedFolders}
             onToggle={handleToggleFolder}
             onSelectFolder={setActiveFolder}
             activeFolder={activeFolder}
             onDelete={handleDeleteItem}
             onRename={handleRenameItem}
             onCreate={handleCreateRequest}
           />
        </div>
        
        {/* Status Bar */}
        <div className="p-2 border-t border-zinc-800 text-[10px] text-zinc-500 truncate bg-zinc-900 flex items-center gap-2">
           <Folder size={12} /> {activeFolder || 'root'}
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
         {/* Top Bar Tabs */}
         <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-0 shrink-0">
            <div className="flex items-center h-full overflow-x-auto no-scrollbar">
               <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-3 text-zinc-400 hover:text-white border-r border-zinc-800 h-full">
                  <Menu size={18} />
               </button>
               {openFiles.length === 0 && <div className="px-4 text-xs text-zinc-600 italic">No files open</div>}
               {openFiles.map(fileName => {
                 const isActive = activeFile === fileName;
                 const info = getFileInfo(fileName);
                 const Icon = info.icon;
                 return (
                    <div 
                      key={fileName}
                      onClick={() => setActiveFile(fileName)}
                      className={`
                        group h-full flex items-center gap-2 px-3 min-w-[120px] max-w-[200px] border-r border-zinc-800 cursor-pointer select-none transition-colors relative
                        ${isActive ? 'bg-[#1e1e1e] text-orange-400' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}
                      `}
                    >
                       <div className={`absolute top-0 left-0 right-0 h-0.5 ${isActive ? 'bg-orange-500' : 'bg-transparent'}`} />
                       <Icon size={14} className={isActive ? 'text-orange-500' : info.color} />
                       <span className="truncate text-xs flex-1">{fileName.split('/').pop()}</span>
                       <button onClick={(e) => handleCloseFile(e, fileName)} className={`opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded p-0.5 ${isActive ? 'opacity-100' : ''}`}><X size={12} /></button>
                    </div>
                 );
               })}
            </div>
            <div className="flex items-center gap-2 px-3 bg-zinc-900 h-full border-l border-zinc-800 shrink-0">
               <Tooltip content="Exit to Chat">
                 <Button onClick={() => navigate('/chat')} variant="secondary" className="h-8 w-8 p-0">
                    <ArrowLeft size={18} />
                 </Button>
               </Tooltip>
               
               <Tooltip content={isAppRunning ? "Stop Execution" : "Run Application"}>
                  <Button 
                    onClick={() => setIsAppRunning(!isAppRunning)} 
                    className={`h-8 w-8 p-0 transition-all ${isAppRunning ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
                  >
                    {isAppRunning ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                  </Button>
               </Tooltip>

               <Tooltip content="Toggle Console">
                 <Button 
                   onClick={() => setShowConsole(!showConsole)} 
                   variant="secondary" 
                   className={`h-8 w-8 p-0 border border-zinc-700 ${showConsole ? 'bg-zinc-700 text-orange-400' : 'text-zinc-400'}`}
                 >
                    <Terminal size={18} />
                 </Button>
               </Tooltip>

               <Tooltip content="Download ZIP">
                 <Button onClick={handleDownloadZip} className="h-8 w-8 p-0 bg-orange-600 hover:bg-orange-500">
                    <Download size={18} />
                 </Button>
               </Tooltip>
            </div>
         </div>

         {/* Editor Content & Console Panel */}
         <div className="flex-1 flex flex-col min-h-0 relative">
            <div className="flex-1 relative">
               {activeFileData ? (
                  activeFileData.status === 'generating' ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-4">
                        <RefreshCw className="animate-spin text-orange-500" size={32} />
                        <p className="animate-pulse">Building logic...</p>
                     </div>
                  ) : (
                    <Editor
                      height="100%"
                      theme="vs-dark"
                      path={activeFileData.name}
                      defaultLanguage={getFileInfo(activeFileData.name).lang}
                      value={activeFileData.content}
                      onChange={handleCodeChange}
                      options={{
                        minimap: { enabled: true },
                        fontSize: 14,
                        fontFamily: 'JetBrains Mono, monospace',
                        padding: { top: 20 },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        smoothScrolling: true
                      }}
                    />
                  )
               ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-4 bg-[#1e1e1e]">
                     <div className="w-24 h-24 rounded-3xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
                        <Code2 size={48} className="text-zinc-500" />
                     </div>
                     <p className="text-lg font-medium text-zinc-500">Select a file from the explorer</p>
                     <div className="flex gap-2 text-xs text-zinc-700 font-mono">
                        <span className="px-2 py-1 bg-zinc-800/50 rounded">Alt+N New File</span>
                        <span className="px-2 py-1 bg-zinc-800/50 rounded">Ctrl+S Save</span>
                     </div>
                  </div>
               )}
            </div>

            {/* Bottom Console Panel */}
            {showConsole && (
               <div className="h-1/3 border-t border-zinc-800 bg-zinc-950 flex flex-col animate-slide-up shadow-2xl relative z-20">
                  <div className="h-8 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/80 shrink-0">
                     <div className="flex items-center gap-2">
                        <Terminal size={12} className="text-orange-500" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                           Live Console {isAppRunning && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                        </span>
                     </div>
                     <div className="flex items-center gap-2">
                        <button onClick={() => setLogs([])} className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase tracking-wider font-bold">Clear</button>
                        <button onClick={() => setShowConsole(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-zinc-300 custom-scrollbar bg-black/30">
                     {!isAppRunning && logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                           <div className="p-3 rounded-full bg-zinc-900 border border-zinc-800">
                              <Terminal size={24} className="opacity-20" />
                           </div>
                           <p className="italic">No logs yet. Run the app to see live output.</p>
                        </div>
                     ) : (
                        <div className="space-y-1">
                           {logs.map((log) => (
                              <div key={log.id} className="flex gap-3 animate-fade-in group">
                                 <span className="text-zinc-600 shrink-0 select-none group-hover:text-zinc-500 transition-colors">[{log.time}]</span>
                                 <span className="break-all">{log.text}</span>
                              </div>
                           ))}
                           <div ref={consoleEndRef} />
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
           <Card className="w-full max-w-sm animate-fade-in border-orange-500/30">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                 {showCreateModal === 'file' ? <FilePlus size={20} className="text-orange-500" /> : <FolderPlus size={20} className="text-orange-500" />}
                 Create {showCreateModal === 'file' ? 'File' : 'Folder'}
              </h3>
              
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-xs text-zinc-500 uppercase font-bold">Location</label>
                    <div className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded text-zinc-400 text-xs font-mono flex items-center gap-2 overflow-hidden">
                       <Folder size={12} className="shrink-0" />
                       <span className="truncate">{createLocation || activeFolder || 'root'} /</span>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs text-zinc-500 uppercase font-bold">Name</label>
                    <input 
                      autoFocus
                      type="text" 
                      placeholder={showCreateModal === 'file' ? "e.g., Component.tsx" : "e.g., components"}
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateItem()}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none transition-colors"
                    />
                 </div>

                 <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => { setShowCreateModal(null); setNewItemName(''); }}>Cancel</Button>
                    <Button onClick={handleCreateItem}>Create</Button>
                 </div>
              </div>
           </Card>
        </div>
      )}

    </div>
  );
};

export default CodeGenerator;