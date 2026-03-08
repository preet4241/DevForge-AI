import { AgentState } from "./types";

// --- Conditional Edge for Supervisor ---
export const shouldContinue = (state: AgentState) => {
  const { next } = state;
  if (next === "FINISH") {
    return "__end__";
  }
  return next;
};

// --- Conditional Edge for Cyclic Graph (Debate) ---
export const shouldLoop = (state: AgentState) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  const content = (lastMessage.content as string).toLowerCase();

  if (content.includes("approved") || content.includes("looks good") || content.includes("lgtm")) {
    return "end";
  }
  
  // If critique is present, loop back to the first agent
  if (content.includes("critique") || content.includes("change") || content.includes("fix")) {
    return "loop"; // Loop back to the author
  }

  return "end"; // Default end if unsure
};

// --- Conditional Edge for Autonomy (Tool Usage) ---
export const shouldUseTool = (state: AgentState) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage.content as string;

  if (content.includes("TOOL_CALL:")) {
    return "tools";
  }
  return "__end__";
};
