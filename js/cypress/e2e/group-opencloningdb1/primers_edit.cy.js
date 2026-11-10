import endpoints from '../../../packages/opencloningdb/src/endpoints';


describe('Actions that can be perfomed by an edit user on the Primers page', () => {
  afterEach(() => {
    cy.resetDB();
  })
  it('can tag primers from the table', () => {
    cy.addTagInTableTest('primers', 'input_entities');
  });
  it('can remove and add tags from the detail page', () => {
    cy.addTagInDetailPageTest('primers', 'fwd_restriction_then_ligation', 'restriction_then_ligation');
  });
  it('can edit the name and UID of a primer', () => {
    cy.e2eLogin('/primers?name=rvs_restriction_then_ligation', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr').contains('rvs_restriction_then_ligation').click();
    cy.get('[data-testid="resource-detail-header-title"]').contains('rvs_restriction_then_ligation').should('exist');
    cy.get('[aria-label="Edit name and UID"]').click();
    cy.get('[data-testid="resource-detail-header-title"]').within(() => {
      cy.contains('Name must be at least 2 characters').should('not.exist');
      cy.setInputValue('Name', '1', 'div');
      cy.contains('Name must be at least 2 characters').should('exist');
      cy.setInputValue('Name', 'new_name', 'div');
      cy.setInputValue('UID', 'ML7', 'div'); // Existing UID
      cy.contains('UID already exists').should('exist');
      cy.get('button').contains('Save').should('be.disabled');
      cy.setInputValue('UID', 'new_uid', 'div');
      cy.get('button').contains('Save').click();
      cy.dbAlertExists('Primer updated successfully');
      cy.closeDbAlerts();
      cy.get('button').contains('Save').should('not.exist');
      cy.contains('new_name').should('exist');
      cy.contains('new_uid').should('exist');
      cy.get('[aria-label="Edit name and UID"]').click();
      cy.clearInputValue('UID', 'div');
      cy.get('button').contains('Save').click();
      cy.dbAlertExists('Primer updated successfully');
      cy.closeDbAlerts();
      cy.contains('No UID').should('exist');
    });
  });
  it('can add primers from the design tab', () => {
    cy.e2eLogin('/design', 'bootstrap+clerk_test@example.com', 'password');
    cy.addPrimer('test_primer', 'AACCCCTTTGGG').then(() => {
      cy.get('.primer-table-container').contains('test_primer').should('exist');
      cy.intercept('POST', Cypress.getDbURL(endpoints.postPrimer)).as('addPrimer');
      cy.changeTab('Primers', '#opencloning-app-tabs');
      cy.get('.primer-table-container [data-testid="SaveIcon"]').click();
      cy.get('[data-testid="submit-to-database-component"]').within(() => {
        cy.get('input#resource_title').should('have.value', 'test_primer');
        cy.contains('To change the primer name').should('exist');
        cy.get('button').contains('Submit').click();
      });
      cy.wait('@addPrimer');
      cy.openCloningAlertExists('Primer created successfully');
      cy.closeAlerts();
      cy.get('.primer-table-container').contains('test_primer').should('exist');
      cy.changeTab('Primers', '[data-testid="opencloningdb-app-tabs"]');
      cy.get('[data-testid="primers-page"] tbody tr').first().within(() => {
        cy.get('td').contains('test_primer').should('exist');
        cy.get('td').contains('AACCCCTTTGGG').should('exist');
      });
    });
  });

  it('can delete a primer from the detail page when not in use, but not otherwise', () => {
    let primerName = 'no_source_primer';
    cy.e2eLogin(`/primers?name=${primerName}`, 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody button').contains(primerName).click();
    cy.get('[data-testid="delete-primer-button"]').should('not.be.disabled').click();
    cy.get('[role="dialog"]').contains('Confirm delete').click();
    cy.dbAlertExists('Primer deleted successfully');
    cy.closeDbAlerts();
    cy.location('pathname').should('eq', '/primers');
    cy.setInputValue('Name', primerName);
    cy.get('button').contains('Search').click();
    cy.get('tbody').contains(primerName).should('not.exist');

    primerName = 'fwd_restriction_then_ligation';
    cy.setInputValue('Name', primerName);
    cy.get('button').contains('Search').click();
    cy.get('tbody button').contains(primerName).click();
    cy.get('[data-testid="delete-primer-button"]').should('be.disabled');
  });

  it('can bulk upload primers', () => {
    cy.e2eLogin('/primers', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('[data-testid="bulk-upload-primers-button"]').click();
    // Can download the template
    cy.get('div[role="presentation"] a').contains('Download template').then((link) => {
      cy.wrap(link).invoke('attr', 'href').should('include', '/bulk_submission_templates/bulk_submit_primers.tsv');
    });
    cy.get('[data-testid="bulk-upload-upload-file"]').click();
    cy.get('input[type="file"]').selectFile('cypress/test_files/import_oligos/database_import.tsv', { force: true });
    cy.get('[data-testid="bulk-upload-primers-modal"]').within(() => {
      cy.get('tr').eq(1).within(() => {
        cy.contains('repeated-uid').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
      });
      cy.get('tr').eq(2).within(() => {
        cy.contains('fwd_restriction_then_ligation').should('exist');
        cy.get('[data-testid="WarningIcon"]').should('exist');
      });
      cy.get('tr').eq(3).within(() => {
        cy.contains('all-fine').should('exist');
        cy.get('[data-testid="CheckCircleIcon"]').should('exist');
      });
      cy.setAutocompleteValue('Tags to apply (optional)', 'templateless_PCR', 'div');
      cy.setAutocompleteValue('Tags to apply (optional)', 'restriction_ligation_assembly', 'div');
    });
    cy.intercept('POST', Cypress.getDbURL(endpoints.primersBulk, '*')).as('bulkUploadPrimers');
    cy.get('button').contains('Import entries without warnings').click();
    cy.wait('@bulkUploadPrimers').then(({ response, request }) => {
      cy.wrap(response.body).should('have.length', 1);
      cy.wrap(response.body[0].name).should('equal', 'all-fine');
      cy.wrap(request.query).should('have.property', 'strict', 'true');
      cy.wrap(request.query).should('have.property', 'tags');
      cy.wrap(request.query.tags).should('have.length', 2);
    });
    cy.dbAlertExists('Imported 1 clear primer successfully');
    cy.closeDbAlerts();
    cy.get('[data-testid="bulk-upload-primers-button"]').click();
    cy.get('[data-testid="bulk-upload-upload-file"]').click();
    cy.get('input[type="file"]').selectFile('cypress/test_files/import_oligos/database_import.tsv', { force: true });
    cy.get('tr [data-testid="CheckCircleIcon"]').should('not.exist');
    cy.intercept('POST', Cypress.getDbURL(endpoints.primersBulk, '*')).as('bulkUploadPrimers2');
    cy.get('button').contains('Import entries with warnings too').click();
    cy.wait('@bulkUploadPrimers2').then(({ response, request }) => {
      cy.wrap(response.body).should('have.length', 1);
      cy.wrap(response.body[0].name).should('equal', 'fwd_restriction_then_ligation');
      cy.wrap(request.query).should('have.property', 'strict', 'false');
    });
    cy.dbAlertExists('Imported 1 with warnings primer successfully');
    cy.closeDbAlerts();
  });
});

