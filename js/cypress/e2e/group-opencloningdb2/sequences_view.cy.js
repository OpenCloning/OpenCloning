import endpoints from '../../../packages/opencloningdb/src/endpoints';


describe('SequencesPage', () => {
  it('should render and make the right search request', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.e2eLogin('/sequences?name=pREX0008', 'view-only-user@example.com', 'password');
    cy.wait('@getSequences').then(({ response, request }) => {
      expect(request.query).to.deep.equal({ page: '1', size: '25', name: 'pREX0008' });
      cy.get('h5').contains('Sequences').should('exist');

      const sequences = response.body.items;
      const exampleSequence = sequences.find((sequence) => sequence.name === 'pREX0008');

      expect(exampleSequence).to.exist;
      expect(exampleSequence.sample_uids).to.deep.equal(['example_sequencing-sample']);
      expect(exampleSequence.sequence_type).to.equal('plasmid');
      expect(exampleSequence.tags.map((tag) => tag.name)).to.include('example_sequencing');

      cy.get('tbody tr')
        .filter(`:contains(${exampleSequence.name})`)
        .should('have.length', 1)
        .first()
        .within(() => {
          cy.get('td').eq(1).should('contain', 'example_sequencing-sample');
          cy.get('td').eq(2).should('contain', exampleSequence.name);
          cy.get('td').eq(3).should('contain', 'Plasmid');
          cy.get('td').eq(4).contains('example_sequencing').should('exist');
          cy.get('td').eq(5).should('contain', exampleSequence.created_by.display_name);
          cy.get('td').eq(6).invoke('text').should('not.be.empty');
        });
    });

    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences2');
    cy.setInputValue('UID', 'example_sequencing-sample', '[data-testid="sequences-page"]');
    cy.setInputValue('Name', 'pREX0008', '[data-testid="sequences-page"]');
    cy.clickMultiSelectOption('Type', 'Plasmid', '[data-testid="sequences-page"]');
    cy.clickMultiSelectOption('Tags', 'example_sequencing', '[data-testid="sequences-page"]');
    cy.setInputValue('Created by', 'Bootstrap User', '[data-testid="sequences-page"]');
    cy.get('[data-testid="sequences-page"] button').contains('Search').click();
    cy.wait('@getSequences2').then(({ response, request }) => {
      cy.wrap(request.query).should('have.property', 'page', '1');
      cy.wrap(request.query).should('have.property', 'size', '25');
      cy.wrap(request.query).should('have.property', 'uid', 'example_sequencing-sample');
      cy.wrap(request.query).should('have.property', 'name', 'pREX0008');
      cy.wrap(request.query).should('have.property', 'sequence_types', 'plasmid');
      cy.wrap(request.query.tags).should('match', /\d+/);
      cy.wrap(request.query).should('have.property', 'created_by', 'Bootstrap User');

      const filteredSequences = response.body.items;
      expect(filteredSequences).to.have.length(1);
      expect(filteredSequences[0].name).to.equal('pREX0008');

      cy.get('tbody tr')
        .should('have.length', 1)
        .first()
        .within(() => {
          cy.get('td').eq(1).should('contain', 'example_sequencing-sample');
          cy.get('td').eq(2).should('contain', 'pREX0008');
          cy.get('td').eq(3).should('contain', 'Plasmid');
          cy.get('td').eq(4).contains('example_sequencing').should('exist');
          cy.get('td').eq(5).invoke('text').should('not.be.empty');
          cy.get('td').eq(6).invoke('text').should('not.be.empty');
        });
    });

    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences3');
    cy.get('[data-testid="sequences-page"] label').contains('With UID').parent().find('input').click({ force: true });
    cy.get('[data-testid="sequences-page"] button').contains('Search').click();
    cy.wait('@getSequences3').then(({ request }) => {
      cy.wrap(request.query).should('have.property', 'has_uid', 'true');
      cy.wrap(request.query).should('have.property', 'uid', 'example_sequencing-sample');
      cy.wrap(request.query).should('have.property', 'name', 'pREX0008');
      cy.wrap(request.query).should('have.property', 'sequence_types', 'plasmid');
      cy.wrap(request.query.tags).should('match', /\d+/);
    });
  });

  it('should set query params from the URL', () => {
    const url = '/sequences?uid=example_sequencing-sample&name=pREX0008&sequence_types=plasmid&tags=1&has_uid=true&created_by=Bootstrap+User';
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.intercept('GET', Cypress.getDbURL(endpoints.tags, '*'), { statusCode: 200, body: [{ id: 1, name: 'example_sequencing' }] }).as('getTags');
    cy.e2eLogin(url, 'view-only-user@example.com', 'password');
    cy.wait('@getSequences').then(({ request }) => {
      cy.wrap(request.query).should('have.property', 'uid', 'example_sequencing-sample');
      cy.wrap(request.query).should('have.property', 'name', 'pREX0008');
      cy.wrap(request.query).should('have.property', 'sequence_types', 'plasmid');
      cy.wrap(request.query).should('have.property', 'has_uid', 'true');
      cy.wrap(request.query.tags).should('match', /\d+/);
      cy.wrap(request.query).should('have.property', 'created_by', 'Bootstrap User');
    });
    cy.get('[data-testid="url-params-form"]').within(() => {
      cy.get('label').contains('With UID').parent().find('input').should('be.checked');
      cy.get('label').contains(/^UID$/).parent().find('input').should('have.value', 'example_sequencing-sample');
      cy.get('label').contains('Name').parent().find('input').should('have.value', 'pREX0008');
      cy.get('label').contains('Type').siblings().find('div').contains('Plasmid').should('exist');
      cy.get('label').contains('Tags').siblings().find('div').contains('example_sequencing').should('exist');
      cy.get('label').contains('Created by').parent().find('input').should('have.value', 'Bootstrap User');
    });
  });

  it('can go back to main page from the detail page', () => {
    cy.goBackToMainPageFromDetailPage('sequences', 'pREX0008');
  });

  it('clicking on entry shows the detail page', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.e2eLogin('/sequences', 'view-only-user@example.com', 'password');
    // entry clone has parent and children, no sequencing data.
    // pREX0008 has sequencing data, no parent or children.
    // lacZ_PCR_product has linked primers
    cy.wait('@getSequences');
    for (const name of ['entry_clone_lacZ', 'pREX0008', 'lacZ_PCR_product']) {
      cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as(`getSequences-${name}`);
      cy.setInputValue('Name', name, '[data-testid="sequences-page"]');
      cy.get('[data-testid="sequences-page"] button').contains('Search').click();
      cy.wait(`@getSequences-${name}`).then(({ response }) => {
        const sequence = response.body.items.find((item) => item.name === name);

        cy.intercept('GET', Cypress.getDbURL(endpoints.sequence(sequence.id))).as('getSequenceDetail');
        cy.intercept('GET', Cypress.getDbURL(endpoints.sequenceCloningStrategy(sequence.id))).as('getSequenceCloningStrategy');
        cy.intercept('GET', Cypress.getDbURL(endpoints.sequenceChildren(sequence.id))).as('getSequenceChildren');
        cy.intercept('GET', Cypress.getDbURL(endpoints.sequenceLines(sequence.id))).as('getSequenceLines');
        cy.intercept('GET', Cypress.getDbURL(endpoints.sequencePrimers(sequence.id))).as('getSequencePrimers');
        cy.intercept('GET', Cypress.getDbURL(endpoints.sequenceSequencingFiles(sequence.id))).as('getSequenceSequencingFiles');

        cy.get('tbody button').contains(sequence.name).click();
        cy.wait('@getSequenceDetail').then(({ response: sequenceDetailResponse }) => {
          const sequenceDetail = sequenceDetailResponse.body;

          cy.get('[data-testid="resource-detail-header-title"] h5').contains(sequenceDetail.name).should('exist');
          if (name !== 'lacZ_PCR_product') {
            cy.get('[data-testid="resource-detail-header-title"]').contains('Plasmid').should('exist');
          } else {
            cy.get('[data-testid="resource-detail-header-title"]').contains('PCR product').should('exist');
          }
          cy.get('[data-testid="tag-chip-with-delete"]').contains(sequenceDetail.tags[0].name).should('exist');

          if (sequenceDetail.sample_uids.length > 0) {
            sequenceDetail.sample_uids.forEach((uid) => {
              cy.contains('h6', 'Sequence sample UIDs').parent().parent().contains(uid).should('exist');
            });
          } else {
            cy.contains('h6', 'Sequence sample UIDs').parent().parent().contains('No UIDs linked').should('exist');
          }
          cy.get('[data-testid="sequence-seguid"]').contains(sequenceDetail.seguid).should('exist');
        });
        cy.wait('@getSequencePrimers').then(({ response: sequencePrimersResponse }) => {
          const linkedPrimers = [...sequencePrimersResponse.body.templates, ...sequencePrimersResponse.body.products];

          if (name === 'lacZ_PCR_product') {
            cy.wrap(linkedPrimers).should('have.length', 2);
            linkedPrimers.forEach((primer) => {
              cy.contains('h6', 'Linked primers').parent().parent().contains(primer.name).should('exist');
            });
          } else {
            cy.contains('h6', 'Linked primers').should('not.exist');
          }
        });
        cy.wait('@getSequenceSequencingFiles').then(({ response: sequencingFilesResponse }) => {
          const sequencingFiles = sequencingFilesResponse.body;

          if (sequencingFiles.length > 0) {
            sequencingFiles.forEach((file) => {
              cy.get('[data-testid="sequencing-file-row"]').contains(file.original_name).should('exist');
            });
          } else {
            cy.contains('h6', 'Sequencing files').parent().parent().contains('No sequencing files linked').should('exist');
          }
        });

        cy.wait(['@getSequenceCloningStrategy', '@getSequenceChildren']).then(() => {
          if (name === 'pREX0008') {
            // Parents
            cy.get('[data-testid="sequence-provenance"]').contains('UploadedFileSource').should('exist');
            // Children
            cy.get('[data-testid="sequence-children"]').should('not.exist');
            cy.get('[data-testid="change-sequence-circularity-button"]').should('exist');
            // Lines
            cy.get('[data-testid="sequence-lines"]').within(() => {
              cy.get('tr').should('have.length', 3);
              cy.get('tr').contains('example_sequencing-line').should('exist');
              cy.get('tr').contains('template_sequence-line').should('exist');
            });
          } else if (name === 'entry_clone_lacZ') {
            // Parents
            cy.get('[data-testid="sequence-provenance"]').contains('GatewaySource').should('exist');
            cy.get('[data-testid="sequence-provenance"] [data-testid="sequence-table"]').should('exist').within(() => {
              cy.get('tr').should('have.length', 3);
              cy.get('tr').eq(1).contains('pDONR221').should('exist');
              cy.get('tr').eq(2).contains('lacZ_PCR_product').should('exist');
            });
            // Children
            cy.get('[data-testid="sequence-children"] [data-testid="sequence-table"]').should('exist').within(() => {
              cy.get('tr').should('have.length', 2);
              cy.get('tr').eq(1).contains('expression_clone_lacZ').should('exist');
            });
            cy.get('[data-testid="change-sequence-circularity-button"]').should('not.exist');
            // Lines
            cy.get('[data-testid="sequence-lines"]').should('not.exist'); 
          }
        });
        cy.get('.veEditor').contains(name).should('exist');
        cy.get('button').contains('Back to Sequences').click();
      });
    }
  });

  it('can add to tab from the detail page', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.e2eLogin('/sequences?name=pREX0008', 'view-only-user@example.com', 'password');
    cy.wait('@getSequences')
    cy.get('tbody button').contains('pREX0008').click();
    cy.get('button').contains('Add to Design Tab', { timeout: 20000 }).click();
    cy.changeTab('Design');
    // There should be no warnings
    cy.openCloningAlertsAreEmpty();
    // Empty source should have been removed
    cy.get('li.source-node').should('have.length', 1);
    cy.get('.open-cloning', { timeout: 20000 }).contains('pREX0008').should('exist');
  });

  it('can download and align sequencing files', () => {
    cy.disableCache();
    // If downloaded file exists, delete it
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.e2eLogin('/sequences?name=pREX0008', 'view-only-user@example.com', 'password');
    cy.wait('@getSequences').then(({ response }) => {
      const sequence = response.body.items.find((item) => item.name === 'pREX0008');
      cy.intercept('GET', Cypress.getDbURL(endpoints.sequenceSequencingFiles(sequence.id))).as('getSequenceSequencingFiles');
      cy.get('tbody button').contains(sequence.name).click();
      cy.wait('@getSequenceSequencingFiles').then(({ response: sequencingFilesResponse }) => {
        const sequencingFiles = sequencingFilesResponse.body;
        const firstFile = sequencingFiles[0];
        cy.intercept('GET', Cypress.getDbURL(endpoints.sequencingFileDownload(firstFile.id))).as('downloadSequencingFile');
        // Wait until name displayed on sequence editor
        cy.get('.veEditor').contains('pREX0008', { timeout: 20000 }).should('exist').then(() => {
          cy.get('h5').contains('pREX0008').scrollIntoView()
          cy.get('[data-testid="sequencing-file-row"] [data-testid="DownloadIcon"]').first().click();
          cy.wait('@downloadSequencingFile', { timeout: 20000 });
          // Check that the file was downloaded
          cy.readFile(`cypress/downloads/${firstFile.original_name}`);
          // Click outside to remove the tooltip covering this
          cy.get('body').click('topLeft');
          cy.get('button[aria-label="See alignments"]').click();
          cy.get('.veTabActive').contains('Alignments', { timeout: 20000 }).should('exist');
        });
      });
    });
  });

  it('clicking on add to design tab button adds sequences to the design tab', () => {
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequenceTextFile('*'))).as('getSequenceTextFile');
    cy.e2eLogin('/sequences?name=lacz', 'view-only-user@example.com', 'password');
    cy.wait('@getSequences')
    cy.get('button').contains('Add to Design Tab').should('not.exist');
    cy.get('button').contains('Tag Sequences').should('not.exist');

    const selectedSequences = ['entry_clone_lacZ', 'expression_clone_lacZ'];

    selectedSequences.forEach((name) => {
      cy.get('tbody tr').filter(`:contains(${name})`).within(() => {
        cy.get('input').eq(0).should('not.be.checked');
        cy.get('input').eq(0).click();
        cy.get('input').eq(0).should('be.checked');
      });
    });

    cy.get('button').contains('Add to Design Tab').click();
    cy.wait('@getSequenceTextFile');
    cy.changeTab('Design');
    cy.get('.open-cloning', { timeout: 20000 }).contains(selectedSequences[0]).should('exist');
    cy.get('.open-cloning').contains(selectedSequences[1]).should('exist');
  });

  it('paginates the table after lowering rows per page', () => {
    cy.openCloningDbTablePaginationTest('sequences', '[data-testid="sequences-page"]');
  });

  it('select all checks every row and shows bulk actions', () => {
    cy.openCloningDbTableSelectAllTest('sequences', '[data-testid="sequences-page"]', 'select all sequences', 'Add to Design Tab');
  });

  it('can load ancestors from the design tab', () => {
    cy.e2eLogin('/sequences?name=entry_clone_lacZ', 'view-only-user@example.com', 'password');
    cy.get('tbody button').contains('entry_clone_lacZ').click();
    cy.get('button').contains('Add to Design Tab').click();
    cy.changeTab('Design');
    cy.get('.open-cloning li').contains('Imported from').should('exist');
    cy.get('.open-cloning li').contains('Gateway BP reaction').should('not.exist');

    cy.get('button').contains('Load history').click();
    cy.get('.open-cloning li').contains('Gateway BP reaction').should('exist');
    cy.get('.open-cloning li').contains('PCR with primers').should('not.exist');
    cy.get('.open-cloning li').contains('pDONR221').should('exist');
  });
});
