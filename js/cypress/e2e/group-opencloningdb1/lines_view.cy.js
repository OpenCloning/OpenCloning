import endpoints from '../../../packages/opencloningdb/src/endpoints';


describe('LinesPage', () => {
  it('should render and make the right search request', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.lines, '*')).as('getLines');
    cy.e2eLogin('/lines', 'view-only-user@example.com', 'password');
    cy.wait('@getLines').then(({ request, response }) => {
      expect(request.query).to.deep.equal({ page: '1', size: '25' });
      cy.get('h5').contains('Lines').should('exist');

      const exampleLine = response.body.items.find((item) => item.uid === 'crispr_hdr-line');

      cy.get('tbody tr')
        .filter(`:contains(crispr_hdr-line)`)
        .should('have.length', 1)
        .first()
        .within(() => {
          cy.get('td').eq(1).should('contain', 'crispr_hdr-line');
          cy.get('td').eq(2).should('contain', '3xHA-ase1');
          cy.get('td').eq(3).should('contain', 'pFA6a-3HA-kanMX6');
          cy.get('td').eq(4).contains('crispr_hdr').should('exist');
          cy.get('td').eq(5).should('contain', exampleLine.created_by.display_name);
          cy.get('td').eq(6).invoke('text').should('not.be.empty');
        });
    });

    cy.intercept('GET', Cypress.getDbURL(endpoints.lines, '*')).as('getLines2');
    cy.setInputValue('UID', 'crispr_hdr-line', '[data-testid="lines-page"]');
    cy.setInputValue('Genotype', '3xHA-ase1', '[data-testid="lines-page"]');
    cy.setInputValue('Plasmid', 'pFA6a-3HA-kanMX6', '[data-testid="lines-page"]');
    cy.clickMultiSelectOption('Tags', 'crispr_hdr', '[data-testid="lines-page"]');
    cy.setInputValue('Created by', 'Bootstrap User', '[data-testid="lines-page"]');
    cy.get('[data-testid="lines-page"] button').contains('Search').click();
    cy.wait('@getLines2').then(({ response, request }) => {
      cy.wrap(request.query).should('have.property', 'page', '1');
      cy.wrap(request.query).should('have.property', 'size', '25');
      cy.wrap(request.query).should('have.property', 'uid', 'crispr_hdr-line');
      cy.wrap(request.query).should('have.property', 'genotype', '3xHA-ase1');
      cy.wrap(request.query).should('have.property', 'plasmid', 'pFA6a-3HA-kanMX6');
      cy.wrap(request.query.tags).should('match', /\d+/);
      cy.wrap(request.query).should('have.property', 'created_by', 'Bootstrap User');

      const filteredLines = response.body.items;
      expect(filteredLines).to.have.length(1);
      expect(filteredLines[0].uid).to.equal('crispr_hdr-line');

      cy.get('tbody tr')
        .should('have.length', 1)
        .first()
        .within(() => {
          cy.get('td').eq(1).should('contain', 'crispr_hdr-line');
          cy.get('td').eq(2).should('contain', '3xHA-ase1');
          cy.get('td').eq(3).should('contain', 'pFA6a-3HA-kanMX6');
          cy.get('td').eq(4).contains('crispr_hdr').should('exist');
        });
    });
  });
  it('can go back to main page from the detail page', () => {
    cy.goBackToMainPageFromDetailPage('lines', 'crispr_hdr-line');
  });

  it('should set query params from the URL', () => {
    cy.e2eLogin('/lines', 'view-only-user@example.com', 'password');
    cy.intercept('GET', Cypress.getDbURL(endpoints.lines, '*'), { statusCode: 200, body: { items: [] } }).as('getLines');
    cy.intercept('GET', Cypress.getDbURL(endpoints.tags, '*'), { statusCode: 200, body: [{ id: 4, name: 'crispr_hdr' }] }).as('getTags');
    cy.visit('/lines?uid=crispr_hdr-line&genotype=3xHA-ase1&plasmid=pFA6a-3HA-kanMX6&tags=4&created_by=Bootstrap+User');
    cy.wait('@getLines').then(({ request }) => {
      cy.wrap(request.query).should('have.property', 'uid', 'crispr_hdr-line');
      cy.wrap(request.query).should('have.property', 'genotype', '3xHA-ase1');
      cy.wrap(request.query).should('have.property', 'plasmid', 'pFA6a-3HA-kanMX6');
      cy.wrap(request.query).should('have.property', 'tags', '4');
      cy.wrap(request.query).should('have.property', 'created_by', 'Bootstrap User');
    });
    cy.get('[data-testid="url-params-form"]').within(() => {
      cy.get('label').contains(/^UID$/).parent().find('input').should('have.value', 'crispr_hdr-line');
      cy.get('label').contains('Genotype').parent().find('input').should('have.value', '3xHA-ase1');
      cy.get('label').contains('Plasmid').parent().find('input').should('have.value', 'pFA6a-3HA-kanMX6');
      cy.get('label').contains('Tags').siblings().find('div').contains('crispr_hdr').should('exist');
      cy.get('label').contains('Created by').parent().find('input').should('have.value', 'Bootstrap User');
    });
  });

  it('clicking on entry shows the detail page', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.lines, '*')).as('getLines');
    cy.e2eLogin('/lines', 'view-only-user@example.com', 'password');
    cy.wait('@getLines').then(({ response }) => {
      const line = response.body.items.find((item) => item.uid === 'crispr_hdr-line');
      cy.intercept('GET', Cypress.getDbURL(endpoints.line(line.id))).as('getLineDetail');
      cy.intercept('GET', Cypress.getDbURL(endpoints.line(line.parent_ids[0]))).as('getParentLine');

      cy.get('tbody button').contains(line.uid).click();
      cy.wait('@getLineDetail');
      cy.wait('@getParentLine');

      cy.get('[data-testid="resource-detail-header-title"] h5').contains(line.uid).should('exist');
      cy.get('[data-testid="tag-chip-with-delete"]').contains('crispr_hdr').should('exist');
      cy.get('[data-testid="line-genotype"]').contains('3xHA-ase1').should('exist');
      cy.get('[data-testid="line-plasmids"]').contains('pFA6a-3HA-kanMX6').should('exist');
      cy.get('[data-testid="line-parent-lines"]').contains('parent_strain').should('exist');
      cy.get('button').contains('Transformation').should('exist');
      cy.get('button').contains('parent_strain').click();
      cy.get('[data-testid="resource-detail-header-title"] h5').contains('parent_strain', { timeout: 20000 }).should('exist');
      cy.get('p').contains('No genotype or plasmids in this line.').should('exist');
      cy.get('[data-testid="line-children"]').within(() => {
        cy.contains('crispr_hdr-line').should('exist');
        cy.contains('golden_gate-line').should('exist');
      });
    });
  });

  it('paginates the table after lowering rows per page', () => {
    cy.openCloningDbTablePaginationTest('lines', '[data-testid="lines-page"]');
  });

  it('select all checks every row and shows bulk actions', () => {
    cy.openCloningDbTableSelectAllTest('lines', '[data-testid="lines-page"]', 'select all lines', 'Tag Lines');
  });
});
