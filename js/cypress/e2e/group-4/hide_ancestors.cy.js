import { loadExample, loadHistory } from '../common_functions';

describe('Tests primer functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Hides ancestors', () => {
    loadExample('homologous recombination');
    // Hide top
    cy.contains('li', 'PCR with primers').find('[aria-label="Hide ancestors"] svg').first().click();
    cy.contains('li', 'Request to addgene').should('not.be.visible');
    // Hide everything esle
    cy.contains('li', 'Homologous recombination').find('[aria-label="Hide ancestors"] svg').first().click();
    cy.contains('li', 'Request to addgene').should('not.be.visible');
    cy.contains('li', 'PCR with primers').should('not.be.visible');
    cy.contains('li', 'Genome region').should('not.be.visible');
    // Show some, but not the 1st one since it remains hidden
    cy.contains('li', 'Homologous recombination').find('[aria-label="Show ancestors"] svg').first().click();
    // Scroll to top to ensure all elements are in view
    cy.get('.tab-panels-container').scrollTo('top');
    cy.contains('li', 'Request to addgene').should('not.be.visible');
    cy.contains('li', 'PCR with primers').should('be.visible');
    cy.contains('li', 'Genome region').should('be.visible');
    // Show all
    cy.contains('li', 'PCR with primers').find('[aria-label="Show ancestors"] svg').first().click();
    cy.get('.tab-panels-container').scrollTo('top');
    cy.contains('li', 'Request to addgene').should('be.visible');
    cy.contains('li', 'PCR with primers').should('be.visible');
    cy.contains('li', 'Genome region').should('be.visible');

    // Hide again, and make sure that when changing cloning strategy, the hidden ancestors are
    // reset
    cy.contains('li', 'Homologous recombination').find('[aria-label="Hide ancestors"] svg').first().click();
    loadExample('Gateway');
    cy.get('.tab-panels-container').scrollTo('top');
    cy.contains('li', 'Genome region').should('be.visible');
    cy.contains('li', 'Plasmid pDONR221 from SnapGene').should('be.visible');
    cy.contains('li', 'Plasmid pcDNA6.2_C-YFP-DEST from SnapGene').scrollIntoView();
    cy.contains('li', 'Plasmid pcDNA6.2_C-YFP-DEST from SnapGene').should('be.visible');

    // Now hide everything, and make sure that it remains hidden when loading another json file on top
    cy.contains('li', 'Gateway LR reaction').find('[aria-label="Hide ancestors"] svg').first().click();

    loadHistory('apps/opencloning/public/examples/templateless_PCR.json');
    cy.get('.history-loaded-dialog').contains('Add to existing').click();
    cy.get('.history-loaded-dialog button').contains('Select').click();
    cy.contains('li', 'Polymerase extension').should('be.visible');
    cy.get('li').contains('Gateway LR reaction').should('be.visible');
    cy.get('li').contains('Gateway BP reaction').should('not.be.visible');

  });
});
