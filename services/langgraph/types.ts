import { BaseMessage } from "@langchain/core/messages";

export interface AgentState {
  messages: BaseMessage[];
  next: string;
  sender: string;
  // Add any other state variables here (e.g., current task, critique, etc.)
  critique?: string;
  task?: string;
  toolOutput?: string;
}
