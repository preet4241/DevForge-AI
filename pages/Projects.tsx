
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  FolderKanban, ArrowRight, Clock, Plus, MoreVertical, Trash2, Copy, Edit2, 
  ExternalLink, Loader2, X, Monitor, Smartphone, Bot, Box, Check, Database,
  Code2, Terminal, Cpu, ChevronDown, Zap, Search, Filter, ArrowDownAZ, Calendar,
  ArrowUpAZ, ArrowDown, SlidersHorizontal, SortAsc
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Button, Badge } from '../components/UI';
import { StorageService } from '../services/storageService';
import { useToast } from '../components/Toast';

const LANGUAGES = [
  'Node.js', 'Java', 'Python', 'C', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'TypeScript', 'React', 'Bash'
];

const DEFAULT_LANGS: Record<string, string> = {
  web: 'Node.js',
  app: 'Java',
  bot: 'Python',
  software: 'C',
  program: 'C++',
  automation: 'Python'
};

// --- Custom Components ---

const FilterDropdown = ({ 
  value, 
  onChange, 
  options, 
  icon: Icon,
  label 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: { value: string, label: string }[], 
  icon: any,
  label?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLabel = options.find(o => o.value === value)?.label || value;

  return (
     <div className="relative" ref={ref}>
        <button 
           onClick={() => setIsOpen(!isOpen)}
           className={`
             flex items-center justify-between gap-3 bg-zinc-950/50 border rounded-lg px-3 py-2 text-sm transition-all min-w-[160px] w-full
             ${isOpen 
               ? 'border-orange-500/50 text-white ring-1 ring-orange-500/20' 
               : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200'}
           `}
        >
           <div className="flex items-center gap-2 truncate">
              <Icon size={14} className={isOpen ? "text-orange-500" : "text-zinc-500"} />
              <span className="font-medium truncate">{currentLabel}</span>
           </div>
           <ChevronDown size={14} className={`text-zinc-600 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-orange-500' : ''}`} />
        </button>

        {isOpen && (
           <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-[100] overflow-hidden animate-fade-in p-1">
              <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                {label}
              </div>
              {options.map((opt) => (
                 <div 
                    key={opt.value}
                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                    className={`
                      flex items-center justify-between px-2 py-2 rounded-lg text-sm cursor-pointer transition-all
                      ${value === opt.value 
                        ? 'bg-orange-500/10 text-orange-400' 
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}
                    `}
                 >
                    <span>{opt.label}</span>
                    {value === opt.value && <Check size={14} />}
                 </div>
              ))}
           </div>
        )}
     </div>
  );
};

const CustomDropdown = ({ value, onChange, options, label }: { value: string, onChange: (val: string) => void, options: string[], label: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white flex items-center justify-between cursor-pointer transition-all
          ${isOpen ? 'ring-2 ring-orange-500 border-transparent' : 'hover:border-zinc-700'}
        `}
      >
        <div className="flex items-center gap-2">
          <Code2 size={16} className="text-orange-500" />
          <span className="text-sm font-medium">{value}</span>
        </div>
        <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[60] left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          <div className="p-1">
            {options.map((opt) => (
              <div
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`
                  flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors
                  ${value === opt ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}
                `}
              >
                <span>{opt}</span>
                {value === opt && <Check size={14} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

const Projects = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<{ projectId: string, action: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortOption, setSortOption] = useState<string>('newest');

  // Modal State
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectData, setNewProjectData] = useState({
    name: '',
    description: '',
    type: 'web' as 'web' | 'app' | 'bot' | 'software' | 'automation' | 'program',
    language: 'Node.js'
  });

  const isDbEnabled = !!import.meta.env.VITE_FIREBASE_API_KEY;

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await StorageService.getProjects();
      setProjects(data);
    } catch (e) {
      console.error("Failed to load projects", e);
      showToast("Failed to load projects", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = (project: any) => {
    localStorage.setItem('currentProject', JSON.stringify(project));
    navigate('/chat');
  };

  const handleCreateNew = () => {
    setNewProjectData({ name: '', description: '', type: 'web', language: 'Node.js' });
    setShowNewProjectModal(true);
  };

  const handleTypeSelect = (type: 'web' | 'app' | 'bot' | 'software' | 'automation' | 'program') => {
    setNewProjectData({
      ...newProjectData,
      type,
      language: DEFAULT_LANGS[type] || 'Node.js'
    });
  };

  const confirmCreateProject = async () => {
    if (!newProjectData.name.trim()) {
      showToast("Please enter a project name", "warning");
      return;
    }

    const newProject = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: newProjectData.name,
      description: newProjectData.description, 
      type: newProjectData.type, 
      language: newProjectData.language,
      createdAt: Date.now(),
      status: 'active'
    };
    
    setProjects([newProject, ...projects]);
    await StorageService.saveProject(newProject);
    localStorage.setItem('currentProject', JSON.stringify(newProject));
    setShowNewProjectModal(false);
    showToast("Project created successfully", "success");
    navigate('/chat');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project?')) {
      setLoadingAction({ projectId: id, action: 'delete' });
      try {
        await StorageService.deleteProject(id);
        setProjects(prev => prev.filter(p => p.id !== id));
        showToast("Project deleted", "info");
      } catch (e) {
        showToast("Failed to delete project", "error");
      } finally {
        setLoadingAction(null);
        setActiveMenu(null);
      }
    } else {
      setActiveMenu(null);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    setLoadingAction({ projectId: project.id, action: 'duplicate' });
    try {
      const newProject = {
        ...project,
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        name: `${project.name} (Copy)`,
        createdAt: Date.now()
      };
      await StorageService.saveProject(newProject);
      setProjects([newProject, ...projects]);
      showToast("Project duplicated", "success");
    } finally {
      setLoadingAction(null);
      setActiveMenu(null);
    }
  };

  const handleRename = async (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    const newName = window.prompt("Enter new project name:", project.name);
    
    if (newName && newName.trim() !== "" && newName !== project.name) {
      setLoadingAction({ projectId: project.id, action: 'rename' });
      try {
        const updatedProject = { ...project, name: newName };
        await StorageService.saveProject(updatedProject);
        setProjects(prev => prev.map(p => p.id === project.id ? updatedProject : p));
        showToast("Project renamed", "success");
      } finally {
        setLoadingAction(null);
      }
    }
    setActiveMenu(null);
  };

  const getProjectIcon = (type: string) => {
    switch (type) {
      case 'web': return Monitor;
      case 'app': return Smartphone;
      case 'bot': return Bot;
      case 'software': return Box;
      case 'program': return Terminal;
      case 'automation': return Zap;
      default: return Monitor;
    }
  };

  const generateGradient = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash % 360);
    const h2 = Math.abs((hash * 2) % 360);
    return `linear-gradient(135deg, hsla(${h1}, 85%, 60%, 0.15) 0%, hsla(${h2}, 85%, 60%, 0.15) 100%)`;
  };

  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesType = filterType === 'all' || p.type === filterType;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        if (sortOption === 'newest') return b.createdAt - a.createdAt;
        if (sortOption === 'oldest') return a.createdAt - b.createdAt;
        if (sortOption === 'az') return a.name.localeCompare(b.name);
        if (sortOption === 'za') return b.name.localeCompare(a.name);
        return 0;
      });
  }, [projects, searchQuery, filterType, sortOption]);

  const TypeOption = ({ type, icon: Icon, label }: { type: 'web' | 'app' | 'bot' | 'software' | 'automation' | 'program', icon: any, label: string }) => (
    <div 
      onClick={() => handleTypeSelect(type)}
      className={`
        cursor-pointer rounded-lg p-3 border transition-all duration-200 flex flex-col items-center gap-2 relative h-full justify-center
        ${newProjectData.type === type 
          ? 'bg-orange-600/10 border-orange-500 text-orange-400 ring-1 ring-orange-500' 
          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700'}
      `}
    >
      {newProjectData.type === type && (
        <div className="absolute top-1.5 right-1.5 text-orange-500">
          <Check size={12} />
        </div>
      )}
      <Icon size={20} />
      <span className="text-[10px] font-bold uppercase tracking-tight text-center">{label}</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in h-full flex flex-col relative pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FolderKanban className="text-orange-500" /> My Projects
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-zinc-400">Manage and continue your builds.</p>
            {isDbEnabled && (
              <Badge color="orange">
                 <div className="flex items-center gap-1"><Database size={10} /> Firebase Connected</div>
              </Badge>
            )}
          </div>
        </div>
        <Button variant="primary" onClick={handleCreateNew}>
          <Plus size={18} /> New Project
        </Button>
      </div>

      {/* Toolbar: Search, Filter, Sort */}
      {/* Added z-40 relative to ensure dropdowns appear on top, and removed overflow-hidden */}
      <div className="flex flex-col md:flex-row gap-3 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 backdrop-blur-sm relative z-40">
        <div className="relative flex-1">
           <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
           <input 
             type="text"
             placeholder="Search projects..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="w-full bg-zinc-950/50 border border-zinc-700/50 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-orange-500/50 outline-none placeholder:text-zinc-600 transition-all"
           />
        </div>
        
        <div className="flex gap-2 shrink-0">
           <FilterDropdown 
             label="Filter Type"
             icon={SlidersHorizontal}
             value={filterType}
             onChange={setFilterType}
             options={[
               { value: 'all', label: 'All Types' },
               { value: 'web', label: 'Web Apps' },
               { value: 'app', label: 'Mobile Apps' },
               { value: 'bot', label: 'Bots' },
               { value: 'software', label: 'Software' },
               { value: 'program', label: 'Programs' },
             ]}
           />

           <FilterDropdown 
             label="Sort By"
             icon={SortAsc}
             value={sortOption}
             onChange={setSortOption}
             options={[
               { value: 'newest', label: 'Newest First' },
               { value: 'oldest', label: 'Oldest First' },
               { value: 'az', label: 'Name (A-Z)' },
               { value: 'za', label: 'Name (Z-A)' },
             ]}
           />
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <Loader2 size={32} className="animate-spin text-orange-500" />
          <p className="text-zinc-500">Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600">
            {searchQuery ? <Search size={32} /> : <FolderKanban size={32} />}
          </div>
          <div>
            <h3 className="text-xl font-medium text-white">
              {searchQuery ? 'No matching projects' : 'No projects yet'}
            </h3>
            <p className="text-zinc-500 max-w-sm mx-auto mt-2">
              {searchQuery ? `Try adjusting your search for "${searchQuery}"` : "Start by describing your idea in the Project Builder."}
            </p>
          </div>
          {!searchQuery && (
            <Link to="/build">
               <Button variant="secondary">Start Building</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-0">
          {filteredProjects.map((project) => {
            const ProjectIcon = getProjectIcon(project.type);
            const isMenuOpen = activeMenu === project.id;
            const bgGradient = generateGradient(project.name);

            return (
              <Card 
                key={project.id} 
                className={`group hover:border-orange-500/30 transition-all duration-300 relative cursor-pointer flex flex-col overflow-hidden p-0 border-zinc-800 ${isMenuOpen ? 'z-30 ring-1 ring-zinc-700' : 'z-0'}`}
                onClick={() => handleOpen(project)}
              >
                {/* Generative Gradient Header */}
                <div 
                  className="h-24 w-full relative"
                  style={{ background: bgGradient }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"></div>
                  
                  {/* Floating Icon */}
                  <div className="absolute bottom-4 left-6 w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shadow-lg group-hover:scale-110 group-hover:border-orange-500/50 group-hover:text-orange-400 transition-all duration-300">
                    <ProjectIcon size={20} />
                  </div>

                  {/* Menu Button */}
                  <div className="absolute top-3 right-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (loadingAction) return;
                        setActiveMenu(isMenuOpen ? null : project.id);
                      }}
                      className={`p-1.5 rounded-full backdrop-blur-md transition-colors ${isMenuOpen ? 'bg-zinc-800 text-white' : 'bg-black/20 text-white/70 hover:bg-black/40 hover:text-white'}`}
                      disabled={!!loadingAction}
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-10 cursor-default" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(null);
                          }} 
                        />
                        <div className="absolute right-0 top-8 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-20 py-1 overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
                           <button 
                            onClick={() => handleOpen(project)}
                            disabled={!!loadingAction}
                            className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 disabled:opacity-50"
                          >
                            <ExternalLink size={14} /> Open Project
                          </button>
                          
                          <button 
                            onClick={(e) => handleRename(e, project)}
                            disabled={!!loadingAction}
                            className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 disabled:opacity-50"
                          >
                            {loadingAction?.projectId === project.id && loadingAction?.action === 'rename' ? (
                              <Loader2 size={14} className="animate-spin text-orange-400" />
                            ) : (
                              <Edit2 size={14} /> 
                            )}
                            Rename
                          </button>
                          
                          <button 
                            onClick={(e) => handleDuplicate(e, project)}
                            disabled={!!loadingAction}
                            className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 disabled:opacity-50"
                          >
                            {loadingAction?.projectId === project.id && loadingAction?.action === 'duplicate' ? (
                              <Loader2 size={14} className="animate-spin text-orange-400" />
                            ) : (
                              <Copy size={14} /> 
                            )}
                            Duplicate
                          </button>
                          
                          <div className="border-t border-zinc-800 my-1"></div>
                          
                          <button 
                            onClick={(e) => handleDelete(e, project.id)}
                            disabled={!!loadingAction}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 disabled:opacity-50"
                          >
                             {loadingAction?.projectId === project.id && loadingAction?.action === 'delete' ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} /> 
                            )}
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Content Area */}
                <div className="p-6 pt-2 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white line-clamp-1 group-hover:text-orange-400 transition-colors">{project.name}</h3>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-3 font-medium uppercase tracking-wider">
                     <span>{project.type}</span>
                     <span>•</span>
                     <span className="flex items-center gap-1"><Clock size={10} /> {new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>

                  <p className="text-zinc-400 text-sm mb-6 line-clamp-2 leading-relaxed">
                    {project.description || <em>No description provided.</em>}
                  </p>
                  
                  <div className="mt-auto flex items-center justify-between">
                     <div className="flex gap-2">
                        {project.language && (
                           <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                             {project.language}
                           </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${project.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                           {project.status || 'Active'}
                        </span>
                     </div>
                  </div>
                </div>
                
                {/* Hover Action */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
              </Card>
            );
          })}
        </div>
      )}

      {/* NEW PROJECT MODAL */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl animate-fade-in relative">
             <button 
               onClick={() => setShowNewProjectModal(false)}
               className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
             >
               <X size={20} />
             </button>

             <div className="p-6">
                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                   <FolderKanban className="text-orange-500" size={20} /> Create New Project
                </h2>
                <p className="text-sm text-zinc-500 mb-6 border-b border-zinc-800 pb-4">Initialize a new workspace for the agent swarm.</p>

                <div className="space-y-5">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Project Name</label>
                      <input 
                        type="text" 
                        value={newProjectData.name}
                        onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value})}
                        placeholder="e.g. Super App 2.0"
                        autoFocus
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all placeholder:text-zinc-600"
                      />
                   </div>

                   <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Project Category</label>
                      <div className="grid grid-cols-3 gap-2">
                         <TypeOption type="web" icon={Monitor} label="Website" />
                         <TypeOption type="app" icon={Smartphone} label="Mobile App" />
                         <TypeOption type="bot" icon={Bot} label="Chat Bot" />
                         <TypeOption type="software" icon={Box} label="Software" />
                         <TypeOption type="program" icon={Terminal} label="Program" />
                         <TypeOption type="automation" icon={Zap} label="Automation" />
                      </div>
                   </div>

                   <CustomDropdown 
                      label="Programming Language"
                      value={newProjectData.language}
                      onChange={(val) => setNewProjectData({...newProjectData, language: val})}
                      options={LANGUAGES}
                   />

                   <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description (Optional)</label>
                      <textarea 
                        value={newProjectData.description}
                        onChange={(e) => setNewProjectData({...newProjectData, description: e.target.value})}
                        placeholder="Briefly describe what you want to build..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all placeholder:text-zinc-600 h-20 resize-none"
                      />
                   </div>
                </div>

                <div className="mt-8 flex gap-3">
                   <Button onClick={confirmCreateProject} className="flex-1 h-12">
                     Launch Project
                   </Button>
                   <Button variant="outline" onClick={() => setShowNewProjectModal(false)} className="h-12 px-6">
                     Cancel
                   </Button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
