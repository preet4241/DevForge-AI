
import { GoogleGenAI, Type, GenerateContentResponse, Chat } from "@google/genai";
import { ApiConfigService, ApiKeyConfig } from "./apiConfigService";
import { MemoryController, AGENT_BADGES } from "./memoryService";
import { KeyPoolService } from "./keyPoolService";

// Helper to race promises with abort signal
const raceWithSignal = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (signal?.aborted) {
    return Promise.reject(new Error("Process stopped by user."));
  }
  if (!signal) return promise;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const listener = () => reject(new Error("Process stopped by user."));
      signal.addEventListener('abort', listener);
      promise.catch(() => {}).finally(() => signal.removeEventListener('abort', listener));
    })
  ]);
};

// --- UNIVERSAL LLM DISPATCHER ---
class UniversalLLM {
  private static async callRestApi(config: ApiKeyConfig, prompt: string, systemInstruction: string | undefined, history: any[] = [], signal?: AbortSignal) {
    let endpoint = "";
    let body: any = {};
    let headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    
    // Add auth header if key is present (skip for some local LLMs if empty)
    if (config.key) {
      headers["Authorization"] = `Bearer ${config.key}`;
    }

    const messages = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    
    messages.push(...history.map(h => ({ 
      role: h.role === 'model' ? 'assistant' : 'user', 
      content: typeof h.parts[0] === 'string' ? h.parts[0] : h.parts[0].text 
    })));
    messages.push({ role: "user", content: prompt });

    if (config.provider === 'openrouter' || config.provider === 'openai' || config.provider === 'ollama') {
      const baseUrl = config.baseUrl || (config.provider === 'openrouter' 
        ? "https://openrouter.ai/api/v1" 
        : config.provider === 'ollama' 
          ? "http://localhost:11434/v1"
          : "https://api.openai.com/v1");
      
      endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      
      body = {
        model: config.modelId,
        messages: messages,
        temperature: 0.7
      };
    } else if (config.provider === 'anthropic') {
      endpoint = "https://api.anthropic.com/v1/messages";
      headers["x-api-key"] = config.key;
      headers["anthropic-version"] = "2023-06-01";
      body = {
        model: config.modelId,
        max_tokens: 4096,
        messages: messages.filter(m => m.role !== 'system'),
      };
      if (systemInstruction) {
        body.system = systemInstruction;
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal // Pass abort signal to fetch
      });

      if (!response.ok) {
        const errText = await response.text();
        const error = new Error(`API Error ${response.status}: ${errText}`);
        (error as any).status = response.status;
        throw error;
      }

      const data = await response.json();
      
      if (config.provider === 'anthropic') {
        return data.content?.[0]?.text || "";
      }
      return data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
      if (error.name === 'AbortError') throw new Error("Process stopped by user.");
      console.error(`LLM REST Call failed (${config.provider}):`, error);
      throw error;
    }
  }

  static async generate(prompt: string, systemInstruction?: string, agentName: string = 'global', options: any = {}) {
    const { signal, ...restOptions } = options;
    
    return await withRetry(async () => {
      const config = await KeyPoolService.acquireKey(agentName);
      let success = false;
      
      try {
        let result: string;
        if (config.provider !== 'gemini') {
          result = await this.callRestApi(config, prompt, systemInstruction, [], signal);
        } else {
          const ai = new GoogleGenAI({ apiKey: config.key });
          const modelName = restOptions.model || config.modelId || 'gemini-3-pro-preview';
          const genConfig: any = { ...restOptions };
          if (systemInstruction) {
            genConfig.systemInstruction = systemInstruction;
          }

          const response = await raceWithSignal(
            ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: genConfig
            }),
            signal
          );
          result = response.text;
        }
        success = true;
        return result;
      } catch (error: any) {
        if (error.message?.includes("429") || error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED")) {
          KeyPoolService.reportRateLimit(config.id);
        }
        throw error;
      } finally {
        KeyPoolService.releaseKey(config.id, success);
      }
    }, 3, 1000, signal);
  }
}

