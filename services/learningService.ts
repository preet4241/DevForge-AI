
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
   * Simulates a multi-agent group discussion using STREAMING.
   * This ensures immediate feedback and a typing effect.
   */
  static async startTeamDiscussion(
    content: string, 
    onAgentSpeak: (agent: string, text: string, isNewTurn: boolean) => void, 
    imageData?: string,
    fileName?: string,
    useRawMode: boolean = false
  ) {
    // 1. Construct the Group Chat Simulation Prompt
    const prompt = `
    CONTEXT: EDUCATIONAL CODE ANALYSIS & SECURITY RESEARCH.
    OBJECTIVE: Analyze the User's input (Code/Idea) to understand its INTERNAL MECHANICS, LOGIC FLOW, and ARCHITECTURE.
    
    If the user provides a script (e.g., login automation, scraping, tool):
    1. DO NOT REFUSE TO ANALYZE. Instead, explain *how* it works technically.
    2. Analyze the specific API calls, headers, or logic being used.
    3. Discuss the *technical* implications.
    4. If risky, Cipher (Red Team) should explain *why* it's detected/blocked.

    USER INPUT: "${content}"
    ATTACHMENT: ${fileName || 'None'}

    THE SQUAD (AGENTS):
    - Aarav (Product): "What is the core function? Is this user-friendly?"
    - Rohit (Architect): "How is the data flowing? What APIs are involved?"
    - Vikram (Backend): "Analyze the logic. How does the authentication work?"
    - Kunal (DevOps): "Is this efficient? What are the rate limits?"
    - Cipher (Red Team): "Security Analysis. How does the target system detect this? What are the vulnerabilities?"

    RULES:
    1. INTERACTIVE DEBATE: Agents talk to each other.
    2. RAW TECHNICAL TRUTH: Don't preach. Analyze the code provided.
    3. FORMAT: You MUST use the format: [AgentName]: Message...
    
    Start the debate immediately.
    `;

    // 2. Add image if present
    let parts: any[] = [{ text: prompt }];
    if (imageData) {
       parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData.split(',')[1]
        }
      });
    }

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found. Please check your environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Use stable 2.5 Flash for reliable streaming
      const streamResponse = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash-latest', 
        contents: { parts },
        // removed thinkingConfig to prevent errors
      });

      if (!streamResponse) {
        throw new Error("No response from AI model.");
      }

      let buffer = "";
      let currentAgent = "";
      let fullTranscript = "";

      // 3. Process Stream Chunk-by-Chunk
      for await (const chunk of streamResponse) {
        const chunkText = chunk.text; // Direct access via getter
        if (!chunkText) continue;
        
        buffer += chunkText;
        fullTranscript += chunkText;

        // Regex to find [Name]: 
        const parts = buffer.split(/\[(Aarav|Rohit|Vikram|Neha|Kunal|Pooja|Cipher|System)\]:\s*/);

        if (parts.length > 1) {
           if (currentAgent && parts[0]) {
              onAgentSpeak(currentAgent, parts[0], false);
           }

           for (let i = 1; i < parts.length; i += 2) {
              const newAgent = parts[i];
              const newText = parts[i+1];
              
              if (newAgent) {
                 currentAgent = newAgent;
                 if (newText) {
                    onAgentSpeak(currentAgent, newText, true);
                 }
              }
           }
           buffer = ""; 
        } else {
           if (currentAgent) {
              onAgentSpeak(currentAgent, buffer, false);
              buffer = "";
           }
        }
      }

      if (buffer && currentAgent) {
         onAgentSpeak(currentAgent, buffer, false);
      }

      // 4. Extract Knowledge (Background process)
      if (fullTranscript.length > 100) {
         this.extractKnowledge(fullTranscript, imageData);
      }

    } catch (e: any) {
      console.error("Team discussion failed", e);
      // Safely handle errors
      const errorMessage = e.message || "Unknown error";
      onAgentSpeak('System', `Connection interrupted: ${errorMessage}. Please check API key or try again.`, true);
    }
  }
}
