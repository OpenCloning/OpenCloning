import { changeTab } from '../common_functions';

// The workspace has sequences tagged "golden-braid". For the GoldenBraid Level 1 α syntax, the compatible ones are:
// backbone pDGB3_alpha2, promoter pJOG684, CDSs pJOG171, pJOG173 and pJOG351, terminator pUPD-ADH2t_(17-21).
// pDGB3_omega2R and pJOG587 are not compatible.
function loadGoldenBraidSyntax() {
  changeTab('Assembler');
  cy.get('button').contains('Load Syntax').click();
  cy.get('div[role="dialog"] li', { timeout: 20000 }).contains('GoldenBraid').click();
  cy.get('div[role="dialog"] li').contains('Level 1 α').click();
  cy.get('button').contains('Load Plasmids', { timeout: 20000 }).should('be.visible');
}

function loadPlasmidsByTag(tagName) {
  cy.get('[data-testid="load-plasmids-button"]').click();
  cy.get('[data-testid="load-plasmids-from-database"]').click();
  cy.get('[role="dialog"] input').first().click();
  cy.get('li[role="option"]').contains(tagName).click();
  // Click on the title to close the options popup (clicking the backdrop would close the dialog)
  cy.get('[role="dialog"] h2').click();
  cy.intercept('GET', '**/sequences/text_file_sequences*').as('getTextFiles');
  cy.get('[role="dialog"] button').contains('Load sequences').click();
  cy.wait('@getTextFiles');
}

// 1 promoter x 3 CDS x 1 terminator x 1 backbone, the plasmids must be loaded already
function runCombinatorialAssembly() {
  // Each plasmid-select is addressed by the position of its box, since the backbone box is added automatically
  const selectPlasmids = (boxIndex, plasmidNames) => {
    plasmidNames.forEach((name) => {
      cy.get('[data-testid="plasmid-select"]').eq(boxIndex).find('input').click();
      cy.get('li[role="option"]').contains(name).click();
    });
  };
  const selectCategory = (categoryName) => {
    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains(categoryName).click();
  };
  selectCategory("Prom + 5'UTR");
  selectPlasmids(0, ['pJOG684']);
  selectCategory('CDS (Includes STOP)');
  selectPlasmids(1, ['pJOG171', 'pJOG173', 'pJOG351']);
  selectCategory("3'UTR + Term");
  selectPlasmids(2, ['pUPD-ADH2t']);
  // The backbone category is the only option left, so it is filled automatically
  selectPlasmids(3, ['pDGB3_alpha2']);

  cy.get('[data-testid="assembler-submit-button"]').click();
  cy.get('[data-testid="assembler-product-table"]', { timeout: 30000 }).should('be.visible');
}

