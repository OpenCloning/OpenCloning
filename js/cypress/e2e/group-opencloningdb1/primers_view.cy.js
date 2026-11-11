import endpoints from '../../../packages/opencloningdb/src/endpoints';
describe('Actions that can be perfomed by a view-only user on the Primers page', () => {
  it('should render and make the right search request', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.primers, '*')).as('getPrimers');
    cy.e2eLogin('/primers', 'view-only-user@example.com', 'password');
    cy.wait('@getPrimers').then(({ response, request }) => {
      expect(request.query).to.deep.equal({page: "1", size: "25"});
      cy.get('h5').contains('Primers').should('exist');
      const primers = response.body.items;
      const primerWithoutTagsNorUID = primers.find((primer) => primer.name === 'lacZ_attB1_fwd');
      cy.get('tbody tr')
        .filter(`:contains(${primerWithoutTagsNorUID.name})`)
        .should('have.length', 1)
        .first()
        .within(() => {
          cy.get('td').eq(1).should('have.text', '—');
          cy.get('td').eq(2).should('have.text', primerWithoutTagsNorUID.name);
          cy.get('td').eq(3).should('have.text', '-');
          cy.get('td').eq(4).should('have.text', primerWithoutTagsNorUID.sequence);
          cy.get('td').eq(5).should('contain', primerWithoutTagsNorUID.created_by.display_name);
          cy.get('td').eq(6).invoke('text').should('not.be.empty');
        });
      const primerWithTagsAndUID = primers.find((primer) => primer.name === 'fwd_restriction_then_ligation');
      cy.get('tbody tr')
        .filter(`:contains(${primerWithTagsAndUID.name})`)
        .should('have.length', 1)
        .first()
        .within(() => {
          cy.get('td').eq(1).should('have.text', primerWithTagsAndUID.uid);
          cy.get('td').eq(2).should('have.text', primerWithTagsAndUID.name);
          cy.get('td').eq(3).contains(primerWithTagsAndUID.tags[0].name).should('exist');
          cy.get('td').eq(4).should('have.text', primerWithTagsAndUID.sequence);
          cy.get('td').eq(5).should('contain', primerWithTagsAndUID.created_by.display_name);
          cy.get('td').eq(6).invoke('text').should('not.be.empty');
        });
    });
    cy.intercept('GET', Cypress.getDbURL(endpoints.primers, '*')).as('getPrimers2');
    cy.setInputValue('UID', 'ML7', '[data-testid="primers-page"]');
    cy.setInputValue('Name', 'fwd_restriction_then_ligation', '[data-testid="primers-page"]');
    cy.clickMultiSelectOption('Tags', 'templateless_PCR', '[data-testid="primers-page"]');
    cy.setInputValue('Created by', 'Bootstrap User', '[data-testid="primers-page"]');
    cy.get('[data-testid="primers-page"] label').contains('With UID').parent().find('input').click({ force: true });
    cy.get('button').contains('Search').click();
    cy.wait('@getPrimers2').then(({ response, request }) => {
      console.log('request', request.query);
      cy.wrap(request.query).should('have.property', 'page', "1");
      cy.wrap(request.query).should('have.property', 'size', "25");
      cy.wrap(request.query).should('have.property', 'uid', "ML7");
      cy.wrap(request.query).should('have.property', 'name', "fwd_restriction_then_ligation");
      cy.wrap(request.query.tags).should('match', /\d+/);
      cy.wrap(request.query).should('have.property', 'has_uid', 'true');
      cy.wrap(request.query).should('have.property', 'created_by', 'Bootstrap User');
    });
    // Finally a query to verify that multiple tags are working, mock since no need
    cy.intercept('GET', Cypress.getDbURL(endpoints.primers, '*'), { statusCode: 200, body: { items: [] } }).as('getPrimers3');
    cy.setAutocompleteValue('Tags', 'crispr_hdr', '[data-testid="primers-page"]');
    cy.get('button').contains('Search').click();
    cy.wait('@getPrimers3').then(({ response, request }) => {
      cy.wrap(request.query.tags).should('have.length', 2);
      cy.wrap(request.query.tags).each((tag) => {
        cy.wrap(tag).should('match', /\d+/);
      });
    });
  });
  it('should set query params from the URL', () => {
    const url = '/primers?uid=ML7&name=fwd_restriction_then_ligation&tags=1&tags=2&has_uid=true&created_by=Bootstrap+User';
    cy.intercept('GET', Cypress.getDbURL(endpoints.primers, '*'), { statusCode: 200, body: { items: [] } }).as('getPrimers2');
    cy.intercept('GET', Cypress.getDbURL(endpoints.tags), { statusCode: 200, body:[{ id: 1, name: 'crispr_hdr' }, { id: 2, name: 'templateless_PCR' }] }).as('getTags');
    cy.e2eLogin(url, 'view-only-user@example.com', 'password');
    cy.wait('@getPrimers2').then(({ response, request }) => {
      cy.wrap(request.query).should('have.property', 'uid', "ML7");
      cy.wrap(request.query).should('have.property', 'name', "fwd_restriction_then_ligation");
      cy.wrap(request.query.tags).should('have.length', 2);
      cy.wrap(request.query).should('have.property', 'created_by', 'Bootstrap User');
    });
    cy.get('[data-testid="url-params-form"]').within(() => {
      cy.get('label').contains('With UID').parent().find('input').should('be.checked');
      cy.get('label').contains(/^UID$/).parent().find('input').should('have.value', 'ML7');
      cy.get('label').contains('Name').parent().find('input').should('have.value', 'fwd_restriction_then_ligation');
      cy.get('label').contains('Tags').siblings().find('div').contains('crispr_hdr').should('exist');
      cy.get('label').contains('Tags').siblings().find('div').contains('templateless_PCR').should('exist');
      cy.get('label').contains('Created by').parent().find('input').should('have.value', 'Bootstrap User');
    });

  });
  it('clicking on entry shows the detail page and allows to add to design tab', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.primers, '*')).as('getPrimers');
    cy.e2eLogin('/primers', 'view-only-user@example.com', 'password');
    cy.wait('@getPrimers').then(({ response }) => {
      const primer = response.body.items.find((primer) => primer.name === 'fwd_restriction_then_ligation');
      cy.intercept('GET', Cypress.getDbURL(endpoints.primer(primer.id))).as('getPrimer');
      cy.get('tbody button').contains(primer.name).click();
      cy.wait('@getPrimer')
      cy.get('[data-testid="resource-detail-header-title"] h5').contains(primer.name).should('exist');
      cy.get('[data-testid="resource-detail-header-title"] span').contains(primer.uid).should('exist');
      cy.get('[data-testid="tag-chip-with-delete"]').contains(primer.tags[0].name).should('exist');
      cy.get('[data-testid="sequence"]').contains(primer.sequence).should('exist');
      cy.get('[data-testid="linked-templates"]').contains('CU329670').should('exist');
      cy.get('[data-testid="linked-products"]').contains('ase1_CDS_PCR').should('exist');
      cy.get('button').contains('Add to Design Tab').click();
      // TODO: Eventually this should be disabled after adding to design tab
      // cy.get('button').contains('Add to Design Tab').should('not.exist');
      cy.changeTab('Design');
      // Empty source should still exist
      cy.get('li#source-1').should('exist');
      // There should be no warnings
      cy.openCloningAlertsAreEmpty();
      cy.changeTab('Primers', '#opencloning-app-tabs')
      cy.get('.primer-table-container').contains(primer.name).should('exist');

    });
  });
  it('detail page shows UID if exist, message otherwise', () => {
    cy.e2eLogin('/primers?name=fwd_restriction_then_ligation', 'view-only-user@example.com', 'password');
    cy.get('tbody tr').contains('fwd_restriction_then_ligation').click();
    cy.get('[data-testid="resource-detail-header-title"]').contains('fwd_restriction_then_ligation').should('exist');
    cy.get('[data-testid="resource-detail-header-title"] span').contains('ML7').should('exist');
    cy.visit('/primers?name=rvs_restriction_then_ligation');
    cy.get('tbody tr').contains('rvs_restriction_then_ligation').click();
    cy.get('[data-testid="resource-detail-header-title"]').contains('rvs_restriction_then_ligation').should('exist');
    cy.get('[data-testid="resource-detail-header-title"] span').contains('No UID').should('exist');
  });
  it('clicking on add to design tab button adds primers to the design tab', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.primers, '*')).as('getPrimers');
    cy.e2eLogin('/primers', 'view-only-user@example.com', 'password');
    cy.wait('@getPrimers').then(({ response }) => {
      cy.get('button').contains('Add to Design Tab').should('not.exist');
      cy.get('button').contains('Tag Primers').should('not.exist');
      const firstTwoPrimers = response.body.items.slice(0, 2);
      for (const primer of firstTwoPrimers) {
        cy.get('tbody tr').filter(`:contains(${primer.name})`).within(() => {
          cy.get('input').eq(0).should('not.be.checked');
          cy.get('input').eq(0).click();
          cy.get('input').eq(0).should('be.checked');
        });
      }
      cy.get('button').contains('Add to Design Tab').click();
      cy.changeTab('Design');
      cy.changeTab('Primers', '#opencloning-app-tabs')
      cy.get('.primer-table-container').contains(firstTwoPrimers[0].name).should('exist');
      cy.get('.primer-table-container').contains(firstTwoPrimers[1].name).should('exist');
    });
  });

  it('can go back to main page from the detail page', () => {
    cy.goBackToMainPageFromDetailPage('primers', 'fwd_restriction_then_ligation');
  });

  it('paginates the table after lowering rows per page', () => {
    cy.openCloningDbTablePaginationTest('primers', '[data-testid="primers-page"]');
  });

  it('select all checks every row and shows bulk actions', () => {
    cy.openCloningDbTableSelectAllTest('primers', '[data-testid="primers-page"]', 'select all primers', 'Add to Design Tab');
  });
});
