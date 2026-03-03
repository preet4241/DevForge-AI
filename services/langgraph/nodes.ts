import { AgentState } from "./types";
import { chatWithAgent, getAgentPersona } from "../geminiService";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

// --- Agent Node Factory ---
export const createAgentNode = (agentName: string) => {
  return async (state: AgentState) => {
    const { messages } = state;
    // Convert LangChain messages to the format expected by chatWithAgent (if needed)
    // For now, we'll just pass the last message content as the prompt
    // In a real implementation, we'd pass the full history
    const lastMessage = messages[messages.length - 1];
    const userContent = lastMessage.content as string;

    console.log(`[LangGraph] ${agentName} is thinking...`);

    const response = await chatWithAgent(
      [], // History is handled by LangGraph state in this simplified example
      userContent,
      getAgentPersona(agentName),
      agentName
    );

    return {
      messages: [...messages, new AIMessage({ content: response, name: agentName })],
      sender: agentName,
    };
  };
};

// --- Supervisor Node ---
// This node decides who goes next based on the conversation state
export const createSupervisorNode = (members: string[]) => {
  return async (state: AgentState) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    
    const systemPrompt = `You are a supervisor tasked with managing a conversation between the following workers: ${members.join(", ")}. 
    Given the following user request, respond with the worker to act next. 
    Each worker will perform a task and respond with their results and status. 
    When finished, respond with FINISH.
    
    Current conversation:
    ${messages.map(m => `${m.name || 'User'}: ${m.content}`).join('\n')}
    `;

    const response = await chatWithAgent(
      [],
      "Who should act next? Respond ONLY with the name of the worker or FINISH.",
      systemPrompt,
      "Aarav" // Aarav is our default manager/router
    );

    const next = response.trim().replace(/[^a-zA-Z0-9_]/g, ''); // Clean up response
    
    console.log(`[LangGraph] Supervisor selected: ${next}`);

    if (members.includes(next)) {
      return { next };
    }
    return { next: "FINISH" };
  };
};

// --- Tool Node (AutoGPT Style) ---
export const toolNode = async (state: AgentState) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage.content as string;

  // Simple heuristic to detect tool usage (in a real app, use function calling)
  if (content.includes("TOOL_CALL:")) {
    const toolCall = content.split("TOOL_CALL:")[1].trim();
    let toolOutput = "";

    if (toolCall.startsWith("SEARCH")) {
      const query = toolCall.replace("SEARCH", "").trim();
      toolOutput = `[System] Search results for "${query}": Found 3 relevant articles...`;
    } else if (toolCall.startsWith("CALCULATE")) {
      toolOutput = `[System] Calculation result: 42`;
    } else {
      toolOutput = `[System] Unknown tool: ${toolCall}`;
    }

    return {
      messages: [...messages, new SystemMessage(toolOutput)],
      sender: "ToolExecutor",
      toolOutput
    };
  }

  return {};
};
