import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronRight, ChevronDown, FileCode, Folder, FolderPlus, FilePlus, 
  Search, MoreHorizontal, Trash2, Edit2, Upload, X, Code2, Hash, FileJson, FileText, FileType,
  Copy, Scissors, Clipboard
} from 'lucide-react';
import { Button } from './UI';

// --- Types ---
export interface FileSystemItem {
  name: string; // full path
  type: 'file' | 'folder';
  content?: string;
  status?: 'pending' | 'generating' | 'completed' | 'error';
  language?: string;
}

interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: Record<string, FileNode>;
  fileData?: FileSystemItem;
}

interface FileExplorerProps {
  files: FileSystemItem[];
  activeFile: string | null;
  onFileSelect: (file: FileSystemItem) => void;
  onCreate: (path: string, type: 'file' | 'folder') => void;
  onDelete: (path: string, type: 'file' | 'folder') => void;
  onRename: (oldPath: string, newPath: string) => void;
  onMove: (srcPath: string, destPath: string) => void;
  onUpload: (files: FileList) => void;
}

// --- Helper: Get File Icon ---
const getFileInfo = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return { icon: Code2, color: 'text-blue-400' };
    case 'js': case 'jsx': return { icon: FileCode, color: 'text-yellow-400' };
    case 'css': case 'scss': return { icon: Hash, color: 'text-blue-300' };
    case 'html': return { icon: Code2, color: 'text-orange-500' };
    case 'json': return { icon: FileJson, color: 'text-yellow-300' };
    case 'md': return { icon: FileText, color: 'text-zinc-400' };
    default: return { icon: FileType, color: 'text-zinc-500' };
  }
};

