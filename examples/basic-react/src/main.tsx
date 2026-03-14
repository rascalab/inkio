import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@inkio/simple/minimal.css';
import './app.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
