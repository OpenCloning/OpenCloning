import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { setInputValue } from '../common_functions';

describe('Test download sequence file', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Can download the file', () => {
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('Examples').click();
    cy.get('li span').contains('Integration of cassette by homologous recombination').click();
    cy.get('li#sequence-1 svg[data-testid="DownloadIcon"]', { timeOut: 20000 }).click();
    // Can only download zip if the sequence has associated verification files
    cy.get('label').contains('json').should('exist');
    cy.get('label').contains('zip').should('not.exist');
    setInputValue('File name', 'example', '.MuiDialogContent-root');
    // Download file as gb
    cy.get('.MuiDialogActions-root button').contains('Save file').click();
    cy.task('readFileMaybe', 'cypress/downloads/example.gb').then((fileContent) => {
      expect(fileContent).to.include('LOCUS       pFA6a-5FLAG-hphMX6');
      expect(fileContent).to.include('4531 bp');
      // The primers are included in the file
      expect(fileContent).to.include('/label="fwd"');
      expect(fileContent).to.include('/label="rvs"');
    });
    // Also the PCR product contains primers
    cy.get('li#sequence-2 svg[data-testid="DownloadIcon"]').first().click();
    setInputValue('File name', 'example2', '.MuiDialogContent-root');
    // Download file as gb
    cy.get('.MuiDialogActions-root button').contains('Save file').click();
    cy.task('readFileMaybe', 'cypress/downloads/example2.gb').then((fileContent) => {
      expect(fileContent).to.include('LOCUS       pcr_product');
      expect(fileContent).to.include('2233 bp');
      // The primers are included in the file
      expect(fileContent).to.include('/label="fwd"');
      expect(fileContent).to.include('/label="rvs"');
    });

    // Download file as fasta
    cy.get('li#sequence-1 svg[data-testid="DownloadIcon"]').click();
    setInputValue('File name', 'example', '.MuiDialogContent-root');
    cy.get('.MuiDialogContent-root span').contains('fasta').click();
    cy.get('.MuiDialogActions-root button').contains('Save file').click();
    cy.task('readFileMaybe', 'cypress/downloads/example.fasta').then((fileContent) => {
      expect(fileContent).to.include('>pFA6a-5FLAG-hphMX6');
    });
    // Donwload history as json
    cy.get('li#sequence-2 svg[data-testid="DownloadIcon"]').first().click();
    setInputValue('File name', 'example', '.MuiDialogContent-root');
    cy.get('.MuiDialogContent-root span').contains('json').click();
    cy.get('.MuiDialogActions-root button').contains('Save file').click();
    cy.task('readFileMaybe', 'cypress/downloads/example.json').then((fileContent) => {
      expect(fileContent).to.include('"sequences":');
      expect(fileContent).to.include('"sources":');
      expect(fileContent).to.include('"primers":');
      expect(fileContent).to.include('"description":');
      expect(fileContent).to.include('"backend_version":');
      expect(fileContent).to.include('"schema_version":');
      expect(fileContent).to.include('"frontend_version":');
      // Sources
      expect(fileContent).to.include('"type": "AddgeneIdSource"');
      expect(fileContent).to.include('"type": "PCRSource"');
      expect(fileContent).to.not.include('"type": "GenomeCoordinatesSource"');
      expect(fileContent).to.not.include('"type": "HomologousRecombinationSource"');
      // Sequences
      expect(fileContent).to.include('pFA6a-5FLAG-hphMX6');
      expect(fileContent).to.include('pcr_product');
      expect(fileContent).to.not.include('modified_locus');
      expect(fileContent).to.not.include('CU329670');
      // Primers
      expect(fileContent).to.include('"name": "fwd"');
      expect(fileContent).to.include('"name": "rvs"');
    });
  });
  it('Can download the file as zip', () => {
    cy.get('div.cloning-history').selectFile('cypress/test_files/sequencing/3seqs_with_sequencing.zip', { action: 'drag-drop' });

    const expectedFileContents = {
      2: ['verification-2-seq2.fasta', 'verification-2-seq2_2.fasta'],
      3: ['verification-2-seq2.fasta', 'verification-3-seq3.fasta', 'verification-2-seq2_2.fasta'],
      4: ['verification-4-seq4.fasta'],
    }
    for (const sequenceId of [2, 3, 4]) {
      cy.get(`li#sequence-${sequenceId} svg[data-testid="DownloadIcon"]`).first().click();
      setInputValue('File name', `seq-with-files`, '.MuiDialogContent-root');
      cy.get('.MuiDialogContent-root span').contains('zip').click();
      cy.get('.MuiDialogActions-root button').contains('Save file').click();

      cy.readFile(`cypress/downloads/seq-with-files.zip`, null)
        .then((fileContent) => {
          const blob = new Blob([fileContent], { type: 'application/zip' });
          const zipReader = new ZipReader(new BlobReader(blob));
        cy.wrap(
          zipReader.getEntries()
            .then((entries) => {
              const filenames = entries.map((entry) => entry.filename);
              expect(new Set(filenames.slice(1))).to.deep.equal(new Set(expectedFileContents[sequenceId]));
            })
            .finally(() => zipReader.close()),
        );
      });
    }
    // You can download as zip, even if only the parents have verification files
    cy.get('li#sequence-3 svg[data-testid="RuleIcon"]').first().click();
    cy.get('.verification-file-dialog svg[data-testid="DeleteIcon"]').click({ force: true });
    // Click outside
    cy.get('body').click('topLeft');
    cy.get('li#sequence-3 svg[data-testid="DownloadIcon"]').first().click();
    cy.get('label').contains('zip').should('exist');
  });

});
