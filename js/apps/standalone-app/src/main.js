/**
 * Standalone OpenCloning Example
 * 
 * This demonstrates how to use OpenCloning without manually setting up
 * React Provider, Redux Provider, or ConfigProvider.
 * 
 * Compare this to test-app/src/main.jsx which requires manual setup of all providers.
 */

import { StandAloneOpenCloning } from '@opencloning/ui/standalone';
// Import styles (if not already imported via the standalone function)
import '@opencloning/ui';
import './index.css';

// Config for standalone-app
const config = {
  backendUrl: 'http://localhost:8000',
  showAppBar: false,
  noExternalRequests: true,
  enableAssembler: false,
  enablePlannotate: false,
};

// Get references to DOM elements
const container = document.getElementById('root');
const toggleButton = document.getElementById('toggle-button');

// State to track if OpenCloning is mounted
let cleanup = null;
let isMounted = false;

/**
 * Mount OpenCloning component
 */
function mountOpenCloning() {
  if (!isMounted) {
    cleanup = StandAloneOpenCloning({
      config,
      element: container
    });
    isMounted = true;
    toggleButton.textContent = 'Unmount OpenCloning';
    // Update exported cleanup function
    window.openCloningCleanup = cleanup;
    console.log('OpenCloning mounted');
  }
}

/**
 * Unmount OpenCloning component
 */
function unmountOpenCloning() {
  if (isMounted && cleanup) {
    cleanup();
    cleanup = null;
    isMounted = false;
    toggleButton.textContent = 'Mount OpenCloning';
    // Clear exported cleanup function
    window.openCloningCleanup = null;
    console.log('OpenCloning unmounted');
  }
}

/**
 * Toggle mount/unmount state
 */
function toggleOpenCloning() {
  if (isMounted) {
    unmountOpenCloning();
  } else {
    mountOpenCloning();
  }
}

// Set up button click handler
toggleButton.addEventListener('click', toggleOpenCloning);

// Initially mount OpenCloning
mountOpenCloning();

// Export functions for potential use (e.g., in browser console)
window.mountOpenCloning = mountOpenCloning;
window.unmountOpenCloning = unmountOpenCloning;
