import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@inkio/simple/style.css';
import './app.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('React Router example: missing #root mount node.');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