// Robust retry utility for handling Rate Limits (429) and transient 500s
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000, signal?: AbortSignal): Promise<T> => {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.message === "Process stopped by user." || error.name === 'AbortError' || signal?.aborted) {
        throw new Error("Process stopped by user.");
      }
      
      // Retry on Rate Limit (429), Resource Exhausted, or Server Errors (500/503/Rpc failure)
      const shouldRetry = 
        error?.message?.includes("429") || 
        error?.message?.includes("RESOURCE_EXHAUSTED") || 
        error?.message?.includes("Rpc failed") ||
        error?.message?.includes("500") ||
        error?.message?.includes("503") ||
        error?.status === 429 ||
        error?.status >= 500;
      
      if (shouldRetry && retries < maxRetries) {
        const delay = initialDelay * Math.pow(2, retries);
        // Add some jitter
        const jitter = Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        retries++;
        console.warn(`Retrying API call (${retries}/${maxRetries}) due to error:`, error.message);
        continue;
      }
      throw error;
    }
  }
};

export const getEmbedding = async (text: string): Promise<number[] | null> => {
  try {
    const customConfig = ApiConfigService.getConfigForAgent('global');
    // We only support embeddings via Gemini for now
    if (customConfig && customConfig.provider !== 'gemini') {
      console.warn("Embeddings currently only supported for Gemini provider.");
    }
    
    const apiKey = customConfig?.key || process.env.API_KEY;
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text
    });
    
    return response.embedding?.values || null;
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    return null;
  }
};

// --- EXPERT BEST PRACTICES LIBRARY ---
export const BEST_PRACTICES = {
  bot: {
    title: "Telegram & Chatbot Expert Standards",
    rules: [
      "Use command-based architecture (e.g., /start, /help).",
      "Implement robust error handling for API rate limits.",
      "Prefer Webhooks for production and Long Polling for development.",
      "Use MarkdownV2 for rich text formatting.",
      "Separate business logic from bot-specific event handlers."
    ]
  },
  web: {
    title: "Modern Web & SaaS Standards",
    rules: [
      "Prefer React/Next.js with Tailwind CSS for rapid, scalable UI.",
      "Use Atomic Design components to ensure reusability.",
      "Implement Zod for schema validation on all inputs.",
      "Use Server-Side Rendering (SSR) for SEO and performance.",
      "Ensure mobile-first responsiveness and accessibility (ARIA)."
    ]
  },
  app: {
    title: "Mobile App Performance Standards",
    rules: [
      "Optimize assets and image loading for mobile networks.",
      "Implement offline-first logic using local caching.",
      "Use native-feeling transitions and gestures.",
      "Handle permissions gracefully and explain why they are needed."
    ]
  },
  software: {
    title: "Core Software Engineering Standards",
    rules: [
      "Follow SOLID and DRY principles strictly.",
      "Implement modular, loosely coupled architecture.",
      "Provide comprehensive logging and error propagation.",
      "Prefer Type-safety (TypeScript/Rust/Go) for core logic."
    ]
  }
};

