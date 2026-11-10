import endpoints from '../../packages/opencloningdb/src/endpoints';


const listEndpoints = {
  sequences: endpoints.sequences,
  lines: endpoints.lines,
  primers: endpoints.primers,
};

const tagEndpoints = {
  lines: endpoints.lineTags,
  input_entities: endpoints.inputEntityTags,
};

Cypress.Commands.add('addTagInTableTest', (resourcePlural, tagEndpointName) => {
  cy.intercept('GET', Cypress.getDbURL(listEndpoints[resourcePlural], '*')).as('getRequest');
  cy.e2eLogin(`/${resourcePlural}`, 'bootstrap+clerk_test@example.com', 'password');
  cy.wait('@getRequest')
  cy.get('tbody tr').contains('test-tag').should('not.exist')
  cy.get('tbody tr input').eq(0).click();
  cy.get('tbody tr input').eq(1).click();
  cy.get('button').contains(`Tag ${resourcePlural}`, { matchCase: false }).click();
  cy.setInputValue('Tags', 'test-tag', '[data-testid="tag-entities-dialog"]');
  cy.get('div[role="presentation"]').contains('Create tag').click();
  cy.intercept('POST', Cypress.getDbURL(tagEndpoints[tagEndpointName]('*'))).as('addTag');
  cy.get('[data-testid="tag-entities-dialog"] button').contains('Tag').click({ force: true });
  cy.wait('@addTag');
  cy.get('tbody tr').eq(0).contains('test-tag').should('exist');
  cy.get('tbody tr').eq(1).contains('test-tag').should('exist');
  cy.get('tbody tr').eq(2).contains('test-tag').should('not.exist');

  // No errors if adding the same tag again (just skipped)
  
  cy.get('tbody tr input').eq(0).click();
  cy.get('tbody tr input').eq(1).click();
  cy.get('button').contains(`Tag ${resourcePlural}`, { matchCase: false }).click();
  cy.setAutocompleteValue('Tags', 'test-tag', '[data-testid="tag-entities-dialog"]');
  cy.get('[data-testid="tag-entities-dialog"] button').contains('Tag').click();
  cy.wait('@addTag');
  cy.get('tbody tr').eq(0).contains('test-tag').should('exist');
  cy.get('tbody tr').eq(1).contains('test-tag').should('exist');
  cy.get('tbody tr').eq(2).contains('test-tag').should('not.exist');

  // No errors if adding the same tag again (just skipped)
  cy.get('tbody tr input').eq(0).click();
  cy.get('tbody tr input').eq(1).click();
  cy.get('button').contains(`Tag ${resourcePlural}`, { matchCase: false }).click();
  cy.setAutocompleteValue('Tags', 'test-tag', '[data-testid="tag-entities-dialog"]');
  cy.get('[data-testid="tag-entities-dialog"] button').contains('Tag').click();
  cy.get('[data-testid="tag-entities-dialog"]').should('not.exist');
  cy.get('@addTag.all').should('have.length', 2);

});

Cypress.Commands.add('addTagInDetailPageTest', (resourcePlural, resourceName, expectedTagName) => {
  cy.intercept('GET', Cypress.getDbURL(listEndpoints[resourcePlural], '*')).as('getRequest');
  cy.e2eLogin(`/${resourcePlural}?name=${resourceName}`, 'bootstrap+clerk_test@example.com', 'password');
  cy.wait('@getRequest').then(({ response }) => {
    const resource = response.body.items.find((resource) => resource.name === resourceName || resource.uid === resourceName);
    const tagId = resource.tags[0].id;
    cy.get('tbody tr button').contains(resourceName).click();
    cy.get('[data-testid="resource-detail-header-title"]').contains(resourceName).should('exist');
    cy.intercept('DELETE', `${Cypress.getDbURL('')}/**/${resource.id}/tags/${tagId}`).as('deleteTag');
    cy.get('[data-testid="tag-chip-with-delete"]').filter(`:contains(${expectedTagName})`).within(
      () => {
        cy.get('svg[data-testid="ClearIcon"]').click();
      }
    );
    cy.wait('@deleteTag')
    cy.get('[data-testid="tag-chip-with-delete"]').should('not.exist');
    cy.get('[data-testid="tag-chip-list"]').contains('No tags').should('exist');
    cy.get('svg[data-testid="AddIcon"]').click();
    cy.setAutocompleteValue('Tags', expectedTagName, '[data-testid="tag-entities-dialog"]');
    cy.get('[data-testid="tag-entities-dialog"] button').contains('Tag').click();
    cy.get('[data-testid="tag-chip-with-delete"]').filter(`:contains(${expectedTagName})`).should('exist');

  });
});

/** Requires seeded list total > 10 so page 2 exists when size is 10. */
Cypress.Commands.add('openCloningDbTablePaginationTest', (resourcePlural, pageTestId) => {
  cy.intercept('GET', Cypress.getDbURL(listEndpoints[resourcePlural], '*')).as('list');
  cy.e2eLogin(`/${resourcePlural}`, 'view-only-user@example.com', 'password');
  cy.wait('@list').then(({ response }) => {
    expect(response.body.total).to.be.greaterThan(10);
  });
  cy.get(`${pageTestId} .MuiTablePagination-select`).click();
  cy.get('ul[role="listbox"] li').contains(/^10$/).click();
  cy.wait('@list').then(({ request }) => {
    expect(request.query).to.have.property('page', '1');
    expect(request.query).to.have.property('size', '10');
  });
  cy.get('tbody tr').should('have.length', 10);
  cy.get(`${pageTestId} .MuiTablePagination-actions button[aria-label="Go to next page"]`).click();
  cy.wait('@list').then(({ request }) => {
    expect(request.query).to.have.property('page', '2');
    expect(request.query).to.have.property('size', '10');
  });
});

Cypress.Commands.add('openCloningDbTableSelectAllTest', (resourcePlural, pageTestId, selectAllAriaLabel, bulkButtonLabel) => {
  cy.intercept('GET', Cypress.getDbURL(listEndpoints[resourcePlural], '*')).as('list');
  cy.e2eLogin(`/${resourcePlural}`, 'view-only-user@example.com', 'password');
  cy.wait('@list');
  cy.get(`${pageTestId} [aria-label="${selectAllAriaLabel}"]`).click();
  cy.get(`${pageTestId} tbody tr`).each(($tr) => {
    cy.wrap($tr).find('input[type="checkbox"]').first().should('be.checked');
  });
  cy.get(`${pageTestId} button`).contains(bulkButtonLabel).should('exist');
});

Cypress.Commands.add('goBackToMainPageFromDetailPage', (resourcePlural, resourceName) => {
  cy.intercept('GET', Cypress.getDbURL(listEndpoints[resourcePlural], '*')).as('list');
  cy.e2eLogin(`/${resourcePlural}?name=${resourceName}`, 'view-only-user@example.com', 'password');
  cy.wait('@list');
  cy.get('tbody button').contains(resourceName).click();
  cy.get('button').contains(`Back to ${resourcePlural}`, { matchCase: false }).click();
  cy.url().should('include', `/${resourcePlural}`);
});