describe('Assembler with OpenCloningDB', () => {
  beforeEach(() => {
    cy.e2eLogin('/design', 'bootstrap+clerk_test@example.com', 'password');
  });

  it('does not load the default plasmids of the syntax, and offers the database as a source', () => {
    loadGoldenBraidSyntax();
    // No plasmids loaded, so there is nothing to choose from
    cy.get('[data-testid="assembler-submit-button"]').should('not.exist');
    cy.get('[data-testid="load-plasmids-button"]').click();
    cy.get('[data-testid="load-plasmids-from-files"]').should('exist');
    cy.get('[data-testid="load-plasmids-from-database"]').should('exist');
    cy.get('[data-testid="load-plasmids-from-local-server"]').should('not.exist');
  });

  it('loads plasmids by tag from the database and uses them in the assembler', () => {
    loadGoldenBraidSyntax();
    loadPlasmidsByTag('golden-braid');

    // Incompatible plasmids are reported as invalid, compatible ones as valid
    cy.get('[role="dialog"]').contains('Invalid Plasmids').should('exist');
    cy.get('[role="dialog"]').contains('Valid Plasmids').should('exist');
    cy.get('[data-testid="invalid-plasmids-box"]').contains('pDGB3_omega2R').should('exist');
    cy.get('[data-testid="invalid-plasmids-box"]').contains('pJOG587').should('exist');
    ['pDGB3_alpha2', 'pJOG684', 'pJOG171', 'pJOG173', 'pJOG351', 'pUPD-ADH2t_(17-21)'].forEach((name) => {
      cy.get('[data-testid="valid-plasmids-box"]').contains(name).should('exist');
    });
    cy.get('[role="dialog"] button').contains('Import valid plasmids').click();
    cy.get('[role="dialog"]').should('not.exist');

    // Loading the same plasmids again does not add duplicates
    loadPlasmidsByTag('golden-braid');
    cy.get('[role="dialog"] button').contains('Import valid plasmids').click();
    cy.get('[role="dialog"]').should('not.exist');

    // Only the valid ones are available
    cy.get('[data-testid="category-select"]').last().click();
    cy.get('li[role="option"]').contains("Prom + 5'UTR").click();
    cy.get('[data-testid="plasmid-select"]').last().click();
    cy.get('li[role="option"]').should('have.length', 1);
    cy.get('li[role="option"]').contains('pJOG684').should('exist');
    cy.get('li[role="option"]').contains('pJOG587').should('not.exist');
    cy.get('li[role="option"]').contains('pDGB3_omega2R').should('not.exist');
  });

  it('runs a combinatorial assembly with plasmids from the database', () => {
    loadGoldenBraidSyntax();
    loadPlasmidsByTag('golden-braid');
    cy.get('[role="dialog"] button').contains('Import valid plasmids').click();
    cy.get('[role="dialog"]').should('not.exist');

    runCombinatorialAssembly();
    // 1 promoter x 3 CDS x 1 terminator x 1 backbone
    cy.get('[data-testid="assembler-product-table-view-button"]').should('have.length', 3);

    // The product is sent to the cloning tab, where the input plasmids are DatabaseSources
    cy.get('[data-testid="assembler-product-table-view-button"]').first().click();
    cy.get('button.MuiTab-root.Mui-selected').contains('Cloning').should('exist');
    // The 4 input plasmids are DatabaseSources (located in the database), the product is not
    [1, 2, 3, 4].forEach((id) => cy.checkSequenceInDatabase(id));
    cy.checkSequenceNotInDatabase(5);
  });

  describe('Upload to DB', () => {
    // The test expects none of the products to be in the database already.
    // The outer beforeEach logs in first, so this resets the data before the test, not the session.
    beforeEach(() => {
      cy.resetDB();
    });
    afterEach(() => {
      cy.resetDB();
    });

    it('uploads the assemblies and their history to the database', () => {
      // Tag to apply to the uploaded products (any tag other than the one of the plasmids)
      cy.intercept('GET', Cypress.getDbURL('/tags')).as('getTags');
      loadGoldenBraidSyntax();
      loadPlasmidsByTag('golden-braid');
      cy.wait('@getTags').then(({ response }) => {
        const tag = response.body.find((t) => t.name !== 'golden-braid');
        expect(tag).to.exist;
        cy.wrap(tag).as('productTag');
      });
      cy.get('[role="dialog"] button').contains('Import valid plasmids').click();
      cy.get('[role="dialog"]').should('not.exist');
      runCombinatorialAssembly();
      cy.get('[data-testid="assembler-product-table-view-button"]').should('have.length', 3);

      // Validation: the plasmids are in the database already, so the 3 strategies are ready to import
      cy.intercept('POST', Cypress.getDbURL('/sequences/cloning_strategy/bulk/validate')).as('validate');
      cy.get('[data-testid="assembler-upload-to-db-button"]').click();
      cy.wait('@validate').then(({ response }) => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.have.length(3);
        response.body.forEach((row) => {
          expect(row.parsing_errors).to.deep.equal([]);
          expect(row.already_synced).to.equal(false);
          // The input plasmids have the database ids of the existing sequences
          const databaseSources = row.cloning_strategy.sources.filter((s) => s.type === 'DatabaseSource');
          expect(databaseSources).to.have.length(4);
          databaseSources.forEach((s) => expect(s.database_id).to.be.a('number'));
        });
        const plasmidIds = new Set(response.body.flatMap((row) => row.cloning_strategy.sources
          .filter((s) => s.type === 'DatabaseSource').map((s) => s.database_id)));
        // 1 promoter, 3 CDS, 1 terminator, 1 backbone
        expect(plasmidIds.size).to.equal(6);
        cy.wrap([...plasmidIds]).as('plasmidIds');
      });
      cy.get('[data-testid="submit-cloning-strategies-in-bulk-dialog"]').within(() => {
        cy.contains('3 clear, 0 warning, 0 error out of 3 uploaded items.').should('exist');
        cy.get('tbody tr').each((row) => cy.wrap(row).should('contain', 'Ready to import'));
      });

      // Apply a tag and import
      cy.get('@productTag').then((tag) => {
        cy.get('[data-testid="submit-cloning-strategies-in-bulk-dialog"]').contains('label', 'Tags to apply (optional)').siblings('div').first().click();
        cy.get('li[role="option"]').contains(tag.name).click();
      });
      // Click on the title to close the options popup
      cy.get('[data-testid="submit-cloning-strategies-in-bulk-dialog"]').contains('Upload to OpenCloningDB').click();
      cy.intercept('POST', Cypress.getDbURL('/sequences/cloning_strategy/bulk*')).as('submit');
      cy.get('[data-testid="submit-cloning-strategies-in-bulk-dialog"]').contains('button', 'Import').click();
      cy.wait('@submit').then(({ request, response }) => {
        expect(response.statusCode).to.equal(200);
        // The response contains all the sequences of the strategies. The products are new and tagged,
        // the plasmids are the existing ones (not duplicated) and are not tagged.
        const productNames = request.body.map(({ file_name: fileName }) => fileName.replace(/\.json$/, ''));
        const products = response.body.filter((s) => productNames.includes(s.name));
        const others = response.body.filter((s) => !productNames.includes(s.name));
        expect(products.map((s) => s.name).sort()).to.deep.equal([...productNames].sort());
        cy.get('@plasmidIds').then((plasmidIds) => {
          products.forEach((s) => expect(plasmidIds).not.to.include(s.id));
          expect([...new Set(others.map((s) => s.id))].sort()).to.deep.equal([...plasmidIds].sort());
        });
        cy.get('@productTag').then((tag) => {
          products.forEach((s) => expect(s.tags.map((t) => t.id)).to.deep.equal([tag.id]));
          others.forEach((s) => expect(s.tags.map((t) => t.id)).not.to.include(tag.id));
        });
        cy.wrap(productNames).as('productNames');
      });
      cy.get('[data-testid="submit-cloning-strategies-in-bulk-dialog"]').should('not.exist');
      cy.contains('Uploaded 3 assemblies to OpenCloningDB').should('exist');

      // Uploading again: everything is already in the database
      cy.get('[data-testid="assembler-upload-to-db-button"]').click();
      cy.wait('@validate');
      cy.get('[data-testid="submit-cloning-strategies-in-bulk-dialog"]').within(() => {
        cy.get('tbody tr').each((row) => cy.wrap(row).should('contain', 'Already synced'));
        cy.contains('button', 'Import').should('be.disabled');
        cy.contains('button', 'Cancel').click();
      });
      cy.get('[data-testid="submit-cloning-strategies-in-bulk-dialog"]').should('not.exist');

      // The products are in the sequences page, with the tag
      cy.get('@productTag').then((tag) => {
        cy.intercept('GET', Cypress.getDbURL('/sequences*')).as('getSequences');
        cy.visit(`/sequences?tags=${tag.id}`);
        cy.wait('@getSequences');
        cy.get('@productNames').then((productNames) => {
          productNames.forEach((name) => cy.get('tbody').contains(name).should('exist'));
        });
      });
    });
  });
});
