import React from 'react';
import { ThemeProvider } from '@mui/material';
import { createOpenCloningTheme } from '../theme';

const IsInsideOpenCloningTheme = React.createContext(false);

/**
 * OpenCloningThemeProvider - Provides the OpenCloning MUI theme to its children
 *
 * The theme's CSS variables are set on :root, so only the outermost OpenCloningThemeProvider sets the
 * theme: nested ones (e.g. the one in <OpenCloning /> inside an app) just render their children.
 *
 * @param {Object} props
 * @param {Object} [props.themeOptions] - MUI theme options that override the OpenCloning theme.
 *   Pass a stable object (not one created on every render), since the theme is rebuilt when it changes.
 * @param {React.ReactNode} props.children - Child components
 */
export function OpenCloningThemeProvider({ themeOptions, children }) {
  const isNested = React.useContext(IsInsideOpenCloningTheme);
  const theme = React.useMemo(() => (isNested ? null : createOpenCloningTheme(themeOptions)), [isNested, themeOptions]);
  if (isNested) {
    return children;
  }
  return (
    <IsInsideOpenCloningTheme.Provider value>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </IsInsideOpenCloningTheme.Provider>
  );
}

export default OpenCloningThemeProvider;
