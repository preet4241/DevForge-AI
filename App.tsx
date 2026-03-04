
import React, { lazy } from 'react';
console.log('DEBUG: App.tsx React:', React);
import { Routes, Route, HashRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';

// Helper for stability: Retries lazy imports with exponential backoff for smoother recovery
const retry = (fn: () => Promise<any>, retriesLeft = 5, interval = 500): Promise<any> => {
  return new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch((error) => {
        if (retriesLeft === 0) {
          reject(error);
          return;
        }
        // Exponential backoff: 500ms, 750ms, 1125ms... prevents hammering but tries fast first
        setTimeout(() => {
          retry(fn, retriesLeft - 1, interval * 1.5).then(resolve, reject);
        }, interval);
      });
  });
};

// Lazy loaded pages with retry logic for enhanced stability
const Home = lazy(() => retry(() => import('./pages/Home')));
const Builder = lazy(() => retry(() => import('./pages/Builder')));
const Projects = lazy(() => retry(() => import('./pages/Projects')));
const AgentDashboard = lazy(() => retry(() => import('./pages/AgentDashboard')));
const Chat = lazy(() => retry(() => import('./pages/Chat')));
const Planning = lazy(() => retry(() => import('./pages/Planning')));
const CodeGenerator = lazy(() => retry(() => import('./pages/CodeGenerator')));
const Settings = lazy(() => retry(() => import('./pages/Settings')));
const TrainingChat = lazy(() => retry(() => import('./pages/TrainingChat')));
const Templates = lazy(() => retry(() => import('./pages/Templates')));
const LogicBuilder = lazy(() => retry(() => import('./pages/LogicBuilder')));
const TerminalPage = lazy(() => retry(() => import('./pages/TerminalPage')));

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/build" element={<Builder />} />
              <Route path="/logic" element={<LogicBuilder />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/planning" element={<Planning />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/code" element={<CodeGenerator />} />
              <Route path="/agents" element={<AgentDashboard />} />
              <Route path="/training" element={<TrainingChat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/terminal" element={<TerminalPage />} />
            </Routes>
          </Layout>
        </HashRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
