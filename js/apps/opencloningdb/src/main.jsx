import React from 'react';
import './index.css';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { OpenCloningThemeProvider } from '@opencloning/ui/providers/ThemeProvider';
import store from './store';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <Provider store={store}>
    <OpenCloningThemeProvider>
      <App />
    </OpenCloningThemeProvider>
  </Provider>,
);
