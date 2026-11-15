import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, GlobalStyles } from '@mui/material';
// Import UI package styles (includes all component styles)
import '@opencloning/ui';
import { OpenCloningThemeProvider } from '@opencloning/ui/providers/ThemeProvider';
import './index.css';
import App from './App';

// Single scrollbar: only the body scrolls (no overflow on html).
// Set after CssBaseline, which also sets the body background.
const pageStyles = (theme) => ({
  html: { height: '100%' },
  body: {
    minHeight: '100%',
    paddingBottom: '100px',
    overflowY: 'scroll',
    backgroundColor: theme.vars.palette.grey[100],
  },
  '#root': { minHeight: '100%' },
});

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <OpenCloningThemeProvider>
    <CssBaseline />
    <GlobalStyles styles={pageStyles} />
    <App />
  </OpenCloningThemeProvider>
);
