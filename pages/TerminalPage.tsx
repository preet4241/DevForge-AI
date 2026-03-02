import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';

const TerminalPage = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#09090b', // zinc-950
        foreground: '#e4e4e7', // zinc-200
        cursor: '#f97316', // orange-500
        selectionBackground: 'rgba(249, 115, 22, 0.3)',
      },
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Sync project files to backend workspace before connecting
    const initTerminal = async () => {
      let folderName = '';
      
      try {
        const savedProject = localStorage.getItem('currentProject');
        if (savedProject) {
          const project = JSON.parse(savedProject);
          folderName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          
          // Sync files to backend
          if (project.codeFiles && project.codeFiles.length > 0) {
            await fetch('/api/workspace/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                folderName: project.name,
                files: project.codeFiles
              })
            });
          }
        }
      } catch (e) {
        console.error('Failed to sync workspace files:', e);
      }

      // Connect to Socket.io backend with folderName query
      const socket = io({
        query: { folderName }
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        term.writeln('\x1b[1;32mConnected to DevForge Terminal Backend\x1b[0m');
      });

      socket.on('terminal.incData', (data: string) => {
        term.write(data);
      });

      socket.on('disconnect', () => {
        term.writeln('\r\n\x1b[1;31mDisconnected from terminal backend\x1b[0m');
      });

      // Handle input
      term.onData((data) => {
        socket.emit('terminal.toTerm', data);
      });
    };

    initTerminal();

    // Robust fitting using ResizeObserver
    const safeFit = () => {
      if (
        terminalRef.current && 
        terminalRef.current.clientWidth > 0 && 
        terminalRef.current.clientHeight > 0 &&
        term.element
      ) {
        try {
          // Check if internal render service is ready to avoid "Cannot read properties of undefined (reading 'dimensions')"
          const core = (term as any)._core;
          if (core && core._renderService && core._renderService.dimensions) {
            fitAddon.fit();
          }
        } catch (e) {
          console.warn('Terminal fit error:', e);
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      safeFit();
    });

    resizeObserver.observe(terminalRef.current);

    // Initial fit attempt with a slight delay to ensure CSS is applied
    const fitTimeout = setTimeout(() => {
      safeFit();
    }, 250); // Increased delay slightly to ensure rendering is complete

    return () => {
      clearTimeout(fitTimeout);
      resizeObserver.disconnect();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      term.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-white overflow-hidden">
      <div className="flex-1 relative w-full h-full">
        <div ref={terminalRef} className="absolute inset-0 overflow-hidden p-2" />
      </div>
    </div>
  );
};

export default TerminalPage;
