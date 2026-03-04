import * as React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('DEBUG: React version in index.tsx:', React?.version);
console.log('DEBUG: ReactDOM version in index.tsx:', (ReactDOM as any)?.version);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
