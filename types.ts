
export interface Project {
  id: string;
  name: string;
  description: string;
  type: 'web' | 'app' | 'bot' | 'software' | 'automation' | 'program';
  language?: string;
  createdAt: number;
  plan?: string;
  architecture?: string;
  codeFiles?: CodeFile[];
}

export interface CodeFile {
  name: string;
  language: string;
  content: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  status: 'idle' | 'working' | 'completed' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  agentName?: string; // To know who spoke
  isInternal?: boolean; // To hide raw JSON steps if needed
}

export interface ProjectState {
  brief: {
    product_goal: string;
    target_users: string;
    features: string[];
    complexity_level: 'beginner' | 'developer';
  } | null;
  plan: {
    agent_flow: string[];
    tech_stack: any;
  } | null;
}

export type ActivityLogType = 'working' | 'created' | 'editing' | 'edited' | 'reading' | 'running' | 'done' | 'error' | 'thinking' | 'waiting';

export interface ActivityLogEntry {
  id: string;
  agentId: string; // e.g., 'Rohit', 'System'
  type: ActivityLogType;
  text: string; // e.g., "Editing main.py file"
  detail?: string; // e.g., "main.py"
  editable?: boolean;
  timestamp: number;
  done: boolean;
}