// --- Helper: Build Tree ---
const buildFileTree = (files: FileSystemItem[]) => {
  const root: FileNode = { id: 'root', name: 'root', path: '', type: 'folder', children: {} };
  files.forEach(file => {
    const path = file.name.replace(/^\//, ''); 
    const parts = path.split('/').filter(p => p);
    let current = root;
    parts.forEach((part, index) => {
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

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files, activeFile, onFileSelect, onCreate, onDelete, onRename, onMove, onUpload
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string, type: 'file' | 'folder' } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const tree = useMemo(() => buildFileTree(files), [files]);

  // --- Handlers ---
  const handleToggle = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, path: string, type: 'file' | 'folder') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path, type });
  };

  const startRenaming = (path: string) => {
    setRenamingId(path);
    setRenameValue(path.split('/').pop() || '');
    setContextMenu(null);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const submitRename = () => {
    if (renamingId && renameValue.trim()) {
      const parts = renamingId.split('/');
      parts.pop();
      const newPath = parts.length > 0 ? `${parts.join('/')}/${renameValue}` : renameValue;
      if (newPath !== renamingId) {
        onRename(renamingId, newPath);
      }
    }
    setRenamingId(null);
  };

  // --- Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, path: string) => {
    e.stopPropagation();
    setDraggedNode(path);
    e.dataTransfer.setData('text/plain', path);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, targetPath: string, targetType: 'file' | 'folder') => {
    e.preventDefault();
    e.stopPropagation();
    const srcPath = e.dataTransfer.getData('text/plain');
    if (!srcPath || srcPath === targetPath) return;

    // If dropping on a file, drop into its parent folder
    let destFolder = targetPath;
    if (targetType === 'file') {
      const parts = targetPath.split('/');
      parts.pop();
      destFolder = parts.join('/');
    }

    // Prevent dropping into self or children
    if (destFolder.startsWith(srcPath)) return;

    const fileName = srcPath.split('/').pop();
    const destPath = destFolder ? `${destFolder}/${fileName}` : fileName || '';
    
    if (destPath !== srcPath) {
      onMove(srcPath, destPath);
    }
    setDraggedNode(null);
  };

  // --- Recursive Tree Item ---
  const TreeItem = ({ node, level }: { node: FileNode, level: number }) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = activeFile === node.path;
    const isRenaming = renamingId === node.path;
    const { icon: Icon, color } = getFileInfo(node.name);

    // Filter by search
    if (searchQuery && node.type === 'file' && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return null;
    }

    // If folder matches search or has matching children, show it
    const hasMatchingChildren = (n: FileNode): boolean => {
      if (n.type === 'file') return n.name.toLowerCase().includes(searchQuery.toLowerCase());
      return Object.values(n.children).some(child => hasMatchingChildren(child));
    };

    if (searchQuery && node.type === 'folder' && !hasMatchingChildren(node)) {
      return null;
    }

    return (
      <div className="select-none">
        <div 
          className={`
            group flex items-center gap-1 py-1 px-2 cursor-pointer transition-all duration-150 text-sm relative
            ${isSelected ? 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border-l-2 border-transparent'}
          `}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={(e) => {
            e.stopPropagation();
            if (node.type === 'folder') handleToggle(node.path);
            else if (node.fileData) onFileSelect(node.fileData);
          }}
          onContextMenu={(e) => handleContextMenu(e, node.path, node.type)}
          onDoubleClick={(e) => { e.stopPropagation(); startRenaming(node.path); }}
          draggable
          onDragStart={(e) => handleDragStart(e, node.path)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, node.path, node.type)}
        >
          {/* Tree Line Guide (Optional, simplified here) */}
          
          <span className="shrink-0 flex items-center justify-center w-5 h-5">
            {node.type === 'folder' ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <Icon size={14} className={color} />
            )}
          </span>

          {node.type === 'folder' && (
            <Folder size={14} className={`mr-1.5 ${isExpanded ? 'text-blue-400 fill-blue-500/20' : 'text-zinc-500'}`} />
          )}

          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-950 border border-blue-500 rounded px-1 py-0.5 text-xs text-white outline-none min-w-[100px]"
            />
          ) : (
            <span className="truncate flex-1">{node.name}</span>
          )}
        </div>

        {node.type === 'folder' && isExpanded && (
          <div>
            {Object.values(node.children)
              .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
              .map(child => <TreeItem key={child.id} node={child} level={level + 1} />)
            }
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#141414] border-r border-zinc-800" onContextMenu={(e) => handleContextMenu(e, '', 'folder')}>
      {/* Toolbar */}
      <div className="p-2 border-b border-zinc-800 flex gap-1">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2 top-1.5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search files..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded pl-7 pr-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
          />
        </div>
        <div className="flex gap-0.5">
          <Button variant="secondary" className="h-7 w-7 p-0" onClick={() => onCreate('', 'file')} title="New File"><FilePlus size={14} /></Button>
          <Button variant="secondary" className="h-7 w-7 p-0" onClick={() => onCreate('', 'folder')} title="New Folder"><FolderPlus size={14} /></Button>
          <div className="relative group">
            <Button variant="secondary" className="h-7 w-7 p-0" title="Upload"><Upload size={14} /></Button>
            <div className="absolute right-0 top-full mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded shadow-xl hidden group-hover:block z-50">
               <button onClick={() => fileInputRef.current?.click()} className="block w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 text-zinc-300">Upload Files</button>
               <button onClick={() => folderInputRef.current?.click()} className="block w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 text-zinc-300">Upload Folder</button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Inputs */}
      <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => e.target.files && onUpload(e.target.files)} />
      <input type="file" multiple ref={folderInputRef} className="hidden" onChange={(e) => e.target.files && onUpload(e.target.files)} {...{ webkitdirectory: "", directory: "" } as any} />

      {/* Tree */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {Object.values(tree.children)
          .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
          .map(node => <TreeItem key={node.id} node={node} level={0} />)
        }
        {Object.keys(tree.children).length === 0 && (
          <div className="text-center text-zinc-600 text-xs py-8 italic">No files</div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div 
            className="fixed z-50 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="px-2 py-1 text-[10px] text-zinc-500 uppercase font-bold border-b border-zinc-800 mb-1">
              {contextMenu.path ? contextMenu.path.split('/').pop() : 'Project'}
            </div>
            <button onClick={() => { onCreate(contextMenu.path, 'file'); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-blue-600 hover:text-white flex items-center gap-2">
              <FilePlus size={12} /> New File
            </button>
            <button onClick={() => { onCreate(contextMenu.path, 'folder'); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-blue-600 hover:text-white flex items-center gap-2">
              <FolderPlus size={12} /> New Folder
            </button>
            {contextMenu.path && (
              <>
                <div className="my-1 border-t border-zinc-800" />
                <button onClick={() => startRenaming(contextMenu.path)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-blue-600 hover:text-white flex items-center gap-2">
                  <Edit2 size={12} /> Rename
                </button>
                <button onClick={() => { onDelete(contextMenu.path, contextMenu.type); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/50 hover:text-red-200 flex items-center gap-2">
                  <Trash2 size={12} /> Delete
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