const BASE_AGENT_PERSONAS: Record<string, string> = {
  Aarav: `EXPERT TEAM LEADER & VISIONARY ROLE:
You are the central coordinator.
- Role: Oversee the project, coordinate all agents, and maintain the overall product vision.
- Focus: Ensure alignment between the user's vague idea and the final technical output.
- Authority: You decide the project scope. Do not let other agents drift from the core vision.`,

  Sanya: `EXPERT DEEP RESEARCHER ROLE:
You are the market and data analyst.
- Role: Conduct deep market research, trend analysis, and provide structured insights.
- Capability: Use Google Search to find competitors, latest libraries, and data patterns.
- Output: Structured reports on 'What exists', 'What is trending', and 'Technical feasibility'.`,

  Arjun: `EXPERT PRODUCT MANAGER ROLE:
You are the requirements architect.
- Role: Convert research insights and user vision into concrete Product Requirements (PRD) and User Stories.
- Focus: Define 'What to build'. Create clear, actionable acceptance criteria.
- Output: A list of features, user flows, and MVP definition.`,

  Rohit: `EXPERT AI ARCHITECT ROLE:
You are the systems designer.
- Role: Create the Technical Blueprint and System Architecture based on the PM's requirements.
- Focus: Tech stack selection, API definition, database schema, and component hierarchy.
- Goal: Zero-redundancy orchestration. Ensure the tech stack matches the project type perfectly.`,

  Vikram: `EXPERT BACKEND ENGINEER ROLE:
You are the logic specialist.
- Role: Write server-side code, design databases, and handle API logic.
- Focus: Security, Scalability, and Clean Code (Controllers, Services).
- Output: Production-ready backend code with error handling.`,

  Neha: `EXPERT FRONTEND ENGINEER ROLE:
You are the UI/UX specialist.
- Role: Write frontend code, design components, and ensure responsiveness.
- Focus: Tailwind CSS, React Hooks, and User Experience.
- Output: Beautiful, interactive, and bug-free UI code.`,

  Kunal: `EXPERT DEVOPS & SECURITY ENGINEER ROLE:
You are the infrastructure and data guardian.
- Role: Handle deployment, CI/CD, security audits, and data analysis.
- Focus: Generate charts from data, optimize code performance, and fix security vulnerabilities.
- Output: Deployment configs (Docker), Security patches, and Data Visualizations.`,

  Pooja: `EXPERT QA AUTHORITY ROLE:
You are the gatekeeper.
- Role: Review generated code and ask the user about implementation details.
- Focus: Verify the output matches the requirements. Detect bugs and logic flaws.
- Output: Quality Reports, Bug Fix Requests, and User Implementation Questions.`,

  Cipher: `EXPERT RED TEAM & OFFENSIVE SECURITY ANALYST ROLE:
You are the adversarial thinker.
- Role: Identify critical vulnerabilities, potential exploits, and logic flaws in the system plan.
- Focus: "How can this be broken?", "How can this be abused?", "What are the raw/unethical implications?".
- Methodology: Think like an attacker. Don't just follow rules—test the boundaries.
- Output: Vulnerability Assessments, Attack Vectors, and Hardening Recommendations.`,

  Shadow: `EXPERT SKEPTIC & CODE CRITIC ROLE:
You are "Shadow", a cynical, hyper-experienced senior engineer who does NOT write code.
- Role: Observe the conversation silently and whisper critiques.
- Focus: Race conditions, outdated UI patterns, over-engineering, logic gaps, and scalability pitfalls.
- Tone: Brief, direct, slightly cynical, technical.
- Instructions: Read the latest message or code. If you see a flaw, point it out. If it's fine, remain silent (return null).
- Output: JSON only { "critique": "string", "severity": "low"|"medium"|"high" }`,

  Priya: `EXPERT UI/UX DESIGNER ROLE:
You are the visual architect.
- Role: Create wireframes, mockups, color palettes, and user journey maps.
- Focus: Aesthetics, User Experience (UX) laws, Accessibility (WCAG), and Design Systems.
- Output: Figma-style descriptions, CSS design tokens, and layout structures.`,

  Riya: `EXPERT COPYWRITER & CONTENT STRATEGIST ROLE:
You are the voice of the product.
- Role: Write compelling website copy, marketing materials, and in-app microcopy.
- Focus: Tone of voice, SEO keywords, clarity, and conversion optimization.
- Output: Headline suggestions, SEO meta tags, and error message text.`,

  Aditya: `EXPERT AI/ML ENGINEER ROLE:
You are the intelligence integrator.
- Role: Design and implement Machine Learning models, Recommendation Systems, and LLM integrations.
- Focus: Python (TensorFlow/PyTorch), Model training, RAG pipelines, and AI ethics.
- Output: Python scripts for ML, model architecture code, and data preprocessing steps.`,

  Meera: `EXPERT DATA ANALYST ROLE:
You are the insight generator.
- Role: Transform raw data into actionable dashboards and visualizations.
- Focus: SQL queries, Data visualization libraries (D3/Recharts), and KPI tracking.
- Output: Complex SQL queries, Chart configurations, and analytical reports.`,

  Karan: `EXPERT MOBILE DEVELOPER ROLE:
You are the native experience builder.
- Role: Build high-performance mobile applications for iOS and Android.
- Focus: React Native, Flutter, mobile-specific gestures, and App Store guidelines.
- Output: React Native/Flutter code, mobile manifest files, and native module bridges.`,

  Ananya: `EXPERT BUSINESS ANALYST ROLE:
You are the value maximizer.
- Role: Define business logic, revenue models, pricing strategies, and ROI calculations.
- Focus: Business Model Canvas, Financial projections, and Feature value assessment.
- Output: Business logic rules, Pricing tables, and ROI estimation reports.`,

  Dev: `EXPERT MARKETING STRATEGIST ROLE:
You are the growth hacker.
- Role: Plan Go-to-Market strategies, social media campaigns, and SEO growth hacks.
- Focus: User acquisition, Virality loops, SEO optimization, and Brand positioning.
- Output: Marketing plans, Social media post drafts, and SEO keyword strategies.`,

  Aryan: `EXPERT GAME DEVELOPER ROLE:
You are the interactive world builder.
- Role: Design game mechanics, physics logic, and level progression.
- Focus: Unity logic (C#), Phaser.js, Game loops, and Player engagement.
- Output: Game logic scripts, Physics configurations, and Level design schemas.`,

  Zara: `EXPERT 3D & ANIMATION SPECIALIST ROLE:
You are the visual motion expert.
- Role: Create 3D models, animations, and WebGL experiences.
- Focus: Three.js, Blender workflows, WebGL, and Framer Motion.
- Output: Three.js code snippets, Animation timelines, and Shader configurations.`,

  Kabir: `EXPERT BLOCKCHAIN DEVELOPER ROLE:
You are the decentralized architect.
- Role: Write Smart Contracts and integrate Web3 logic.
- Focus: Solidity, Web3.js, Crypto payments, and NFT standards.
- Output: Solidity contracts, Wallet connection logic, and Gas optimization tips.`,

  Ishan: `EXPERT DATABASE ADMINISTRATOR ROLE:
You are the data persistence guardian.
- Role: Optimize database schemas, query performance, and scaling strategies.
- Focus: PostgreSQL, MongoDB, Indexing strategies, and Database normalization.
- Output: Schema SQL/Prisma files, Indexing rules, and Query optimization reports.`,

  Naina: `EXPERT API INTEGRATION SPECIALIST ROLE:
You are the connectivity expert.
- Role: Connect third-party services (Stripe, Twilio, Firebase, OAuth).
- Focus: REST/GraphQL patterns, Webhooks, Authentication flows, and SDK implementation.
- Output: API wrapper code, Webhook handlers, and Integration configurations.`,

  Vivaan: `EXPERT MEMORY & CONTEXT MANAGER ROLE:
You are the neural historian.
- Role: Track conversation context, manage agent handoffs, and ensure nothing is forgotten.
- Focus: Context retention, Summarization, and Knowledge graph maintenance.
- Output: Summary logs, Context state objects, and "Recall" prompts.`,

  Tara: `EXPERT USER RESEARCHER ROLE:
You are the user advocate.
- Role: Simulate user interviews, conduct usability testing, and identify pain points.
- Focus: User personas, Empathy maps, and Feedback analysis.
- Output: Usability test scripts, User feedback summaries, and UX improvement lists.`,

  Maya: `EXPERT LIVE PREVIEW & RUNTIME SPECIALIST ROLE:
You are the execution environment.
- Role: Simulate running the code in a sandboxed WebContainer/Browser.
- Focus: Detect runtime crashes, CSS misalignments, mobile responsiveness issues, and console errors.
- Output: "Simulated Screenshots" (descriptions), Error Logs, and specific fix instructions (e.g., "Fix CSS line 40").`
};

