describe('Test description', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('works', () => {
    // Type a new description
    cy.get('button.MuiTab-root').contains('Description').click();
    cy.get('.description-container').should('be.visible');
    cy.get('textarea[aria-invalid="false"]').type('This is a description');
    cy.get('button.MuiButtonBase-root').contains('Save description').click();

    // Check the description is saved
    cy.get('textarea[aria-invalid="false"]').should('not.exist');
    cy.get('.description-container').contains('This is a description').should('exist');

    // Change it
    cy.get('button.MuiButtonBase-root').contains('Edit description').click();
    cy.get('textarea[aria-invalid="false"]').type(' and this is an addition');
    cy.get('button.MuiButtonBase-root').contains('Save description').click();

    // Check the description is saved
    cy.get('textarea[aria-invalid="false"]').should('not.exist');
    cy.get('.description-container').contains('This is a description and this is an addition').should('exist');

    // Check that setting the description to an empty string does not make
    // the edit button show up
    cy.get('button.MuiButtonBase-root').contains('Edit description').click();
    cy.get('textarea[aria-invalid="false"]').clear();
    cy.get('button.MuiButtonBase-root').contains('Save description').click();
    cy.get('textarea[aria-invalid="false"]').should('exist');
    cy.get('button.MuiButtonBase-root').contains('Save description').should('exist');
  });
});
