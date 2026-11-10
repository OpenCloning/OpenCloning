describe('Test empty source functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Creates / deletes empty sources', () => {
    cy.get('svg[data-testid="AddCircleIcon"]').parent().click();
    cy.get('li#source-1').should('exist');
    cy.get('li#source-2').should('exist');
    cy.get('li#source-3').should('not.exist');
    cy.get('svg[data-testid="AddCircleIcon"]').parent().click();
    cy.get('li#source-1').should('exist');
    cy.get('li#source-2').should('exist');
    cy.get('li#source-3').should('exist');
    cy.get('li#source-1 svg[data-testid="DeleteIcon"]').eq(0).click();
    cy.get('li#source-1').should('not.exist');
    cy.get('li#source-2 svg[data-testid="DeleteIcon"]').eq(0).click();
    cy.get('li#source-2').should('not.exist');
    cy.get('li#source-3 svg[data-testid="DeleteIcon"]').eq(0).click();
    cy.get('li#source-3').should('not.exist');
    // There is still a button to create a new one
    cy.get('div.tf-tree svg[data-testid="AddCircleIcon"]').should('exist');

    // Creating new sources resets the counter
    // (see bug from https://github.com/OpenCloning/OpenCloning_frontend/issues/110#issuecomment-1996934760)
    cy.get('svg[data-testid="AddCircleIcon"]').parent().click();
    cy.get('svg[data-testid="AddCircleIcon"]').parent().click();
    cy.get('svg[data-testid="AddCircleIcon"]').parent().click();
    cy.get('li#source-1').should('exist');
    cy.get('li#source-2').should('exist');
    cy.get('li#source-3').should('exist');
  });
});
