import { loadExample, addPrimer, changeTab, setInputValue } from '../common_functions';

describe('Tests primer functionality', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('button.MuiTab-root').contains('Primers').click();
  });
  it('Can add and delete primers', () => {
    // Add dummy primer
    addPrimer('fwd', 'atg');
    changeTab('Primers');
    cy.get('.primer-table-container tr').contains('fwd').should('exist');
    cy.get('form.primer-row').should('not.exist');
    cy.get('.primer-form-container').contains('Add Primer').should('exist');
    cy.get('.primer-table-container tr').contains('fwd').should('exist');
    cy.get('.primer-table-container tr').contains('atg').should('exist');
    cy.get('.primer-table-container [data-testid="DeleteIcon"]').click();
    cy.get('.primer-table-container [data-testid="DeleteIcon"]').should('not.exist');
  });
  it('Cannot delete primers in use', () => {
    [
      'Integration of cassette by homologous recombination',
      'Templateless PCR',
      'CRISPR HDR',
    ].forEach((example) => {
      cy.get('button.MuiTab-root').contains('Cloning').click();
      loadExample(example);
      cy.get('button.MuiTab-root').contains('Primers').click();
      // Hover over the delete icon
      cy.get('.primer-table-container [data-testid="DeleteIcon"]').first().trigger('mouseover');
      cy.get('.MuiTooltip-tooltip').contains('Cannot delete primer in use');
      cy.get('.primer-table-container [data-testid="DeleteIcon"]').first().trigger('mouseout');

      cy.get('.primer-table-container [data-testid="DeleteIcon"]').eq(1).trigger('mouseover');
      cy.get('.MuiTooltip-tooltip').contains('Cannot delete primer in use');
      cy.get('.primer-table-container [data-testid="DeleteIcon"]').eq(1).trigger('mouseout');

      if (example === 'CRISPR HDR') {
        cy.get('.primer-table-container [data-testid="DeleteIcon"]').eq(2).trigger('mouseover');
        cy.get('.MuiTooltip-tooltip').contains('Cannot delete primer in use');
        cy.get('.primer-table-container [data-testid="DeleteIcon"]').eq(2).trigger('mouseout');
      }

      cy.get('.primer-table-container [data-testid="DeleteIcon"]').first().click();
      cy.get('.primer-table-container [data-testid="DeleteIcon"]').eq(1).click();
      if (example === 'CRISPR HDR') {
        cy.get('.primer-table-container [data-testid="DeleteIcon"]').eq(2).click();
      }
      cy.get('.primer-table-container td.name').contains('fwd').should('exist');
      cy.get('.primer-table-container td.name').contains('rvs').should('exist');
      if (example === 'CRISPR HDR') {
        cy.get('.primer-table-container td.name').contains('sgRNA').should('exist');
      }
    });
  });

  // it('removes spaces on paste', () => {
  //   cy.get('.primer-form-container').contains('Add Primer').click();
  //   cy.get('form.primer-row').should('exist');
  //   // TODO: Implement paste command
  // });
  it('Can close add form', () => {
    // Add two dummy primers
    cy.get('.primer-form-container').contains('Add Primer').click();
    cy.get('form.primer-row').should('exist');
    cy.get('.primer-form-container [data-testid="CancelIcon"').click();
    cy.get('form.primer-row').should('not.exist');
    cy.get('.primer-form-container').contains('Add Primer').click();
    // Type something and close
    cy.get('form.primer-row input#name').type('fwd-2');
    cy.get('form.primer-row input#sequence').type('atg');
    cy.get('.primer-form-container [data-testid="CancelIcon"').click();
    cy.get('form.primer-row').should('not.exist');
  });
  it('Can edit primers', () => {
    addPrimer('fwd', 'gatctcgccataaaagacag');
    changeTab('Primers');
    cy.get('.primer-table-container tr').contains('fwd').should('exist');
    cy.get('.primer-table-container [data-testid="EditIcon"]').first().click();
    // The edited primer is not shown in the table
    cy.get('.primer-table-container tr').contains('fwd').should('not.exist');
    cy.get('form.primer-row').should('exist');
    cy.get('form.primer-row input#name').should('have.value', 'fwd');
    cy.get('form.primer-row input#sequence').should('have.value', 'gatctcgccataaaagacag');
    cy.get('form.primer-row input#name').clear();
    cy.get('form.primer-row input#name').type('blah');
    cy.get('form.primer-row input#sequence').clear();
    cy.get('form.primer-row input#sequence').type('gggggggggggg');
    cy.get('form.primer-row [data-testid="CheckCircleIcon"]').click();
    cy.get('form.primer-row').should('not.exist');
    cy.get('.primer-form-container').contains('Add Primer').should('exist');
    cy.get('.primer-table-container tr').contains('blah').should('exist');
    cy.get('.primer-table-container tr').contains('gggggggggggg').should('exist');
    cy.get('.primer-table-container tr').contains('fwd').should('not.exist');
    cy.get('.primer-table-container tr').contains('gatctcgccataaaagacag').should('not.exist');
  });
  it('Applies contrains to edit used primer', () => {
    const formNotSubmittable = () => {
      cy.get('form.primer-row [data-testid="CheckCircleIcon"]').should('have.class', 'form-invalid');
      cy.get('form.primer-row [data-testid="CheckCircleIcon"]').click();
      cy.get('form.primer-row').should('exist');
    };
    loadExample('Integration of cassette by homologous recombination');
    changeTab('Primers');
    cy.get('.primer-table-container [data-testid="EditIcon"]').first().click();

    // Sequence is not editable
    cy.get('form.primer-row .MuiFormHelperText-root').contains('Cannot edit sequence in use');
    cy.get('form.primer-row input#sequence[disabled]').should('exist');

    cy.get('.primer-table-container [data-testid="EditIcon"]').first().click();
    // The submit button is not shown until something is typed
    cy.get('form.primer-row [data-testid="CheckCircleIcon"]').should('not.exist');
    // Cannot be empty
    cy.get('form.primer-row input#name').clear();
    formNotSubmittable();
    cy.get('form.primer-row .MuiFormHelperText-root').contains('Field required');
    // Type existing name
    cy.get('form.primer-row input#name').type('fwd');
    cy.get('form.primer-row .MuiFormHelperText-root').contains('Name exists');
    formNotSubmittable();
    // Revert to original name
    cy.get('form.primer-row input#name').clear('');
    cy.get('form.primer-row input#name').type('rvs');
    cy.get('form.primer-row .MuiFormHelperText-root').contains('Name exists').should('not.exist');
  });
  it('Can change name of  used primer', () => {
    loadExample('Integration of cassette by homologous recombination');
    changeTab('Primers');
    cy.get('.primer-table-container [data-testid="EditIcon"]').first().click();
    cy.get('form.primer-row input#name').clear();
    cy.get('form.primer-row input#name').type('blah');
    cy.get('form.primer-row [data-testid="CheckCircleIcon"]').click();
    cy.get('form.primer-row').should('not.exist');
    cy.get('.primer-table-container tr').contains('blah').should('exist');
    cy.get('.primer-table-container tr').contains('fwd').should('not.exist');
    cy.get('.primer-table-container tr').contains('AGTTTTCATATCTTCCTTTATATTCTATTAATTGAATTTCAAACATCGTTTTATTGAGCTCATTTACATCAACCGGTTCACGGATCCCCGGGTTAATTAA').should('exist');
  });
  it('Applies contrains to edit unused primer', () => {
    const formNotSubmittable = () => {
      cy.get('form.primer-row [data-testid="CheckCircleIcon"]').should('have.class', 'form-invalid');
      cy.get('form.primer-row [data-testid="CheckCircleIcon"]').click();
      cy.get('form.primer-row').should('exist');
    };

    addPrimer('fwd', 'atg');
    addPrimer('rvs', 'cgt');
    changeTab('Primers');
    cy.get('.primer-table-container [data-testid="EditIcon"]').first().click();
    // The submit button is not shown until something is typed
    cy.get('form.primer-row [data-testid="CheckCircleIcon"]').should('not.exist');
    // Cannot be empty
    cy.get('form.primer-row input#name').clear();
    formNotSubmittable();
    cy.get('form.primer-row .MuiFormHelperText-root').contains('Field required');
    // Type existing name
    cy.get('form.primer-row input#name').type('rvs');
    cy.get('form.primer-row .MuiFormHelperText-root').contains('Name exists');
    formNotSubmittable();
    // Revert to original name
    cy.get('form.primer-row input#name').clear('');
    cy.get('form.primer-row input#name').type('fwd');
    // Invalid sequences not accepted
    cy.get('form.primer-row input#sequence').clear();
    cy.get('form.primer-row input#sequence').type('ss');
    cy.get('form.primer-row .MuiFormHelperText-root').contains('Invalid DNA sequence');
    formNotSubmittable();
    cy.get('form.primer-row input#sequence').clear('');
    cy.get('form.primer-row input#sequence').type('ATGC');
    cy.get('form.primer-row .MuiFormHelperText-root').should('have.text', '');
  });
  it('Applies constrains to new primer', () => {
    addPrimer('fwd', 'atg');
    addPrimer('rvs', 'cgt');
    changeTab('Primers');
    // Useful to check the form is not submitted
    const formNotSubmittable = () => {
      cy.get('form.primer-row [data-testid="CheckCircleIcon"]').should('have.class', 'form-invalid');
      cy.get('form.primer-row [data-testid="CheckCircleIcon"]').click();
      cy.get('form.primer-row').should('exist');
    };

    cy.get('form.primer-row').should('not.exist');
    cy.get('.primer-form-container').contains('Add Primer').click();
    // The button is no longer shown after clicking
    cy.get('.primer-form-container').contains('Add Primer').should('not.exist');
    // The form is shown, but can't be submitted yet
    cy.get('form.primer-row').should('exist');
    // Should have empty helper text
    cy.get('form.primer-row .MuiFormHelperText-root').should('have.text', '');
    // The submit button is not shown until something is typed
    cy.get('form.primer-row [data-testid="CheckCircleIcon"]').should('not.exist');

    // Type existing name
    cy.get('form.primer-row input#name').type('fwd');
    cy.get('form.primer-row .MuiFormHelperText-root#name-helper-text').contains('Name exists');
    formNotSubmittable();
    cy.get('form.primer-row input#name').clear('');
    cy.get('form.primer-row .MuiFormHelperText-root#name-helper-text').should('have.text', 'Field required');
    cy.get('form.primer-row input#name').type('fwd-2');
    cy.get('form.primer-row .MuiFormHelperText-root#name-helper-text').should('have.text', '');
    formNotSubmittable();

    // Type non-DNA sequence
    cy.get('form.primer-row input#sequence').type('yy');
    cy.get('form.primer-row .MuiFormHelperText-root#sequence-helper-text').contains('Invalid DNA sequence');
    formNotSubmittable();
    cy.get('form.primer-row input#sequence').clear('');
    cy.get('form.primer-row .MuiFormHelperText-root#sequence-helper-text').should('have.text', 'Field required');
    cy.get('form.primer-row input#sequence').type('atg');
    cy.get('form.primer-row .MuiFormHelperText-root#sequence-helper-text').should('have.text', '');
    cy.get('form.primer-row [data-testid="CheckCircleIcon"]').should('not.have.class', 'form-invalid');
    cy.get('form.primer-row [data-testid="CheckCircleIcon"]').click();
    cy.get('form.primer-row').should('not.exist');
  });
  it('Edit overrides add', () => {
    addPrimer('fwd', 'gatctcgccataaaagacag');
    changeTab('Primers');
    cy.get('.primer-form-container').contains('Add Primer').click();
    cy.get('form.primer-row').should('exist');
    // Type something
    cy.get('form.primer-row input#name').type('fwd-2');
    cy.get('form.primer-row input#sequence').type('atg');
    // Click on edit
    cy.get('.primer-table-container [data-testid="EditIcon"]').first().click();
    cy.get('form.primer-row input#name').should('not.have.value', 'fwd-2');
    cy.get('.primer-form-container [data-testid="CancelIcon"').click();
    cy.get('form.primer-row').should('not.exist');
    cy.get('.primer-form-container').contains('Add Primer');
    cy.get('.primer-table-container tr').contains('fwd').should('exist');
    cy.get('.primer-table-container tr').contains('gatctcgccataaaagacag').should('exist');
  });
  it('Can import primers from tsv or csv file', () => {
    cy.get('.primer-form-container').contains('Import from file').click();
    // This one has a trailing empty line
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/valid.tsv', { force: true });
    // There should be a table with the primers displayed
    cy.get('.import-primers-modal-content').should('exist');
    cy.get('.import-primers-modal-content tbody tr').should('have.length', 2);
    cy.get('.import-primers-modal-content [data-testid="CheckCircleIcon"]').should('have.length', 2);
    cy.get('.import-primers-modal-content tbody tr').eq(0).contains('oligo1');
    cy.get('.import-primers-modal-content tbody tr').eq(0).contains('cagctagctac');
    cy.get('.import-primers-modal-content tbody tr').eq(1).contains('oligo2');
    cy.get('.import-primers-modal-content tbody tr').eq(1).contains('cggttagct');
    cy.get('.import-primers-modal-content button').contains('Cancel').click();
    // Should work with semicolon delimiter
    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/semicolon.csv', { force: true });
    cy.get('.import-primers-modal-content tbody tr').should('have.length', 2);
    cy.get('.import-primers-modal-content [data-testid="CheckCircleIcon"]').should('have.length', 2);
    cy.get('.import-primers-modal-content tbody tr').eq(0).contains('oligo3');
    cy.get('.import-primers-modal-content tbody tr').eq(0).contains('cagctagctac');
    cy.get('.import-primers-modal-content tbody tr').eq(1).contains('oligo4');
    cy.get('.import-primers-modal-content tbody tr').eq(1).contains('cggttagct');
    // Clicking on Cancel should close the modal and primers should not be added
    cy.get('.import-primers-modal-content .MuiButtonBase-root').contains('Cancel').click();
    cy.get('.import-primers-modal-content').should('not.exist');
    cy.get('.primer-table-container tr').contains('oligo1').should('not.exist');
    cy.get('.primer-table-container tr').contains('oligo2').should('not.exist');
    // Import them
    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/valid.tsv', { force: true });
    cy.get('.import-primers-modal-content button').contains('Import').click();
    cy.get('.primer-table-container tr').contains('oligo1').should('exist');
    cy.get('.primer-table-container tr').contains('oligo2').should('exist');

    // Import wrong file should show error
    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/wrong_extension.txt', { force: true });
    cy.get('#global-error-message-wrapper').contains('File must be a .csv or .tsv file').should('exist');
    // Close the error
    cy.get('#global-error-message-wrapper button').click();

    // Error if file contains both delimiters
    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/both_delimiters.csv', { force: true });
    cy.get('#global-error-message-wrapper').contains('File must contain only one delimiter, either comma or semicolon').should('exist');
    cy.get('#global-error-message-wrapper button').click();

    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/wrong_format.tsv', { force: true });
    cy.get('#global-error-message-wrapper').contains('All lines should have').should('exist');
    cy.get('#global-error-message-wrapper button').click();

    // Error if file is empty
    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/empty.tsv', { force: true });
    cy.get('#global-error-message-wrapper').contains('File is empty').should('exist');
    cy.get('#global-error-message-wrapper button').click();

    // Can import from file with inverted headers
    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/inverted_headers.tsv', { force: true });
    cy.get('.import-primers-modal-content tr').contains('oligo5').should('exist');
    cy.get('.import-primers-modal-content tr').contains('oligo6').should('exist');
    cy.get('.import-primers-modal-content button').contains('Import').click();
    cy.get('.primer-table-container tr').contains('oligo5').should('exist');
    cy.get('.primer-table-container tr').contains('oligo6').should('exist');

    // Importing the same ones again should have the add button disabled
    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/valid.tsv', { force: true });
    cy.get('.import-primers-modal-content [data-testid="WarningIcon"]').should('have.length', 2);
    cy.get('.import-primers-modal-content button').contains('Import').should('be.disabled');
    cy.get('.import-primers-modal-content button').contains('Cancel').click();

    // It's possible to load a valid and an invalid oligo in the same file
    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/valid_and_invalid.tsv', { force: true });
    cy.get('.import-primers-modal-content [data-testid="CheckCircleIcon"]').should('have.length', 1);
    cy.get('.import-primers-modal-content [data-testid="CancelIcon"]').should('have.length', 1);
    cy.get('.import-primers-modal-content button').contains('Import').click();
    cy.get('.primer-table-container tr').contains('good_oligo2').should('exist');

    // Should work with csv file
    cy.get('.primer-form-container').contains('Import from file').click();
    cy.get('.primer-form-container input').selectFile('cypress/test_files/import_oligos/valid.csv', { force: true });
    cy.get('.import-primers-modal-content').should('exist');
    cy.get('.import-primers-modal-content tbody tr').should('have.length', 2);
    cy.get('.import-primers-modal-content [data-testid="CheckCircleIcon"]').should('have.length', 2);
    cy.get('.import-primers-modal-content tbody tr').eq(0).contains('oligo3');
    cy.get('.import-primers-modal-content tbody tr').eq(0).contains('cagctagctac');
    cy.get('.import-primers-modal-content tbody tr').eq(1).contains('oligo4');
    cy.get('.import-primers-modal-content tbody tr').eq(1).contains('cggttagct');
    cy.get('.import-primers-modal-content button').contains('Import').click();
    cy.get('.primer-table-container tr').contains('oligo1').should('exist');
    cy.get('.primer-table-container tr').contains('oligo2').should('exist');
  });
  it('Can download primers', () => {
    loadExample('Templateless PCR');
    changeTab('Primers');
    cy.get('button').contains('Download Primers').click();
    setInputValue('File name', 'primers-test', '.MuiDialogContent-root');
    cy.get('.MuiDialogActions-root button').contains('Save file').click();
    cy.task('readFileMaybe', 'cypress/downloads/primers-test.csv').then((fileContent) => {
      // Check the downloaded file contains the correct primer information
      const lines = fileContent.split('\n');
      expect(lines[0]).to.contain('id,name,sequence');
      expect(lines[1]).to.contain('3,fwd_hyb,agaactcaaccattacgggtttgacgaatatagacgagattcgcaattacttgtctgatggattaccaagatgatgggct');
      expect(lines[2]).to.contain('4,rvs_hyb,ttacgagatatttgagttaaacttcatgcataccctccaaaaactcaatcatttcaccaagcccatcatcttggtaatcc');
    });
    // Try the same with tsv
    cy.get('button').contains('Download Primers').click();
    setInputValue('File name', 'primers-test', '.MuiDialogContent-root');
    cy.get('.MuiDialogContent-root span').contains('tsv').click();
    cy.get('.MuiDialogActions-root button').contains('Save file').click();
    cy.task('readFileMaybe', 'cypress/downloads/primers-test.tsv').then((fileContent) => {
      const lines = fileContent.split('\n');
      expect(lines[0]).to.contain('id\tname\tsequence');
      expect(lines[1]).to.contain('3\tfwd_hyb\tagaactcaaccattacgggtttgacgaatatagacgagattcgcaattacttgtctgatggattaccaagatgatgggct');
      expect(lines[2]).to.contain('4\trvs_hyb\tttacgagatatttgagttaaacttcatgcataccctccaaaaactcaatcatttcaccaagcccatcatcttggtaatcc');
    });
  });
});
