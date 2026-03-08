import { StateGraph, END } from "@langchain/langgraph/web";
import { AgentState } from "./types";
import { createAgentNode, createSupervisorNode, toolNode } from "./nodes";
import { shouldContinue, shouldLoop, shouldUseTool } from "./edges";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";

// --- Basic Sequential Style ---
export const createBasicSequentialGraph = (members: string[]) => {
  const workflow = new StateGraph<AgentState>({
    channels: {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
      next: {
        value: (x: string, y: string) => y,
        default: () => members[0],
      },
      sender: {
        value: (x: string, y: string) => y,
        default: () => "User",
      },
    },
  });

  // Add Agent Nodes
  members.forEach((member) => {
    workflow.addNode(member, createAgentNode(member));
  });

  // Add Edges (Sequential)
  for (let i = 0; i < members.length - 1; i++) {
    workflow.addEdge(members[i], members[i + 1]);
  }
  workflow.addEdge(members[members.length - 1], END);

  workflow.setEntryPoint(members[0]);

  return workflow.compile();
};

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
    workflow.addEdge(member, "Supervisor");
  });

  // Supervisor decides next step
  workflow.addConditionalEdges("Supervisor", shouldContinue);

  workflow.setEntryPoint("Supervisor");

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
  workflow.addEdge(authorName, reviewerName);

  // Reviewer -> Conditional (Loop back to Author or End)
  workflow.addConditionalEdges(reviewerName, shouldLoop, {
    "loop": authorName,
    "end": END,
  });

  workflow.setEntryPoint(authorName);

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

  workflow.addConditionalEdges("agent", shouldUseTool, {
    tools: "tools",
    __end__: END,
  });

  workflow.addEdge("tools", "agent");

  workflow.setEntryPoint("agent");

  return workflow.compile();
};

// --- Graph Runner ---
export const runGraph = async (
  style: "Basic" | "CrewAI" | "AutoGen" | "AutoGPT",
  initialMessage: string,
  history: BaseMessage[],
  callbacks: {
    onNodeStart?: (nodeName: string) => void;
    onNodeEnd?: (nodeName: string, output: string) => void;
    onToolCall?: (toolName: string, output: string) => void;
  },
  fileOperations?: any,
  signal?: AbortSignal
) => {
  let graph;
  const members = ["Aarav", "Sanya", "Arjun", "Rohit", "Vikram"];

  switch (style) {
    case "Basic":
      graph = createBasicSequentialGraph(members);
      break;
    case "CrewAI":
      graph = createCrewAIGraph(members);
      break;
    case "AutoGen":
      graph = createAutoGenGraph("Aarav", "Sanya");
      break;
    case "AutoGPT":
      graph = createAutoGPTGraph("Aarav");
      break;
    default:
      graph = createBasicSequentialGraph(members);
  }

  const initialState: AgentState = {
    messages: [...history, new HumanMessage({ content: initialMessage })],
    next: "",
    sender: "User",
  };

  const config = {
    configurable: {
      fileOperations,
      callbacks,
    },
    signal,
  };

  const stream = await graph.stream(initialState, config);

  let finalOutput = "";
  for await (const chunk of stream) {
    const nodeName = Object.keys(chunk)[0];
    const state = chunk[nodeName] as AgentState;

    if (callbacks.onNodeStart) callbacks.onNodeStart(nodeName);

    if (nodeName === "tools" && state.toolOutput) {
      if (callbacks.onToolCall) callbacks.onToolCall("ToolExecutor", state.toolOutput);
    } else if (state.messages && state.messages.length > 0) {
      const lastMsg = state.messages[state.messages.length - 1];
      if (callbacks.onNodeEnd) callbacks.onNodeEnd(nodeName, lastMsg.content as string);
      finalOutput = lastMsg.content as string;
    }
  }

  return finalOutput;
};
