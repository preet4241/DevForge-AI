
import { AGENT_PERSONAS, chatWithAgent, generateJSON } from './geminiService';
import { GlobalMemoryController } from './memoryService';
import { Type, GoogleGenAI, GenerateContentResponse } from '@google/genai';

export interface KnowledgeItem {
  content: string;
  type: 'rule' | 'pattern' | 'anti-pattern' | 'critique' | 'scenario' | 'debate_outcome';
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
      GOAL: Extract HARD CONSTRAINTS, LIMITATIONS, SECURITY RULES, SCENARIOS, and CRITIQUES from the discussion.
      
      CONTEXT: The team is discussing a scenario to understand what is NOT possible or what requires strict boundaries.
      
      INSTRUCTIONS:
      1. Analyze the content for rules, risks, scenarios, or critiques.
      2. Categorize into DOMAIN: 'security', 'performance', 'ui', 'backend', 'devops', or 'general'.
      3. Classify type: 
         - 'rule' (Hard constraint/Security limit)
         - 'anti-pattern' (Bad practice/Assumption to avoid)
         - 'pattern' (Correct approach to a complex problem)
         - 'critique' (A specific flaw found in the user's approach)
         - 'scenario' (A hypothetical failure situation discussed)
         - 'debate_outcome' (The final agreed-upon resolution from agents)
      
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
              content: { type: Type.STRING, description: "The concise rule/constraint/scenario text." },
              type: { type: Type.STRING, enum: ['rule', 'pattern', 'anti-pattern', 'critique', 'scenario', 'debate_outcome'] },
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
        model: 'gemini-3-flash-preview',
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
   * Uses a dynamic moderator loop to select from all 25 agents based on relevance.
   * Agents speak sequentially with delays to prevent 429 errors.
   */
  static async startTeamDiscussion(
    content: string, 
    onAgentSpeak: (agent: string, text: string, isNewTurn: boolean) => void, 
    imageData?: string,
    fileName?: string,
    useRawMode: boolean = false
  ) {
    let fullTranscript = `USER INPUT: "${content}"\nATTACHMENT: ${fileName || 'None'}\n\n--- DISCUSSION START ---\n\n`;
    const availableAgentsList = Object.keys(AGENT_PERSONAS).join(', ');

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found. Please check your environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey });

      let discussionActive = true;
      let turnCount = 0;
      const MAX_TURNS = 6; // Prevent infinite loops
      let lastSpeaker = '';

      while (discussionActive && turnCount < MAX_TURNS) {
        // 1. Moderator (Aarav/System) decides who speaks next based on context
        const moderatorPrompt = `
        You are the System Moderator.
        You are moderating a discussion about a user's code/idea among 25 expert agents.
        
        CURRENT TRANSCRIPT:
        ${fullTranscript}
        
        AVAILABLE AGENTS: ${availableAgentsList}
        
        TASK: Decide who should speak next. 
        - Choose an agent who has the MOST relevant expertise for the current state of the discussion.
        - DO NOT choose the same agent who just spoke (${lastSpeaker}).
        - If the discussion has reached a natural conclusion, or if no other agent has anything valuable to add, return "DONE".
        - Only call upon agents if their specific expertise is absolutely needed.
        `;

        const schema = {
          type: Type.OBJECT,
          properties: {
            nextAgent: { type: Type.STRING, description: "Name of the agent to speak next, or 'DONE' if finished." },
            reason: { type: Type.STRING, description: "Brief reason why this agent is needed." }
          },
          required: ['nextAgent', 'reason']
        };

        // Use a fast model for moderation
        const modResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: moderatorPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema
          }
        });

        const moderatorDecision = JSON.parse(modResponse.text || "{}");
        
        if (!moderatorDecision || moderatorDecision.nextAgent === 'DONE' || !AGENT_PERSONAS[moderatorDecision.nextAgent]) {
          discussionActive = false;
          break;
        }

        const nextAgentName = moderatorDecision.nextAgent;
        lastSpeaker = nextAgentName;
        turnCount++;

        // Delay to prevent 429 Rate Limit errors (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 2. The selected agent speaks
        const agentPersona = AGENT_PERSONAS[nextAgentName];
        const agentPrompt = `
        CONTEXT: EDUCATIONAL CODE ANALYSIS, CRITIQUE & SECURITY RESEARCH.
        OBJECTIVE: Train the user by analyzing their input/code. DO NOT GENERATE NEW CODE unless explicitly asked for a tiny snippet to explain a concept.
        
        ${agentPersona}
        
        Here is the discussion so far:
        ${fullTranscript}
        
        INSTRUCTIONS:
        1. Read the user input and the previous agents' thoughts.
        2. ANALYZE & CRITIQUE: Focus on "Why" this approach was taken, potential pitfalls, security risks, and performance bottlenecks.
        3. ASK QUESTIONS: Challenge the user or other agents. E.g., "Why use this library?", "How does this handle edge case X?".
        4. SCENARIO SIMULATION: If applicable, propose a failure scenario (e.g., "What if the DB locks here?") to test the logic.
        5. Speak directly to the team or the user. Keep it concise, technical, and insightful (1-2 short paragraphs).
        6. DO NOT output your name at the beginning.
        `;

        let parts: any[] = [{ text: agentPrompt }];
        if (imageData && turnCount === 1) { // Send image to the first agent
           parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: imageData.split(',')[1]
            }
          });
        }

        const streamResponse = await ai.models.generateContentStream({
          model: 'gemini-3-flash-preview', 
          contents: { parts }
        });

        if (!streamResponse) {
          throw new Error(`No response from AI model for ${nextAgentName}.`);
        }

        let agentResponse = "";
        let isFirstChunk = true;

        for await (const chunk of streamResponse) {
          const chunkText = chunk.text;
          if (!chunkText) continue;
          
          agentResponse += chunkText;
          onAgentSpeak(nextAgentName, chunkText, isFirstChunk);
          isFirstChunk = false;
        }

        fullTranscript += `[${nextAgentName}]: ${agentResponse}\n\n`;

        // Delay after speaking to prevent 429 on the next moderator call
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Extract Knowledge (Background process)
      if (fullTranscript.length > 100) {
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
