import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@inkio/simple/minimal.css';
import './app.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Basic React example: missing #root mount node.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
