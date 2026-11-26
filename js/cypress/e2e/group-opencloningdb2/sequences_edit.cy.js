import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import endpoints from '../../../packages/opencloningdb/src/endpoints';

const bulkSequenceFiles = [
  '68164.gb',
  '68165.gb',
  'hello.fasta',
  'pFA6a-3HA-kanMX6.fasta',
  'repeated_1.gb',
  'repeated_2.gb',
].map((file) => `cypress/test_files/bulk_sequence_submit/${file}`);

const SEQUENCING_RUN = 'cypress/test_files/bulk_sequencing_files/seed_sequencing_run';
// See the README.md of SEQUENCING_RUN
const SEQUENCING_RUN_SAMPLES = [
  'seqcheck_circular_1-sample', 'SEQCHECK_CIRCULAR_3-SAMPLE', 'seqcheck_circular_2-sample', 'colony_L2', 'TN9W63_1',
  'TN9W63_2', 'GB_105355_c1', 'GB_105355_c2', 'GB_105417_c1', 'empty_well',
];

/** { path in the zip: content } of the files of the fake sequencing run, as the provider zips them. */
function readSequencingRun() {
  const entries = {};
  SEQUENCING_RUN_SAMPLES.forEach((sample) => {
    ['final.fastq', 'stats'].forEach((extension) => {
      cy.readFile(`${SEQUENCING_RUN}/${sample}/${sample}.${extension}`).then((content) => {
        entries[`seed_sequencing_run/${sample}/${sample}.${extension}`] = content;
      });
    });
  });
  return cy.wrap(entries);
}

