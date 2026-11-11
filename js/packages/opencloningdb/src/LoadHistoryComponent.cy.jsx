import React from 'react';
import LoadHistoryComponent from './LoadHistoryComponent';

// The sequence id comes from the stub (/db/sequences/<id>/cloning_strategy), so it follows the seed data
const databaseIdFromStub = (stub) => Number(stub.endpoint.match(/\/db\/sequences\/(\d+)\//)[1]);

describe('<LoadHistoryComponent />', () => {
  it('calls loadDatabaseFile with the file returned by the API', () => {
    const loadDatabaseFileSpy = cy.spy().as('loadDatabaseFileSpy');
    cy.setupOpenCloningDBTestAuth();

    cy.interceptOpenCloningDBStub('get_cloning_strategy', { alias: 'getCloningStrategy' });

    cy.getStub('get_cloning_strategy').then((cloningStrategyStub) => {
      const databaseId = databaseIdFromStub(cloningStrategyStub);
      const expectedContent = JSON.stringify(cloningStrategyStub.response.body);

      cy.mount(
        <LoadHistoryComponent
          databaseId={databaseId}
          loadDatabaseFile={loadDatabaseFileSpy}
        />,
      );

      cy.wait('@getCloningStrategy').its('request.url').should('include', cloningStrategyStub.endpoint);
      cy.get('@loadDatabaseFileSpy').should('have.been.calledOnce');

      cy.get('@loadDatabaseFileSpy').then((spy) => {
        const [file, id, flag] = spy.lastCall.args;
        expect(id).to.equal(databaseId);
        expect(flag).to.equal(true);

        return cy.readFileAsText(file).then((content) => {
          expect(content).to.equal(expectedContent);
        });
      });
    });
  });

  it('shows a loading spinner while the request is pending', () => {
    cy.setupOpenCloningDBTestAuth();

    cy.getStub('get_cloning_strategy').then((cloningStrategyStub) => {
      cy.intercept({ method: cloningStrategyStub.method, pathname: cloningStrategyStub.endpoint }, (req) => {
        req.reply({
          delay: 1000,
          statusCode: cloningStrategyStub.response.status_code,
          body: cloningStrategyStub.response.body,
          headers: cloningStrategyStub.response.headers,
        });
      }).as('getCloningStrategy');

      cy.mount(
        <LoadHistoryComponent
          databaseId={databaseIdFromStub(cloningStrategyStub)}
          loadDatabaseFile={cy.stub()}
        />,
      );
    });

    cy.get('.MuiCircularProgress-svg', { timeout: 500 }).should('exist');
    cy.wait('@getCloningStrategy');
  });

  it('shows a retry button when the request fails, and retries on click', () => {
    cy.setupOpenCloningDBTestAuth();

    cy.getStub('get_cloning_strategy').then((cloningStrategyStub) => {
      let callCount = 0;
      cy.intercept({ method: cloningStrategyStub.method, pathname: cloningStrategyStub.endpoint }, (req) => {
        callCount += 1;
        if (callCount === 1) {
          req.reply({ statusCode: 500 });
        } else {
          req.reply({
            statusCode: cloningStrategyStub.response.status_code,
            body: cloningStrategyStub.response.body,
            headers: cloningStrategyStub.response.headers,
          });
        }
      }).as('getCloningStrategy');

      cy.mount(
        <LoadHistoryComponent
          databaseId={databaseIdFromStub(cloningStrategyStub)}
          loadDatabaseFile={cy.stub()}
        />,
      );
    });

    cy.wait('@getCloningStrategy');
    cy.contains('Failed to load history file.').should('exist');
    cy.contains('button', 'Retry').should('exist').click();
    cy.wait('@getCloningStrategy');
    cy.contains('Failed to load history file.').should('not.exist');
  });
});
