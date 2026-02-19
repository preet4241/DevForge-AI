import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

const MermaidBlock = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      try {
        mermaid.initialize({ 
          startOnLoad: false, 
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'Inter',
        });
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        
        if (isMounted) {
          setSvg(svg);
          setError(false);
        }
      } catch (e) {
        console.error("Mermaid rendering failed:", e);
        if (isMounted) {
          setError(true);
        }
      }
    };

    renderChart();

    return () => { isMounted = false; };
  }, [chart]);

  if (error) {
    return (
      <div className="my-4 rounded-lg overflow-hidden border border-red-900/50 bg-red-900/10 p-4">
        <p className="text-red-400 text-xs font-mono mb-2">Diagram rendering failed</p>
        <pre className="text-xs text-zinc-500 overflow-x-auto">{chart}</pre>
      </div>
    );
  }

  return (
    <div 
      className="my-6 flex justify-center bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 overflow-x-auto shadow-inner"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};

export const Markdown = ({ text }: { text: string }) => {
  if (!text) return null;

  // Split content by code blocks to handle them separately
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="text-sm leading-relaxed text-zinc-300 space-y-1">
      {parts.map((part, index) => {
        // Handle Code Blocks
        if (part.startsWith('```')) {
          const firstLineBreak = part.indexOf('\n');
          let lang = '';
          let codeContent = '';

          if (firstLineBreak !== -1) {
             lang = part.slice(3, firstLineBreak).trim();
             const lastLineBreak = part.lastIndexOf('\n');
             if (lastLineBreak > firstLineBreak) {
                codeContent = part.slice(firstLineBreak + 1, lastLineBreak);
             } else {
                codeContent = part.slice(firstLineBreak + 1).replace(/```$/, '');
             }
          } else {
             codeContent = part.slice(3).replace(/```$/, '');
          }

          // Special handling for Mermaid Diagrams
          if (lang === 'mermaid') {
            return (
              <React.Fragment key={index}>
                <MermaidBlock chart={codeContent} />
              </React.Fragment>
            );
          }
          
          return (
            <div key={index} className="my-4 rounded-lg overflow-hidden border border-zinc-800 bg-[#0d1117]">
              {lang && (
                <div className="px-4 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs font-mono text-zinc-500 flex items-center justify-between">
                  <span>{lang}</span>
                </div>
              )}
              <pre className="p-4 overflow-x-auto">
                <code className="font-mono text-xs text-zinc-300 whitespace-pre">{codeContent}</code>
              </pre>
            </div>
          );
        }

        // Standard text rendering simulation
        let html = part
          // Escape HTML
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")

          // Headers
          .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-zinc-800">$1</h1>')
          .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-white mt-6 mb-3">$1</h2>')
          .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-orange-400 mt-5 mb-2">$1</h3>')
          .replace(/^#### (.*$)/gm, '<h4 class="text-base font-medium text-zinc-200 mt-4 mb-2">$1</h4>')

          // Horizontal Rules
          .replace(/^---$/gm, '<hr class="my-6 border-zinc-800" />')

          // Blockquotes
          .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-orange-500/50 pl-4 py-1 my-4 text-zinc-400 italic bg-zinc-900/30 rounded-r">$1</blockquote>')

          // Lists (Unordered)
          .replace(/^\s*[-*]\s+(.*$)/gm, '<div class="flex gap-2 ml-1 my-1 items-start"><span class="text-zinc-500 mt-1.5 text-[10px]">•</span><span class="flex-1">$1</span></div>')

          // Lists (Numbered)
          .replace(/^\s*(\d+)\.\s+(.*$)/gm, '<div class="flex gap-2 ml-1 my-1 items-start"><span class="text-zinc-500 font-mono text-xs mt-0.5">$1.</span><span class="flex-1">$2</span></div>')

          // Bold
          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
          
          // Italic
          .replace(/\*(.*?)\*/g, '<em class="text-zinc-400 italic">$1</em>')

          // Inline Code
          .replace(/`([^`]+)`/g, '<code class="bg-zinc-800/80 px-1.5 py-0.5 rounded text-orange-300 font-mono text-xs border border-zinc-700/50">$1</code>')

          // Links
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-orange-400 hover:text-orange-300 underline decoration-orange-400/30 hover:decoration-orange-300 underline-offset-2 transition-colors">$1</a>')

          // Newlines
          .replace(/\n\n/g, '<div class="h-3"></div>')
          .replace(/\n/g, '<br />');

        return (
          <div key={index} dangerouslySetInnerHTML={{ __html: html }} className="markdown-body" />
        );
      })}
    </div>
  );
};
