
import React, { useState } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, ...props }) => {
  const isInteractive = !!onClick;
  // Local state to track hover status as requested
  const [isHovered, setIsHovered] = useState(false);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick && onClick();
    }
    props.onKeyDown && props.onKeyDown(e);
  };

  return (
    <div 
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-pressed={isInteractive ? isHovered : undefined}
      className={`
        bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm 
        transition-all duration-300 ease-in-out
        ${isInteractive ? 'cursor-pointer hover:bg-zinc-800/80 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950' : ''} 
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '',
  disabled = false,
  loading = false,
  type = 'button',
  ...props
}) => {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 outline-none";
  const variants = {
    primary: "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20 focus:ring-orange-500",
    secondary: "bg-zinc-700 hover:bg-zinc-600 text-white focus:ring-zinc-500",
    outline: "border border-zinc-700 hover:bg-zinc-800 text-zinc-300 focus:ring-zinc-500"
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'orange';
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'orange', className = '', ...props }) => {
  const colors = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20", 
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color] || colors.orange} ${className}`} {...props}>
      {children}
    </span>
  );
};

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);
  const id = React.useId();

  return (
    <div 
      className="relative group/tooltip inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      aria-describedby={isVisible ? id : undefined}
    >
      {children}
      <div 
        id={id}
        role="tooltip"
        className={`
          absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 
          bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-lg shadow-xl 
          transition-all duration-200 z-[100] text-center pointer-events-none 
          ${isVisible ? 'opacity-100 visible transform translate-y-0' : 'opacity-0 invisible transform translate-y-2'}
        `}
      >
        <div className="text-xs text-zinc-300 leading-relaxed">
          {content}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-zinc-700"></div>
      </div>
    </div>
  );
};

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className, containerClassName, ...props }) => {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div className={`relative overflow-hidden bg-zinc-900 ${containerClassName || ''}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/50 animate-pulse">
           {/* Optional placeholder icon */}
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async" // Optimized: Offloads image decoding from main thread
        onLoad={() => setLoaded(true)}
        className={`transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className || ''}`}
        {...props}
      />
    </div>
  );
};
