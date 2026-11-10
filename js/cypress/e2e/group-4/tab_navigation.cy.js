import { checkInputValue } from "../common_functions";

describe('Test tab navigation functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Can navigate the tabs', () => {
    // Starts on cloning tab
    cy.get('div.tf-ancestor-tree').should('be.visible');
    cy.get('.primer-table-container').should('not.be.visible');
    cy.get('.settings-tab').should('not.be.visible');
    // Move to primers tab
    cy.get('button.MuiTab-root').contains('Primers').click();
    cy.get('.primer-table-container').should('be.visible');
    cy.get('div.tf-ancestor-tree').should('not.be.visible');
    cy.get('.settings-tab').should('not.be.visible');
    // Move to description tab
    cy.get('button.MuiTab-root').contains('Description').click();
    cy.get('.primer-table-container').should('not.be.visible');
    cy.get('div.tf-ancestor-tree').should('not.be.visible');
    cy.get('.description-container').should('be.visible');
    cy.get('.settings-tab').should('not.be.visible');
    // Move to the sequence tab
    cy.get('button.MuiTab-root').contains('Sequence').click();
    cy.get('.primer-table-container').should('not.be.visible');
    cy.get('div.tf-ancestor-tree').should('not.be.visible');
    cy.get('.description-container').should('not.be.visible');
    cy.get('.main-sequence-editor').should('be.visible');
    cy.get('.settings-tab').should('not.be.visible');
    // Move to the data model tab
    cy.get('button.MuiTab-root').contains('Data model').click();
    cy.get('.primer-table-container').should('not.be.visible');
    cy.get('div.tf-ancestor-tree').should('not.be.visible');
    cy.get('.description-container').should('not.be.visible');
    cy.get('.main-sequence-editor').should('not.be.visible');
    cy.get('code').contains('input').should('be.visible');
    cy.get('.settings-tab').should('not.be.visible');
    // Move to the settings tab
    cy.get('button.MuiTab-root').contains('Settings').click();
    cy.get('.primer-table-container').should('not.be.visible');
    cy.get('div.tf-ancestor-tree').should('not.be.visible');
    cy.get('.description-container').should('not.be.visible');
    cy.get('.main-sequence-editor').should('not.be.visible');
    cy.get('code').contains('input').should('not.be.visible');
    cy.get('.settings-tab').should('be.visible');
    // Check that the values are displayed
    cy.get('.settings-tab').contains('Primer DNA concentration').should('be.visible');
    cy.get('.settings-tab').contains('Monovalent ions').should('be.visible');
    cy.get('.settings-tab').contains('Divalent ions').should('be.visible');
    checkInputValue('Primer DNA concentration', '50');
    checkInputValue('Monovalent ions', '50');
    checkInputValue('Divalent ions', '1.5');
  });
});
