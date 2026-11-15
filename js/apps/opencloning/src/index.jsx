import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { GlobalStyles } from '@mui/material';
import store from '@opencloning/store';
import { OpenCloningThemeProvider } from '@opencloning/ui/providers/ThemeProvider';
import App from './App';

// The tabs scroll inside the app, so the page itself never scrolls
const pageStyles = {
  html: { overflow: 'hidden' },
  body: { margin: 0, height: '100%', overflow: 'hidden' },
};

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <Provider store={store}>
    <OpenCloningThemeProvider>
      <GlobalStyles styles={pageStyles} />
      <App />
    </OpenCloningThemeProvider>
  </Provider>
);

// expose store when run in Cypress
if (window.Cypress) {
  window.store = store;
}
