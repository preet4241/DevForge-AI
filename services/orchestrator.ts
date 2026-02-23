
import { getAgentPersona, chatWithAgent, generateJSON } from './geminiService';
import { AgentMemoryService } from './agentMemoryService';
import { Type } from '@google/genai';

type StatusCallback = (agentName: string, status: string) => void;
type MessageCallback = (agentName: string, text: string) => void;

export class Orchestrator {
  
  static async handleUserMessage(
    userMessage: string, 
    history: any[], 
    onStatusUpdate: StatusCallback,
    onMessageChunk: MessageCallback,
    signal?: AbortSignal
  ): Promise<string> {
    
    if (signal?.aborted) throw new Error("Process stopped by user.");

    // --- STEP 1: AARAV - The Router/Classifier ---
    onStatusUpdate('Aarav', 'Classifying message and routing...');
    
    const aaravSchema = {
      type: Type.OBJECT,
      properties: {
        messageType: { 
          type: Type.STRING, 
          enum: ['learning', 'casual', 'task', 'debate'],
          description: "Classify the user message type."
        },
        relevantAgents: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of relevant agent names (e.g., 'Sanya', 'Arjun', 'Rohit', 'Vikram', 'Neha', 'Kunal', 'Pooja', 'Cipher', 'Maya'). Empty for casual."
        },
        priorityLevel: {
          type: Type.STRING,
          enum: ['high', 'medium', 'low']
        },
        shouldSaveMemory: {
          type: Type.BOOLEAN,
          description: "True if this contains facts, code, or knowledge that should be learned."
        },
        topic: {
          type: Type.STRING,
          description: "A short 2-3 word topic summary."
        }
      },
      required: ['messageType', 'relevantAgents', 'priorityLevel', 'shouldSaveMemory', 'topic']
    };

    const aaravPrompt = `
      Analyze the following user message and classify it.
      User Message: "${userMessage}"
      
      Available Agents: Sanya (Research), Arjun (PM), Rohit (Architect), Vikram (Backend), Neha (Frontend), Kunal (DevOps), Pooja (QA), Cipher (Security), Maya (UI/UX).
      
      Decide if it's learning (facts/code), casual (greetings), task (build/calculate), or debate (complex topic).
      Select ONLY the relevant agents. If casual, relevantAgents can be empty.
    `;

    const classification = await generateJSON(aaravPrompt, getAgentPersona('Aarav'), aaravSchema, { signal });
    
    if (!classification) {
      return "Aarav failed to classify the message. Please try again.";
    }

    const { messageType, relevantAgents, shouldSaveMemory, topic } = classification;
    let finalResponse = `**Aarav (Router):** Classified as \`${messageType}\`. Relevant Agents: ${relevantAgents.length ? relevantAgents.join(', ') : 'None'}.\n\n`;
    onMessageChunk('Aarav', finalResponse);

    // --- STEP 2: Sequential Processing & Debate ---
    if (relevantAgents.length === 0) {
      // Casual or unassigned
      onStatusUpdate('Aarav', 'Responding directly...');
      const casualResp = await chatWithAgent(history, userMessage, getAgentPersona('Aarav'), 'Aarav', { signal });
      onMessageChunk('Aarav', casualResp);
      return finalResponse + `**Aarav:** ${casualResp}`;
    }

    let accumulatedContext = `User Request: ${userMessage}\n\n`;
    let agentResponses: { agent: string, response: string }[] = [];

    for (const agentName of relevantAgents) {
      if (signal?.aborted) throw new Error("Process stopped by user.");
      
      onStatusUpdate(agentName, 'Processing and thinking...');
      
      // Retrieve memory for this specific agent
      const recentMemories = await AgentMemoryService.getMemories(agentName, 3);
      const memoryContext = recentMemories.length > 0 
        ? `\nYour Recent Memories on related topics:\n${recentMemories.map(m => `- ${m.topic}: ${m.summary}`).join('\n')}`
        : '';

      const agentPrompt = `
        ${accumulatedContext}
        ${memoryContext}
        
        Task: Provide your expert response or code based on your role. If previous agents have responded, you can agree, disagree, or build upon their work.
        State your confidence level (High/Medium/Low) at the end of your response.
      `;

      const response = await chatWithAgent([], agentPrompt, getAgentPersona(agentName), agentName, { signal });
      onMessageChunk(agentName, response);
      
      agentResponses.push({ agent: agentName, response });
      accumulatedContext += `[${agentName}'s Response]:\n${response}\n\n`;
      finalResponse += `**${agentName}:**\n${response}\n\n`;
    }

    // --- STEP 3: Synthesis (If Debate/Multiple Agents) ---
    if (relevantAgents.length > 1) {
      onStatusUpdate('Aarav', 'Synthesizing final response...');
      const synthesisPrompt = `
        The user asked: "${userMessage}"
        The team provided the following responses:
        ${accumulatedContext}
        
        Task: Synthesize these responses into a final, cohesive answer for the user. Resolve any conflicts.
      `;
      const synthesis = await chatWithAgent([], synthesisPrompt, getAgentPersona('Aarav'), 'Aarav', { signal });
      onMessageChunk('Aarav', synthesis);
      finalResponse += `**Aarav (Synthesis):**\n${synthesis}\n\n`;
    }

    // --- STEP 4: Memory System (Learning) ---
    if (shouldSaveMemory || messageType === 'learning') {
      onStatusUpdate('System', 'Saving to Agent Memory...');
      
      for (const agentName of relevantAgents) {
        // Find the agent's specific response to summarize, or summarize the whole context
        const agentResp = agentResponses.find(r => r.agent === agentName)?.response || userMessage;
        
        // In a real scenario, a dedicated Memory Manager Agent would summarize this.
        // For now, we save a structured entry directly.
        await AgentMemoryService.saveMemory(agentName, {
          topic: topic || 'General Learning',
          summary: `Learned from user input: ${userMessage.substring(0, 100)}... Agent concluded: ${agentResp.substring(0, 100)}...`,
          connections: [messageType],
          confidence: 'high'
        });
      }
      finalResponse += `*(System: Learning data saved to memory for ${relevantAgents.join(', ')})*\n`;
    }

    onStatusUpdate('System', 'Cycle Complete');
    return finalResponse;
  }
}
