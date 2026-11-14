import { createTheme } from '@mui/material';

// The MUI theme shared by all OpenCloning apps: styles that should look the same everywhere go here
// (see .claude/skills/mui-styling). It is still MUI's default theme; styling-plan.md lists what moves in.
const themeOptions = {};

/**
 * Creates the OpenCloning theme, with optional overrides from the page that embeds OpenCloning
 *
 * @param {Object} [overrides] - MUI theme options (e.g. `{ palette: { primary: { main: '#00695c' } } }`),
 *   merged on top of the OpenCloning theme
 * @returns {Object} MUI theme
 */
export function createOpenCloningTheme(overrides = {}) {
  return createTheme(themeOptions, overrides);
}