/** Select a zip with the given { path: content } in the zip input of "Link sequencing files". */
function selectZip(fileName, entries) {
  cy.wrap(null).then(async () => {
    const writer = new ZipWriter(new BlobWriter('application/zip'));
    for (const [path, content] of Object.entries(entries)) {
      await writer.add(path, new TextReader(content));
    }
    const blob = await writer.close();
    return Cypress.Buffer.from(await blob.arrayBuffer());
  }).then((contents) => {
    cy.get('[data-testid="bulk-link-sequencing-files-zip-input"]').selectFile({ contents, fileName }, { force: true });
  });
}

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
  it('can add and remove sequencing files of samples from the detail page', () => {
    const sequenceName = 'pREX0008';
    const sampleBlock = (uid) => cy.get('[data-testid="sample-block"]').filter(`:contains(${uid})`);
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.e2eLogin(`/sequences?name=pREX0008`, 'bootstrap+clerk_test@example.com', 'password');
    cy.wait('@getSequences').then(({ response }) => {
      const sequence = response.body.items.find((item) => item.name === sequenceName);
      cy.intercept('GET', Cypress.getDbURL(endpoints.sequenceSamples, '*')).as('getSamples');
      cy.get('tbody tr button').contains(sequenceName).click();
      cy.wait('@getSamples').then(({ request, response }) => {
        expect(request.url).to.contain(`sequence_id=${sequence.id}`);
        const sample = response.body.items.find((item) => item.uid === 'example_sequencing-sample');
        const sequencingFile = sample.sequencing_files[0];
        cy.intercept('DELETE', Cypress.getDbURL(endpoints.sequencingFile(sequencingFile.id))).as('deleteSequencingFile');
        sampleBlock(sample.uid).find('[data-testid="sequencing-file-row"]').filter(`:contains(${sequencingFile.original_name})`).within(() => {
          cy.get('[aria-label="Delete"]').click();
        });
        cy.wait('@deleteSequencingFile');
        cy.get('[data-testid="sequencing-file-row"]').contains(sequencingFile.original_name).should('not.exist');
        cy.dbAlertExists('Sequencing file deleted successfully');
        cy.closeDbAlerts();

        // Upload to the sample
        cy.intercept('POST', Cypress.getDbURL(endpoints.sequenceSampleSequencingFiles(sample.uid))).as('addSequencingFile');
        sampleBlock(sample.uid).find('input[type="file"]').selectFile('cypress/test_files/dummy_sequencing.fasta', { force: true });
        cy.wait('@addSequencingFile');
        cy.dbAlertExists('Sequencing files submitted successfully');
        cy.closeDbAlerts();
        sampleBlock(sample.uid).find('[data-testid="sequencing-file-row"]').contains('dummy_sequencing.fasta').should('exist');

        // A new sample, with a location
        cy.get('[aria-label="Add new UIDs"]').click();
        cy.get('[data-testid="create-sequence-sample-uid-dialog"]').within(() => {
          cy.get('label').contains('Sample UID 1').siblings('div').find('input').type('clone-2');
          cy.get('[data-testid="create-sample-location"]').type('box 7');
          cy.get('button').contains('Create').should('be.enabled').click();
        });
        cy.dbAlertExists('1 sample UID(s) created successfully');
        cy.closeDbAlerts();
        sampleBlock('clone-2').find('[data-testid="sample-block-location"]').should('contain', 'Location: box 7');
      });
    });
  });
  it('can add, edit, transfer and remove sample UIDs from the detail page', () => {
    const sequenceName = 'pREX0008';
    const sampleBlock = (uid) => cy.get('[data-testid="sample-block"]').filter(`:contains(${uid})`);
    cy.intercept('GET', Cypress.getDbURL(endpoints.sequences, '*')).as('getSequences');
    cy.e2eLogin(`/sequences?name=pREX0008`, 'bootstrap+clerk_test@example.com', 'password');
    cy.wait('@getSequences').then(({ response }) => {
      const sequence = response.body.items.find((item) => item.name === sequenceName);
      cy.get('tbody tr button').contains(sequenceName).click();
      cy.get('[data-testid="sequence-samples-section"]').contains('cre_lox_recombination-sample').should('not.exist');
      cy.get('[data-testid="sequence-samples-section"]').contains('example_sequencing-sample').should('exist');
      cy.intercept('POST', Cypress.getDbURL(endpoints.sequenceSampleReassign('cre_lox_recombination-sample'))).as('transferSample');
      cy.get('[aria-label="Transfer UID from another sequence"]').click();
      cy.setAutocompleteValue('Search UIDs', 'cre_lox_recombination-sample', 'body', false);
      cy.contains('Are you sure you want to transfer UID cre_lox_recombination-sample from sequence reconstituted_locus to this one').should('exist');
      cy.get('[data-testid="transfer-sample-dialog"]').contains('button', 'Confirm').click();
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
        cy.get('label').contains('Sample UID 1').siblings('div').find('input').type('new_sample_uid');
        cy.get('button').contains('Add another UID').click();
        cy.get('label').contains('Sample UID 2').siblings('div').find('input').type('new_sample_uid2');
        cy.get('button').contains('Create').should('be.enabled').click();
      });

      sampleBlock('new_sample_uid').should('exist');
      sampleBlock('new_sample_uid2').should('exist');
      cy.dbAlertExists('2 sample UID(s) created successfully');
      cy.closeDbAlerts();

      // Can rename it and set its location
      sampleBlock('new_sample_uid2').find('[aria-label="Edit UID and location"]').click();
      cy.get('[data-testid="edit-sample-dialog"]').within(() => {
        cy.get('label').contains('Sample UID').siblings('div').find('input').clear();
        cy.get('label').contains('Sample UID').siblings('div').find('input').type('renamed_uid');
        cy.get('[data-testid="edit-sample-location"]').type('-80 box 3');
        cy.get('button').contains('Save').should('be.enabled').click();
      });
      cy.dbAlertExists('Sample updated successfully');
      cy.closeDbAlerts();
      sampleBlock('renamed_uid').find('[data-testid="sample-block-location"]').should('contain', '-80 box 3');

      // Can delete it
      sampleBlock('renamed_uid').find('[aria-label="Delete sample"]').click();
      cy.get('button').contains(/^Delete$/).click();
      cy.dbAlertExists('UID renamed_uid deleted successfully');
      cy.closeDbAlerts();
      sampleBlock('new_sample_uid').should('exist');
      cy.get('[data-testid="sample-block-uid"]').contains('renamed_uid').should('not.exist');
    });
  });
  it('can move a sample to another sequence, with its sequencing files', () => {
    cy.e2eLogin('/sequences?name=pREX0008', 'bootstrap+clerk_test@example.com', 'password');
    cy.get('tbody tr button').contains('pREX0008').click();
    cy.get('[data-testid="sample-block"]').filter(':contains(example_sequencing-sample)').find('[aria-label="Move to another sequence"]').click();
    cy.get('[data-testid="transfer-sample-dialog"]').within(() => {
      cy.setAutocompleteValue('Sequence', 'pFA6a-5FLAG', 'div', false);
      cy.contains('to sequence pFA6a-5FLAG').should('exist');
      cy.contains('button', 'Confirm').click();
    });
    cy.dbAlertExists('UID transferred successfully');
    cy.closeDbAlerts();
    cy.get('[data-testid="sequence-samples-section"]').contains('example_sequencing-sample').should('not.exist');
    cy.visit('/sequences?name=pFA6a-5FLAG');
    cy.get('tbody tr button').contains('pFA6a-5FLAG').click();
    cy.get('[data-testid="sequence-header"]').contains('pFA6a-5FLAG').should('exist');
    cy.get('[data-testid="sample-block"]').filter(':contains(example_sequencing-sample)').find('[data-testid="sequencing-file-row"]').should('have.length.greaterThan', 0);
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
  it('can bulk link sequencing files', () => {
    const modal = '[data-testid="bulk-link-sequencing-files-modal"]';
    const submit = '[data-testid="bulk-link-sequencing-files-submit"]';
    const row = (sampleName) => cy.get(`[data-testid="bulk-link-row"][data-sample-name="${sampleName}"]`);
    const sampleInput = (sampleName) => row(sampleName).find('[data-testid="bulk-link-sample-select"] input');
    // The second text input of the row, after the sample
    const sequenceInput = (sampleName) => row(sampleName).find('input[type="text"]').eq(1);
    // Types over the selected sample, as a user would: clearing the field would unset the sample (and its sequence)
    const chooseSample = (sampleName, typed, option) => {
      sampleInput(sampleName).type(`{selectall}${typed}`);
      cy.get('li[role="option"]').contains(option).click();
    };
    const decodeBody = (body) => (typeof body === 'string' ? body : new TextDecoder().decode(body));
    cy.intercept('POST', Cypress.getDbURL(endpoints.sequencingFilesBulk)).as('bulkLinkSequencingFiles');
    cy.e2eLogin('/sequences?name=pREX0008', 'bootstrap+clerk_test@example.com', 'password');

    // A zip without .final.fastq files shows an error, and no modal
    selectZip('no_final_fastq.zip', { 'bulk_sample1.fastq': '@r\nACGT\n+\nIIII\n' });
    cy.dbAlertExists('No .final.fastq files found in no_final_fastq.zip');
    cy.closeDbAlerts();
    cy.get(modal).should('not.exist');

    // Only the .final.fastq files are read (not the .stats or the __MACOSX copies). The files whose sample name is
    // the UID of a sample (case-insensitive) go to that sample
    readSequencingRun().then((entries) => selectZip('seed_sequencing_run.zip', {
      ...entries,
      '__MACOSX/seed_sequencing_run/empty_well/._empty_well.final.fastq': 'not a fastq',
    }));
    cy.get('[data-testid="bulk-link-sequencing-files-count"]')
      .should('have.text', '10 .final.fastq files in seed_sequencing_run.zip (3 with an existing sample of the same name).');
    sampleInput('SEQCHECK_CIRCULAR_3-SAMPLE').should('have.value', 'seqcheck_circular_3-sample');
    row('SEQCHECK_CIRCULAR_3-SAMPLE').should('contain', 'seqcheck_circular_3').and('contain', 'Existing sample');
    row('seqcheck_circular_1-sample').should('contain', 'Existing sample');
    row('seqcheck_circular_2-sample').should('contain', 'Existing sample');
    row('GB_105355_c1').should('contain', 'Choose a sample');
    cy.get(submit).should('be.disabled').and('have.text', 'Link 10 files');

    // Find exact matches: the two reads of pJOG684 (no samples) become new samples of it. The exact read of
    // pREX0008 is not matched, as it already has samples
    cy.get(modal).contains('button', 'Find exact matches').click();
    cy.dbAlertExists('Matched 2 of 7 files without sample');
    cy.closeDbAlerts();
    ['GB_105355_c1', 'GB_105355_c2'].forEach((sampleName) => {
      sampleInput(sampleName).should('have.value', sampleName);
      sequenceInput(sampleName).should('have.value', 'pJOG684');
      row(sampleName).should('contain', 'New sample').and('contain', 'Matched by read');
    });
    row('TN9W63_1').should('contain', 'Choose a sample');

    // Files with other names go to an existing sample, two of them to the same one (flagged)
    chooseSample('TN9W63_1', 'example_seq', 'example_sequencing-sample · pREX0008');
    chooseSample('TN9W63_2', 'example_seq', 'example_sequencing-sample · pREX0008');
    row('TN9W63_1').should('contain', 'Also used for TN9W63_2');
    row('TN9W63_2').should('contain', 'Also used for TN9W63_1');
    chooseSample('colony_L2', 'seqcheck_linear_2', 'seqcheck_linear_2-sample · seqcheck_linear_2');

    // A new sample, with the sample name as UID by default, needs a sequence
    sampleInput('GB_105417_c1').click();
    cy.get('li[role="option"]').contains('Create sample "GB_105417_c1"').click();
    row('GB_105417_c1').should('contain', 'Choose a sequence');
    cy.get(submit).should('be.disabled');
    row('GB_105417_c1').within(() => cy.setAutocompleteValue('Sequence', 'pJOG173', 'div', false));
    row('GB_105417_c1').should('contain', 'New sample').and('not.contain', 'Matched by read');

    // Skip a file
    row('empty_well').find('input[type="checkbox"]').uncheck();
    row('empty_well').should('contain', 'Skipped');

    cy.get(submit).should('have.text', 'Link 9 files · create 3 samples').click();
    cy.wait('@bulkLinkSequencingFiles').then(({ request, response }) => {
      expect(request.headers['content-type']).to.include('multipart/form-data');
      const body = decodeBody(request.body);
      expect(body).to.not.include('empty_well');
      expect(body).to.not.include('sequence_names');
      expect(body.match(/name="files"/g)).to.have.length(9);
      ['TN9W63_1', 'TN9W63_2', 'GB_105355_c1', 'GB_105417_c1'].forEach((name) => {
        expect(body).to.include(`name="files"; filename="${name}.final.fastq"`);
      });
      ['example_sequencing-sample', 'seqcheck_circular_3-sample', 'GB_105355_c2', 'GB_105417_c1'].forEach((uid) => {
        expect(body).to.match(new RegExp(`name="sample_uids"\\r\\n\\r\\n${uid}\\r\\n`));
      });
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.deep.equal({ created: 9, created_samples: 3 });
    });
    cy.dbAlertExists('Linked 9 sequencing files successfully, 3 new samples');
    cy.closeDbAlerts();
    cy.get(modal).should('not.exist');

    // Opening the run again: the files already linked to their sample cannot be linked again, unless another sample
    // is chosen
    readSequencingRun().then((entries) => selectZip('seed_sequencing_run.zip', entries));
    cy.get('[data-testid="bulk-link-sequencing-files-count"]')
      .should('have.text', '10 .final.fastq files in seed_sequencing_run.zip (6 with an existing sample of the same name, 6 already linked).');
    ['seqcheck_circular_1-sample', 'GB_105355_c1', 'GB_105417_c1'].forEach((sampleName) => {
      row(sampleName).should('contain', 'Already linked');
      row(sampleName).find('input[type="checkbox"]').should('be.disabled').and('not.be.checked');
    });
    cy.get(submit).should('have.text', 'Link 4 files');
    chooseSample('GB_105355_c1', 'GB_105355_c2', 'GB_105355_c2 · pJOG684');
    row('GB_105355_c1').should('contain', 'Existing sample').and('not.contain', 'Already linked');
    row('GB_105355_c1').find('input[type="checkbox"]').should('be.enabled').and('be.checked');
    cy.get(submit).should('have.text', 'Link 5 files');
    // A new sample keeps the sequence of the previous one (shown with its samples)
    chooseSample('GB_105417_c1', 'GB_105417_c1-bis', 'Create sample "GB_105417_c1-bis"');
    sequenceInput('GB_105417_c1').should('have.value', 'pJOG173 (GB_105417_c1)');
    row('GB_105417_c1').should('contain', 'New sample').and('not.contain', 'Matched by read');
    cy.get(submit).should('have.text', 'Link 6 files · create 1 sample');
    cy.get(modal).contains('button', 'Cancel').click();
    cy.get(modal).should('not.exist');

    // The files are linked to the samples
    const sampleFiles = (uid) => cy.get('[data-testid="sample-block"]').filter(`:contains(${uid})`).find('[data-testid="sequencing-file-row"]');
    cy.get('tbody tr button').contains('pREX0008').click();
    sampleFiles('example_sequencing-sample').should('contain', 'TN9W63_1.final.fastq').and('contain', 'TN9W63_2.final.fastq');
    cy.visit('/sequences?name=pJOG684');
    cy.get('tbody tr button').contains('pJOG684').click();
    sampleFiles('GB_105355_c1').should('contain', 'GB_105355_c1.final.fastq');
    sampleFiles('GB_105355_c2').should('contain', 'GB_105355_c2.final.fastq');
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
    cy.dbAlertExists('Cannot connect to backend server');
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
