import endpoints from '../../../packages/opencloningdb/src/endpoints';


describe('Actions that can be perfomed by an edit user on the Lines page', () => {
  afterEach(() => {
    cy.resetDB();
  })
  it('can tag lines from the table', () => {
    cy.addTagInTableTest('lines', 'lines');
  });
  it('can remove and add tags from the detail page', () => {
    cy.addTagInDetailPageTest('lines', 'crispr_hdr-line', 'crispr_hdr');
  });
  it('can rename a line', () => {
    cy.e2eLogin('/lines', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr').contains('crispr_hdr-line').click();
    cy.get('[data-testid="resource-detail-header-title"]').contains('crispr_hdr-line').should('exist');
    cy.get('[aria-label="Edit line UID"]').click();
    cy.setInputValue('Line UID', 'crispr_hdr-line-new');
    cy.get('button').contains('Save').click();
    cy.dbAlertExists('Line UID updated successfully');
    cy.closeDbAlerts();
    cy.get('[data-testid="resource-detail-header-title"]').contains('crispr_hdr-line-new').should('exist');
  });
  it('can delete a line that has no children', () => {
    cy.e2eLogin('/lines', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr').contains('crispr_hdr-line').click();
    cy.get('[data-testid="resource-detail-header-title"]').contains('crispr_hdr-line').should('exist');
    cy.get('button').contains('Delete line').click();
    cy.get('button').contains('Confirm delete').click();
    cy.dbAlertExists('Line deleted successfully');
    cy.closeDbAlerts();
    // Verify we are redirected to the lines list page after deletion
    cy.url().should('match', /\/lines$/);
    // Check that the deleted line no longer appears in the table
    cy.get('tbody').should('not.contain', 'crispr_hdr-line');
  });
  it('cannot delete a line that has children', () => {
    cy.e2eLogin('/lines', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr').contains('parent_strain').click();
    cy.get('[data-testid="resource-detail-header-title"]').contains('parent_strain').should('exist');
    cy.get('button').contains('Delete line').should('be.disabled');
  });
  it('can update the UID of a line to a non-existing UID', () => {
    cy.e2eLogin('/lines', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr').contains('crispr_hdr-line').click();
    cy.get('[data-testid="resource-detail-header-title"]').contains('crispr_hdr-line').should('exist');
    cy.get('[aria-label="Edit line UID"]').click();
    // Initially cannot save
    cy.get('button').contains('Save').should('be.disabled');
    // Cannot save with existing UID
    cy.setInputValue('Line UID', 'parent_strain');
    cy.get('button').contains('Save').should('be.disabled');
    // Can save with non-existing UID
    cy.setInputValue('Line UID', 'crispr_hdr-line-new');
    cy.get('button').contains('Save').should('be.enabled');
    cy.get('button').contains('Save').click();
    cy.dbAlertExists('Line UID updated successfully');
    cy.closeDbAlerts();
    cy.get('[data-testid="resource-detail-header-title"]').contains('crispr_hdr-line-new').should('exist');
  });
  it('can do a transformation of a line and applies the right constraints', () => {
    cy.e2eLogin('/lines', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr').contains('crispr_hdr-line').click();
    cy.get('[data-testid="resource-detail-header-title"]').contains('crispr_hdr-line').should('exist');
    for (const mode of ['from_parent', 'from_list']) {

      if (mode === 'from_parent') {
        cy.get('button').contains('Transformation').click();
      } else {
        cy.get('button').contains('Create line').click();
      }

      cy.get('[data-testid="create-line-dialog"]').within(() => {
        if (mode === 'from_parent') {
          cy.get('label').contains('Parent lines').siblings('div').find('input').should('be.disabled');
        } else {
          cy.setAutocompleteValue('Parent lines', 'crispr_hdr-line', 'div');
        }
        cy.get('label').contains('Alleles').siblings('div').contains('3xHA-ase1').should('exist');
        cy.get('label').contains('Plasmids').siblings('div').contains('pFA6a-3HA-kanMX6').should('exist');
        cy.get('button').contains('Submit').should('be.disabled');

        // Remove allele
        cy.clearChip('3xHA-ase1');
        // Remove plasmid
        cy.clearChip('pFA6a-3HA-kanMX6');
        // Still cannot submit
        cy.get('button').contains('Submit').should('be.disabled');

        // Use existing UID, cannot submit
        cy.setInputValue('Line UID', 'crispr_hdr-line', 'div');
        cy.contains('Line UID already exists').should('exist');
        cy.get('button').contains('Submit').should('be.disabled');

        // Change ID with alleles removed, can submit
        cy.setInputValue('Line UID', mode, 'div');
        cy.get('button').contains('Submit').should('be.enabled');

        // Same plasmid and allele, cannot submit
        cy.setAutocompleteValue('Alleles', '3xHA-ase1', 'div', false);
        cy.get('button').contains('Submit').should('be.enabled');
        cy.setAutocompleteValue('Plasmids', 'pFA6a-3HA-kanMX6', 'div', false);
        cy.get('button').contains('Submit').should('be.disabled');

        // Add an extra allele, can submit
        cy.setAutocompleteValue('Alleles', 'ase1delta::hphMX6', 'div', false);
        cy.intercept('POST', Cypress.getDbURL(endpoints.postLine)).as('postLine');
        cy.get('button').contains('Submit').click();
        cy.wait('@postLine').then(({ response }) => {
          cy.url().should('match', new RegExp(`/lines/${response.body.id}$`));  
        });
      });

      // Alleles are shown
      cy.get('[data-testid="resource-detail-header-title"]').contains(mode).should('exist');
      cy.get('[data-testid="line-genotype"]').contains('3xHA-ase1').should('exist');
      cy.get('[data-testid="line-genotype"]').contains('ase1delta::hphMX6').should('exist');
      cy.get('[data-testid="line-plasmids"]').contains('pFA6a-3HA-kanMX6').should('exist');
      cy.get('[data-testid="line-parent-lines"]').contains('crispr_hdr-line').should('exist');
      cy.get('button').contains('Back to Lines').click();
    }

  });
  it('can create a line by mating', () => {
    cy.e2eLogin('/lines', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('button').contains('Create line').click();
    cy.get('[data-testid="create-line-dialog"]').within(() => {
      cy.get('button').contains('Submit').should('be.disabled');

      // Adding two lines as parents adds their alleles and plasmids
      cy.setAutocompleteValue('Parent lines', 'crispr_hdr-line', 'div');
      cy.setAutocompleteValue('Parent lines', 'homologous_recombination-line', 'div');
      cy.get('.MuiAlert-root').contains('2 parents selected').should('exist');
      cy.get('label').contains('Alleles').siblings('div').contains('3xHA-ase1').should('exist');
      cy.get('label').contains('Alleles').siblings('div').contains('ase1delta::hphMX6').should('exist');
      cy.get('label').contains('Plasmids').siblings('div').contains('pFA6a-3HA-kanMX6').should('exist');
      cy.get('label').contains('Plasmids').siblings('div').contains('pFA6a-5FLAG').should('exist');
      cy.setInputValue('Line UID', 'mating-line', 'div');
      cy.get('button').contains('Submit').should('be.enabled');
      // We verify that only the parent alleles are available for selection
      cy.clearChip('3xHA-ase1');
      cy.clearChip('ase1delta::hphMX6');
      cy.clearChip('pFA6a-3HA-kanMX6');
      cy.clearChip('pFA6a-5FLAG');
      cy.contains('Alleles').siblings('div').first().children('input').click();
      cy.document().its('body').find('div[role="presentation"]').then((presentation) => {
        cy.wrap(presentation).find('li').should('have.length', 2);
        cy.wrap(presentation).find('li').eq(0).contains('3xHA-ase1').should('exist');
        cy.wrap(presentation).find('li').eq(1).contains('ase1delta::hphMX6').should('exist');
      });
      // Force because it will be covered by the alleles autocomplete
      cy.contains('Plasmids').siblings('div').first().children('input').click( { force: true });
      cy.document().its('body').find('div[role="presentation"]').then((presentation) => {
        cy.wrap(presentation).find('li').should('have.length', 2);
        cy.wrap(presentation).find('li').eq(0).contains('pFA6a-3HA-kanMX6').should('exist');
        cy.wrap(presentation).find('li').eq(1).contains('pFA6a-5FLAG').should('exist');
      });
      cy.setAutocompleteValue('Alleles', '3xHA-ase1', 'div', false);
      cy.setAutocompleteValue('Alleles', 'ase1delta::hphMX6', 'div', false);
      cy.setAutocompleteValue('Plasmids', 'pFA6a-3HA-kanMX6', 'div', false);
      cy.setAutocompleteValue('Plasmids', 'pFA6a-5FLAG', 'div', false);
      cy.get('button').contains('Submit').should('be.enabled');
      cy.get('button').contains('Submit').click();
    });
    // We should be in the line page now
    cy.get('[data-testid="resource-detail-header-title"]').contains('mating-line').should('exist');
    cy.get('[data-testid="line-genotype"]').contains('3xHA-ase1').should('exist');
    cy.get('[data-testid="line-genotype"]').contains('ase1delta::hphMX6').should('exist');
    cy.get('[data-testid="line-plasmids"]').contains('pFA6a-3HA-kanMX6').should('exist');
    cy.get('[data-testid="line-plasmids"]').contains('pFA6a-5FLAG').should('exist');
    cy.get('[data-testid="line-parent-lines"]').contains('crispr_hdr-line').should('exist');
    cy.get('[data-testid="line-parent-lines"]').contains('homologous_recombination-line').should('exist');
  });
  it('can create a line without parents nor alleles nor plasmids', () => {
    cy.e2eLogin('/lines', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('button').contains('Create line').click();
    cy.get('[data-testid="create-line-dialog"]').within(() => {
      cy.setInputValue('Line UID', 'reference-line', 'div');
      cy.get('button').contains('Submit').click();
    });
    cy.get('[data-testid="resource-detail-header-title"]').contains('reference-line').should('exist');
    cy.get('[data-testid="line-genotype"]').should('not.exist');
    cy.get('[data-testid="line-plasmids"]').should('not.exist');
    cy.get('[data-testid="line-parent-lines"]').should('not.exist');
    cy.contains('No genotype or plasmids in this line.').should('exist');
  });
  it('can bulk upload lines', () => {
    cy.e2eLogin('/lines', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('[data-testid="bulk-upload-lines-button"]').click();
    // Can download the template
    cy.get('div[role="presentation"] a').contains('Download template').then((link) => {
      cy.wrap(link).invoke('attr', 'href').should('include', '/bulk_submission_templates/bulk_submit_lines.tsv');
    });
    cy.get('[data-testid="bulk-upload-upload-file"]').click();
    cy.get('input[type="file"]').selectFile('cypress/test_files/bulk_lines/with_conflict.tsv', { force: true });
    cy.get('[data-testid="bulk-upload-lines-modal"]').within(() => {
      cy.contains('All rows must be clear to import');
      cy.get('tr').eq(1).within(() => {
        cy.contains('crispr_hdr-line').should('exist');
        cy.contains('UID already exists in workspace').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
      });
      cy.get('tr').eq(2).within(() => {
        cy.contains('bulk_line_dup').should('exist');
        cy.contains('UID duplicated in uploaded file').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
      });
      cy.get('tr').eq(3).within(() => {
        cy.contains('bulk_line_dup').should('exist');
        cy.contains('UID duplicated in uploaded file').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
      });
      cy.get('tr').eq(4).within(() => {
        cy.contains('bulk_line_bad_genotype').should('exist');
        cy.contains('Genotype "missing-allele-xyz" not found').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
      });
      cy.get('tr').eq(5).within(() => {
        cy.contains('bulk_line_bad_parent').should('exist');
        cy.contains('Parent UID "missing-parent-xyz" not found').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
      });
      cy.get('tr').eq(6).within(() => {
        cy.contains('bulk_line_clear').should('exist');
        cy.get('[data-testid="CheckCircleIcon"]').should('exist');
        cy.get('td').eq(5).should('be.empty');
      });
      cy.get('button').contains('Import').should('be.disabled');
      cy.get('button').contains('Cancel').click();
    });


    cy.get('[data-testid="bulk-upload-lines-button"]').click();
    cy.get('[data-testid="bulk-upload-upload-file"]').click();
    cy.get('input[type="file"]').selectFile('cypress/test_files/bulk_lines/valid_single.tsv', { force: true });
    cy.get('[data-testid="bulk-upload-lines-modal"]').within(() => {
      cy.get('tr').eq(1).within(() => {
        cy.contains('bulk_line_cypress_1').should('exist');
        cy.get('[data-testid="CheckCircleIcon"]').should('exist');
      });
      const conflictRows = [
        {
          uid: 'intercept_conflict_line',
          genotype: [],
          plasmids: [],
          parent_uids: [],
          uid_exists: true,
          uid_duplicated: false,
        },
      ];
      cy.intercept(
        {
          method: 'POST',
          url: Cypress.getDbURL(endpoints.linesBulk, '*'),
          times: 1,
        },
        {
          statusCode: 409,
          body: conflictRows,
        },
      ).as('bulkUploadLines409');
      cy.get('button').contains('Import').click();
    });
    cy.wait('@bulkUploadLines409');
    cy.dbAlertExists('Conflicts detected while importing. Review the updated validation results.');
    cy.closeDbAlerts();
    cy.get('[data-testid="bulk-upload-lines-modal"]').within(() => {
      cy.contains('intercept_conflict_line').should('exist');
      cy.contains('UID already exists in workspace').should('exist');
      cy.get('button').contains('Import').should('be.disabled');
      cy.get('button').contains('Cancel').click();
    });

    cy.get('[data-testid="bulk-upload-lines-button"]').click();
    cy.get('[data-testid="bulk-upload-upload-file"]').click();
    cy.get('input[type="file"]').selectFile('cypress/test_files/bulk_lines/valid_single.tsv', { force: true });
    cy.get('[data-testid="bulk-upload-lines-modal"]').within(() => {
      cy.setAutocompleteValue('Tags to apply (optional)', 'templateless_PCR', 'div');
      cy.setAutocompleteValue('Tags to apply (optional)', 'restriction_ligation_assembly', 'div');
      cy.intercept('POST', Cypress.getDbURL(endpoints.linesBulk, '*')).as('bulkUploadLines');
      cy.get('button').contains('Import').click();
      cy.wait('@bulkUploadLines').then(({ response, request }) => {
        cy.wrap(response.body).should('have.length', 1);
        cy.wrap(response.body[0].uid).should('equal', 'bulk_line_cypress_1');
        cy.wrap(request.body).should('have.length', 1);
        cy.wrap(request.body[0].uid).should('equal', 'bulk_line_cypress_1');
        cy.wrap(request.body[0].genotype).should('deep.equal', ['3xHA-ase1']);
        cy.wrap(request.body[0].plasmids).should('deep.equal', ['pFA6a-3HA-kanMX6']);
        cy.wrap(request.body[0].parent_uids).should('deep.equal', ['parent_strain']);
        cy.wrap(request.query).should('have.property', 'tags');
        cy.wrap(request.query.tags).should('have.length', 2);
      });
    });
    cy.dbAlertExists('Imported 1 line successfully');
    cy.closeDbAlerts();
    cy.get('tbody').contains('bulk_line_cypress_1').should('exist');
  });
  it('can remove plasmids and alleles from a line in a transformation', () => {
    cy.e2eLogin('/lines', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr').contains('crispr_hdr-line').click();
    cy.get('[data-testid="resource-detail-header-title"]').contains('crispr_hdr-line').should('exist');
    cy.get('button').contains('Transformation').click();
    cy.get('[data-testid="create-line-dialog"]').within(() => {
      cy.setInputValue('Line UID', 'crispr_hdr-line-new', 'div');
      cy.clearChip('3xHA-ase1');
      cy.clearChip('pFA6a-3HA-kanMX6');
      cy.get('button').contains('Submit').click();
    });
    cy.get('[data-testid="resource-detail-header-title"]').contains('crispr_hdr-line-new').should('exist');
    cy.get('[data-testid="line-parent-lines"]').contains('crispr_hdr-line').should('exist');
    cy.get('[data-testid="line-genotype"]').should('not.exist');
    cy.get('[data-testid="line-plasmids"]').should('not.exist');
  });
});
