import { AgentState } from "./types";
import { chatWithAgent, getAgentPersona } from "../geminiService";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

// --- Agent Node Factory ---
export const createAgentNode = (agentName: string) => {
  return async (state: AgentState, config?: any) => {
    const { messages } = state;
    const callbacks = config?.configurable?.callbacks;
    
    if (callbacks?.onNodeStart) callbacks.onNodeStart(agentName);
    
    // Convert LangChain messages to the format expected by chatWithAgent
    const history = messages.slice(0, -1).map(m => ({
      role: m._getType() === 'human' ? 'user' : 'model',
      parts: [{ text: m.content as string }]
    }));
    
    const lastMessage = messages[messages.length - 1];
    const userContent = lastMessage.content as string;

    console.log(`[LangGraph] ${agentName} is thinking...`);

    const response = await chatWithAgent(
      history,
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
  return async (state: AgentState, config?: any) => {
    const { messages } = state;
    const callbacks = config?.configurable?.callbacks;
    
    if (callbacks?.onNodeStart) callbacks.onNodeStart("Supervisor");
    
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
export const toolNode = async (state: AgentState, config?: any) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage.content as string;
  const fileOps = config?.configurable?.fileOperations;
  const callbacks = config?.configurable?.callbacks;

  if (callbacks?.onNodeStart) callbacks.onNodeStart("ToolExecutor");

  // Simple heuristic to detect tool usage (in a real app, use function calling)
  if (content.includes("TOOL_CALL:")) {
    const toolCall = content.split("TOOL_CALL:")[1].trim();
    let toolOutput = "";

    try {
      if (toolCall.startsWith("CREATE_FILE")) {
        const args = toolCall.replace("CREATE_FILE", "").trim();
        const spaceIdx = args.indexOf(" ");
        const path = spaceIdx > -1 ? args.substring(0, spaceIdx) : args;
        const fileContent = spaceIdx > -1 ? args.substring(spaceIdx + 1) : "";
        if (fileOps?.createFile) {
          await fileOps.createFile(path, fileContent);
          toolOutput = `[System] Created file: ${path}`;
        } else {
          toolOutput = `[System] File operations not available.`;
        }
      } else if (toolCall.startsWith("EDIT_FILE")) {
        const args = toolCall.replace("EDIT_FILE", "").trim();
        const spaceIdx = args.indexOf(" ");
        const path = spaceIdx > -1 ? args.substring(0, spaceIdx) : args;
        const fileContent = spaceIdx > -1 ? args.substring(spaceIdx + 1) : "";
        if (fileOps?.editFile) {
          await fileOps.editFile(path, fileContent);
          toolOutput = `[System] Edited file: ${path}`;
        } else {
          toolOutput = `[System] File operations not available.`;
        }
      } else if (toolCall.startsWith("DELETE_FILE")) {
        const path = toolCall.replace("DELETE_FILE", "").trim();
        if (fileOps?.deleteFile) {
          await fileOps.deleteFile(path);
          toolOutput = `[System] Deleted file: ${path}`;
        } else {
          toolOutput = `[System] File operations not available.`;
        }
      } else if (toolCall.startsWith("RENAME_FILE")) {
        const args = toolCall.replace("RENAME_FILE", "").trim();
        const [oldPath, newPath] = args.split(" ");
        if (fileOps?.renameFile) {
          await fileOps.renameFile(oldPath, newPath);
          toolOutput = `[System] Renamed file from ${oldPath} to ${newPath}`;
        } else {
          toolOutput = `[System] File operations not available.`;
        }
      } else if (toolCall.startsWith("SEARCH")) {
        const query = toolCall.replace("SEARCH", "").trim();
        toolOutput = `[System] Search results for "${query}": Found 3 relevant articles...`;
      } else if (toolCall.startsWith("CALCULATE")) {
        toolOutput = `[System] Calculation result: 42`;
      } else {
        toolOutput = `[System] Unknown tool: ${toolCall}`;
      }
    } catch (e: any) {
      toolOutput = `[System] Error executing tool: ${e.message}`;
    }

    return {
      messages: [...messages, new SystemMessage(toolOutput)],
      sender: "ToolExecutor",
      toolOutput
    };
  }

  return {};
};
