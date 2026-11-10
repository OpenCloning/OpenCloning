import React from 'react';
import { AppContent } from './App';
import { FormDataProvider, useFormData } from './context/FormDataContext';
import { setInputValue } from '../../../cypress/e2e/common_functions';

// Wrapper component that exposes FormDataProvider context for spying
// The context value is stored on window.cyFormDataContext for Cypress to access
function FormDataProviderWithSpy({ children }) {
  const ContextExposer = ({ children: innerChildren }) => {
    const context = useFormData();
    
    React.useEffect(() => {
      // Store context on window so Cypress can access it
      if (typeof window !== 'undefined') {
        window.cyFormDataContext = context;
      }
    }, [context]);
    
    return <>{innerChildren}</>;
  };
  
  return (
    <FormDataProvider>
      <ContextExposer>
        {children}
      </ContextExposer>
    </FormDataProvider>
  );
}

describe('App', () => {
  it('Works correctly to define overhangs', () => {
    cy.mount(
      <FormDataProviderWithSpy>
        <AppContent />
      </FormDataProviderWithSpy>
    );
    cy.viewport(1200, 900);

    // You can access FormDataProvider context values via window.cyFormDataContext
    // Example: cy.window().its('cyFormDataContext').then(context => { ... })
    // The context includes: parts, setParts, addDefaultPart, syntaxName, setSyntaxName, etc.

    // Initially, StartingPage should be displayed
    cy.contains('Choose a method to begin creating your parts').should('be.visible');

    // Click on "Defining parts from overhangs" option
    cy.contains('Defining parts from overhangs').click();
    cy.get('[data-testid="overhangs-step"]').should('be.visible');
    cy.get('[data-testid="overhangs-step"] textarea').first().focus().clear();
    cy.get('[data-testid="overhangs-step"] textarea').first().focus().type('CCCT\nCGCT\nCCCT\n\nCGCT\nCACA\nCCCT', { delay: 0 });

    // The first element of the overhangs preview table should be the first overhang
    cy.get('[data-testid="overhangs-step-container"] [data-testid="overhangs-preview-table"] tr').first().find('td').should('have.length', 3)
    cy.get('[data-testid="overhangs-step-container"] [data-testid="overhangs-preview-table"] tr').first().find('td').eq(0).find('h6').should('have.text', '1');
    cy.get('[data-testid="overhangs-step-container"] [data-testid="overhangs-preview-table"] tr').first().find('td').eq(1).find('h6').should('have.text', '3');
    cy.get('[data-testid="overhangs-step-container"] [data-testid="overhangs-preview-table"] tr').first().find('td').eq(2).find('h6').should('have.text', '4');

    cy.get('[data-testid="overhangs-step-container"] [data-testid="overhangs-preview-table"] tr').eq(1).find('td').should('have.length', 2)
    cy.get('[data-testid="overhangs-step-container"] [data-testid="overhangs-preview-table"] tr').eq(1).find('td').eq(0).find('h6').should('have.text', '1');
    cy.get('[data-testid="overhangs-step-container"] [data-testid="overhangs-preview-table"] tr').eq(1).find('td').eq(1).find('h6').should('have.text', '2');

    cy.get('[data-testid="overhangs-step-container"] button').contains('Next').click();

    cy.get('[data-testid="design-form"]').should('be.visible');
    
    // Example: Access FormDataProvider context values
    cy.window().its('cyFormDataContext').then(context => {
      expect(context.parts).to.have.length.greaterThan(0);
      expect(context.parts[0]).to.have.property('left_overhang');
    });
  });
});
