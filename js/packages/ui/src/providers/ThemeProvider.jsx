import React from 'react';
import { ThemeProvider } from '@mui/material';
import { createOpenCloningTheme } from '../theme';

/**
 * OpenCloningThemeProvider - Provides the OpenCloning MUI theme to its children
 *
 * @param {Object} props
 * @param {Object} [props.themeOptions] - MUI theme options that override the OpenCloning theme.
 *   Pass a stable object (not one created on every render), since the theme is rebuilt when it changes.
 * @param {React.ReactNode} props.children - Child components
 */
export function OpenCloningThemeProvider({ themeOptions, children }) {
  const theme = React.useMemo(() => createOpenCloningTheme(themeOptions), [themeOptions]);
  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
}

export default OpenCloningThemeProvider;
