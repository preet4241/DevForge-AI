
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
    
    // Get all 25 agent names dynamically
    const allAgentNames = Object.keys(require('./geminiService').AGENT_PERSONAS);
    const agentNamesString = allAgentNames.join(', ');

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
          description: `List of relevant agent names from the available pool. Empty for casual.`
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
      
      Available Agents: ${agentNamesString}.
      
      Decide if it's learning (facts/code), casual (greetings), task (build/calculate), or debate (complex topic).
      Select ONLY the agents whose specific expertise is absolutely required to handle this request. If casual, relevantAgents can be empty.
    `;

    const classification = await generateJSON(aaravPrompt, getAgentPersona('Aarav'), aaravSchema, { signal });
    
    if (!classification) {
      return "Aarav failed to classify the message. Please try again.";
    }

    // Ensure only valid agents are selected
    const validRelevantAgents = (classification.relevantAgents || []).filter((a: string) => allAgentNames.includes(a));
    const { messageType, shouldSaveMemory, topic } = classification;
    
    let finalResponse = `**Aarav (Router):** Classified as \`${messageType}\`. Relevant Agents: ${validRelevantAgents.length ? validRelevantAgents.join(', ') : 'None'}.\n\n`;
    onMessageChunk('Aarav', finalResponse);

    // --- STEP 2: Sequential Processing & Debate ---
    if (validRelevantAgents.length === 0) {
      // Casual or unassigned
      onStatusUpdate('Aarav', 'Responding directly...');
      const casualResp = await chatWithAgent(history, userMessage, getAgentPersona('Aarav'), 'Aarav', { signal });
      onMessageChunk('Aarav', casualResp);
      return finalResponse + `**Aarav:** ${casualResp}`;
    }

    let accumulatedContext = `User Request: ${userMessage}\n\n`;
    let agentResponses: { agent: string, response: string }[] = [];

    for (let i = 0; i < validRelevantAgents.length; i++) {
      const agentName = validRelevantAgents[i];
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
        
        Task: Provide your expert response or code based on your role. If previous agents have responded, you MUST read their responses and build upon them, agree, or disagree based on your expertise. Do not just repeat what they said.
        State your confidence level (High/Medium/Low) at the end of your response.
      `;

      const response = await chatWithAgent([], agentPrompt, getAgentPersona(agentName), agentName, { signal });
      onMessageChunk(agentName, response);
      
      agentResponses.push({ agent: agentName, response });
      accumulatedContext += `[${agentName}'s Response]:\n${response}\n\n`;
      finalResponse += `**${agentName}:**\n${response}\n\n`;

      // Smart Delay to prevent 429 errors when multiple agents are talking
      if (i < validRelevantAgents.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // --- STEP 3: Synthesis (If Debate/Multiple Agents) ---
    if (validRelevantAgents.length > 1) {
      // Delay before synthesis to prevent 429
      await new Promise(resolve => setTimeout(resolve, 3000));
      
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
      
      for (const agentName of validRelevantAgents) {
        const agentResp = agentResponses.find(r => r.agent === agentName)?.response || userMessage;
        
        await AgentMemoryService.saveMemory(agentName, {
          topic: topic || 'General Learning',
          summary: `Learned from user input: ${userMessage.substring(0, 100)}... Agent concluded: ${agentResp.substring(0, 100)}...`,
          connections: [messageType],
          confidence: 'high'
        });
      }
      finalResponse += `*(System: Learning data saved to memory for ${validRelevantAgents.join(', ')})*\n`;
    }

    onStatusUpdate('System', 'Cycle Complete');
    return finalResponse;
  }
}
