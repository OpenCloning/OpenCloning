describe('cloning backend', () => {
  it('uses cloning backend auth', () => {
    cy.intercept('GET', 'http://localhost:8000/cloning/version').as('getVersion');
    cy.e2eLogin('/design', 'bootstrap+clerk_test@example.com', 'password');

    cy.resolveTestUserByEmail('bootstrap+clerk_test@example.com').then((user) => {
      cy.wait('@getVersion').then(({ request, response: { statusCode } }) => {
        expect(request.headers).to.have.property('authorization', `Bearer ${user.token}`);
        expect(statusCode).to.eq(200);
      });
    });

  });
});
