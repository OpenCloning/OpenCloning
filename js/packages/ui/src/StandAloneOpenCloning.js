import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import store from '@opencloning/store';
import { ConfigProvider } from './providers/ConfigProvider';
import { OpenCloning } from './components';
// Import styles
import './index.css';

/**
 * StandAloneOpenCloning - Mounts the OpenCloning component into a DOM element
 * 
 * This function handles all the setup required for OpenCloning:
 * - Redux Provider with store
 * - ConfigProvider with config
 * - React rendering
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.config - Configuration object for OpenCloning
 * @param {HTMLElement} options.element - DOM element where to mount the component
 * @returns {Function} Cleanup function that unmounts the component
 * 
 * @example
 * const container = document.getElementById('opencloning-container');
 * const cleanup = StandAloneOpenCloning({
 *   config: { /* config object *\/ },
 *   element: container
 * });
 * 
 * // Later, to unmount:
 * cleanup();
 */
export function StandAloneOpenCloning({ config, element }) {
  if (!config) {
    throw new Error('StandAloneOpenCloning requires a config object');
  }

  if (!element) {
    throw new Error('StandAloneOpenCloning requires an element');
  }

  if (!(element instanceof HTMLElement)) {
    throw new Error('Element must be an HTMLElement');
  }

  const container = element;

  // Create React root
  const root = createRoot(container);

  // Render the component with all providers
  root.render(
    React.createElement(Provider, { store },
      React.createElement(ConfigProvider, { config },
        React.createElement(OpenCloning)
      )
    )
  );

  // Return cleanup function
  return () => {
    root.unmount();
  };
}

export default StandAloneOpenCloning;
