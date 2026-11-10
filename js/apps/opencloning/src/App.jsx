import React, { useState, useEffect, useMemo } from 'react';
import { ConfigProvider } from '@opencloning/ui/providers/ConfigProvider';
import { DatabaseProvider } from '@opencloning/ui/providers/DatabaseContext';
import { getExternalHttpClient } from '@opencloning/utils/httpClients';
import { MainAppBar, OpenCloning, useUrlParamsLoader, useInitializeApp } from '@opencloning/ui/components';
import { useConfig } from '@opencloning/ui/hooks';
import { eLabFTWInterface } from '@opencloning/opencloning-elabftw';
import DummyInterface from '@opencloning/ui/components/dummy';

// Create a basic HTTP client for loading config (doesn't require backendUrl)
const configHttpClient = getExternalHttpClient();

function AppContent() {
  const { showAppBar } = useConfig();

  // Initialize app-level concerns (session storage)
  useInitializeApp();

  // Load sequences from URL parameters if present
  useUrlParamsLoader();

  return (
    <div className="App">
      {showAppBar && (
        <header className="App-header">
          <div className="app-title">
            <MainAppBar />
          </div>
        </header>
      )}
      <OpenCloning />
    </div>
  );
}

function App() {
  const [config, setConfig] = useState(null);
  const [message, setMessage] = useState('Loading config...');

  useEffect(() => {
    async function loadConfig() {
      setMessage('Loading config...');
      try {
        const { data } = await configHttpClient.get(`${import.meta.env.BASE_URL}config.json`);
        // Validate that data is an object, not HTML
        if (typeof data === 'object' && data !== null && !Object.prototype.hasOwnProperty.call(data, 'length')) {
          setConfig(data);
        } else {
          console.error('Invalid config data received:', data);
          setMessage('Invalid config data received');
        }
      } catch (error) {
        console.error('Failed to load config:', error);
        setMessage('Failed to load config');
      }
    }

    loadConfig();
  }, []);

  const database = useMemo(() => {
    const dbName = config?.database;
    if (dbName === 'elabftw') return eLabFTWInterface;
    else if (dbName === 'dummy') return DummyInterface;
    else return null;
  }, [config]);

  if (config === null) {
    return <div className="loading-state-message">{message}</div>;
  }

  return (
    <ConfigProvider config={config}>
      <DatabaseProvider value={database}>
        <AppContent />
      </DatabaseProvider>
    </ConfigProvider>
  );
}

export default App;
