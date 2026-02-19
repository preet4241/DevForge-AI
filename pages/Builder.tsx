
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Rocket, Wand2, Monitor, Smartphone, Bot, Box, Map, Hammer, 
  Lightbulb, RefreshCw, Sparkles, ArrowRight, ShoppingBag, 
  Activity, Wallet, MessageSquare, Cloud, ClipboardList, 
  Search, Cpu, Music, Globe, Shield, Mic, MicOff, History, Trash2
} from 'lucide-react';
import { Button, Card, Tooltip } from '../components/UI';
import { enhanceProjectPrompt } from '../services/geminiService';
import { useToast } from '../components/Toast';

const PLACEHOLDERS = [
  "e.g., A specific Telegram bot that manages a crypto community, bans spam, and welcomes new members...",
  "e.g., A personal finance dashboard that visualizes spending habits and suggests budget improvements...",
  "e.g., An AI-powered fitness app that creates custom workout plans based on available equipment...",
  "e.g., A real-time collaboration tool for remote teams with whiteboarding and video chat...",
  "e.g., An automated inventory management system for small businesses with barcode scanning...",
  "e.g., A travel itinerary planner that suggests destinations based on budget and weather...",
  "e.g., A smart recipe app that generates meal plans based on ingredients in your fridge..."
];

type ProjectType = 'web' | 'app' | 'bot' | 'software';

const QUICK_PROMPTS: Record<ProjectType, string[]> = {
  web: [
    "A responsive e-commerce site for handmade jewelry with product listings, cart, and checkout.",
    "A personal portfolio website with a dark mode toggle, showcasing projects and contact information.",
    "A simple blog platform with markdown support and commenting functionality.",
    "A task management web app with drag-and-drop reordering, categories, and due dates.",
    "A recipe sharing platform where users can upload recipes, search by ingredients, and rate them.",
    "A real-time chat application with user authentication and group chat features.",
    "A weather dashboard displaying current conditions and a 5-day forecast for any city.",
    "A URL shortener service with custom alias support and click analytics.",
    "A landing page for a SaaS product with lead capture form and testimonials."
  ],
  app: [
    "A mobile fitness tracker that logs workouts, calculates calories burned, and tracks progress.",
    "A simple budgeting app that allows users to categorize expenses and set monthly limits.",
    "A habit tracker mobile app with daily reminders and streak tracking.",
    "A flashcard app for language learning with spaced repetition.",
    "A mobile grocery list app that syncs across devices and allows sharing with family members.",
    "A plant care reminder app with a database of common plants and watering schedules.",
    "An alarm clock app with customizable sounds and snooze options.",
    "A meditation timer app with guided sessions and ambient sounds.",
    "A healthy recipe finder app with dietary filters."
  ],
  bot: [
    "A Telegram bot that provides daily weather updates for a specified city.",
    "A Discord bot for moderating a gaming community, including kick/ban and welcome messages.",
    "A simple AI chatbot for a small business website to answer FAQs about services.",
    "A WhatsApp bot for sending automated reminders for appointments.",
    "A Slack bot that integrates with Jira to create tickets from messages.",
    "A Reddit bot that monitors a subreddit for keywords and sends alerts.",
    "A bot that scrapes product prices from e-commerce sites and alerts for drops.",
    "A summary bot that reads news articles from a given RSS feed.",
    "A bot for managing a crypto community, banning spam and welcoming new members."
  ],
  software: [
    "A desktop application for managing a small library, tracking books and borrowers.",
    "A command-line tool for converting video files between different formats.",
    "A desktop utility to encrypt and decrypt files using a password.",
    "A network monitoring tool that pings hosts and reports their status.",
    "An image processing desktop app for basic edits like resizing and cropping.",
    "A simple code formatter for Python files that adheres to PEP8 standards.",
    "A script to automate daily backups of folders to cloud storage.",
    "A password manager desktop app with strong encryption and generation features.",
    "A bulk file renamer tool with regex support."
  ]
};

const getRandomPrompts = (type: ProjectType, count: number): string[] => {
  const allPrompts = QUICK_PROMPTS[type];
  if (!allPrompts || allPrompts.length === 0) return [];
  return [...allPrompts].sort(() => 0.5 - Math.random()).slice(0, count);
};

