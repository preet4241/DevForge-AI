
import { GoogleGenAI } from "@google/genai";
import { ApiConfigService } from "./apiConfigService";

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
      contents: {
        parts: [{ text }]
      }
    });
    
    return (response as any).embedding?.values || null;
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    return null;
  }
};
