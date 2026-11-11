import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { setInputValue, deleteSourceByContent, loadExample, closeAlerts } from '../common_functions';

describe('Test download history file', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Can download the json, svg files', () => {
    loadExample('Integration of cassette by homologous recombination');
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').click();
    cy.get('[role="menuitem"]').contains('Save cloning history to file').click();
    cy.get('button').contains('Save file').click();

    // Wait for and verify the JSON file
    cy.readFile('cypress/downloads/cloning_strategy.json').then((fileContent) => {
      expect(fileContent).to.have.property('sequences');
      expect(fileContent).to.have.property('sources');
      expect(fileContent).to.have.property('primers');
      expect(fileContent).to.have.property('description');
      expect(fileContent).to.have.property('backend_version');
      expect(fileContent).to.have.property('schema_version');
      expect(fileContent).to.have.property('frontend_version');
      expect(fileContent).to.not.have.property('files');
    });

    // Print cloning history to svg (works from another tab)
    cy.get('button.MuiTab-root').contains('Primers').click();
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').click();
    cy.get('[role="menuitem"]').contains('Print cloning history').click();

    // Wait for and verify the SVG file
    cy.readFile('cypress/downloads/history.svg').then((fileContent) => {
      expect(fileContent).to.include('PCR with primers fwd and rvs');
    });
  });
  it('Can download zip files', () => {
    // Load the zip example
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').siblings('input').selectFile('apps/opencloning/public/examples/cloning_strategy_with_sequencing.zip', { force: true });
    cy.contains('Read from file final_product.gb', { timeout: 20000 }).should('exist');
    // Alerts can cover the app bar
    cy.get('body').then(($body) => {
      if ($body.find('div#global-error-message-wrapper .MuiAlert-message').length > 0) {
        closeAlerts();
      }
    });
    cy.get('div.cloning-tab-pannel').contains('final_product.gb', { timeout: 20000 });
    // Download the zip file
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').click();
    cy.get('[role="menuitem"]').contains('Save cloning history to file').click();
    // Download the json file and check that it does not contain files
    cy.get('button').contains('Save file').click();
    cy.task('readFileMaybe', 'cypress/downloads/cloning_strategy.json').then((fileContent) => {
      expect(fileContent).to.include('"sequences":');
      expect(fileContent).to.include('"sources":');
      expect(fileContent).to.include('"primers":');
      expect(fileContent).to.include('"description":');
      expect(fileContent).to.include('"backend_version":');
      expect(fileContent).to.include('"schema_version":');
      expect(fileContent).to.include('"frontend_version":');
      expect(fileContent).to.not.include('"files":');
    });
    // Change the name of the file and download as zip
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').click();
    cy.get('[role="menuitem"]').contains('Save cloning history to file').click();
    setInputValue('File name', 'cloning_strategy_with_sequencing', '.download-cloning-strategy-dialog');
    cy.get('.download-cloning-strategy-dialog span').contains('zip').click({ force: true });
    cy.get('button').contains('Save file').click();

    // Wait for the download to complete and verify zip contents
    cy.readFile('cypress/downloads/cloning_strategy_with_sequencing.zip', null)
      .then((fileContent) => {
        const blob = new Blob([fileContent], { type: 'application/zip' });
        const zipReader = new ZipReader(new BlobReader(blob));

        cy.wrap(
          zipReader.getEntries()
            .then((entries) => {
              const filenames = entries.map((entry) => entry.filename);
              expect(filenames).to.include('cloning_strategy.json');
              expect(filenames).to.include('verification-1-BZO902_13409020_13409020.ab1');
              expect(filenames).to.include('verification-1-BZO903_13409037_13409037.ab1');
              expect(filenames).to.include('verification-1-BZO904_13409044_13409044.ab1');

              // Get and parse the JSON file content
              const jsonEntry = entries.find((entry) => entry.filename === 'cloning_strategy.json');
              jsonEntry.getData(new TextWriter()).then((jsonContent) => {
                const parsedJson = JSON.parse(jsonContent);
                expect(parsedJson).to.have.property('files');
                expect(parsedJson.files).to.have.length(3);
                const fileNames = parsedJson.files.map((f) => f.file_name);
                expect(fileNames).to.include('BZO902_13409020_13409020.ab1');
                expect(fileNames).to.include('BZO903_13409037_13409037.ab1');
                expect(fileNames).to.include('BZO904_13409044_13409044.ab1');
              });
            })
            .finally(() => zipReader.close()),
        );
      });
    // The file can be loaded
    deleteSourceByContent('final_product.gb');
    cy.get('div.cloning-tab-pannel').contains('final_product.gb').should('not.exist');
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').siblings('input').selectFile('cypress/downloads/cloning_strategy_with_sequencing.zip', { force: true });
    cy.get('div.cloning-tab-pannel').contains('final_product.gb', { timeout: 20000 });
  });
});
