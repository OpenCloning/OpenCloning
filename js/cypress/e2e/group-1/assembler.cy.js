import { changeTab } from '../common_functions';
import { ZipReader, BlobReader } from '@zip.js/zip.js';

describe('Test assembler functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('Can open assembler tab and load MoClo assembly', () => {
    // Navigate to the Assembler tab
    changeTab('Assembler');
    
    // Verify the assembler tab is visible by checking for the warning alert and Load Syntax button
    cy.get('.MuiAlert-root').contains('The Assembler is experimental').should('be.visible');
    cy.get('button').contains('Load Syntax').should('be.visible');
    
    // Click on Load Syntax button
    cy.get('button').contains('Load Syntax').click();
    
    // Wait for the dialog to open and load syntaxes
    cy.get('div[role="dialog"]', { timeout: 10000 }).should('be.visible');
    cy.get('div[role="dialog"]').contains('Load an existing syntax').should('be.visible');
    
    // Wait for syntaxes to load and find MoClo syntax
    cy.get('div[role="dialog"] li', { timeout: 10000 }).should('have.length.greaterThan', 0);
    cy.get('div[role="dialog"] li').contains('MoClo YTK', { matchCase: false }).should('exist');
    
    // Click on the MoClo syntax
    cy.get('div[role="dialog"] li').contains('MoClo YTK', { matchCase: false }).click();
    
    // Wait for the syntax to load (dialog should close and assembler component should appear)
    cy.get('div[role="dialog"]').should('not.exist');
    
    // Verify that the assembler component is now visible with the loaded syntax
    // After loading syntax, the "Load Plasmids" button should appear
    cy.get('button').contains('Load Plasmids', { timeout: 10000 }).should('be.visible');
    // Verify the assembler component is rendered by checking for the Category select
    cy.get('label').contains('Category', { timeout: 10000 }).should('be.visible');


    cy.get('[data-testid="plasmid-select"]').last().click();
    cy.get('li[role="option"]').first().click();
    cy.get('[data-testid="plasmid-select"]').last().click();
    cy.get('li[role="option"]').eq(1).click();

    // Select the next category and one or two plasmids for each category
    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains('AACG').click();
    cy.get('[data-testid="plasmid-select"]').last().click();
    cy.get('li[role="option"]').first().click();
    // cy.get('[data-testid="plasmid-select"]').last().click();
    // cy.get('li[role="option"]').eq(1).click();

    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains('5').click();
    cy.get('[data-testid="plasmid-select"]').last().click();
    cy.get('li[role="option"]').first().click();
    // cy.get('[data-testid="plasmid-select"]').last().click();
    // cy.get('li[role="option"]').eq(1).click();

    cy.get('[data-testid="assembler-submit-button"]').should('not.exist');

    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains('TACA-CCCT').click();
    cy.get('[data-testid="plasmid-select"]').last().click();
    cy.get('li[role="option"]').first().click();
    // cy.get('[data-testid="plasmid-select"]').last().click();
    // cy.get('li[role="option"]').eq(1).click();

    cy.get('[data-testid="assembler-submit-button"]').click();

    cy.get('[data-testid="assembler-product-table"]', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="assembler-product-table-view-button"]').should('have.length', 2);

    // Change name of the second assembly
    cy.get('[data-testid="assembler-product-table-edit-button"]').last().click();
    cy.get('[role="dialog"]').find('input').clear();
    cy.get('[role="dialog"]').find('input').type('new_name');
    cy.get('[role="dialog"]').contains('Save').click();
    cy.get('[data-testid="assembler-download-assemblies-button"]').click();

    cy.readFile(`cypress/downloads/assemblies.zip`, null)
      .then((fileContent) => {
        const blob = new Blob([fileContent], { type: 'application/zip' });
        const zipReader = new ZipReader(new BlobReader(blob));
        cy.wrap(
          zipReader.getEntries()
            .then((entries) => {
              const filenames = entries.map((entry) => entry.filename);
              expect(filenames[0]).to.equal('assemblies.tsv');
              expect(filenames[1]).to.equal('assemblies.csv');
              expect(filenames[2]).to.equal('001_pYTK002_(ConS)+pYTK048_(Spacer)+pYTK067_(Con1)+pYTK095_(AmpR).json');
              expect(filenames[3]).to.equal('001_pYTK002_(ConS)+pYTK048_(Spacer)+pYTK067_(Con1)+pYTK095_(AmpR).gbk');
              expect(filenames[4]).to.equal('new_name.json');
              expect(filenames[5]).to.equal('new_name.gbk');
              expect(filenames.length).to.equal(6);
            })
            .finally(() => zipReader.close()),
        )});

    // cy.get('[data-testid="category-select"]').last().click();
    cy.get('[data-testid="assembler-product-table-view-button"]').first().click();

    // Should be in cloning tab
    cy.get('button.MuiTab-root.Mui-selected').contains('Cloning').should('exist');
    cy.get('li#sequence-5').contains('2278 bps');

    changeTab('Assembler');

    // Removing plasmids should not give an error and instead should clear all assemblies
    cy.get('button').contains('Remove uploaded plasmids').click();
    cy.get('[data-testid="assembler-submit-button"]').should('not.exist');
    cy.get('[data-testid="assembler-product-table"]').should('not.exist');

    // Should show the default first two categories now that there is no uploaded plasmids
    cy.get('[data-testid="category-select"]').contains('Assembly connector').should('be.visible');
    cy.get('[data-testid="category-select"]').contains('Promoter').should('not.exist');

  });
  it('Correctly applies constraints and auto-fills', () => {
    changeTab('Assembler');
    // Load MoClo syntax
    cy.get('button').contains('Load Syntax').click();
    cy.get('div[role="dialog"]').contains('Load an existing syntax').should('be.visible');
    cy.get('div[role="dialog"] li').contains('MoClo YTK', { matchCase: false }).click();
    cy.get('div[role="dialog"]').should('not.exist');

    // Remove plasmids
    cy.get('button').contains('Remove uploaded plasmids').click();
    
    // Select Promoter
    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains('Promoter').click();

    // Select N-term
    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains('N-term').click();

    // Category 3b should have been auto-filled
    cy.get('[data-testid="category-select"]').contains('3b').should('be.visible');

    // Select 4, 5, 6
    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains('4 (Terminator)').click();

    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains('5').click();

    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains('6').click();

    // Category 7 should have been auto-filled
    cy.get('[data-testid="category-select"]').contains('Yeast plasmid').should('exist');

    // Can only remove the ones with multiple options
    cy.get('[data-testid="category-select"] input').eq(0).should('be.disabled');
    cy.get('[data-testid="category-select"] input').eq(1).should('be.disabled');

    // Removing it removes previous options
    cy.get('[data-testid="category-select"] [data-testid="ClearIcon"]').first().click( { force: true } );
    cy.get('[data-testid="category-select"]').should('have.length', 2);
  })

  it('displays error message when syntax is invalid', () => {
    changeTab('Assembler');

    cy.intercept('POST', '**/validate_syntax', {
      statusCode: 500,
      body: { error: 'Invalid syntax' },
    }).as('validateSyntaxError');

    const dummyFile  = {
      contents: Cypress.Buffer.from(JSON.stringify({a: 'b'})),
      fileName: 'moclo_syntax.json',
      mimeType: 'text/plain',
      lastModified: Date.now(),
    }
    cy.get('button').contains('Load Syntax').click();
    cy.get('[role="dialog"] input[type="file"]').selectFile(dummyFile, { force: true });
    cy.wait('@validateSyntaxError');

  });

  it('displays syntax overview correctly and can switch between detailed and compact mode', () => {
    changeTab('Assembler');
    cy.get('button').contains('Load Syntax').click();
    cy.get('div[role="dialog"]').contains('Load an existing syntax').should('be.visible');
    cy.get('div[role="dialog"] li').contains('MoClo YTK', { matchCase: false }).click();

    cy.get('[data-testid="assembler-syntax-overview-button"]').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[role="dialog"]').contains('Yeast marker').should('exist');
    cy.get('label').contains('Detailed').click();
    cy.get('[role="dialog"]').contains('Yeast marker').should('not.exist');
    cy.get('label').contains('Compact').should('be.visible');

  });
});
