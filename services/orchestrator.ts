import { getAgentPersona, chatWithAgent, generateJSON, BEST_PRACTICES, generateVerifiedCode } from './geminiService';
import { MemoryController } from './memoryService';
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
    const stored = localStorage.getItem('currentProject');
    const project = stored ? JSON.parse(stored) : { type: 'software' };

    // 1. AARAV
    onStatusUpdate('Aarav', 'Planning...');
    const aarav = await chatWithAgent([], `User: ${userMessage}. Plan this ${project.type}.`, getAgentPersona('Aarav'), 'Aarav', { signal });
    onMessageChunk('Aarav', aarav);

    // 2. ROHIT
    onStatusUpdate('Rohit', 'Architecting...');
    const rohitSchema = {
      type: Type.OBJECT,
      properties: {
        agent_flow: { type: Type.ARRAY, items: { type: Type.STRING } },
        tech_stack: { type: Type.OBJECT, properties: { frontend: {type:Type.STRING}, backend: {type:Type.STRING} } }
      },
      required: ['agent_flow', 'tech_stack']
    };
    const plan = await generateJSON(`Plan: ${aarav}. Create flow.`, getAgentPersona('Rohit'), rohitSchema, { signal });
    onMessageChunk('Rohit', `Flow: ${plan.agent_flow.join(' -> ')}`);

    // 3. EXECUTION
    for (const agent of plan.agent_flow) {
      onStatusUpdate(agent, 'Executing...');
      const res = await chatWithAgent([], `Task: Build part of ${aarav} using ${JSON.stringify(plan.tech_stack)}`, getAgentPersona(agent), agent, { signal });
      onMessageChunk(agent, res);
      MemoryController.addExperience(agent, 100, []);
    }

    return "Build Cycle Complete.";
  }
}