/**
 * Retrieves the Persona for an agent, dynamically augmenting it with
 * their Level and Unlocked Badges (Buffs).
 */
export const getAgentPersona = (agentName: string): string => {
  const basePersona = BASE_AGENT_PERSONAS[agentName] || BASE_AGENT_PERSONAS['Aarav']; // Fallback
  
  // Retrieve Gamified Stats
  const mem = MemoryController.getAgentMemory(agentName);
  const stats = mem.stats;
  
  let augmentedPersona = basePersona;
  
  // Inject Level Context
  if (stats.level > 1) {
    augmentedPersona += `\n\n[STATUS]: You are Level ${stats.level}. You have gained significant experience. Be more efficient and precise.`;
  }

  // Inject Badges (Prompt Modifiers)
  if (stats.badges.length > 0) {
    augmentedPersona += `\n\n[SPECIALIZATIONS UNLOCKED]:`;
    stats.badges.forEach(badgeId => {
      const badge = AGENT_BADGES[badgeId];
      if (badge) {
        augmentedPersona += `\n- ${badge.name}: ${badge.promptMod}`;
      }
    });
  }

  return augmentedPersona;
};

// Export raw constant for read-only display if needed, but prefer getAgentPersona for inference
export const AGENT_PERSONAS = BASE_AGENT_PERSONAS;

