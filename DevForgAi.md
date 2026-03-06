# DevForge AI Builder - Project Documentation

## 1. Project Overview
**What is this project?**
DevForge AI Builder is an advanced platform where a swarm of autonomous AI agents collaborate in real-time to plan, architect, and generate software projects (Web Apps, Mobile Apps, Bots, and Software). It acts as an AI-powered IDE and project generator.

**Tech Stack:**
- **Frontend**: React 19, React Router DOM, Vite, Tailwind CSS, Monaco Editor, React Flow (visual logic builder), xterm.js (terminal), Lucide React.
- **Backend**: Express.js, Socket.io (for terminal PTY), tsx.
- **Database/Storage**: Firebase Realtime Database (RTDB) for projects and agent memories, IndexedDB (`idb-keyval`) for vector memory (RAG), LocalStorage for caching. Supabase schema exists but is currently inactive in frontend services.
- **APIs/AI**: Google GenAI (`@google/genai`), LangChain/LangGraph (`@langchain/langgraph`). Custom `UniversalLLM` dispatcher supports Gemini, OpenAI, Anthropic, OpenRouter, and Ollama.

## 2. Frontend
**Pages/Screens Implemented:**
- `Home.tsx`: Landing page with animations and quick start prompts.
- `Builder.tsx`: Project creation with voice input, prompt enhancement, and templates.
- `Projects.tsx`: List of saved projects.
- `AgentDashboard.tsx`: Dashboard showing agent statuses, roles, stats (XP/levels), and badges.
- `Chat.tsx`: Multi-agent chat interface with orchestrator.
- `Planning.tsx`: Project planning interface with Mermaid.js diagrams.
- `CodeGenerator.tsx`: Full IDE with Monaco editor, file explorer, multi-tab support, and terminal.
- `Settings.tsx`: API key management and general settings.
- `TrainingChat.tsx`: Interface to train agents and update their memory.
- `Templates.tsx`: Pre-built project templates.
- `LogicBuilder.tsx`: Visual node-based logic builder using React Flow.
- `TerminalPage.tsx`: Full-screen terminal emulator.

**UI Components Built:**
- `Layout.tsx`, `ErrorBoundary.tsx`, `Toast.tsx`, `UI.tsx` (Button, Card, Tooltip), `FileExplorer.tsx`, `Markdown.tsx`, `ThreeLoadingScreen.tsx`, `ActivityLogPanel.tsx`, `TerminalView.tsx`.

**Routing Structure:**
- Uses `react-router-dom` with `HashRouter` in `App.tsx`. Lazy loading is implemented with a custom retry mechanism for stability.

**State Management Approach:**
- **React Context**: `IDEContext.tsx` uses `useReducer` to manage complex IDE state (file system, open tabs, active tab, unsaved files).
- **Client Storage**: LocalStorage for history and caching, IndexedDB for large vector embeddings (agent memory).

## 3. Backend
**API Endpoints:**
- `GET /api/health`: Health check endpoint.
- `POST /api/workspace/sync`: Syncs files from the frontend to the local disk (`/workspace` directory).
- `POST /api/workspace/create`: Creates a new workspace folder for a project.

**WebSockets:**
- Socket.io is used to provide a real-time terminal emulator. It listens for `terminal.toTerm` and emits `terminal.incData`. It spawns `cmd.exe` on Windows or a pseudo-terminal via `python3 pty` on Unix.

**Authentication/Authorization Logic:**
- Currently, there is no authentication or authorization implemented. The app is open access.

**Middleware Used:**
- `express.json({ limit: '50mb' })` for parsing large file payloads.
- Vite middleware for development mode (`middlewareMode: true`).
- `express.static('dist')` for serving production builds.

## 4. Database
**Schema/Models Defined:**
- **Firebase RTDB**:
  - `projects/{id}`: Stores project metadata and nested workspace files.
  - `agents/{agentId}/memories`: Stores agent learning memories (topic, summary, connections).
- **Supabase (Defined in `database/schema.sql`, but currently unused in frontend)**:
  - `projects`: id, name, description, type, status, metadata.
  - `code_files`: id, project_id, name, language, content, path.
  - `activity_logs`: id, project_id, agent_id, type, text, detail.

**Relationships:**
- In the SQL schema, `code_files` and `activity_logs` have a foreign key to `projects(id)` with `ON DELETE CASCADE`.

## 5. Features Implemented
**Working Features:**
- Project creation with voice input and AI prompt enhancement.
- Multi-agent orchestration (Aarav, Sanya, Arjun, Rohit, Vikram, etc.) with debate, synthesis, and memory retrieval.
- Universal LLM dispatcher supporting multiple providers (Gemini, OpenAI, Anthropic, OpenRouter, Ollama).
- Agent memory system with vector embeddings (RAG) and cosine similarity search stored in IndexedDB.
- Gamified agent stats (XP, levels, badges) that dynamically modify LLM system prompts.
- Fully functional IDE interface with Monaco editor, file explorer, and multi-tab support.
- Integrated terminal emulator using xterm.js and Socket.io.
- Visual logic builder using React Flow.
- Workspace file syncing to local disk.

**Partially-Done Features:**
- **LangGraph Integration**: Graphs are defined in `services/langgraph/graphs.ts` (CrewAI, AutoGen, AutoGPT styles), but the main app currently uses a custom `Orchestrator` class (`services/orchestrator.ts`).
- **Supabase Integration**: Schema exists, but data operations are currently routed through Firebase RTDB and LocalStorage.

## 6. Current Errors & Issues
**Known Bugs and Errors:**
- **Terminal PTY Fallback**: The backend uses `python3 -c 'import pty; pty.spawn("/bin/bash")'` on Unix systems. This will fail if Python 3 is not installed on the host machine.
- **Voice Input**: Relies on the experimental browser `SpeechRecognition` API, which has inconsistent support across different browsers (works best in Chrome).
- **Database Duality**: The presence of both Firebase RTDB logic and a Supabase SQL schema creates architectural ambiguity.

**Files/Modules Causing Problems:**
- `server.ts`: The terminal spawning logic is fragile depending on the host OS environment.

## 7. Sensitive Areas
- **`server.ts` (Terminal WebSocket)**: Spawns shell processes (`cmd.exe` or `/bin/bash`). This is a severe security risk (Remote Code Execution) if the server is exposed to the public internet without authentication.
- **`services/geminiService.ts`**: The `UniversalLLM` dispatcher handles raw HTTP requests and API keys for various providers. The rate limiting (429) and retry logic here is complex and critical for stability.
- **`services/memoryService.ts`**: Performs client-side vector math (cosine similarity) for RAG. Performance could degrade if the IndexedDB vector store grows too large.

## 8. What's Remaining
**Features Not Yet Built:**
- **Authentication & User Accounts**: The app currently lacks user login and secure data isolation.
- **Cloud Deployment Pipeline**: Currently, projects can only be exported to a ZIP or saved to the local workspace. Direct deployment to platforms like Vercel or Netlify is missing.
- **Full LangGraph Adoption**: Transitioning the custom `Orchestrator` to use the defined LangGraph workflows for better state management during agent debates.

**Things That Are Broken and Need Fixing:**
- **Security**: The terminal WebSocket endpoint must be secured with authentication before any public deployment.
- **Database Consolidation**: Decide between Firebase RTDB and Supabase, and remove the unused implementation to clean up the codebase.
