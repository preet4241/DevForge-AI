import { StateGraph, END } from "@langchain/langgraph";
import { AgentState } from "./types";
import { createAgentNode, createSupervisorNode, toolNode } from "./nodes";
import { shouldContinue, shouldLoop, shouldUseTool } from "./edges";
import { BaseMessage } from "@langchain/core/messages";

// --- A. CrewAI Style (Supervisor) ---
export const createCrewAIGraph = (members: string[]) => {
  const workflow = new StateGraph<AgentState>({
    channels: {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
      next: {
        value: (x: string, y: string) => y,
        default: () => "Supervisor",
      },
      sender: {
        value: (x: string, y: string) => y,
        default: () => "User",
      },
    },
  });

  // Add Supervisor Node
  workflow.addNode("Supervisor", createSupervisorNode(members));

  // Add Agent Nodes
  members.forEach((member) => {
    workflow.addNode(member, createAgentNode(member));
  });

  // Add Edges
  members.forEach((member) => {
    // After an agent finishes, return to Supervisor
    workflow.addEdge(member, "Supervisor" as any);
  });

  // Supervisor decides next step
  workflow.addConditionalEdges("Supervisor" as any, shouldContinue);

  workflow.setEntryPoint("Supervisor" as any);

  return workflow.compile();
};

// --- B. AutoGen Style (Debate/Cyclic) ---
export const createAutoGenGraph = (authorName: string, reviewerName: string) => {
  const workflow = new StateGraph<AgentState>({
    channels: {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
      next: {
        value: (x: string, y: string) => y,
        default: () => authorName,
      },
      sender: {
        value: (x: string, y: string) => y,
        default: () => "User",
      },
    },
  });

  workflow.addNode(authorName, createAgentNode(authorName));
  workflow.addNode(reviewerName, createAgentNode(reviewerName));

  // Author -> Reviewer
  workflow.addEdge(authorName as any, reviewerName as any);

  // Reviewer -> Conditional (Loop back to Author or End)
  workflow.addConditionalEdges(reviewerName as any, shouldLoop, {
    retry: authorName,
    __end__: END,
  } as any);

  workflow.setEntryPoint(authorName as any);

  return workflow.compile();
};

// --- C. AutoGPT Style (Autonomy/Tools) ---
export const createAutoGPTGraph = (agentName: string) => {
  const workflow = new StateGraph<AgentState>({
    channels: {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
      next: {
        value: (x: string, y: string) => y,
        default: () => agentName,
      },
      sender: {
        value: (x: string, y: string) => y,
        default: () => "User",
      },
    },
  });

  workflow.addNode("agent", createAgentNode(agentName));
  workflow.addNode("tools", toolNode);

  workflow.addConditionalEdges("agent" as any, shouldUseTool, {
    tools: "tools",
    __end__: END,
  } as any);

  workflow.addEdge("tools" as any, "agent" as any);

  workflow.setEntryPoint("agent" as any);

  return workflow.compile();
};