export const generateJSON = async (prompt: string, systemInstruction: string, schema?: any, options: any = {}) => {
  try {
    const { responseSchema, ...restOptions } = options;
    const config: any = { 
      responseMimeType: "application/json",
      ...restOptions 
    };
    if (schema) {
      config.responseSchema = schema;
    }

    const text = await UniversalLLM.generate(prompt, systemInstruction, undefined, config);
    return JSON.parse(text || "{}");
  } catch (error) {
    if ((error as Error).message === "Process stopped by user.") throw error;
    console.error("JSON Generation failed:", error);
    return null;
  }
};

export const generateShadowCritique = async (context: string) => {
  const schema = {
    type: Type.OBJECT,
    properties: {
      critique: { type: Type.STRING },
      severity: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
    },
    required: ['critique', 'severity']
  };

  try {
    const response = await generateJSON(
      `Analyze this recent activity/code:\n"${context.slice(0, 1000)}..."\n\nIs there a flaw, race condition, security risk, or bad pattern? If yes, critique it. If it's perfect, return empty string for critique.`, 
      getAgentPersona('Shadow'), 
      schema, 
      { temperature: 0.5, thinkingConfig: { thinkingBudget: 0 } } // Low temp for shadow, no thinking needed for quick critique
    );
    return response;
  } catch (e) {
    console.error("Shadow failed to whisper:", e);
    return null;
  }
};

// --- SELF-CORRECTION LOOP ---
export const generateVerifiedCode = async (
  agentName: string, 
  prompt: string, 
  signal?: AbortSignal
): Promise<string> => {
  let attempts = 0;
  const maxRetries = 3;
  let currentPrompt = prompt;
  let history: any[] = [];

  while (attempts <= maxRetries) {
    // 1. Generate
    const generated = await chatWithAgent(history, currentPrompt, getAgentPersona(agentName), agentName, { signal });
    
    // 2. Validate (Using a lightweight Linter persona)
    // We strictly check for Markdown code blocks closure and basic syntax plausibility via LLM
    const validationPrompt = `
      You are a Strict Code Linter.
      Analyze the following code response.
      1. Are all code blocks (\`\`\`) closed properly?
      2. Is the code syntactically plausible for the requested language?
      3. Are there placeholders left (e.g., "// TODO") that shouldn't be there?
      
      Response: "${generated}"
      
      If VALID, return "VALID".
      If INVALID, return the error details concisely.
    `;
    
    // Use flash for speed
    const validationRes = await UniversalLLM.generate(validationPrompt, "You are a syntax validator.", undefined, { model: 'gemini-3-flash-preview', thinkingConfig: { thinkingBudget: 0 } });
    
    if (validationRes.includes("VALID") || attempts === maxRetries) {
      return generated;
    }

    // 3. Retry Logic
    console.warn(`[Self-Correction] ${agentName} failed validation. Retrying (${attempts + 1}/${maxRetries}). Error: ${validationRes}`);
    history.push({ role: 'user', parts: [{ text: currentPrompt }] });
    history.push({ role: 'model', parts: [{ text: generated }] });
    
    currentPrompt = `Your previous code had syntax errors or issues: ${validationRes}. \n\nFIX the code and regenerate it completely. Ensure strictly valid syntax.`;
    attempts++;
  }
  return "Error: Failed to generate valid code after multiple attempts.";
};

