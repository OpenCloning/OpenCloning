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

  it('Accepts paths that go around the first overhang, and warns about parts that are not in a complete assembly', () => {
    cy.mount(
      <FormDataProviderWithSpy>
        <AppContent />
      </FormDataProviderWithSpy>
    );
    cy.viewport(1200, 900);
    cy.contains('Defining parts from overhangs').click();
    const typeOverhangs = (text) => {
      cy.get('[data-testid="overhangs-step"] textarea').first().focus();
      cy.get('[data-testid="overhangs-step"] textarea').first().clear();
      cy.get('[data-testid="overhangs-step"] textarea').first().type(text, { delay: 0 });
    };
    const previewRows = () => cy.get('[data-testid="overhangs-step-container"] [data-testid="overhangs-preview-table"] tr');

    // The circle is not closed yet
    typeOverhangs('CCCT\nCGCT\nCACA');
    cy.get('[data-testid="overhangs-step-container"]').contains('Parts that are not in a complete assembly: CCCT-CGCT, CGCT-CACA.').should('exist');
    // The parts are displayed anyway
    previewRows().should('have.length', 1);
    previewRows().first().find('h6').should('have.length', 2);

    // Closing the circle removes the warning
    typeOverhangs('CCCT\nCGCT\nCACA\nCCCT');
    cy.get('[data-testid="overhangs-step-container"]').contains('Parts that are not in a complete assembly').should('not.exist');
    previewRows().should('have.length', 1);
    previewRows().first().find('h6').should('have.length', 3);

    // A path that goes around the first overhang (CACA -> CCCT -> CGCT) is accepted
    typeOverhangs('CCCT\nCGCT\nCACA\nCCCT\n\nCACA\nCGCT');
    cy.get('[data-testid="overhangs-step-container"] .MuiAlert-root').should('not.exist');
    previewRows().should('have.length', 2);
    previewRows().eq(1).find('h6').eq(0).should('have.text', '2');
    previewRows().eq(1).find('h6').eq(1).should('have.text', '4');
    cy.window().its('cyFormDataContext').then((context) => {
      expect(context.parts).to.have.length(4);
      expect(context.parts[3].left_overhang).to.equal('CACA');
      expect(context.parts[3].right_overhang).to.equal('CGCT');
    });

    // A path that is not connected to the rest
    typeOverhangs('CCCT\nCGCT\nCACA\nCCCT\n\nGGGG\nTTTT');
    cy.get('[data-testid="overhangs-step-container"]').contains('Parts that are not in a complete assembly: GGGG-TTTT.').should('exist');
    cy.get('[data-testid="overhangs-step-container"]').contains('Overhangs that cannot be reached from the first overhang (CCCT): GGGG.').should('exist');
  });
});
