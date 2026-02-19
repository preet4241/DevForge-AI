
import { generateJSON, generateContent } from './geminiService';
import { GlobalMemoryController } from './memoryService';
import { Type, GoogleGenAI } from '@google/genai';

// Fix: Added missing DiaryEntry interface exported for Chat.tsx
export interface DiaryEntry {
  id: string;
  timestamp: number;
  summary: string;
}

export class LearningService {
  static async extractKnowledge(content: string, imageData?: string): Promise<any> {
    const schema = {
      type: Type.OBJECT,
      properties: {
        items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { content: {type: Type.STRING}, type: {type: Type.STRING}, domain: {type: Type.STRING} } } },
        explanation: { type: Type.STRING }
      }
    };
    try {
      const result = await generateJSON(`Extract rules from: ${content}`, "Distiller role.", schema);
      if (result?.items) {
        result.items.forEach((i: any) => GlobalMemoryController.learn(i.type, i.content, i.domain));
        GlobalMemoryController.logEvent(result.explanation);
      }
      return result;
    } catch (e) { return null; }
  }

  // Fix: Added rawMode parameter and updated model selection to resolve argument mismatch in TrainingChat.tsx
  static async startTeamDiscussion(content: string, onAgentSpeak: any, imageData?: string, fileName?: string, rawMode?: boolean) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("Key missing");
    const ai = new GoogleGenAI({ apiKey });
    
    // Fix: Use correct Gemini 3 models based on rawMode preference
    const model = rawMode ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    const stream = await ai.models.generateContentStream({
      model,
      contents: `Debate this: ${content}. Agents: Aarav, Rohit, Vikram, Kunal, Cipher. Format: [AgentName]: text`
    });

    let currentAgent = "System";
    for await (const chunk of stream) {
      const text = chunk.text;
      if (!text) continue;
      const match = text.match(/\[(Aarav|Rohit|Vikram|Neha|Kunal|Pooja|Cipher|System)\]:\s*/);
      if (match) currentAgent = match[1];
      onAgentSpeak(currentAgent, text.replace(/\[.*?\]:\s*/, ''), !!match);
    }
  }
}
