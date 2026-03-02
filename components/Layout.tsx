
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Home, Hammer, Bot, Settings, Zap, FolderKanban, LayoutTemplate, BrainCircuit, Workflow, Wrench, Terminal as TerminalIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { ThreeLoadingScreen } from './ThreeLoadingScreen';

interface LayoutProps {
  children: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, mobile, badge }: { to: string, icon: any, label: string, mobile?: boolean, badge?: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors focus:ring-2 focus:ring-orange-500 outline-none ${
        isActive 
          ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
      } ${mobile ? 'w-full' : ''}`}
    >
      <div className="flex items-center space-x-3">
        <Icon size={20} aria-hidden="true" />
        <span className="font-medium">{label}</span>
      </div>
      {badge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${isActive ? 'bg-white/20 text-white' : 'bg-orange-500 text-white'}`}>
          {badge}
        </span>
      )}
    </Link>
  );
};

const ToolsMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isActive = location.pathname === '/terminal';

  return (
    <div className="space-y-1">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors focus:ring-2 focus:ring-orange-500 outline-none ${
          isOpen || isActive
            ? 'bg-zinc-800 text-white' 
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
        }`}
      >
        <div className="flex items-center space-x-3">
          <Wrench size={20} aria-hidden="true" />
          <span className="font-medium">Tools</span>
        </div>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      
      {isOpen && (
        <div className="pl-11 pr-2 py-1 space-y-1">
          <Link 
            to="/terminal" 
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              isActive 
                ? 'bg-orange-600/20 text-orange-500' 
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <TerminalIcon size={16} aria-hidden="true" />
            <span className="font-medium text-sm">Terminal</span>
          </Link>
        </div>
      )}
    </div>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  
  // Routes that should use the full workspace layout (no sidebar)
  const isWorkspace = location.pathname === '/chat' || location.pathname === '/code' || location.pathname === '/training' || location.pathname === '/logic' || location.pathname === '/terminal';
  const isHome = location.pathname === '/';

  React.useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500); // Force 1.5s loading screen on route change

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && !isWorkspace && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      {!isWorkspace && (
        <aside 
          className={`
            fixed top-0 left-0 bottom-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 
            transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
          aria-label="Sidebar Navigation"
        >
          <div className="h-full flex flex-col">
            <div className="p-6 flex items-center space-x-2 border-b border-zinc-800">
              <Zap className="text-orange-500" size={28} fill="currentColor" aria-hidden="true" />
              <span className="text-xl font-bold text-white">DevForge</span>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1" aria-label="Main">
              <NavItem to="/" icon={Home} label="Home" />
              <NavItem to="/projects" icon={FolderKanban} label="Projects" />
              <NavItem to="/build" icon={Hammer} label="Project Builder" />
              <NavItem to="/logic" icon={Workflow} label="Visual Builder" badge="NEW" />
              <NavItem to="/agents" icon={Bot} label="Agent Dashboard" />
              <NavItem to="/training" icon={BrainCircuit} label="Neural Training" badge="AI" />
              
              <div role="separator" className="pt-4 pb-2 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Resources</div>
              <NavItem to="/templates" icon={LayoutTemplate} label="Templates" />
              <ToolsMenu />
              
              <div role="separator" className="pt-4 pb-2 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Account</div>
              <NavItem to="/settings" icon={Settings} label="Settings" />
            </nav>

            <div className="p-4 border-t border-zinc-800 text-center">
              <div className="bg-zinc-800/50 rounded-lg p-3 text-[10px] text-zinc-500 font-mono">
                GEMINI_3_PRO_ENGINE
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative" id="main-content">
        {!isWorkspace && (
          <header className={`h-16 lg:hidden flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md z-[60] ${isHome ? 'fixed top-0 left-0 right-0' : ''}`}>
            <div className="flex items-center space-x-2">
               <Zap className="text-orange-500" size={24} fill="currentColor" aria-hidden="true" />
               <span className="font-bold text-white">DevForge</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400 focus:ring-2 focus:ring-orange-500"
              aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={isSidebarOpen}
              aria-controls="mobile-navigation"
            >
              {isSidebarOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
          </header>
        )}

        <div className={`flex-1 overflow-x-hidden scroll-smooth ${isWorkspace || isHome ? 'p-0 overflow-hidden' : 'p-4 md:p-8 overflow-y-auto'}`}>
           {isLoading ? (
             <ThreeLoadingScreen />
           ) : (
             <React.Suspense fallback={<ThreeLoadingScreen />}>
              <div className={isHome ? 'h-full overflow-y-auto' : isWorkspace ? 'h-full overflow-hidden relative' : ''}>
                {children}
              </div>
             </React.Suspense>
           )}
        </div>
      </main>
    </div>
  );
};
