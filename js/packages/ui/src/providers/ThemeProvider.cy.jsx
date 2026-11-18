import React from 'react';
import { Button } from '@mui/material';
import { OpenCloningThemeProvider } from './ThemeProvider';

// cy.mount wraps every component in OpenCloningThemeProvider, passing it the themeOptions option
describe('<OpenCloningThemeProvider />', () => {
  it('uses the OpenCloning theme by default', () => {
    cy.mount(<Button variant="contained">Button</Button>);
    cy.get('button').should('have.css', 'background-color', 'rgb(25, 118, 210)');
  });

  it('applies the theme options of the embedding page', () => {
    const themeOptions = { palette: { primary: { main: '#00695c' } } };
    cy.mount(<Button variant="contained">Button</Button>, { themeOptions });
    cy.get('button').should('have.css', 'background-color', 'rgb(0, 105, 92)');
  });

  it('ignores nested providers, since the outermost one sets the theme', () => {
    const themeOptions = { palette: { primary: { main: '#00695c' } } };
    cy.mount(
      <OpenCloningThemeProvider themeOptions={themeOptions}>
        <Button variant="contained">Button</Button>
      </OpenCloningThemeProvider>,
    );
    cy.get('button').should('have.css', 'background-color', 'rgb(25, 118, 210)');
  });

  it('exposes the theme as CSS variables', () => {
    cy.mount(<Button variant="contained">Button</Button>);
    cy.document().then((doc) => {
      const rootStyle = doc.defaultView.getComputedStyle(doc.documentElement);
      expect(rootStyle.getPropertyValue('--opencloning-palette-primary-main').trim()).to.equal('#1976d2');
      expect(rootStyle.getPropertyValue('--opencloning-palette-savedToDatabase-main').trim()).to.equal('#008000');
    });
  });
});
