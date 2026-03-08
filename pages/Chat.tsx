
import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, ChevronLeft, Wrench, MessageSquare, Monitor, Terminal, Paperclip, X, FileCode, 
  ArrowUp, Activity, MoreVertical, Rocket, Zap, Globe, Download, Code, Maximize2, Minimize2, Copy, Check,
  Ghost, MessageCircleWarning, Trash2, BookOpen, Sparkles, Book, BrainCircuit, Save,
  Play, Square, MessageCircle, ClipboardList, Smartphone, Tablet, Settings, Loader2, Github
} from 'lucide-react';
import { Button, Badge, Tooltip } from '../components/UI';
import { Orchestrator } from '../services/orchestrator';
import { generateShadowCritique, scaffoldProject, generateDetailedPlan, reviseDetailedPlan, generatePujaQuestions, generateArchitectureManifest, QAQuestion } from '../services/geminiService';
import { LearningService, DiaryEntry } from '../services/learningService';
import { MemoryController } from '../services/memoryService';
import { StorageService } from '../services/storageService';
import { useNavigate } from 'react-router-dom';
import { Markdown } from '../components/Markdown';
import { ActivityLogPanel } from '../components/ActivityLogPanel';
import { ActivityLogEntry } from '../types';
import { useToast } from '../components/Toast';
import { runGraph } from '../services/langgraph/graphs';
import { useIDE } from '../contexts/IDEContext';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { collection, addDoc, query, orderBy, limit, getDocs, startAfter, doc, setDoc, onSnapshot, getDoc, Timestamp, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { GitSyncModal } from '../components/GitSyncModal';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  agentName?: string;
  isStreaming?: boolean;
}

interface Artifact {
  id: string;
  language: string;
  title: string;
  content: string;
  agent: string;
  timestamp: number;
}

interface Whisper {
  id: string;
  critique: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
}

const SAMPLE_LOGS = [
  "🔍 Analyzing neural weights for project consistency...",
  "📦 Loading agent dependencies: Aarav, Rohit, Neha, Vikram...",
  "🚀 Initializing sandbox environment for logic verification...",
  "✨ Syncing project state with local database...",
  "✅ Handshake with Gemini 3.0 Pro successful.",
  "🌐 Monitoring active sockets for real-time updates...",
  "🛡️ Cipher agent: Scanning input for adversarial patterns...",
  "⚠️ Memory warning: Conversation history approaching context limit.",
  "🔥 Hot-reload active for code artifact generation.",
  "🐘 DB Client: Persistent session established.",
  "🧠 Thinking budget allocated: 2048 tokens."
];

