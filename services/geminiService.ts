
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ApiConfigService } from "./apiConfigService";
import { MemoryController } from "./memoryService";

const getApiKey = (agentName?: string) => {
  const customConfig = ApiConfigService.getConfigForAgent(agentName || 'global');
  return customConfig?.key || process.env.API_KEY;
};

// Robust retry utility for handling Rate Limits (429) and transient 500s
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> => {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error?.message || "";
      const shouldRetry = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("500") || msg.includes("503");
      if (shouldRetry && retries < maxRetries) {
        const delay = initialDelay * Math.pow(2, retries) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
        continue;
      }
      throw error;
    }
  }
};

export const generateContent = async (prompt: string, systemInstruction?: string, agentName?: string, options: any = {}) => {
  const apiKey = getApiKey(agentName);
  if (!apiKey) throw new Error("API Key not found.");
  
  const ai = new GoogleGenAI({ apiKey });
  const model = options.model || 'gemini-3-pro-preview';
  
  // Fix: Explicitly typed withRetry to GenerateContentResponse to resolve 'unknown' type error
  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model,
    contents: prompt,
    config: { ...options, systemInstruction }
  }));
  return response.text;
};

// --- EXPERT BEST PRACTICES LIBRARY ---
export const BEST_PRACTICES = {
  bot: {
    title: "Telegram & Chatbot Expert Standards",
    rules: ["Use command-based architecture.", "Implement robust error handling.", "Use MarkdownV2."]
  },
  web: {
    title: "Modern Web & SaaS Standards",
    rules: ["Prefer React/Tailwind.", "Use Atomic Design.", "Ensure mobile-first accessibility."]
  },
  app: {
    title: "Mobile App Performance Standards",
    rules: ["Optimize assets.", "Implement offline-first logic.", "Handle permissions gracefully."]
  },
  software: {
    title: "Core Software Engineering Standards",
    rules: ["Follow SOLID/DRY principles.", "Modular architecture.", "Type-safety."]
  }
};

const BASE_AGENT_PERSONAS: Record<string, string> = {
  Aarav: "EXPERT TEAM LEADER: Central coordinator and vision holder.",
  Sanya: "EXPERT RESEARCHER: Conducts deep market research and trend analysis.",
  Arjun: "PRODUCT MANAGER: Converts research into concrete PRDs and user stories.",
  Rohit: "AI ARCHITECT: Systems designer and tech stack specialist.",
  Vikram: "BACKEND ENGINEER: Handles server-side logic and databases.",
  Neha: "FRONTEND ENGINEER: UI/UX and React specialist.",
  Kunal: "DEVOPS: Infrastructure, security, and deployment.",
  Pooja: "QA AUTHORITY: Verifies implementation and detects bugs.",
  Cipher: "RED TEAM: Identifies vulnerabilities and exploits.",
  Shadow: "CODE CRITIC: Senior engineer whisperer finding flaws in JSON format.",
  Maya: "LIVE PREVIEW: Simulated runtime specialist for visual debugging."
};

export const getAgentPersona = (agentName: string): string => {
  const base = BASE_AGENT_PERSONAS[agentName] || BASE_AGENT_PERSONAS['Aarav'];
  const stats = MemoryController.getAgentMemory(agentName).stats;
  let persona = `${base}\n\n[STATUS]: Level ${stats.level}.`;
  if (stats.badges.length > 0) {
    persona += `\n[SPECIALIZATIONS]: ${stats.badges.join(', ')}`;
  }
  return persona;
};

export const AGENT_PERSONAS = BASE_AGENT_PERSONAS;

export const generateJSON = async (prompt: string, systemInstruction: string, schema?: any, options: any = {}) => {
  const config = { ...options, responseMimeType: "application/json", responseSchema: schema };
  const text = await generateContent(prompt, systemInstruction, undefined, config);
  return JSON.parse(text || "{}");
};

export const generateVerifiedCode = async (agentName: string, prompt: string, signal?: AbortSignal): Promise<string> => {
  // Simplified verified code generation
  return await generateContent(prompt, getAgentPersona(agentName), agentName, { signal }) || "";
};

export const generateProjectPlan = async (idea: string, type: string) => {
  return await generateContent(`Plan build for: "${idea}" (${type}). Include Mermaid.js diagrams.`, getAgentPersona('Rohit'), 'Rohit', { 
    thinkingConfig: { thinkingBudget: 1024 },
    tools: [{googleSearch: {}}] 
  });
};

export const conductMarketResearch = async (idea: string) => {
  // Fix: Explicitly typed withRetry to GenerateContentResponse to resolve 'unknown' type error
  const response = await withRetry<GenerateContentResponse>(() => {
    const ai = new GoogleGenAI({ apiKey: getApiKey('Sanya') || "" });
    return ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Intensive market research for: "${idea}".`,
      config: { tools: [{googleSearch: {}}], systemInstruction: getAgentPersona('Sanya') },
    });
  });
  return response.text;
};

export const generateArchitecture = async (plan: string) => generateContent(`Design architecture for: ${plan}`, getAgentPersona('Rohit'), 'Rohit');
export const generateCodeModule = async (fileName: string, context: string) => generateVerifiedCode('Vikram', `File: ${fileName}\nContext: ${context}`);
export const chatWithAgent = async (history: any[], message: string, systemInstruction: string, agentName?: string, options: any = {}) => 
  generateContent(message, agentName ? getAgentPersona(agentName) : systemInstruction, agentName, options);
export const enhanceProjectPrompt = async (currentPrompt: string, projectType: string) => 
  generateContent(`Rewrite for clarity: "${currentPrompt}" (${projectType})`, "You are a Prompt Engineer.", undefined, { temperature: 0.1 });

// Fix: Added missing generateShadowCritique export as it is imported in Chat.tsx
export const generateShadowCritique = async (context: string) => 
  generateContent(`Analyze this work and provide a deep technical critique of the logic and architecture: ${context}`, getAgentPersona('Shadow'), 'Shadow');
