
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none p-4">
        <style>{`
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .animate-slide-in-right {
            animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-xl transform transition-all duration-300 animate-slide-in-right
              ${toast.type === 'success' ? 'bg-zinc-900/90 border-green-500/30 text-green-100 shadow-green-900/20' : ''}
              ${toast.type === 'error' ? 'bg-zinc-900/90 border-red-500/30 text-red-100 shadow-red-900/20' : ''}
              ${toast.type === 'warning' ? 'bg-zinc-900/90 border-amber-500/30 text-amber-100 shadow-amber-900/20' : ''}
              ${toast.type === 'info' ? 'bg-zinc-900/90 border-blue-500/30 text-blue-100 shadow-blue-900/20' : ''}
            `}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={18} className="text-green-500" />}
              {toast.type === 'error' && <XCircle size={18} className="text-red-500" />}
              {toast.type === 'warning' && <AlertCircle size={18} className="text-amber-500" />}
              {toast.type === 'info' && <Info size={18} className="text-blue-500" />}
            </div>
            
            <div className="flex-1">
              <p className="text-sm font-medium leading-relaxed">{toast.message}</p>
            </div>
            
            <button 
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors -mr-1 -mt-1 text-white/50 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
