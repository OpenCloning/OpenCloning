import { closeAlerts, loadExample } from '../common_functions';

describe('Test drag and drop functionality', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('li#source-1').should('exist');
  });
  it('Shows the drop area when dragging a file', () => {
    cy.get('div.cloning-history').trigger('dragover');
    cy.get('div.cloning-history').should('have.class', 'dragging-file');
    cy.get('div.cloning-history').contains('Drop multiple sequence').should('exist');
    cy.get('div.cloning-history').trigger('dragleave');
    cy.get('div.cloning-history').should('not.have.class', 'dragging-file');

    // Also can be closed
    cy.get('div.cloning-history').trigger('dragover');
    cy.get('div.cloning-history').should('have.class', 'dragging-file');
    cy.get('div.cloning-history').contains('Drop multiple sequence').should('exist');
    cy.get('div.cloning-history .cancel-icon').click();
    cy.get('div.cloning-history').should('not.have.class', 'dragging-file');
  });
  it('Can load single sequence file', () => {
    cy.get('div.cloning-history').selectFile('apps/opencloning/public/examples/ase1.gb', { action: 'drag-drop' });
    // This also checks that the empty source was replaced
    cy.get('li#sequence-1', { timeout: 20000 }).contains('CU329670');
    cy.get('li#sequence-1 li#source-1').contains('Read from file ase1.gb');
  });
  it('Can load multiple sequence files, with multiple sequences in them', () => {
    cy.get('div.cloning-history').selectFile(['apps/opencloning/public/examples/ase1.gb', 'apps/opencloning/public/examples/dummy_multi_fasta.fasta'], { action: 'drag-drop' });
    // There should be three sources displayed, and three sequences (7 because of the Add Source button)
    cy.get('div.tf-tree.tf-ancestor-tree ul li').should('have.length', 7);
  });
  it('Can load a history file', () => {
    cy.get('div.cloning-history').selectFile('apps/opencloning/public/examples/homologous_recombination.json', { action: 'drag-drop' });
    // No error message should be displayed
    cy.get('div#global-error-message-wrapper div.MuiAlert-message').should('not.exist');
    cy.get('div.tf-tree.tf-ancestor-tree').contains('Homologous recombination with').should('exist');
  });
  it('Shows the right errors when dropping wrong files', () => {
    // JSON file + something else
    cy.get('div.cloning-history').selectFile(['apps/opencloning/public/examples/homologous_recombination.json', 'apps/opencloning/public/examples/ase1.gb'], { action: 'drag-drop' });
    cy.get('div.MuiAlert-message').contains('Drop either');

    // JSON file with wrong content
    cy.get('div.cloning-history').selectFile('cypress/test_files/wrong_history.json', { action: 'drag-drop' });
    cy.get('div.MuiAlert-message').contains('should contain at least');

    // Files which are not sequences
    cy.get('div.cloning-history').selectFile('apps/opencloning/public/favicon.ico', { action: 'drag-drop' });
    cy.get('div.MuiAlert-message').contains('Could not read the file favicon.ico');

    // Files which are not sequences mixed with sequences
    cy.get('div.cloning-history').selectFile(['apps/opencloning/public/examples/ase1.gb', 'apps/opencloning/public/favicon.ico'], { action: 'drag-drop' });
    cy.get('div.MuiAlert-message').contains('Could not read the file favicon.ico');
  });
  it('Can merge with existing history', () => {
    loadExample('Gibson assembly');

    cy.get('div.cloning-history').selectFile('apps/opencloning/public/examples/homologous_recombination.json', { action: 'drag-drop', force: true });
    cy.get('.history-loaded-dialog').contains('Add to existing').click();
    cy.get('.history-loaded-dialog button').contains('Select').click();

    // Previous
    cy.get('div.cloning-tab-pannel').contains('Gibson assembly of fragments');
    // Newly loaded
    cy.get('div.cloning-tab-pannel').contains('Homologous recombination');

    // Can load one with the same primer names again as long as they have the same sequence as well
    cy.get('div.cloning-history').selectFile('apps/opencloning/public/examples/homologous_recombination.json', { action: 'drag-drop', force: true });
    cy.get('.history-loaded-dialog').contains('Add to existing').click();
    cy.get('.history-loaded-dialog button').contains('Select').click();

    cy.get('div.cloning-tab-pannel div.finished-source').filter(':contains("Homologous recombination")').should('have.length', 2);

    // Error if two primers have the same name but different sequence
    cy.get('div.cloning-history').selectFile('cypress/test_files/primer_same_name_different_sequence.json', { action: 'drag-drop', force: true });
    cy.get('.history-loaded-dialog').contains('Add to existing').click();
    cy.get('.history-loaded-dialog button').contains('Select').click();

    // Shows error and does not load them again
    cy.get('.MuiAlert-message').contains('Primer name vector_rvs exists in current').should('exist');
    cy.get('div.cloning-tab-pannel div.finished-source').filter(':contains("Homologous recombination")').should('have.length', 2);

    // Can replace the history
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').siblings('input').selectFile('apps/opencloning/public/examples/crispr_hdr.json', { force: true });
    cy.get('.history-loaded-dialog').contains('Replace existing').click();
    cy.get('.history-loaded-dialog button').contains('Select').click();

    cy.get('div.cloning-tab-pannel').contains('Homologous recombination').should('not.exist');
    cy.get('div.cloning-tab-pannel').contains('CRISPR HDR with').should('exist');
  });
  it('Can load a SnapGene .dna file with history', () => {
    cy.get('div.cloning-history').selectFile('cypress/test_files/snapgene_history/gibson_assembly.dna', { action: 'drag-drop' });
    cy.get('li', { timeout: 20000 }).contains('Gibson');
    cy.get('#global-error-message-wrapper .MuiAlert-message').should('not.exist');
  });
  it('Can load a SnapGene .dna file with history and warning', () => {
    cy.get('div.cloning-history').selectFile('cypress/test_files/snapgene_history/circularize.dna', { action: 'drag-drop' });
    cy.get('li', { timeout: 20000 }).contains('Circularization of fragment');
    cy.get('#global-error-message-wrapper').contains('Not all SnapGene history was parsed');
  });
  it('Falls back to sequence when SnapGene .dna history fails', () => {
    cy.get('div.cloning-history').selectFile('cypress/test_files/snapgene_history/topo_ta_cloning.dna', { action: 'drag-drop' });
    cy.get('#global-error-message-wrapper', { timeout: 20000 }).contains('Failed to parse the history');
    cy.get('li#source-1', { timeout: 20000 }).contains('Read from file');
  });
});
