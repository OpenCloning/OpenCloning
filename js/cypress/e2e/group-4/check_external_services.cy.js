describe('Test external services status check', () => {
  it('Gives the right error if the backend server is down', () => {
    cy.intercept('GET', 'http://127.0.0.1:8000/version', {
      statusCode: 500,
    }).as('localCheck');
    cy.visit('/');

    cy.get('.service-status-check-alert').should('contain', 'Backend server is down');
    cy.intercept('GET', 'http://127.0.0.1:8000/version', {
      statusCode: 200,
      body: {
        backend_version: '1.2.3',
        schema_version: '4.5.6',
      },
    }).as('localCheck2');
    cy.get('.service-status-check-alert button').click();
    cy.get('.service-status-check-alert').should('contain', 'All services are up and running!');
    cy.get('.service-status-check-alert button').click();
    cy.get('.service-status-check-alert').should('not.exist');

    // Check if the version dialog has the correct versions
    cy.get('.MuiToolbar-root button.MuiButtonBase-root').contains('About').click();
    cy.get('.MuiButtonBase-root').contains('App version').click();
    cy.get('.MuiDialogContent-root span').contains('Backend').siblings('p').should('contain', '1.2.3');
    cy.get('.MuiDialogContent-root span').contains('Schema').siblings('p').should('contain', '4.5.6');
    cy.get('.MuiDialogContent-root span').contains('Frontend').siblings('p').should('contain', '__VERSION__');
    // Click outside the dialog
    cy.get('body').click(0, 0);

  });
});
