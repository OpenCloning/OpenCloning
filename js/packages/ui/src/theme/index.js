import { createTheme } from '@mui/material';
import { merge } from 'lodash-es';

// The MUI theme shared by all OpenCloning apps: styles that should look the same everywhere go here
// (see .claude/skills/mui-styling).
const themeOptions = {
  // Also exposes the theme as CSS variables, for the CSS that is left, e.g. var(--opencloning-palette-primary-main).
  // The prefix keeps them apart from those of a host page that also uses MUI.
  cssVariables: { cssVarPrefix: 'opencloning' },
  palette: {
    // Sequences and sources that are saved in the database
    savedToDatabase: { main: '#008000' },
  },
  components: {
    MuiAlert: {
      styleOverrides: {
        // Vertically centre the icon and the message
        root: { alignItems: 'center' },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: { fontSize: '1rem' },
      },
    },
  },
};

/**
 * Creates the OpenCloning theme, with optional overrides from the page that embeds OpenCloning
 *
 * @param {Object} [overrides] - MUI theme options (e.g. `{ palette: { primary: { main: '#00695c' } } }`),
 *   merged on top of the OpenCloning theme
 * @returns {Object} MUI theme
 */
export function createOpenCloningTheme(overrides = {}) {
  // Merged before createTheme, since the CSS variables are generated from the options it receives first
  return createTheme(merge({}, themeOptions, overrides));
}
