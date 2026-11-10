import React, { createContext, useContext, useMemo } from 'react';

const ConfigContext = createContext(null);

/**
 * ConfigProvider - Provides application configuration via React Context
 * 
 * @param {Object} props
 * @param {Object} props.config - Config object
 * @param {React.ReactNode} props.children - Child components
 */
export function ConfigProvider({ config, children }) {
  if (!config) {
    throw new Error('ConfigProvider requires a config prop');
  }

  const value = useMemo(() => ({
    config,
  }), [config]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * useConfig - Hook to access configuration from ConfigProvider
 * 
 * @returns {Object} Configuration object with properties:
 *   - backendUrl: string
 *   - showAppBar: boolean
 *   - enableAssembler: boolean
 *   - enablePlannotate: boolean
 *   - requiresBackendAuth: boolean
 *   - noExternalRequests: boolean
 *   - database: string | null
 * 
 * @throws {Error} If used outside of ConfigProvider
 */
export function useConfig() {
  const context = useContext(ConfigContext);
  
  if (context === null) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }

  return context.config;
}

export default ConfigProvider;
