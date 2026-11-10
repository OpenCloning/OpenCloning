import endpoints from '../../../packages/opencloningdb/src/endpoints';

const bulkSequenceFiles = [
  '68164.gb',
  '68165.gb',
  'hello.fasta',
  'pFA6a-3HA-kanMX6.fasta',
  'repeated_1.gb',
  'repeated_2.gb',
].map((file) => `cypress/test_files/bulk_sequence_submit/${file}`);

describe('Actions that can be perfomed by an edit user on the Sequences page', () => {
  afterEach(() => {
    cy.resetDB();
  })
  it('can toggle sequence circularity from the detail page', () => {
    const sequenceName = 'pREX0008';
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.e2eLogin(`/sequences?name=${sequenceName}`, 'bootstrap+clerk_test@example.com', 'password');
    cy.wait('@getSequences').then(({ response }) => {
      const sequence = response.body.items.find((item) => item.name === sequenceName);
      cy.intercept('PATCH', Cypress.getDbURL(endpoints.sequenceChangeCircularity(sequence.id))).as('changeCircularity');
      cy.get('tbody tr button').contains(sequenceName).click();
      cy.get('[data-testid="change-sequence-circularity-button"]').click();
      cy.wait('@changeCircularity');
      cy.dbAlertExists('Sequence circularity updated');
      cy.closeDbAlerts();
      cy.get('[data-testid="sequence-header"]').contains('Linear DNA').should('exist');
      cy.get('[data-testid="change-sequence-circularity-button"]').click();
      cy.wait('@changeCircularity');
      cy.dbAlertExists('Sequence circularity updated');
      cy.closeDbAlerts();
      cy.get('[data-testid="sequence-header"]').contains('Plasmid').should('exist');
    });
  });
  it('can tag sequences from the table', () => {
    cy.addTagInTableTest('sequences', 'input_entities');
  });
  it('can remove and add tags from the detail page', () => {
    cy.addTagInDetailPageTest('sequences', 'pREX0008', 'example_sequencing');
  });
  it('can add and remove sequencing files from the detail page', () => {
    const sequenceName = 'pREX0008';
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.e2eLogin(`/sequences?name=pREX0008`, 'bootstrap+clerk_test@example.com', 'password');
    cy.wait('@getSequences').then(({ response }) => {
      const sequence = response.body.items.find((item) => item.name === sequenceName);
      cy.intercept('GET', Cypress.getDbURL(endpoints.sequenceSequencingFiles(sequence.id))).as('getSequenceSequencingFiles');
      cy.get('tbody tr button').contains(sequenceName).click();
      cy.wait('@getSequenceSequencingFiles').then(({ response }) => {
        const sequencingFiles = response.body;
        const sequencingFile = sequencingFiles[0];
        cy.intercept('DELETE', Cypress.getDbURL(endpoints.sequenceSequencingFileDelete(sequence.id, sequencingFile.id))).as('deleteSequencingFile');
        cy.get('[data-testid="sequencing-file-row"]').filter(`:contains(${sequencingFile.original_name})`).within(() => {
          cy.get('[aria-label="Delete"]').click();
        });
        cy.wait('@deleteSequencingFile');
        cy.get('[data-testid="sequencing-file-row"]').contains(sequencingFile.original_name).should('not.exist');
        cy.dbAlertExists('Sequencing file deleted successfully');
        cy.closeDbAlerts();
        cy.intercept('POST', Cypress.getDbURL(endpoints.sequenceSequencingFiles(sequence.id))).as('addSequencingFile');
        cy.get('[aria-label="Add sequencing files"]').siblings('input').selectFile('cypress/test_files/dummy_sequencing.fasta', { force: true });
        cy.wait('@addSequencingFile');
        cy.dbAlertExists('Sequencing files submitted successfully');
        cy.get('[data-testid="sequencing-file-row"]').contains('dummy_sequencing.fasta').should('exist');

      });
    });
  });
  it('can add and remove sample UIDs from the detail page', () => {
    const sequenceName = 'pREX0008';
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.e2eLogin(`/sequences?name=pREX0008`, 'bootstrap+clerk_test@example.com', 'password');
    cy.wait('@getSequences').then(({ response }) => {
      const sequence = response.body.items.find((item) => item.name === sequenceName);
      cy.get('tbody tr button').contains(sequenceName).click();
      cy.get('[data-testid="sequence-samples-section"]').contains('cre_lox_recombination-sample').should('not.exist');
      cy.get('[data-testid="sequence-samples-section"]').contains('example_sequencing-sample').should('exist');
      cy.intercept('PATCH', Cypress.getDbURL(endpoints.sequenceSample('cre_lox_recombination-sample'))).as('transferSample');
      cy.get('[aria-label="Transfer UID from another sequence"]').click();
      cy.setAutocompleteValue('Search UIDs', 'cre_lox_recombination-sample', 'body', false);
      cy.contains('Are you sure you want to transfer UID cre_lox_recombination-sample from sequence reconstituted_locus to this one').should('exist');
      cy.contains('Confirm').click();
      cy.wait('@transferSample').then(({ request }) => {
        expect(request.body).to.deep.equal({ sequence_id: sequence.id });
      });
      cy.get('[data-testid="sequence-samples-section"]').contains('cre_lox_recombination-sample').should('exist');
      cy.get('[data-testid="sequence-samples-section"]').contains('example_sequencing-sample').should('exist');
      cy.dbAlertExists('UID transferred successfully');
      cy.closeDbAlerts();

      cy.get('[aria-label="Add new UIDs"]').click();
      cy.get('[data-testid="create-sequence-sample-uid-dialog"]').should('be.visible');
      cy.get('[data-testid="create-sequence-sample-uid-dialog"]').within(() => {
        cy.get('input').type('new_sample_uid');
        cy.get('button').contains('Add another UID').click();
        cy.get('input').last().type('new_sample_uid2');
        cy.get('button').contains('Create').click();
      });

      cy.get('[data-testid="sequence-samples-section"]').contains('new_sample_uid').should('exist');
      cy.get('[data-testid="sequence-samples-section"]').contains('new_sample_uid2').should('exist');
      cy.dbAlertExists('2 sample UID(s) created successfully');
      cy.closeDbAlerts();

      // Can delete it
      cy.get('[data-testid="sample-uid-badge-with-delete"]').contains('new_sample_uid2').within(() => {
        cy.get('svg').click();
      });
      cy.dbAlertExists('UID new_sample_uid2 deleted successfully');
      cy.closeDbAlerts();
      cy.get('[data-testid="sample-uid-badge-with-delete"]').contains('new_sample_uid').should('exist');
      cy.get('[data-testid="sample-uid-badge-with-delete"]').contains('new_sample_uid2').should('not.exist');
    });
  });
  it('can change name but not sequence type in circular sequence', () => {

    cy.e2eLogin(`/sequences?name=pREX0008`, 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr button').contains('pREX0008').click();
    cy.get('[data-testid="sequence-header"]').within(() => {
      cy.get('[aria-label="Edit name and type"]').click();
      cy.get('input').first().clear()
      cy.get('input').first().type('new_sequence_name');
      cy.get('input').last().should('be.disabled');
      cy.get('button').contains('Save').click();
      cy.contains('new_sequence_name').should('exist');
    });
    cy.dbAlertExists('Sequence updated successfully');

    cy.closeDbAlerts();
  });
  it('can change name and sequence type in linear sequence', () => {
    cy.e2eLogin(`/sequences?name=reconstituted_locus`, 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr button').contains('reconstituted_locus').click();
    cy.get('[data-testid="sequence-header"]').within(() => {
      cy.contains('Linear DNA').should('exist');
      cy.get('[aria-label="Edit name and type"]').click();
      cy.get('input').first().clear()
      cy.get('input').first().type('new_sequence_name');
      cy.contains('Type').siblings('div').first().click();
    });
    // Plasmid should not be an option
    cy.get('div[role="presentation"]').contains('Plasmid').should('not.exist');
    cy.get('div[role="presentation"]').contains('Allele').click();
    cy.get('[data-testid="sequence-header"]').within(() => {
      cy.get('button').contains('Save').click();
      cy.contains('new_sequence_name').should('exist');
      cy.contains('Allele').should('exist');
      cy.contains('Linear DNA').should('not.exist');
    });
    cy.dbAlertExists('Sequence updated successfully');
    cy.closeDbAlerts();
  });
  it('cannot change type in sequence present in a line', () => {
    cy.e2eLogin(`/sequences?name=ase1delta`, 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr button').contains('ase1delta').click();
    cy.get('[aria-label="Edit name and type"]').click();
    cy.get('[aria-label="Cannot change type of sequence present in a line"] input').should('be.disabled');
  });
  it('can bulk upload sequences', () => {
    cy.e2eLogin('/sequences', 'bootstrap+clerk_test@example.com', 'password');
    // Test a connection error
    cy.intercept({
      method: 'POST',
      url: Cypress.getDbURL(endpoints.sequencesValidateUpload, '*'),
      times: 1,
    }, {
      statusCode: 500,
    }).as('bulkUploadSequences500');
    cy.get('input[type="file"]').eq(0).selectFile(bulkSequenceFiles, { force: true });
    cy.dbAlertExists('Internal server error');
    cy.closeDbAlerts();
    cy.get('[data-testid="bulk-upload-sequences-modal"]').should('not.exist');
    cy.get('button').contains('Upload Sequences').click();
    cy.get('input[type="file"]').eq(0).selectFile(bulkSequenceFiles, { force: true });
    cy.wait('@bulkUploadSequences500');
    cy.get('[data-testid="bulk-upload-sequences-modal"]').within(() => {
      cy.get('tr').eq(1).within(() => {
        cy.contains('hello.fasta').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
      });
      cy.get('tr').eq(2).within(() => {
        cy.contains('pFA6a-3HA-kanMX6.fasta').should('exist');
        cy.get('[data-testid="WarningIcon"]').should('exist');
        cy.contains('Circularized sequence already exists in workspace').should('exist');
        cy.contains('Name already exists in workspace').should('exist');
      });
      cy.get('tr').eq(3).within(() => {
        cy.contains('repeated_1.gb').should('exist');
        cy.get('[data-testid="WarningIcon"]').should('exist');
        cy.contains('Name duplicated in uploaded files').should('exist');
        cy.contains('Sequence duplicated in uploaded files').should('exist');
      });
      cy.get('tr').eq(4).within(() => {
        cy.contains('repeated_2.gb').should('exist');
        cy.get('[data-testid="WarningIcon"]').should('exist');
        cy.contains('Name duplicated in uploaded files').should('exist');
        cy.contains('Sequence duplicated in uploaded files').should('exist');
      });
      cy.get('tr').eq(5).within(() => {
        cy.contains('68164.gb').should('exist');
        cy.get('[data-testid="CheckCircleIcon"]').should('exist');
        cy.get('td').eq(5).should('be.empty');
      });
      cy.get('tr').eq(6).within(() => {
        cy.contains('68165.gb').should('exist');
        cy.get('[data-testid="CheckCircleIcon"]').should('exist');
        cy.get('td').eq(5).should('be.empty');
      });
      cy.setAutocompleteValue('Tags to apply (optional)', 'templateless_PCR', 'div');
      cy.setAutocompleteValue('Tags to apply (optional)', 'restriction_ligation_assembly', 'div');
      cy.intercept('POST', Cypress.getDbURL(endpoints.sequencesBulk, '*')).as('bulkUploadSequences');
      cy.get('button').contains('Import entries without warnings').click();
      cy.wait('@bulkUploadSequences').then(({ response, request }) => {
        cy.wrap(response.body).should('have.length', 2);
        cy.wrap(response.body[0].name).should('equal', 'pPML1_(GB0045)');
        cy.wrap(response.body[1].name).should('equal', 'pNH__(GB0064)');
        cy.wrap(request.query).should('have.property', 'strict', 'true');
        cy.wrap(request.query).should('have.property', 'tags');
        cy.wrap(request.query.tags).should('have.length', 2);
      });
      cy.dbAlertExists('Imported 2 sequences successfully');
      cy.closeDbAlerts();
    });
    cy.get('button').contains('Upload Sequences').click();
    cy.get('input[type="file"]').eq(0).selectFile(bulkSequenceFiles.slice(2), { force: true });
    cy.get('[data-testid="bulk-upload-sequences-modal"]').within(() => {
      cy.get('tr [data-testid="CheckCircleIcon"]').should('not.exist');
      cy.get('tr [data-testid="WarningIcon"]').should('exist');
      cy.get('tr [data-testid="CancelIcon"]').should('exist');
      cy.get('button').contains('Import entries without warnings').should('be.disabled');
      cy.intercept('POST', Cypress.getDbURL(endpoints.sequencesBulk, '*')).as('bulkUploadSequences2');
      cy.get('button').contains('Import entries with warnings too').click();
      cy.wait('@bulkUploadSequences2').then(({ response, request }) => {
        cy.wrap(response.body).should('have.length', 3);
        cy.wrap(response.body[0].name).should('equal', 'pFA6a-3HA-kanMX6');
        cy.wrap(response.body[1].name).should('equal', 'pj5_00001');
        cy.wrap(response.body[2].name).should('equal', 'pj5_00001');
        cy.wrap(request.query).should('have.property', 'strict', 'false');
      });
      cy.dbAlertExists('Imported 3 sequences successfully');
      cy.closeDbAlerts();
    });
  });
  it('can bulk upload template sequences', () => {
    cy.e2eLogin('/sequences', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('[data-testid="bulk-upload-template-sequences-button"]').click();
    // Can download the template
    cy.get('div[role="presentation"] a').contains('Download template').then((link) => {
      cy.wrap(link).invoke('attr', 'href').should('include', '/bulk_submission_templates/bulk_submit_template_sequence.tsv');
    });
    cy.get('[data-testid="bulk-upload-upload-file"]').click();
    cy.get('input[type="file"]').eq(2).selectFile('cypress/test_files/bulk_template_sequences/with_conflict.tsv', { force: true });
    cy.get('[data-testid="bulk-upload-template-sequences-modal"]').within(() => {
      cy.get('tr').eq(1).within(() => {
        cy.contains('template_sequence_allele').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
      });
      cy.get('tr').eq(2).within(() => {
        cy.contains('dup_in_file').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
      });
      cy.get('[data-testid="bulk-upload-import-button"]').should('be.disabled');
      cy.get('button').contains('Cancel').click();
    });
    cy.get('input[type="file"]').eq(2).selectFile('cypress/test_files/bulk_template_sequences/invalid_type.tsv', { force: true });
    cy.dbAlertExists('Invalid sequence_type value(s): not_a_type');
    cy.closeDbAlerts();
    cy.get('input[type="file"]').eq(2).selectFile('cypress/test_files/bulk_template_sequences/valid_single.tsv', { force: true });
    cy.get('[data-testid="bulk-upload-template-sequences-modal"]').within(() => {
      cy.get('tr').eq(1).within(() => {
        cy.contains('bulk_template_cypress_1').should('exist');
        cy.get('[data-testid="CheckCircleIcon"]').should('exist');
      });
      cy.intercept(
        {
          method: 'POST',
          url: Cypress.getDbURL(endpoints.templateSequencesBulk, '*'),
          times: 1,
        },
        {
          statusCode: 409,
          body: [
            {name:"intercept_conflict_a", sequence_type:"allele", name_exists:true, name_duplicated:false},
            {name:"intercept_conflict_b", sequence_type:"locus", name_exists:false, name_duplicated:true}
          ],
        },
      ).as('bulkUploadTemplates409');
      cy.get('[data-testid="bulk-upload-import-button"]').click();
    });
    cy.dbAlertExists('Conflicts detected while importing. Review the updated validation results.');
    cy.closeDbAlerts();
    cy.get('[data-testid="bulk-upload-template-sequences-modal"]').within(() => {
      cy.contains('intercept_conflict_a').should('exist');
      cy.contains('intercept_conflict_b').should('exist');
      cy.contains('Allele').should('exist');
      cy.contains('Locus').should('exist');
      cy.contains('Name already exists in workspace').should('exist');
      cy.contains('Name duplicated in uploaded file').should('exist');
      cy.contains('tr', 'intercept_conflict_a').find('[data-testid="CancelIcon"]').should('exist');
      cy.contains('tr', 'intercept_conflict_b').find('[data-testid="CancelIcon"]').should('exist');
      cy.get('[data-testid="bulk-upload-import-button"]').should('be.disabled');
      cy.get('button').contains('Cancel').click();
    });

    cy.get('input[type="file"]').eq(2).selectFile('cypress/test_files/bulk_template_sequences/valid_single.tsv', { force: true });
    cy.get('[data-testid="bulk-upload-template-sequences-modal"]').within(() => {
      cy.get('tr').eq(1).within(() => {
        cy.contains('bulk_template_cypress_1').should('exist');
        cy.get('[data-testid="CheckCircleIcon"]').should('exist');
      });
      cy.intercept('POST', Cypress.getDbURL(endpoints.templateSequencesBulk, '*')).as('bulkUploadTemplates');
      cy.get('[data-testid="bulk-upload-import-button"]').click();
      cy.wait('@bulkUploadTemplates').then(({ response, request }) => {
        cy.wrap(response.body).should('have.length', 1);
        cy.wrap(response.body[0].name).should('equal', 'bulk_template_cypress_1');
        cy.wrap(response.body[0].sequence_type).should('equal', 'allele');
        cy.wrap(request.body).should('have.length', 1);
        cy.wrap(request.body[0].name).should('equal', 'bulk_template_cypress_1');
        cy.wrap(request.body[0].sequence_type).should('equal', 'allele');
      });
    });
    cy.dbAlertExists('Imported 1 template sequence successfully');
    cy.closeDbAlerts();
  });
  it('can bulk upload cloning strategies', () => {
    cy.e2eLogin('/sequences', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('input[type="file"]').eq(1).selectFile([
      'cypress/test_files/old_and_bug_fix/crispr_hdr.json', // old format
      'cypress/test_files/bulk_cloning_strategies/linearised_pFA6a-kanMX6_wrong_database_id.json', // wrong database id
      'cypress/test_files/bulk_cloning_strategies/manually_typed.json', // new sequence
      'cypress/test_files/wrong_history.json', // wrong JSON format
    ], { force: true });
    cy.get('[data-testid="bulk-upload-cloning-strategies-modal"]').within(() => {
      cy.get('tr').eq(1).within(() => {
        cy.contains('wrong_history.json').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
        cy.contains('cloning strategy is invalid').should('exist');
        cy.get('td').eq(2).contains('Invalid')
      });
      cy.get('tr').eq(2).within(() => {
        cy.contains('pFA6a-kanMX6').should('exist');
        cy.get('[data-testid="WarningIcon"]').should('exist');
        cy.contains('database_id mismatch').should('exist');
        cy.contains('provided 999999').should('exist');
        cy.get('td').eq(2).contains('Review warnings')
      });
      cy.get('tr').eq(3).within(() => {
        cy.contains('crispr_hdr').should('exist');
        cy.get('[data-testid="InfoIcon"]').should('exist');
        cy.contains('previous version').should('exist');
        cy.contains('Already synced')
        cy.get('td').eq(2).contains('Already synced')
      });
      cy.get('tr').eq(4).within(() => {
        cy.contains('manually_typed').should('exist');
        cy.get('[data-testid="CheckCircleIcon"]').should('exist');
        cy.get('td').eq(2).contains('Ready to import')
        cy.get('td').eq(5).should('be.empty')
      });
      cy.intercept({
        method: 'POST',
        url: Cypress.getDbURL(endpoints.sequencesCloningStrategyBulk, '*'),
        times: 1,
      }, {
        statusCode: 500,
      }).as('bulkUploadCloningStrategies');
      cy.get('button').contains('Import entries with warnings too').click();
      cy.wait('@bulkUploadCloningStrategies').then(({ request }) => {
        cy.wrap(request.body).should('have.length', 2);
        cy.wrap(request.body[0]).should('have.property', 'file_name', 'linearised_pFA6a-kanMX6_wrong_database_id.json');
        cy.wrap(request.body[1]).should('have.property', 'file_name', 'manually_typed.json');
      });
      // Submission errors are shown in the dialog
      cy.get('.MuiAlert-colorError').contains('Internal server error').should('exist');
      cy.intercept(
        {
          method: 'POST',
          url: Cypress.getDbURL(endpoints.sequencesCloningStrategyBulk, '*'),
          times: 1,
        }).as('bulkUploadCloningStrategies2');
      cy.get('button').contains('Import entries without warnings').click();
      cy.wait('@bulkUploadCloningStrategies2').then(({ request }) => {
        cy.wrap(request.body).should('have.length', 1);
        cy.wrap(request.body[0]).should('have.property', 'file_name', 'manually_typed.json');
      });
      // manually_typed.json has a single sequence, which is new
      cy.dbAlertExists('Imported 1 cloning strategy successfully (1 sequence created)');
      cy.closeDbAlerts();
    });
    cy.get('tbody tr button').contains('manually_typed').should('exist');
    // Display error after submission
    cy.get('input[type="file"]').eq(1).selectFile([
      'cypress/test_files/bulk_cloning_strategies/linearised_pFA6a-kanMX6_wrong_database_id.json', // old format
    ], { force: true });
    cy.get('[data-testid="bulk-upload-cloning-strategies-modal"]').within(() => {
      cy.intercept({
        method: 'POST',
        url: Cypress.getDbURL(endpoints.sequencesCloningStrategyBulk, '*'),
        times: 1,
      }, {
        statusCode: 409,
        body: [
          { file_name: 'bla.json', parsing_errors: ['test parsing error'] }
        ],
      }).as('bulkUploadCloningStrategies3');
      cy.get('button').contains('Import entries with warnings too').click();
      cy.wait('@bulkUploadCloningStrategies3')
      cy.get('tr').eq(1).within(() => {
        cy.contains('bla.json').should('exist');
        cy.get('[data-testid="CancelIcon"]').should('exist');
        cy.contains('test parsing error').should('exist');
      });
      cy.get('.MuiAlert-colorWarning').contains('Conflicts detected while importing').should('exist');
    });
  });
  it('can change annotation', () => {
    cy.viewport(1920, 1080);
    cy.e2eLogin(`/sequences?name=lacZ_PCR_product`, 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr button').contains('lacZ_PCR_product').click();
    cy.get('[data-testid="sequence-header"]').contains('lacZ_PCR_product').should('exist');
    // Remove covering html elements that prevent selecting
    cy.get('[data-test="cutsiteHideShowTool"]').click();
    cy.sequenceEditorChangeTab('Linear Map');
    cy.sequenceEditorCreateFeature('feature_name1', 500, 1000);
    cy.get('[data-testid="annotation-changed-alert"]').should('exist');
    cy.sequenceEditorCreateFeature('feature_name2', 1500, 2000);
    cy.get('[data-testid="annotation-changed-alert"]').should('exist');
    cy.sequenceEditorClickUndoTool();
    cy.get('[data-testid="annotation-changed-alert"]').should('exist');
    cy.sequenceEditorClickUndoTool();
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
    cy.sequenceEditorClickRedoTool();
    cy.get('[data-testid="annotation-changed-alert"]').should('exist');
    cy.sequenceEditorClickRedoTool();
    cy.get('[data-testid="annotation-changed-alert"]').should('exist');
    cy.get('[data-testid="annotation-changed-alert"] button').contains('Save').click();
    cy.dbAlertExists('Annotation updated');
    cy.closeDbAlerts();
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
    cy.get('.veEditor').contains('feature_name1').should('exist');
    cy.get('.veEditor').contains('feature_name2').should('exist');
    // Check that cancel works
    cy.sequenceEditorDeleteFeature('feature_name1');
    cy.get('[data-testid="annotation-changed-alert"]').should('exist');
    cy.get('.veEditor').contains('feature_name1').should('not.exist');
    cy.get('[data-testid="annotation-changed-alert"] button').contains('Cancel').click();
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
    cy.get('.veEditor').contains('feature_name1').should('exist');
    // Check that it handles failure in server
    cy.sequenceEditorCreateFeature('feature_name3', 2500, 3000);
    cy.intercept(
      'PATCH',
      Cypress.getDbURL(endpoints.sequenceChangeAnnotation('*')),
      { forceNetworkError: true }
    ).as('updateAnnotation');

    cy.get('[data-testid="annotation-changed-alert"] button').contains('Save').click();
    cy.wait('@updateAnnotation');
    cy.dbAlertExists('Network Error');
    cy.closeDbAlerts();
    cy.get('[data-testid="annotation-changed-alert"]').should('exist');
    cy.get('.veEditor').contains('feature_name3').should('exist');
  });
  it('can delete a sequence that has no children and is present in no lines', () => {
    cy.e2eLogin(`/sequences?uid=templateless_PCR-sample`, 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr').filter(`:contains(templateless_PCR-sample)`).first().within( () => {
      cy.get('button').click();
    });
    cy.get('[data-testid="sequence-header"]').contains('templateless_PCR').should('exist');
    cy.get('button').contains('Delete sequence').click();
    cy.get('button').contains('Confirm delete').click();
    cy.dbAlertExists('Sequence deleted successfully');
    cy.closeDbAlerts();
    cy.setInputValue('UID', 'templateless_PCR-sample');
    cy.get('button').contains('Search').click();
    cy.get('tbody').should('not.contain', 'templateless_PCR-sample');

    // Check that correct constrtaints are applied for deletion:

    // Plasmid in line
    cy.clearInputValue('UID');
    cy.setInputValue('Name', 'pREX0008');
    cy.get('button').contains('Search').click();
    cy.get('tr button').contains('pREX0008').click();
    cy.get('[data-testid="delete-sequence-button"]').should('be.disabled');

    // Sequence with children
    cy.get('button').contains('Back to Sequences').click();
    cy.setInputValue('Name', 'digested_vector');
    cy.get('button').contains('Search').click();
    cy.get('tr button').contains('digested_vector').click();
    cy.get('[data-testid="delete-sequence-button"]').should('be.disabled');
  });
  it('can create template sequences', () => {
    cy.e2eLogin('/sequences', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('button').contains('Create Template Sequence').click();
    cy.get('[data-testid="create-template-sequence-dialog"] label').eq(1).siblings('div').first().click();
    cy.get('ul[aria-labelledby="sequence-type-label"] li').should('have.length', 2);
    cy.get('ul[aria-labelledby="sequence-type-label"] li').contains('Allele').click();
    cy.get('[data-testid="create-template-sequence-dialog"]').within(() => {
      cy.get('button').contains('Create').should('be.disabled');
      cy.get('input').first().type('new_template_sequence_allele', { delay: 0 });
      cy.get('button').contains('Create').should('be.enabled');
      cy.get('button').contains('Create').click();
    });
    cy.dbAlertExists('Template sequence created successfully');
    cy.closeDbAlerts();
    cy.get('tbody tr button').contains('new_template_sequence_allele').should('exist');
  });
});
