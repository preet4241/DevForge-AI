
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
    onMessageChunk: MessageCallback, // New callback for streaming agent responses
    signal?: AbortSignal
  ): Promise<string> {
    
    if (signal?.aborted) throw new Error("Process stopped by user.");

    // Detect project type context from history/state if possible, or default
    const storedProject = localStorage.getItem('currentProject');
    const projectInfo = storedProject ? JSON.parse(storedProject) : { type: 'software' };
    const practices = BEST_PRACTICES[projectInfo.type as keyof typeof BEST_PRACTICES] || BEST_PRACTICES.software;

    // --- STEP 1: AARAV (Team Leader) ---
    onStatusUpdate('Aarav', 'Reviewing project vision...');
    // Using RAG Retrieval
    const aaravMemory = await MemoryController.retrieveRelevantContext('Aarav', userMessage);
    const aaravPrompt = `
    User Input: "${userMessage}"
    Category: ${projectInfo.type}
    ${aaravMemory}
    Task: Define the core vision and coordinate the team.
    `;
    const aaravResp = await chatWithAgent([], aaravPrompt, getAgentPersona('Aarav'), 'Aarav', { signal });
    onMessageChunk('Aarav', aaravResp);
    MemoryController.addExperience('Aarav', 50, ['coordination', 'planning']);

    // --- STEP 2: SANYA (Researcher) ---
    onStatusUpdate('Sanya', 'Conducting market & trend research...');
    const sanyaMemory = await MemoryController.retrieveRelevantContext('Sanya', aaravResp);
    const sanyaPrompt = `
    Project Vision (Aarav): ${aaravResp}
    ${sanyaMemory}
    Task: Perform deep research. Use Google Search to find competitors, libraries, and trends.
    `;
    const sanyaResp = await chatWithAgent([], sanyaPrompt, getAgentPersona('Sanya'), 'Sanya', { 
      signal, 
      tools: [{googleSearch: {}}] 
    });
    onMessageChunk('Sanya', sanyaResp);
    MemoryController.addExperience('Sanya', 60, ['research', 'analysis']);

    // --- STEP 3: ARJUN (Product Manager) ---
    onStatusUpdate('Arjun', 'Defining user stories & requirements...');
    const arjunMemory = await MemoryController.retrieveRelevantContext('Arjun', sanyaResp);
    const arjunPrompt = `
    Research Data (Sanya): ${sanyaResp}
    Vision (Aarav): ${aaravResp}
    ${arjunMemory}
    Task: Create Product Requirements Document (PRD) and User Stories.
    `;
    
    // We get a structured PRD here to pass to Rohit
    const arjunSchema = {
      type: Type.OBJECT,
      properties: {
        features: { type: Type.ARRAY, items: { type: Type.STRING } },
        user_stories: { type: Type.ARRAY, items: { type: Type.STRING } },
        summary: { type: Type.STRING }
      },
      required: ['features', 'summary']
    };
    
    const arjunJson = await generateJSON(arjunPrompt, getAgentPersona('Arjun'), arjunSchema, { signal });
    const arjunSummary = arjunJson ? arjunJson.summary : "Product requirements defined.";
    
    // Format Arjun's response nicely for the chat
    let arjunDisplay = arjunSummary;
    if (arjunJson?.features?.length) {
      arjunDisplay += "\n\n**Key Features:**\n" + arjunJson.features.map((f: string) => `- ${f}`).join('\n');
    }
    onMessageChunk('Arjun', arjunDisplay);
    MemoryController.addExperience('Arjun', 50, ['product', 'requirements']);

    // --- STEP 4: ROHIT (Architect) ---
    onStatusUpdate('Rohit', 'Designing technical architecture...');
    const rohitMemory = await MemoryController.retrieveRelevantContext('Rohit', arjunSummary);
    const rohitPrompt = `
    PRD (Arjun): ${JSON.stringify(arjunJson)}
    Best Practices: ${practices.title} - ${practices.rules.join('. ')}
    ${rohitMemory}
    
    Task: Design the system architecture.
    CRITICAL: Define the execution flow.
    - Vikram: Backend
    - Neha: Frontend
    - Kunal: DevOps/Security
    - Pooja: QA
    - Cipher: Red Team & Vulnerability Analysis
    - Maya: Live Preview & Runtime Simulation
    `;

    const rohitSchema = {
      type: Type.OBJECT,
      properties: {
        agent_flow: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING, enum: ['Vikram', 'Neha', 'Kunal', 'Pooja', 'Cipher', 'Maya'] },
          description: "Ordered list of agents to execute the build. Include Maya for visual checking."
        },
        tech_stack: { 
          type: Type.OBJECT,
          properties: {
            frontend: { type: Type.STRING },
            backend: { type: Type.STRING },
            database: { type: Type.STRING },
            deployment: { type: Type.STRING }
          },
          required: ['frontend', 'backend', 'database', 'deployment']
        }
      },
      required: ['agent_flow', 'tech_stack']
    };

    const plan = await generateJSON(rohitPrompt, getAgentPersona('Rohit'), rohitSchema, { 
      signal,
      tools: [{googleSearch: {}}] 
    });

    if (!plan) return "Architecture phase failed. Please try again.";

    const rohitDisplay = `**Architecture Plan**\n\n**Stack:**\n- Frontend: ${plan.tech_stack.frontend}\n- Backend: ${plan.tech_stack.backend}\n- DB: ${plan.tech_stack.database}\n\n**Agent Flow:** ${plan.agent_flow.join(' → ')}`;
    onMessageChunk('Rohit', rohitDisplay);
    MemoryController.addExperience('Rohit', 80, ['design', 'architecture']);

    // --- EXECUTION LOOP ---
    let accumulatedContext = `
    Project: ${projectInfo.name}
    Vision (Aarav): ${aaravResp}
    Research (Sanya): ${sanyaResp}
    Requirements (Arjun): ${arjunSummary}
    Stack: ${JSON.stringify(plan.tech_stack)}
    `;

    let finalResponse = `### Team Report: ${projectInfo.name}\n\n`;
    finalResponse += `**Aarav (Lead):** ${aaravResp}\n\n`;
    finalResponse += `**Sanya (Research):** ${sanyaResp}\n\n`;
    finalResponse += `**Arjun (PM):** ${arjunSummary}\n\n`;

    let lastActiveAgent = 'Rohit';

    for (const agentName of plan.agent_flow) {
      if (signal?.aborted) throw new Error("Process stopped by user.");
      
      onStatusUpdate(agentName, agentName === 'Pooja' ? 'Conducting QA...' : agentName === 'Cipher' ? 'Red Team Analysis...' : agentName === 'Maya' ? 'Simulating Live Preview...' : 'Building...');
      
      // Use RAG to fetch context relevant to the specific task
      let specificTask = "";
      if (agentName === 'Vikram') specificTask = `Implement backend logic using ${plan.tech_stack.backend}.`;
      else if (agentName === 'Neha') specificTask = `Build frontend UI using ${plan.tech_stack.frontend}.`;
      else if (agentName === 'Kunal') specificTask = `DevOps configuration for ${plan.tech_stack.deployment}.`;
      else if (agentName === 'Cipher') specificTask = `Red Team attack analysis on ${plan.tech_stack.backend}.`;
      else if (agentName === 'Maya') specificTask = `Run the code generated by Neha/Vikram in a simulated browser. Check for CSS issues and mobile responsiveness.`;
      else specificTask = `Quality Assurance check on ${lastActiveAgent}.`;

      const memoryContext = await MemoryController.retrieveRelevantContext(agentName, specificTask);
      let taskSuffix = "";
      let taskSkills: string[] = [];
      const isBuilder = ['Vikram', 'Neha', 'Kunal', 'Zara', 'Aryan', 'Karan'].includes(agentName);

      if (agentName === 'Vikram') {
        specificTask = `Implement backend logic. Stack: ${plan.tech_stack.backend}, DB: ${plan.tech_stack.database}.`;
        taskSkills = ['backend', plan.tech_stack.backend, plan.tech_stack.database];
      }
      if (agentName === 'Neha') {
        specificTask = `Build UI components. Stack: ${plan.tech_stack.frontend}.`;
        taskSkills = ['frontend', plan.tech_stack.frontend];
      }
      if (agentName === 'Kunal') {
        specificTask = `Setup Security & DevOps. Stack: ${plan.tech_stack.deployment}. Analyze data and optimize security.`;
        taskSkills = ['devops', 'security', plan.tech_stack.deployment];
      }
      
      if (agentName === 'Pooja') {
        specificTask = `Audit work of ${lastActiveAgent}. Check against requirements: ${arjunSummary}. Ask user if implementation is correct.`;
        taskSuffix = `\nOutput JSON signal for memory learning.`;
        taskSkills = ['qa', 'testing'];
      }

      if (agentName === 'Cipher') {
        specificTask = `Conduct Red Team analysis on the proposed architecture and stack (${plan.tech_stack.backend}/${plan.tech_stack.frontend}). Identify critical vulnerabilities, potential exploits, and suggest hardening measures.`;
        taskSkills = ['security', 'redteam'];
      }

      if (agentName === 'Maya') {
        specificTask = `Simulate a Live Preview of the code generated by Neha. Provide a description of what the user sees, and log any visual errors or console warnings. Suggest specific CSS fixes if needed.`;
        taskSkills = ['testing', 'frontend', 'css'];
      }

      const fullPrompt = `Execute Task: ${specificTask}\n${memoryContext}\n${taskSuffix}`;
      
      // Use generateVerifiedCode for builders to ensure syntax correctness
      let agentResponse = "";
      if (isBuilder) {
         agentResponse = await generateVerifiedCode(agentName, fullPrompt, signal);
      } else {
         agentResponse = await chatWithAgent(
            [{ role: 'user', parts: [{ text: accumulatedContext }] }],
            fullPrompt,
            getAgentPersona(agentName),
            agentName,
            { signal }
         );
      }
      
      onMessageChunk(agentName, agentResponse);
      
      // Award XP
      MemoryController.addExperience(agentName, 100, taskSkills);

      // Handle Memory Learning (simplified for brevity)
      if (agentName === 'Pooja') {
          // Logic to parse Pooja's JSON and update memory would go here
      } else {
        lastActiveAgent = agentName;
      }

      accumulatedContext += `\n\n[${agentName}]: ${agentResponse}`;
      finalResponse += `**${agentName}:**\n${agentResponse}\n\n`;
    }

    onStatusUpdate('System', 'Cycle Complete');
    return finalResponse;
  }
}
