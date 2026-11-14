import React from 'react';
import { createRoot } from 'react-dom/client';
// Import UI package styles (includes all component styles)
import '@opencloning/ui';
import { OpenCloningThemeProvider } from '@opencloning/ui/providers/ThemeProvider';
import './index.css';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <OpenCloningThemeProvider>
    <App />
  </OpenCloningThemeProvider>
);
