import React from 'react';
import { Button } from '@mui/material';
import { OpenCloningThemeProvider } from './ThemeProvider';

describe('<OpenCloningThemeProvider />', () => {
  it('uses the OpenCloning theme by default', () => {
    cy.mount(
      <OpenCloningThemeProvider>
        <Button variant="contained">Button</Button>
      </OpenCloningThemeProvider>,
    );
    cy.get('button').should('have.css', 'background-color', 'rgb(25, 118, 210)');
  });

  it('applies the theme options of the embedding page', () => {
    const themeOptions = { palette: { primary: { main: '#00695c' } } };
    cy.mount(
      <OpenCloningThemeProvider themeOptions={themeOptions}>
        <Button variant="contained">Button</Button>
      </OpenCloningThemeProvider>,
    );
    cy.get('button').should('have.css', 'background-color', 'rgb(0, 105, 92)');
  });
});
