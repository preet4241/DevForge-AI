
import { AGENT_PERSONAS, chatWithAgent, generateJSON } from './geminiService';
import { GlobalMemoryController } from './memoryService';
import { Type, GoogleGenAI, GenerateContentResponse } from '@google/genai';

export interface KnowledgeItem {
  content: string;
  type: 'rule' | 'pattern' | 'anti-pattern';
  domain: 'security' | 'performance' | 'ui' | 'backend' | 'devops' | 'general';
}

export interface KnowledgeExtraction {
  items: KnowledgeItem[];
  explanation: string;
}

export interface DiaryEntry {
  agent: string;
  reflection: string;
  learnings: {
    type: 'rule' | 'pattern';
    content: string;
    domain: string;
  }[];
}

export class LearningService {
  
  /**
   * Extracts knowledge from text or images.
   * Focuses on extracting limitations, constraints, and "impossible" boundaries.
   */
  static async extractKnowledge(content: string, imageData?: string): Promise<KnowledgeExtraction | null> {
    const systemInstruction = `
      ROLE: NEURAL DISTILLER.
      GOAL: Extract HARD CONSTRAINTS, LIMITATIONS, and SECURITY RULES from the discussion.
      
      CONTEXT: The team is discussing a scenario to understand what is NOT possible or what requires strict boundaries.
      
      INSTRUCTIONS:
      1. Analyze the content for "Cannot be done", "Must not", "Risk", or "limitation".
      2. Categorize into DOMAIN: 'security', 'performance', 'ui', 'backend', 'devops', or 'general'.
      3. Classify type: 
         - 'rule' (Hard constraint/Security limit)
         - 'anti-pattern' (Bad practice/Assumption to avoid)
         - 'pattern' (Correct approach to a complex problem)
      
      OUTPUT: Strictly JSON object matching the schema.
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING, description: "The concise rule/constraint text." },
              type: { type: Type.STRING, enum: ['rule', 'pattern', 'anti-pattern'] },
              domain: { type: Type.STRING, enum: ['security', 'performance', 'ui', 'backend', 'devops', 'general'] }
            },
            required: ['content', 'type', 'domain']
          }
        },
        explanation: { type: Type.STRING, description: "One concise sentence summarizing exactly what was learned from this session." }
      },
      required: ['items', 'explanation']
    };

    let promptParts: any[] = [{ text: `DISCUSSION TO ANALYZE:\n\n${content}` }];
    if (imageData) {
      promptParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData.split(',')[1] // Strip prefix
        }
      });
    }

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return null;

      const ai = new GoogleGenAI({ apiKey });
      // Using Flash for extraction to save budget/time
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-latest',
        contents: { parts: promptParts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      const result = JSON.parse(response.text || "{}") as KnowledgeExtraction;
      if (result && result.items) {
        result.items.forEach(item => {
          GlobalMemoryController.learn(item.type, item.content, item.domain);
        });
        
        // Log the learning summary
        if (result.explanation) {
            GlobalMemoryController.logEvent(result.explanation);
        }
      }
      return result;
    } catch (e) {
      console.warn("Knowledge extraction skipped:", e);
      return null;
    }
  }

  /**
   * Generates "Diary Entries" for key agents based on the project history.
   * Used when a project is completed to consolidate learnings.
   */
  static async generateAgentDiaries(projectInfo: any, messages: any[]): Promise<DiaryEntry[]> {
    // Filter last 30 messages to keep context manageable but relevant
    const recentHistory = messages
      .slice(-30)
      .map(m => `[${m.role === 'model' ? (m.agentName || 'AI') : 'User'}]: ${m.text.substring(0, 200)}...`)
      .join('\n');

    const prompt = `
      PROJECT POST-MORTEM & REFLECTION
      
      PROJECT: ${projectInfo.name} (${projectInfo.type})
      DESCRIPTION: ${projectInfo.description}
      
      INTERACTION LOG:
      ${recentHistory}
      
      TASK: Generate a "Diary Entry" for the following agents: Aarav (Lead), Rohit (Architect), Neha (Frontend), Vikram (Backend).
      
      GOAL: Extract PERSISTENT PREFERENCES and LEARNINGS about the User.
      - Did the user prefer specific tech stacks? (e.g. "User likes Tailwind")
      - Did they correct us on anything? (e.g. "User hates complex auth flows")
      - What patterns worked well?
      
      OUTPUT SCHEMA: JSON Array of Diary Entries.
    `;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          agent: { type: Type.STRING, enum: ['Aarav', 'Rohit', 'Neha', 'Vikram'] },
          reflection: { type: Type.STRING, description: "A first-person diary entry (max 2 sentences) summarizing their experience working with this user." },
          learnings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['rule', 'pattern'] },
                content: { type: Type.STRING, description: "The specific rule learned (e.g. 'Always use dark mode for this user')" },
                domain: { type: Type.STRING, description: "e.g. 'ui', 'code_style', 'security'" }
              },
              required: ['type', 'content', 'domain']
            }
          }
        },
        required: ['agent', 'reflection', 'learnings']
      }
    };

    try {
      const result = await generateJSON(prompt, "You are the collective consciousness of the dev team.", schema);
      return result as DiaryEntry[];
    } catch (e) {
      console.error("Failed to generate diaries", e);
      return [];
    }
  }

  /**
   * Simulates a multi-agent group discussion using TRUE A2A (Agent-to-Agent) communication.
   * Agents speak sequentially, reading the previous context, with delays to prevent 429 errors.
   */
  static async startTeamDiscussion(
    content: string, 
    onAgentSpeak: (agent: string, text: string, isNewTurn: boolean) => void, 
    imageData?: string,
    fileName?: string,
    useRawMode: boolean = false
  ) {
    const agents = [
      { name: 'Aarav', role: 'Product Manager', focus: 'Analyze the core function, user intent, and overall goal. What is the user trying to achieve?' },
      { name: 'Rohit', role: 'Architect', focus: 'Analyze the architecture, data flow, and APIs based on the input and previous analysis.' },
      { name: 'Cipher', role: 'Security Expert', focus: 'Analyze security risks, vulnerabilities, rate limits, and how target systems might detect this.' },
      { name: 'Vikram', role: 'Backend Engineer', focus: 'Summarize the technical implementation details, logic, and suggest concrete improvements.' }
    ];

    let fullTranscript = `USER INPUT: "${content}"\nATTACHMENT: ${fileName || 'None'}\n\n--- DISCUSSION START ---\n\n`;

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found. Please check your environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey });

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        
        const prompt = `
        CONTEXT: EDUCATIONAL CODE ANALYSIS & SECURITY RESEARCH.
        OBJECTIVE: Analyze the User's input (Code/Idea) to understand its INTERNAL MECHANICS, LOGIC FLOW, and ARCHITECTURE.
        
        You are ${agent.name}, the ${agent.role}.
        Your specific focus for this turn: ${agent.focus}
        
        Here is the discussion so far:
        ${fullTranscript}
        
        INSTRUCTIONS:
        1. Read the user input and the previous agents' thoughts.
        2. Provide your expert analysis based on your specific focus.
        3. Speak directly to the team or the user. Keep it concise, technical, and insightful (1-2 short paragraphs).
        4. DO NOT output your name at the beginning (e.g., don't write "${agent.name}:"). Just write your response.
        `;

        let parts: any[] = [{ text: prompt }];
        if (imageData && i === 0) { // Only send image to the first agent to save bandwidth/tokens, or send to all? Let's send to all for context.
           parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: imageData.split(',')[1]
            }
          });
        }

        const streamResponse = await ai.models.generateContentStream({
          model: 'gemini-2.5-flash-latest', 
          contents: { parts }
        });

        if (!streamResponse) {
          throw new Error(`No response from AI model for ${agent.name}.`);
        }

        let agentResponse = "";
        let isFirstChunk = true;

        for await (const chunk of streamResponse) {
          const chunkText = chunk.text;
          if (!chunkText) continue;
          
          agentResponse += chunkText;
          onAgentSpeak(agent.name, chunkText, isFirstChunk);
          isFirstChunk = false;
        }

        fullTranscript += `[${agent.name}]: ${agentResponse}\n\n`;

        // Delay to prevent 429 Rate Limit errors (3 seconds)
        if (i < agents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Extract Knowledge (Background process)
      if (fullTranscript.length > 100) {
         // Add a small delay before the final extraction call to be safe
         setTimeout(() => {
             this.extractKnowledge(fullTranscript, imageData);
         }, 4000);
      }

    } catch (e: any) {
      console.error("Team discussion failed", e);
      const errorMessage = e.message || "Unknown error";
      onAgentSpeak('System', `Connection interrupted: ${errorMessage}. Please check API key or try again.`, true);
    }
  }
}