const getIconForPrompt = (prompt: string) => {
  const lower = prompt.toLowerCase();
  if (lower.includes('commerce') || lower.includes('jewelry') || lower.includes('shopping')) return ShoppingBag;
  if (lower.includes('fitness') || lower.includes('workout') || lower.includes('health')) return Activity;
  if (lower.includes('budget') || lower.includes('finance') || lower.includes('crypto')) return Wallet;
  if (lower.includes('chat') || lower.includes('forum') || lower.includes('message')) return MessageSquare;
  if (lower.includes('weather')) return Cloud;
  if (lower.includes('task') || lower.includes('list') || lower.includes('planner')) return ClipboardList;
  if (lower.includes('search') || lower.includes('scrapes')) return Search;
  if (lower.includes('ai') || lower.includes('bot')) return Cpu;
  if (lower.includes('music') || lower.includes('sound')) return Music;
  if (lower.includes('website') || lower.includes('blog')) return Globe;
  if (lower.includes('encrypt') || lower.includes('password') || lower.includes('security')) return Shield;
  return Lightbulb;
};

const Builder = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [idea, setIdea] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('web');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [mode, setMode] = useState<'plan' | 'build'>('plan');
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // History State
  const [recentIdeas, setRecentIdeas] = useState<string[]>([]);
  
  const [currentPlaceholder, setCurrentPlaceholder] = useState(PLACEHOLDERS[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const placeholderIndexRef = useRef(0);

  const [displayedQuickPrompts, setDisplayedQuickPrompts] = useState<string[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);

  const transitionDuration = 700;
  const displayDuration = 3500;
  const totalInterval = transitionDuration + displayDuration;

  useEffect(() => {
    let timeoutId: any; 
    let intervalId: any;

    intervalId = setInterval(() => {
      setIsTransitioning(true);
      timeoutId = setTimeout(() => {
        placeholderIndexRef.current = (placeholderIndexRef.current + 1) % PLACEHOLDERS.length;
        setCurrentPlaceholder(PLACEHOLDERS[placeholderIndexRef.current]);
        setIsTransitioning(false);
      }, transitionDuration);
    }, totalInterval);

    setCurrentPlaceholder(PLACEHOLDERS[placeholderIndexRef.current]);
    handleShufflePrompts();

    // Load History
    const storedHistory = localStorage.getItem('builder_prompt_history');
    if (storedHistory) {
      try {
        setRecentIdeas(JSON.parse(storedHistory));
      } catch(e) { console.error("Failed to parse history"); }
    }

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    handleShufflePrompts();
  }, [projectType]);

  const handleShufflePrompts = () => {
    setIsShuffling(true);
    setTimeout(() => {
      setDisplayedQuickPrompts(getRandomPrompts(projectType, 4));
      setIsShuffling(false);
    }, 400);
  };

  const saveToHistory = (text: string) => {
    if (!text || text.trim().length < 5) return;
    const newHistory = [text, ...recentIdeas.filter(i => i !== text)].slice(0, 6); // Keep top 6
    setRecentIdeas(newHistory);
    localStorage.setItem('builder_prompt_history', JSON.stringify(newHistory));
  };

  const handleSubmit = async () => {
    if (!idea) return;
    saveToHistory(idea);

    setIsGenerating(true);
    const newProject = { 
      id: Date.now().toString(),
      name: idea.split(' ').slice(0, 4).join(' ') + '...',
      description: idea,
      type: projectType, 
      createdAt: Date.now(),
      status: 'active' 
    };
    const existing = JSON.parse(localStorage.getItem('projects') || '[]');
    localStorage.setItem('projects', JSON.stringify([newProject, ...existing]));
    localStorage.setItem('currentProject', JSON.stringify(newProject));
    await new Promise(resolve => setTimeout(resolve, 800));
    navigate(mode === 'plan' ? '/planning' : '/chat');
  };

  const handleEnhancePrompt = async () => {
    if (!idea.trim()) return;
    setIsEnhancing(true);
    const enhancedIdea = await enhanceProjectPrompt(idea, projectType);
    setIdea(enhancedIdea);
    setIsEnhancing(false);
  };

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately as we just wanted permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error("Microphone permission denied via getUserMedia:", err);
      return false;
    }
  };

  const toggleVoiceInput = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice input is not supported in this browser.", "error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = async (event: any) => {
      console.error("Speech error", event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        // User previously denied. Try to ask explicitly via getUserMedia to trigger prompt
        showToast("Microphone permission needed...", "info");
        const granted = await requestMicPermission();
        if (granted) {
           showToast("Permission granted. Retrying...", "success");
           try {
             // Restart recognition now that we hopefully have permission
             recognition.start();
             // Note: Depending on browser, we might need a fresh instance, 
             // but 'start()' on existing *might* work if it's not in an error state anymore.
             // If not, the user can just click the button again.
           } catch(e) { 
             console.error("Failed to restart recognition after grant", e);
             showToast("Please click microphone again.", "info");
           }
        } else {
           showToast("Microphone access blocked. Please enable in browser settings (URL bar).", "error");
        }
      } else if (event.error === 'no-speech') {
        // Ignore, just stopped hearing things
      } else {
        showToast("Voice input error: " + event.error, "error");
      }
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIdea(prev => {
        const trailingSpace = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
        return prev + trailingSpace + transcript;
      });
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      showToast("Could not start voice input.", "error");
    }
  };

  const clearHistory = () => {
    setRecentIdeas([]);
    localStorage.removeItem('builder_prompt_history');
  };

  const TypeCard = ({ id, icon: Icon, label }: { id: ProjectType, icon: any, label: string }) => (
    <div 
      role="button"
      tabIndex={0}
      onClick={() => setProjectType(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setProjectType(id);
        }
      }}
      className={`
        cursor-pointer rounded-xl p-4 border transition-all duration-200 flex flex-col items-center gap-3
        focus:outline-none focus:ring-2 focus:ring-orange-500
        ${projectType === id 
          ? 'bg-orange-600/10 border-orange-500 text-orange-400 ring-1 ring-orange-500/50' 
          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}
      `}
      aria-pressed={projectType === id}
    >
      <Icon size={32} aria-hidden="true" />
      <span className="font-medium text-sm md:text-base">{label}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">New Build</h1>
        <p className="text-zinc-400">Describe your vision. We'll architect the reality.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="group" aria-label="Project Type Selection">
        <TypeCard id="web" icon={Monitor} label="Web App" />
        <TypeCard id="app" icon={Smartphone} label="Mobile App" />
        <TypeCard id="bot" icon={Bot} label="Telegram Bot" />
        <TypeCard id="software" icon={Box} label="Software" />
      </div>

      <Card className="space-y-6 overflow-visible relative">
        <div className="space-y-2">
          <label htmlFor="project-description" className="text-sm font-medium text-zinc-300 ml-1">Project Description</label>
          <div className="relative group">
            <textarea 
              id="project-description"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="" 
              className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-zinc-200 focus:ring-2 focus:ring-orange-500/50 focus:outline-none focus:border-orange-500/50 resize-none placeholder:text-zinc-600 transition-all shadow-inner pr-12"
            />
            
            {/* Voice Input Button */}
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={toggleVoiceInput}
                className={`p-2 rounded-full transition-all duration-300 shadow-lg ${
                  isListening 
                    ? 'bg-red-500/10 text-red-500 animate-pulse border border-red-500/50' 
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700'
                }`}
                title={isListening ? "Stop Listening" : "Voice Input"}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>

            {idea.length === 0 && (
              <div
                className={`absolute inset-0 flex items-start p-5 text-zinc-500 pointer-events-none transition-all ease-in-out select-none ${
                  isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
                }`}
                style={{ transitionDuration: `${transitionDuration}ms` }}
                aria-hidden="true"
              >
                <div className="max-w-md italic">{currentPlaceholder}</div>
              </div>
            )}
          </div>
        </div>

        {/* History Chips */}
        {recentIdeas.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">
               <span className="flex items-center gap-1.5"><History size={12} /> Recent Ideas</span>
               <button onClick={clearHistory} className="hover:text-red-400 flex items-center gap-1 transition-colors"><Trash2 size={10} /> Clear</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentIdeas.map((hist, idx) => (
                <button
                  key={idx}
                  onClick={() => setIdea(hist)}
                  className="text-xs bg-zinc-900 border border-zinc-800 hover:border-orange-500/40 hover:bg-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded-full transition-all max-w-[200px] truncate text-left"
                  title={hist}
                >
                  {hist}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 pt-2 justify-between items-center">
          <Button 
            onClick={handleEnhancePrompt} 
            disabled={!idea.trim() || isEnhancing || isGenerating}
            loading={isEnhancing}
            variant="outline"
            className="w-full md:w-auto text-sm border-dashed border-zinc-700 text-orange-400 hover:text-white hover:border-orange-500/50 hover:bg-orange-500/5"
          >
            {isEnhancing ? 'Rewriting...' : <><Wand2 size={16} aria-hidden="true" /> Enhance Prompt</>}
          </Button>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Sliding Mode Toggle */}
            <div className="relative flex bg-zinc-950 border border-zinc-800 p-1 rounded-xl w-44 h-12 shadow-inner" role="group" aria-label="Action Mode">
              <div 
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] transition-all duration-300 ease-out rounded-lg ${
                  mode === 'plan' 
                    ? 'translate-x-0 bg-zinc-800 shadow-md border border-zinc-700/30' 
                    : 'translate-x-full bg-orange-600 shadow-lg shadow-orange-900/40'
                }`}
              />
              <button
                onClick={() => setMode('plan')}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 transition-colors duration-300 text-sm font-semibold focus:outline-none ${
                  mode === 'plan' ? 'text-white' : 'text-zinc-500'
                }`}
                aria-pressed={mode === 'plan'}
              >
                <Map size={14} aria-hidden="true" /> Plan
              </button>
              <button
                onClick={() => setMode('build')}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 transition-colors duration-300 text-sm font-semibold focus:outline-none ${
                  mode === 'build' ? 'text-white' : 'text-zinc-500'
                }`}
                aria-pressed={mode === 'build'}
              >
                <Hammer size={14} aria-hidden="true" /> Build
              </button>
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={!idea.trim() || isGenerating || isEnhancing}
              loading={isGenerating}
              className="px-8 py-3 h-12 flex-1 md:flex-none min-w-[160px] text-base font-bold shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] transition-all duration-300"
            >
              {isGenerating ? 'Firing up...' : (mode === 'plan' ? 'Create Plan' : 'Start Build')}
              {!isGenerating && (mode === 'plan' ? <Map size={18} aria-hidden="true" /> : <Rocket size={18} aria-hidden="true" />)}
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Start Ideas - Revamped for "Maza" */}
      <div className="pt-2 animate-fade-in">
        <div className="flex items-center justify-between mb-5 px-1">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="text-orange-500 fill-orange-500/20" size={20} aria-hidden="true" />
            <span>Project Starters</span>
          </h2>
          <button 
            onClick={handleShufflePrompts}
            disabled={isShuffling}
            className="text-xs flex items-center gap-2 text-zinc-500 hover:text-orange-400 transition-all px-3 py-1.5 rounded-full border border-zinc-800 hover:border-orange-500/30 bg-zinc-900/50 hover:bg-zinc-800 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Shuffle project starters"
          >
            <RefreshCw size={13} className={`${isShuffling ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} aria-hidden="true" />
            <span>Shuffle</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedQuickPrompts.map((prompt, index) => {
            const Icon = getIconForPrompt(prompt);
            return (
              <div 
                key={index}
                onClick={() => setIdea(prompt)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIdea(prompt);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`
                  group relative p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm
                  hover:bg-zinc-800/60 hover:border-orange-500/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)]
                  hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-4
                  focus:outline-none focus:ring-2 focus:ring-orange-500
                  ${isShuffling ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}
                `}
                style={{ transitionDelay: `${index * 60}ms` }}
              >
                <div className="mt-0.5 p-2 rounded-xl bg-zinc-800/50 text-zinc-500 group-hover:text-orange-400 group-hover:bg-orange-500/10 group-hover:scale-110 transition-all duration-300 shrink-0">
                  <Icon size={20} aria-hidden="true" />
                </div>

                <div className="flex-1 pr-6">
                  <p className="text-sm text-zinc-400 group-hover:text-zinc-100 leading-relaxed font-medium transition-colors duration-300">
                    {prompt}
                  </p>
                </div>

                <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-orange-500">
                  <ArrowRight size={18} aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Builder;