const Chat = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { state: ideState, dispatch: ideDispatch } = useIDE();
  const [project, setProject] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGraphStyle, setSelectedGraphStyle] = useState<"Basic" | "CrewAI" | "AutoGen" | "AutoGPT">("Basic");
  
  // Artifacts
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [showArtifacts, setShowArtifacts] = useState(false);

  // Shadow / Whispers
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [showWhispers, setShowWhispers] = useState(false);
  const [isShadowThinking, setIsShadowThinking] = useState(false);

  // Tasks
  const [showTasks, setShowTasks] = useState(false);

  // Console & Runtime
  const [showConsole, setShowConsole] = useState(false);
  const [logs, setLogs] = useState<{id: number, time: string, text: string}[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [isAppRunning, setIsAppRunning] = useState(false);
  
  const [showWhisperModal, setShowWhisperModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  
  const [viewMode, setViewMode] = useState<'chat' | 'preview'>('chat');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<{agent: string, status: string} | null>(null);
  const [showGraphMenu, setShowGraphMenu] = useState(false);
  
  // Workflow State
  const [workflowStage, setWorkflowStage] = useState<'idle' | 'analyzing' | 'plan_review' | 'qa' | 'executing'>('idle');
  const [generatedPlan, setGeneratedPlan] = useState<string>('');
  const [qaQuestions, setQaQuestions] = useState<QAQuestion[]>([]);
  const [qaAnswers, setQaAnswers] = useState<Record<string, string>>({});
  const [isPlanEditing, setIsPlanEditing] = useState(false);
  const [planEditFeedback, setPlanEditFeedback] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');
  
  // Lazy Loading State
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Aarav Thinking State
  const [thinkingLogs, setThinkingLogs] = useState<string[]>([]);
  const [currentThinkingText, setCurrentThinkingText] = useState('');
  const thinkingScrollRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initProject = async () => {
      const stored = localStorage.getItem('currentProject');
      if (stored) {
        try {
          const localProj = JSON.parse(stored);
          // Load full project data (including files) from Firestore
          const fullProj = await StorageService.getProject(localProj.id);
          
          if (fullProj) {
            setProject(fullProj);
            // Update local storage with fresh data
            localStorage.setItem('currentProject', JSON.stringify(fullProj));
            
            if (messages.length === 0) {
              if (fullProj.description) {
                const initialUserMsg: Message = {
                  id: Date.now().toString(),
                  role: 'user',
                  text: `Building: ${fullProj.description}`,
                  timestamp: Date.now()
                };
                setMessages([initialUserMsg]);
                
                // Scaffold project if no code files exist
                if (!fullProj.codeFiles || fullProj.codeFiles.length === 0) {
                  handleAddLog({
                    agentId: 'SYSTEM',
                    type: 'working',
                    text: 'Scaffolding smart folder structure...',
                    editable: false,
                    done: false
                  });
                  const structure = await scaffoldProject(fullProj.description);
                  if (structure && structure.length > 0) {
                    fullProj.codeFiles = structure
                      .filter(s => s.type === 'file')
                      .map(s => ({
                        name: s.path,
                        language: s.path.split('.').pop() || 'plaintext',
                        content: s.content || ''
                      }));
                    await StorageService.saveProject(fullProj);
                    setProject(fullProj);
                    localStorage.setItem('currentProject', JSON.stringify(fullProj));
                    
                    // Sync with IDE context
                    structure.forEach(s => {
                      ideDispatch({ type: 'CREATE_NODE', payload: { path: s.path, type: s.type, content: s.content || '' } });
                    });
                    
                    handleAddLog({
                      agentId: 'SYSTEM',
                      type: 'working',
                      text: `Scaffolded ${structure.length} files/folders.`,
                      editable: false,
                      done: true
                    });
                  }
                }

                processOrchestratedMessage(initialUserMsg.text, []);
              } else {
                setMessages([{
                  id: 'welcome',
                  role: 'model',
                  text: "Ready to build. Describe your project requirements to start.",
                  timestamp: Date.now(),
                  agentName: 'SYSTEM'
                }]);
              }
            }
          } else {
             // Fallback to local if fetch fails or returns null
             setProject(localProj);
          }
        } catch (e) {
          console.error("Failed to init project", e);
          navigate('/projects');
        }
      } else {
        navigate('/projects');
      }
    };
    
    initProject();
  }, []);

  // Simulated Console Logs
  useEffect(() => {
    let interval: any;
    if (isAppRunning) {
      interval = setInterval(() => {
        const newLog = {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          text: SAMPLE_LOGS[Math.floor(Math.random() * SAMPLE_LOGS.length)]
        };
        setLogs(prev => [...prev, newLog].slice(-50));
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isAppRunning]);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const extractArtifactsFromText = (text: string, agentName: string) => {
    const foundArtifacts: Artifact[] = [];
    const cleanText = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      const title = `${agentName} Snippet`;
      foundArtifacts.push({
        id,
        language: lang || 'text',
        content: code,
        title,
        agent: agentName,
        timestamp: Date.now()
      });
      return `\n> **Artifact Generated**: [${lang || 'Code'}] ${title}\n> *Check the Artifacts Panel to view full code.*\n`;
    });
    return { cleanText, foundArtifacts };
  };

  const processOrchestratedMessage = async (text: string, history: Message[]) => {
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const langChainHistory = history.map(m => 
        m.role === 'user' ? new HumanMessage({ content: m.text }) : new AIMessage({ content: m.text, name: m.agentName })
      );

      const fileOperations = {
        createFile: async (path: string, content: string) => {
          ideDispatch({ type: 'CREATE_NODE', payload: { path, type: 'file', content } });
          // Sync with Firebase
          if (project) {
            const updatedProject = { ...project };
            if (!updatedProject.codeFiles) updatedProject.codeFiles = [];
            updatedProject.codeFiles.push({ name: path, content, type: 'file' });
            await StorageService.saveProject(updatedProject);
            setProject(updatedProject);
            localStorage.setItem('currentProject', JSON.stringify(updatedProject));
          }
          // Sync with local disk
          try {
            await fetch('/api/workspace/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'create', path, content })
            });
          } catch (e) {
            console.error("Local sync failed", e);
          }
        },
        editFile: async (path: string, content: string) => {
          ideDispatch({ type: 'UPDATE_CONTENT', payload: { path, content } });
          // Sync with Firebase
          if (project) {
            const updatedProject = { ...project };
            if (!updatedProject.codeFiles) updatedProject.codeFiles = [];
            const fileIdx = updatedProject.codeFiles.findIndex((f: any) => f.name === path);
            if (fileIdx > -1) {
              updatedProject.codeFiles[fileIdx].content = content;
            } else {
              updatedProject.codeFiles.push({ name: path, content, type: 'file' });
            }
            await StorageService.saveProject(updatedProject);
            setProject(updatedProject);
            localStorage.setItem('currentProject', JSON.stringify(updatedProject));
          }
          // Sync with local disk
          try {
            await fetch('/api/workspace/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'edit', path, content })
            });
          } catch (e) {
            console.error("Local sync failed", e);
          }
        },
        deleteFile: async (path: string) => {
          ideDispatch({ type: 'DELETE_NODE', payload: path });
          // Sync with Firebase
          if (project) {
            const updatedProject = { ...project };
            if (updatedProject.codeFiles) {
              updatedProject.codeFiles = updatedProject.codeFiles.filter((f: any) => f.name !== path && !f.name.startsWith(path + '/'));
              await StorageService.saveProject(updatedProject);
              setProject(updatedProject);
              localStorage.setItem('currentProject', JSON.stringify(updatedProject));
            }
          }
          // Sync with local disk
          try {
            await fetch('/api/workspace/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', path })
            });
          } catch (e) {
            console.error("Local sync failed", e);
          }
        },
        renameFile: async (oldPath: string, newPath: string) => {
          ideDispatch({ type: 'RENAME_NODE', payload: { oldPath, newPath } });
          // Sync with Firebase
          if (project) {
            const updatedProject = { ...project };
            if (updatedProject.codeFiles) {
              updatedProject.codeFiles = updatedProject.codeFiles.map((f: any) => {
                if (f.name === oldPath) return { ...f, name: newPath };
                if (f.name.startsWith(oldPath + '/')) return { ...f, name: f.name.replace(oldPath, newPath) };
                return f;
              });
              await StorageService.saveProject(updatedProject);
              setProject(updatedProject);
              localStorage.setItem('currentProject', JSON.stringify(updatedProject));
            }
          }
          // Sync with local disk
          try {
            await fetch('/api/workspace/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'rename', oldPath, newPath })
            });
          } catch (e) {
            console.error("Local sync failed", e);
          }
        }
      };

      await runGraph(
        selectedGraphStyle,
        text,
        langChainHistory,
        {
          onNodeStart: (nodeName) => {
            setCurrentStatus({ agent: nodeName, status: `Agent ${nodeName} is thinking...` });
            handleAddLog({
              agentId: nodeName,
              type: 'working',
              text: `Agent ${nodeName} started working`,
              editable: false,
              done: false
            });
          },
          onNodeEnd: (nodeName, output) => {
            handleAddLog({
              agentId: nodeName,
              type: 'working',
              text: `Agent ${nodeName} finished working`,
              editable: false,
              done: true
            });

            const { cleanText, foundArtifacts } = extractArtifactsFromText(output, nodeName);
            
            if (foundArtifacts.length > 0) {
              setArtifacts(prev => [...prev, ...foundArtifacts]);
              setActiveArtifactId(foundArtifacts[0].id);
              setShowArtifacts(true);
            }

            const msgId = Date.now().toString() + Math.random();
            const newMsg: Message = {
              id: msgId,
              role: 'model',
              text: cleanText,
              timestamp: Date.now(),
              agentName: nodeName,
              isStreaming: false 
            };

            setMessages(prev => [...prev, newMsg]);

            // Save to Firebase
            if (project?.id) {
              setDoc(doc(db, "projects", project.id, "chat", newMsg.id), newMsg)
                .catch(e => console.error("Failed to save message to Firebase", e));
            }
          },
          onToolCall: (toolName, output) => {
            handleAddLog({
              agentId: toolName,
              type: 'working',
              text: output,
              editable: false,
              done: true
            });
          }
        },
        fileOperations
      );

    } catch (e: any) {
      if (e.message !== "Process stopped by user.") {
        showToast("Agent process failed", "error");
      }
    } finally {
      setCurrentStatus(null);
      setIsLoading(false);
    }
  };

  // Load initial chat history
  useEffect(() => {
    if (!project?.id) return;

    const fetchMessages = async () => {
      try {
        const q = query(
          collection(db, "projects", project.id, "chat"),
          orderBy("timestamp", "desc"),
          limit(20)
        );
        const snapshot = await getDocs(q);
        
        const loadedMessages: Message[] = [];
        snapshot.forEach(doc => {
          loadedMessages.push({ id: doc.id, ...doc.data() } as Message);
        });
        
        if (loadedMessages.length > 0) {
          setMessages(loadedMessages.reverse());
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === 20);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };

    fetchMessages();
  }, [project?.id]);

  const loadMoreMessages = async () => {
    if (!project?.id || !lastVisible || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    // Save current scroll height to maintain position
    const scrollContainer = chatContainerRef.current;
    const previousScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;

    try {
      const q = query(
        collection(db, "projects", project.id, "chat"),
        orderBy("timestamp", "desc"),
        startAfter(lastVisible),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      const newMessages: Message[] = [];
      snapshot.forEach(doc => {
        newMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      
      setMessages(prev => [...newMessages.reverse(), ...prev]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 20);

      // Restore scroll position
      if (scrollContainer) {
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight - previousScrollHeight;
        });
      }
      
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop } = chatContainerRef.current;
      if (scrollTop === 0 && hasMore && !loadingMore) {
        loadMoreMessages();
      }
    }
  };

  const handleAddLog = (log: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    const newLog: ActivityLogEntry = {
      ...log,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now()
    };
    setActivityLogs(prev => [newLog, ...prev]);
    if (log.type === 'working' && !log.done) {
      setCurrentStatus({ agent: log.agentId, status: log.text });
    } else if (log.done) {
      setCurrentStatus(null);
    }
  };

  const handleProjectUpdate = async (updatedProject: any) => {
    await StorageService.saveProject(updatedProject);
    setProject(updatedProject);
    localStorage.setItem('currentProject', JSON.stringify(updatedProject));
    
    // Sync with IDE context
    if (updatedProject.codeFiles) {
      updatedProject.codeFiles.forEach((f: any) => {
         ideDispatch({ type: 'CREATE_NODE', payload: { path: f.name, type: 'file', content: f.content } });
      });
    }
  };

  const startAnalysis = async (prompt: string) => {
    if (isLoading) return;
    setIsLoading(true);
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setPendingPrompt(prompt);
    
    // Add user message immediately
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: prompt,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);

    // Save to Firebase
    if (project?.id) {
      try {
        await setDoc(doc(db, "projects", project.id, "chat", userMsg.id), userMsg);
      } catch (e) {
        console.error("Failed to save message to Firebase", e);
      }
    }
    
    setWorkflowStage('analyzing');
    setIsModalOpen(false); // Keep modal closed during thinking
    setThinkingLogs(["Initializing Aarav..."]);
    setCurrentThinkingText('');
    
    try {
      if (abortController.signal.aborted) throw new Error("Process stopped by user.");

      // 180s timeout for plan generation (increased from 60s)
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error("Analysis timed out")), 180000)
      );

      let firstChunkReceived = false;
      const firstChunkTimeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => {
          if (!firstChunkReceived) {
            reject(new Error("Aarav could not generate a plan. Please try again."));
          }
        }, 30000)
      );

      console.log("CALLING LLM NOW", prompt);
      const plan = await Promise.race([
        generateDetailedPlan(prompt, (text) => {
          if (abortController.signal.aborted) return;
          firstChunkReceived = true;
          setCurrentThinkingText(prev => {
            const newText = prev + text;
            if (newText.includes('\n')) {
              const lines = newText.split('\n');
              const completeLines = lines.slice(0, -1);
              const incompleteLine = lines[lines.length - 1];
              
              setThinkingLogs(logs => [...logs, ...completeLines.filter(l => l.trim())]);
              return incompleteLine;
            }
            return newText;
          });
        }),
        timeoutPromise,
        firstChunkTimeoutPromise
      ]);
      console.log("LLM RESPONSE", plan);
      
      if (abortController.signal.aborted) throw new Error("Process stopped by user.");

      setGeneratedPlan(plan);
      setWorkflowStage('plan_review');
      setIsModalOpen(true); // Open modal only when plan is ready
    } catch (error: any) {
      if (error.message === "Process stopped by user.") {
        return;
      }
      console.error("LLM FAILED", error);
      showToast(error.message || "Failed to generate plan. Please try again.", "error");
      
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'model',
        text: `⚠️ **Aarav Error:** ${error.message || "Failed to generate project plan. Please try again."}`,
        timestamp: Date.now(),
        agentName: 'Aarav'
      };
      
      setMessages(prev => [...prev, errorMsg]);
      
      // Save error to Firebase
      if (project?.id) {
        setDoc(doc(db, "projects", project.id, "chat", errorMsg.id), errorMsg)
          .catch(e => console.error("Failed to save error message", e));
      }
      
      setWorkflowStage('idle');
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handlePlanEdit = async (feedback: string) => {
    if (!feedback.trim()) return;
    setIsLoading(true);
    try {
      const revised = await reviseDetailedPlan(generatedPlan, feedback);
      setGeneratedPlan(revised);
      setIsPlanEditing(false);
      setPlanEditFeedback('');
    } catch (error) {
      showToast("Failed to revise plan.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanApprove = async () => {
    setIsLoading(true);
    try {
      const questions = await generatePujaQuestions(generatedPlan);
      setQaQuestions(questions);
      setWorkflowStage('qa');
    } catch (error) {
      showToast("Failed to generate questions.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartBuilding = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsModalOpen(false);
    setWorkflowStage('executing');
    
    // Add user message to chat
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: pendingPrompt,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    
    // Save to Firebase
    if (project?.id) {
      try {
        await setDoc(doc(db, "projects", project.id, "chat", userMsg.id), userMsg);
      } catch (e) {
        console.error("Failed to save message to Firebase", e);
      }
    }

    try {
      if (abortController.signal.aborted) throw new Error("Process stopped by user.");

      // Step 4a: Architecture Agent
      handleAddLog({
        agentId: 'Architecture',
        type: 'working',
        text: 'Creating project structure...',
        editable: false,
        done: false
      });

      const structure = await generateArchitectureManifest(generatedPlan, qaAnswers);
      
      if (abortController.signal.aborted) throw new Error("Process stopped by user.");

      // Execute file creation
      for (const item of structure) {
        ideDispatch({
          type: 'CREATE_NODE',
          payload: { path: item.path, type: item.type, content: item.content }
        });
      }

      handleAddLog({
        agentId: 'Architecture',
        type: 'success',
        text: 'Project structure scaffolded.',
        editable: false,
        done: true
      });

      // Step 4b: Run Graph
      const fullPrompt = `
Original Request: ${pendingPrompt}

Approved Plan:
${generatedPlan}

User Preferences (Q&A):
${JSON.stringify(qaAnswers, null, 2)}

Project structure has been scaffolded. Now implement the code for these files.
      `.trim();

      // Convert messages for LangChain
      const history = messages.map(m => 
        m.role === 'user' ? new HumanMessage(m.text) : new AIMessage(m.text)
      );

      // Stream response
      const msgId = Date.now().toString();
      setMessages(prev => [...prev, {
        id: msgId,
        role: 'model',
        text: '',
        timestamp: Date.now(),
        isStreaming: true
      }]);

      const finalResponse = await runGraph(
        selectedGraphStyle, 
        fullPrompt, 
        history, 
        {
            onNodeStart: (node) => handleAddLog({ agentId: node, type: 'working', text: `${node} started...`, done: false, editable: false }),
            onNodeEnd: (node, output) => {
                handleAddLog({ agentId: node, type: 'success', text: `Completed step.`, done: true, editable: false });
                setMessages(prev => prev.map(m => 
                    m.id === msgId ? { ...m, text: (m.text || '') + `\n\n**${node}:**\n${output}` } : m
                ));
            },
            onToolCall: (tool, output) => handleAddLog({ agentId: tool, type: 'working', text: `Tool used: ${output}`, done: false, editable: false })
        },
        undefined,
        abortController.signal
      );

      setMessages(prev => prev.map(m => 
        m.id === msgId ? { ...m, isStreaming: false } : m
      ));

      // Post-run logic (Shadow, etc.)
      setIsShadowThinking(true);
      const critique = await generateShadowCritique(finalResponse);
      if (critique && critique.critique) {
        setWhispers(prev => [{
          id: Date.now().toString(),
          critique: critique.critique,
          severity: critique.severity,
          timestamp: Date.now()
        }, ...prev]);
        setShowWhisperModal(true);
      }
      setIsShadowThinking(false);

    } catch (error: any) {
      if (error.message === 'Process stopped by user.') {
        showToast('Execution stopped.', 'info');
      } else {
        console.error("Execution failed:", error);
        showToast("Execution failed. See console.", "error");
      }
    } finally {
      setIsLoading(false);
      setWorkflowStage('idle');
      setPendingPrompt('');
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setWorkflowStage('idle');
    showToast("Generation stopped by user.", "info");
    
    const stopMsg: Message = {
        id: Date.now().toString(),
        role: 'model',
        text: '🛑 **Generation stopped by user.**',
        timestamp: Date.now(),
        agentName: 'System'
    };
    setMessages(prev => [...prev, stopMsg]);
    
    if (project?.id) {
        setDoc(doc(db, "projects", project.id, "chat", stopMsg.id), stopMsg)
            .catch(e => console.error("Failed to save stop message", e));
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const prompt = inputValue;
    setInputValue(''); // Clear input immediately
    
    // Start the workflow instead of direct execution
    await startAnalysis(prompt);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStatus]);

  // Derive activeArtifact from the artifacts array using activeArtifactId
  const activeArtifact = artifacts.find(art => art.id === activeArtifactId);

  // Aarav Thinking Effect
  useEffect(() => {
    if (workflowStage !== 'analyzing') {
      setThinkingLogs([]);
      setCurrentThinkingText('');
      return;
    }
  }, [workflowStage]);

  // Auto-scroll thinking logs
  useEffect(() => {
    if (thinkingScrollRef.current) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
    }
  }, [thinkingLogs, currentThinkingText]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-200 overflow-hidden font-inter relative">
      {/* HEADER */}
      <header className="h-14 border-b border-zinc-900 flex items-center justify-between px-3 bg-zinc-950 shrink-0 z-20 gap-2">
        {/* LEFT: Back & Project Info */}
        <div className="flex items-center gap-2 min-w-0 shrink-1">
          <button 
            onClick={() => navigate('/projects')} 
            className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-900 shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-col min-w-0">
             <h1 className="text-xs md:text-sm font-bold text-zinc-100 truncate">{project?.name || 'Untitled'}</h1>
             <span className="text-[9px] md:text-[10px] text-green-500 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span> 
                Online
             </span>
          </div>
        </div>

        {/* RIGHT: Tools & Graph Selector */}
        <div className="flex items-center gap-1 shrink-0">
           {/* Graph Selector Dropdown */}
           <div className="relative">
             <button
               onClick={() => setShowGraphMenu(!showGraphMenu)}
               className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[10px] md:text-xs font-medium rounded-lg px-2 py-1.5 transition-all"
             >
               <span className="truncate max-w-[80px] md:max-w-none">{selectedGraphStyle}</span>
               <ChevronLeft size={10} className={`text-zinc-500 transition-transform ${showGraphMenu ? 'rotate-90' : '-rotate-90'}`} />
             </button>
             
             {showGraphMenu && (
               <>
                 <div className="fixed inset-0 z-30" onClick={() => setShowGraphMenu(false)} />
                 <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-40 overflow-hidden animate-fade-in">
                   {(["Basic", "CrewAI", "AutoGen", "AutoGPT"] as const).map((style) => (
                     <button
                       key={style}
                       onClick={() => {
                         setSelectedGraphStyle(style);
                         setShowGraphMenu(false);
                       }}
                       className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors flex items-center justify-between ${selectedGraphStyle === style ? 'text-orange-500 bg-zinc-800/50' : 'text-zinc-400'}`}
                     >
                       {style}
                       {selectedGraphStyle === style && <Check size={12} />}
                     </button>
                   ))}
                 </div>
               </>
             )}
           </div>

           <div className="h-4 w-px bg-zinc-900 mx-1"></div>

           <Tooltip content="Whispers">
             <button 
               onClick={() => setShowWhispers(!showWhispers)}
               className={`p-1.5 rounded-lg transition-all ${showWhispers ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}`}
             >
               <MessageCircle size={16} />
             </button>
           </Tooltip>
           <Tooltip content="Tasks">
             <button 
               onClick={() => setShowTasks(!showTasks)}
               className={`p-1.5 rounded-lg transition-all ${showTasks ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}`}
             >
               <ClipboardList size={16} />
             </button>
           </Tooltip>
           <Tooltip content="GitHub Sync">
             <button 
               onClick={() => setShowGitModal(true)}
               className={`p-1.5 rounded-lg transition-all ${showGitModal ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}`}
             >
               <Github size={16} />
             </button>
           </Tooltip>
           <Tooltip content="Artifacts">
             <button 
               onClick={() => setShowArtifacts(!showArtifacts)}
               className={`p-1.5 rounded-lg transition-all ${showArtifacts ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}`}
             >
               <FileCode size={16} />
             </button>
           </Tooltip>

           <button 
             onClick={() => navigate('/code')}
             className="hidden sm:flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-2 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ml-1"
           >
              <Terminal size={12} className="text-orange-500" />
              <span>IDE</span>
           </button>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* CHAT AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
          {viewMode === 'chat' ? (
            <div 
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 py-6 space-y-6"
            >
              {loadingMore && (
                <div className="flex justify-center py-2">
                  <Loader2 size={16} className="animate-spin text-zinc-500" />
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in group`}>
                  {msg.role === 'model' && (
                    <div className="flex items-center gap-2 mb-1.5 px-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center text-[10px] font-black text-white shadow-sm">
                         {msg.agentName?.[0] || 'A'}
                      </div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{msg.agentName || 'AI Agent'}</span>
                    </div>
                  )}
                  <div className={`
                    max-w-[90%] md:max-w-[80%] rounded-2xl p-4 shadow-sm text-sm md:text-base leading-relaxed
                    ${msg.role === 'user' 
                      ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm border border-zinc-700/50' 
                      : 'bg-zinc-900/40 border border-zinc-800/50 text-zinc-300 rounded-tl-sm'}
                  `}>
                    <Markdown text={msg.text} />
                  </div>
                </div>
              ))}
              
              {/* AARAV THINKING STREAM (Inline) */}
              {workflowStage === 'analyzing' && (
                <div className="flex flex-col items-start animate-fade-in group w-full max-w-[90%] md:max-w-[80%]">
                   <div className="flex items-center gap-2 mb-1.5 px-1 opacity-80">
                      <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm">
                         A
                      </div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Aarav</span>
                   </div>
                   <div className="bg-zinc-900/40 border border-zinc-800/50 text-zinc-300 rounded-2xl rounded-tl-sm p-0 overflow-hidden w-full">
                      <div className="flex items-center gap-2 p-3 border-b border-zinc-800/50 bg-zinc-900/50">
                         <Loader2 size={14} className="animate-spin text-blue-500" />
                         <span className="text-xs font-mono text-blue-400 uppercase tracking-wider">Process Stream</span>
                      </div>
                      <div className="p-4 space-y-2 font-mono text-xs max-h-[300px] overflow-y-auto custom-scrollbar" ref={thinkingScrollRef}>
                        {thinkingLogs.map((log, i) => (
                          <div key={i} className="text-zinc-500 flex items-start gap-2 animate-fade-in">
                            <Check size={12} className="text-green-500 mt-0.5 shrink-0" />
                            <span>{log}</span>
                          </div>
                        ))}
                        <div className="text-zinc-300 flex items-start gap-2">
                           <span className="text-blue-500 mt-0.5 shrink-0">➜</span>
                           <span>
                             {currentThinkingText}
                             <span className="w-1.5 h-3 bg-blue-500 animate-pulse inline-block ml-1 align-middle"/>
                           </span>
                        </div>
                      </div>
                   </div>
                </div>
              )}

              {/* AGENT STATUS INDICATOR */}
              {isLoading && currentStatus && (
                <div className="flex flex-col items-start animate-fade-in">
                   <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center border border-zinc-700">
                         <Activity size={10} className="text-orange-500 animate-pulse" />
                      </div>
                      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{currentStatus.agent}</span>
                   </div>
                   <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></div>
                      <span className="text-xs md:text-sm italic text-zinc-500">{currentStatus.status}</span>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4 shrink-0" />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col bg-zinc-900/30 animate-fade-in">
              {/* Preview Header with Device Toggles */}
              <div className="h-12 border-b border-zinc-800/50 flex items-center justify-center gap-2 shrink-0 bg-zinc-950/50 backdrop-blur-sm">
                <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
                  <Tooltip content="Desktop View">
                    <button 
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1.5 rounded-md transition-all ${previewDevice === 'desktop' ? 'bg-zinc-800 text-orange-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Monitor size={16} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Tablet View">
                    <button 
                      onClick={() => setPreviewDevice('tablet')}
                      className={`p-1.5 rounded-md transition-all ${previewDevice === 'tablet' ? 'bg-zinc-800 text-orange-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Tablet size={16} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Mobile View">
                    <button 
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1.5 rounded-md transition-all ${previewDevice === 'mobile' ? 'bg-zinc-800 text-orange-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Smartphone size={16} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              
              {/* Preview Content */}
              <div className="flex-1 overflow-hidden flex items-center justify-center p-4 md:p-8 bg-zinc-950/30">
                <div 
                  className={`bg-zinc-900 shadow-2xl overflow-hidden transition-all duration-500 flex flex-col border border-zinc-800 relative mx-auto ${
                    previewDevice === 'desktop' ? 'w-full rounded-xl max-w-6xl h-full max-h-[60vh]' : 
                    previewDevice === 'tablet' ? 'w-full max-w-[768px] rounded-[2rem] h-full max-h-[50vh]' : 
                    'w-full max-w-[375px] rounded-[2.5rem] h-full max-h-[40vh]'
                  }`}
                >
                  {/* Device Notch/Header for Mobile/Tablet */}
                  {previewDevice !== 'desktop' && (
                    <div className="h-6 w-full bg-zinc-950 flex items-center justify-center shrink-0 border-b border-zinc-800">
                      <div className="w-16 h-1.5 bg-zinc-800 rounded-full"></div>
                    </div>
                  )}

                  <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-zinc-950 relative overflow-hidden">
                    {!isAppRunning ? (
                      // STATE 1: App Stopped
                      <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in p-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-800">
                          <Square size={24} className="text-zinc-500" fill="currentColor" />
                        </div>
                        <p className="text-zinc-300 font-medium text-lg">App is stopped</p>
                        <p className="text-zinc-500 text-sm mt-2">Click the run button to start execution</p>
                      </div>
                    ) : (
                      // App is Running
                      <>
                        {['web', 'app'].includes(project?.type || '') ? (
                          // STATE 3: Running & Preview Available
                          <iframe 
                            src={process.env.APP_URL}
                            className="w-full h-full border-none bg-white"
                            title="App Preview"
                          />
                        ) : (
                          // STATE 2: Running but No Preview
                          <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in p-6 text-center relative">
                            <div className="absolute inset-0 bg-zinc-950/50 z-0"></div>
                            <div className="relative z-10 flex flex-col items-center">
                               <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-800 relative">
                                  <div className="absolute inset-0 rounded-full border-2 border-green-500/20 animate-ping"></div>
                                  <Activity size={24} className="text-green-500 animate-pulse" />
                               </div>
                               <p className="text-zinc-300 font-medium text-lg">App is running</p>
                               <p className="text-zinc-500 text-sm mt-2">Preview not available for this project type</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BOTTOM CONSOLE PANEL (Drawer) */}
          {showConsole && (
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-zinc-950 border-t border-zinc-800 shadow-2xl z-40 flex flex-col animate-slide-up">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-orange-500" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    System Console {isAppRunning && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setLogs([])} className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase font-bold tracking-wider">Clear</button>
                  <button onClick={() => setShowConsole(false)} className="text-zinc-500 hover:text-white p-1"><X size={14} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-zinc-400 custom-scrollbar">
                {!isAppRunning && logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3">
                    <Terminal size={24} className="opacity-20" />
                    <p className="italic">No logs yet. Run the app to see output.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, idx) => (
                      <div key={idx} className="flex gap-3 border-l border-zinc-800 pl-3">
                        <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                        <span className="break-all">{log.text}</span>
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INPUT AREA */}
          <div className="p-4 bg-zinc-950 border-t border-zinc-900 shrink-0 z-10">
            <div className="max-w-4xl mx-auto flex flex-col gap-3">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/50 transition-all shadow-lg">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask the swarm to modify, build or explain..."
                  className="w-full bg-transparent border-none text-zinc-200 placeholder-zinc-600 px-4 py-4 focus:ring-0 resize-none h-20 md:h-24 text-sm md:text-base"
                />
                <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/30 border-t border-zinc-800/50">
                  {/* Left side: Attach & Console */}
                  <div className="flex items-center gap-2">
                    <Tooltip content="Attach Context">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all"
                      >
                        <Paperclip size={18} />
                      </button>
                    </Tooltip>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => showToast(`Attached ${e.target.files?.length} files.`)} />
                    
                    <Tooltip content="Toggle System Console">
                      <button 
                        onClick={() => setShowConsole(!showConsole)}
                        className={`p-2 rounded-lg transition-all ${showConsole ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                      >
                        <Terminal size={18} />
                      </button>
                    </Tooltip>
                  </div>

                  {/* Right side: Controls & Send */}
                  <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                      <button
                        onClick={() => setViewMode('chat')}
                        className={`px-3 py-1.5 text-[10px] md:text-xs font-bold rounded-md transition-all ${viewMode === 'chat' ? 'bg-zinc-800 text-orange-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Chat
                      </button>
                      <button
                        onClick={() => setViewMode('preview')}
                        className={`px-3 py-1.5 text-[10px] md:text-xs font-bold rounded-md transition-all ${viewMode === 'preview' ? 'bg-zinc-800 text-orange-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Preview
                      </button>
                    </div>

                    <div className="h-5 w-px bg-zinc-800"></div>

                    <Tooltip content={isAppRunning ? "Stop Execution" : "Run Execution"}>
                      <button 
                        onClick={() => setIsAppRunning(!isAppRunning)}
                        className={`p-2 rounded-lg transition-all ${isAppRunning ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20' : 'text-zinc-400 hover:text-green-400 hover:bg-zinc-800'}`}
                      >
                        {isAppRunning ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                      </button>
                    </Tooltip>

                    <Button 
                      onClick={isLoading ? handleStop : handleSendMessage}
                      disabled={!inputValue.trim() && !isLoading}
                      className={`rounded-xl px-4 py-2 h-9 md:h-10 transition-all ${(!inputValue.trim() && !isLoading) ? 'opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500' : isLoading ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 hover:shadow-red-900/40' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20 hover:shadow-orange-900/40'}`}
                    >
                      {isLoading ? <Square size={18} fill="currentColor" /> : <ArrowUp size={18} />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                 <span className="flex items-center gap-1"><Zap size={10} className="text-orange-500" /> Latency: 24ms</span>
                 <span className="flex items-center gap-1"><BrainCircuit size={10} /> Mode: Reasoning</span>
              </div>
            </div>
          </div>
        </div>

        {/* ARTIFACTS PANEL (Right Sidebar) */}
        {showArtifacts && (
           <div className="w-full md:w-[450px] lg:w-[500px] border-l border-zinc-900 bg-zinc-950 flex flex-col z-30 fixed inset-y-0 right-0 md:static animate-slide-in-right shadow-2xl">
              <div className="h-14 border-b border-zinc-900 flex items-center justify-between px-4 bg-zinc-950 shrink-0">
                 <div className="flex items-center gap-2">
                    <FileCode className="text-orange-500" size={18} />
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">Generated Snippets</h2>
                 </div>
                 <div className="flex items-center">
                    <button onClick={() => navigate('/code')} className="mr-3 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-orange-500 px-2 py-1 rounded border border-zinc-800 font-bold uppercase tracking-wider transition-colors">
                       Open IDE
                    </button>
                    <button onClick={() => setShowArtifacts(false)} className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white">
                       <X size={20} />
                    </button>
                 </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                 {/* Artifact Tabs */}
                 <div className="flex border-b border-zinc-900 bg-zinc-950/50 overflow-x-auto no-scrollbar shrink-0">
                    {artifacts.length === 0 ? (
                       <div className="px-4 py-3 text-xs text-zinc-600 italic">No artifacts generated yet.</div>
                    ) : (
                       artifacts.map((art) => (
                          <button
                             key={art.id}
                             onClick={() => setActiveArtifactId(art.id)}
                             className={`px-4 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${activeArtifactId === art.id ? 'border-orange-500 text-orange-400 bg-orange-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                          >
                             {art.title}
                          </button>
                       ))
                    )}
                 </div>

                 {/* Content Area */}
                 <div className="flex-1 overflow-y-auto bg-zinc-900/30 p-0 relative">
                    {activeArtifact ? (
                       <div className="h-full flex flex-col">
                          <div className="p-3 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/50">
                             <Badge color="orange">{activeArtifact.language}</Badge>
                             <div className="flex gap-2">
                                <Tooltip content="Copy Code">
                                  <button onClick={() => {navigator.clipboard.writeText(activeArtifact.content); showToast("Copied to clipboard", "success");}} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors">
                                     <Copy size={16} />
                                  </button>
                                </Tooltip>
                                <Tooltip content="Download File">
                                  <button className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors">
                                     <Download size={16} />
                                  </button>
                                </Tooltip>
                             </div>
                          </div>
                          <pre className="p-4 md:p-6 text-xs font-mono text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre">
                             <code>{activeArtifact.content}</code>
                          </pre>
                       </div>
                    ) : (
                       <div className="h-full flex flex-col items-center justify-center text-zinc-600 p-8 text-center">
                          <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                             <FileCode size={32} />
                          </div>
                          <h3 className="font-bold text-zinc-500">No Artifact Selected</h3>
                          <p className="text-sm mt-2">Select an item from the tabs above to view the generated source code.</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* WHISPERS FLOATING WINDOW */}
      {showWhispers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <MessageCircle className="text-orange-500" size={18} />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Whispers</h2>
              </div>
              <button onClick={() => setShowWhispers(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 text-zinc-400 text-sm italic text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4 opacity-50">
                <MessageCircle size={24} />
              </div>
              No whispers from the shadows yet...
            </div>
          </div>
        </div>
      )}

      {/* TASKS FLOATING WINDOW */}
      {showTasks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-orange-500" size={18} />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Tasks</h2>
              </div>
              <button onClick={() => setShowTasks(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 text-zinc-400 text-sm italic text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4 opacity-50">
                <ClipboardList size={24} />
              </div>
              No active tasks in the queue.
            </div>
          </div>
        </div>
      )}
      {/* WORKFLOW MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${workflowStage === 'analyzing' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                  {workflowStage === 'analyzing' ? <Loader2 size={18} className="animate-spin" /> : 
                   workflowStage === 'qa' ? <MessageCircle size={18} /> :
                   <FileCode size={18} />}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    {workflowStage === 'analyzing' ? 'Aarav is Thinking...' :
                     workflowStage === 'plan_review' ? 'Project Plan' :
                     workflowStage === 'qa' ? 'Clarifying Questions' : 'Ready'}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {workflowStage === 'analyzing' ? 'Analyzing your request' :
                     workflowStage === 'plan_review' ? 'Review and approve the plan' :
                     workflowStage === 'qa' ? 'Puja needs a few details' : ''}
                  </p>
                </div>
              </div>
              {workflowStage !== 'analyzing' && (
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              
              {workflowStage === 'plan_review' && (
                <div className="space-y-4">
                  {isPlanEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-400 uppercase">Your Feedback</label>
                        <button onClick={() => setIsPlanEditing(false)} className="text-xs text-zinc-500 hover:text-white">Cancel</button>
                      </div>
                      <textarea 
                        value={planEditFeedback}
                        onChange={(e) => setPlanEditFeedback(e.target.value)}
                        placeholder="What should be changed in the plan?"
                        className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setIsPlanEditing(false)}>Cancel</Button>
                        <Button variant="primary" onClick={() => handlePlanEdit(planEditFeedback)} disabled={isLoading}>
                          {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Update Plan'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <div className="whitespace-pre-wrap font-mono text-xs text-zinc-300 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                        {generatedPlan}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {workflowStage === 'qa' && (
                <div className="space-y-6">
                  {qaQuestions.map((q) => (
                    <div key={q.id} className="space-y-2 animate-fade-in">
                      <p className="text-sm font-medium text-zinc-200">{q.text}</p>
                      {q.options ? (
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => setQaAnswers(prev => ({ ...prev, [q.id]: opt }))}
                              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${qaAnswers[q.id] === opt ? 'bg-orange-500 text-white border-orange-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input 
                          type="text" 
                          placeholder="Type your answer..."
                          value={qaAnswers[q.id] || ''}
                          onChange={(e) => setQaAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:border-orange-500/50 outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Footer Actions */}
            {workflowStage !== 'analyzing' && (
              <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end gap-3 shrink-0">
                {workflowStage === 'plan_review' && !isPlanEditing && (
                  <>
                    <Button variant="secondary" onClick={() => setIsPlanEditing(true)}>Edit Plan</Button>
                    <Button variant="primary" onClick={handlePlanApprove} disabled={isLoading}>
                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Approve Plan'}
                    </Button>
                  </>
                )}
                {workflowStage === 'qa' && (
                  <Button variant="primary" onClick={handleStartBuilding} disabled={isLoading}>
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Start Building'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* GIT SYNC MODAL */}
      <GitSyncModal 
        isOpen={showGitModal} 
        onClose={() => setShowGitModal(false)} 
        project={project} 
        onProjectUpdate={handleProjectUpdate}
      />
    </div>
  );
};

export default Chat;
