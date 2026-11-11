import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import store from '@opencloning/store';
import { ConfigProvider } from '@opencloning/ui/providers/ConfigProvider';
// Import UI package styles (includes all component styles)
import '@opencloning/ui';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);

// Config for test-app
const config = {
  backendUrl: 'http://localhost:8000',
  showAppBar: false,
  noExternalRequests: true,
  enableAssembler: false,
  enablePlannotate: false,
};

root.render(
  <Provider store={store}>
    <ConfigProvider config={config}>
      <App />
    </ConfigProvider>
  </Provider>
);