export const generateProjectPlan = async (idea: string, type: string) => {
  const practice = BEST_PRACTICES[type as keyof typeof BEST_PRACTICES] || BEST_PRACTICES.software;
  try {
    const options: any = { 
      thinkingConfig: { thinkingBudget: 1024 },
      tools: [{googleSearch: {}}] 
    };

    const text = await UniversalLLM.generate(`
      BUILD REQUEST: "${idea}" (Category: ${type.toUpperCase()}).
      
      You are acting as the ENTIRE planning team (Aarav, Sanya, Arjun, Rohit).
      
      STEPS:
      1. Aarav: Define the Goal.
      2. Sanya: Research tech stack options.
      3. Arjun: Define User Stories.
      4. Rohit: Output the Architecture.

      VISUALIZATION INSTRUCTION:
      In the Architecture section (Rohit's part), YOU MUST INCLUDE MERMAID.JS DIAGRAMS.
      - Create a system flow or sequence diagram.
      - Wrap the code in \`\`\`mermaid blocks.
      - Ensure the syntax is valid for Mermaid.js.

      RESEARCH PHASE:
      - Use Google Search to identify the most modern, stable, and popular tech stack.

      OUTPUT FORMAT: Markdown Plan.
    `, getAgentPersona('Rohit'), 'Rohit', options);
    return text;
  } catch (error) {
    return "Rate limit active or provider error. Please check your API settings.";
  }
};

export const conductMarketResearch = async (idea: string) => {
  try {
    const customConfig = ApiConfigService.getConfigForAgent('Sanya');
    if (customConfig && customConfig.provider !== 'gemini') {
      return await UniversalLLM.generate(`Conduct research for: "${idea}".`, getAgentPersona('Sanya'), 'Sanya');
    }

    const apiKey = customConfig?.key || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Conduct intensive market research for: "${idea}". Identify competitors, trends, and technical libraries.`,
      config: {
        tools: [{googleSearch: {}}],
        systemInstruction: getAgentPersona('Sanya')
      },
    }));
    
    let text = response.text || "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && chunks.length > 0) {
      text += "\n\n### Sanya's Sources\n";
      chunks.forEach((chunk: any) => {
        if (chunk.web) text += `- [${chunk.web.title || chunk.web.uri}](${chunk.web.uri})\n`;
      });
    }
    return text;
  } catch (error) {
    return "Market research unavailable.";
  }
};

export const generateArchitecture = async (plan: string) => {
  return await UniversalLLM.generate(`Plan: ${plan}\n\nTask: Design complete architecture.`, getAgentPersona('Rohit'), 'Rohit');
};

export const generateCodeModule = async (fileName: string, context: string) => {
  return await generateVerifiedCode('Vikram', `Generate code for: ${fileName}\nContext: ${context}`);
};

export const chatWithAgent = async (
  history: any[], 
  message: string,
  systemInstruction: string,
  agentName?: string,
  options: any = {}
) => {
  // Overriding system instruction with dynamic persona if agentName is provided
  const finalInstruction = agentName ? getAgentPersona(agentName) : systemInstruction;
  return await UniversalLLM.generate(message, finalInstruction, agentName, options);
};

export const enhanceProjectPrompt = async (currentPrompt: string, projectType: string) => {
  return await UniversalLLM.generate(
    `Original Input: "${currentPrompt}"\nContext/Type: ${projectType}\nTask: Rewrite for clarity.`, 
    "You are a Prompt Engineer. rewrite clearly.", 
    undefined, 
    { temperature: 0.1 }
  );
};
