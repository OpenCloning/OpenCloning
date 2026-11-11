import { addLane, addSource } from '../common_functions';

describe('Test that when files are loaded, old versions are migrated and bug fixes are applied', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Can migrate old files', () => {
    // When drag and drop
    cy.get('div.cloning-history').selectFile('cypress/test_files/old_and_bug_fix/crispr_hdr.json', { action: 'drag-drop' });
    cy.get('#global-error-message-wrapper div.MuiAlert-message', { timeout: 20000 }).contains('migrated to the latest version');

    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').click();
    cy.get('#global-error-message-wrapper div.MuiAlert-message').should('not.exist');
    addLane();
    // When loading from file in source
    addSource('UploadedFileSource', true);
    cy.get('form.submit-sequence-file input').last().selectFile('cypress/test_files/old_and_bug_fix/crispr_hdr.json', { force: true });
    cy.get('#global-error-message-wrapper div.MuiAlert-message', { timeout: 20000 }).contains('migrated to the latest version');
    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').click();
    cy.get('#global-error-message-wrapper div.MuiAlert-message').should('not.exist');
    // When loading from menu
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').siblings('input').selectFile('cypress/test_files/old_and_bug_fix/crispr_hdr.json', { force: true });
    cy.get('.history-loaded-dialog').contains('Replace existing').click();
    cy.get('.history-loaded-dialog button').contains('Select').click();
    cy.get('#global-error-message-wrapper div.MuiAlert-message', { timeout: 20000 }).contains('migrated to the latest version');
    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').click();
    cy.get('#global-error-message-wrapper div.MuiAlert-message').should('not.exist');
  });
  it('Can fix bugs in old files', () => {
    // When drag and drop
    cy.get('div.cloning-history').selectFile('cypress/test_files/old_and_bug_fix/gateway.json', { action: 'drag-drop' });
    cy.get('#global-error-message-wrapper div.MuiAlert-message', { timeout: 20000 }).contains('migrated to the latest version');
    cy.get('#global-error-message-wrapper div.MuiAlert-message').contains('contained an error');
    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').first().click();
    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').first().click();
    cy.get('#global-error-message-wrapper div.MuiAlert-message').should('not.exist');
    addLane();
    // When loading from file in source
    addSource('UploadedFileSource', true);
    cy.get('form.submit-sequence-file input').last().selectFile('cypress/test_files/old_and_bug_fix/gateway.json', { force: true });
    cy.get('#global-error-message-wrapper div.MuiAlert-message', { timeout: 20000 }).contains('migrated to the latest version');
    cy.get('#global-error-message-wrapper div.MuiAlert-message').contains('contained an error');
    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').first().click();
    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').first().click();
    cy.get('#global-error-message-wrapper div.MuiAlert-message').should('not.exist');
    // When loading from menu
    cy.get('.MuiToolbar-root .MuiButtonBase-root').contains('File').siblings('input').selectFile('cypress/test_files/old_and_bug_fix/gateway.json', { force: true });
    cy.get('.history-loaded-dialog').contains('Replace existing').click();
    cy.get('.history-loaded-dialog button').contains('Select').click();
    cy.get('#global-error-message-wrapper div.MuiAlert-message', { timeout: 20000 }).contains('migrated to the latest version');
    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').first().click();
    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').first().click();
    cy.get('#global-error-message-wrapper div.MuiAlert-message').should('not.exist');
  });
  it('Works with zip files', () => {
    cy.get('div.cloning-history').selectFile('cypress/test_files/old_and_bug_fix/cloning_strategy_with_sequencing.zip', { action: 'drag-drop' });
    cy.get('#global-error-message-wrapper div.MuiAlert-message', { timeout: 20000 }).contains('migrated to the latest version');
    cy.get('div.MuiAlert-action svg[data-testid="CloseIcon"]').click();
    cy.get('#global-error-message-wrapper div.MuiAlert-message').should('not.exist');
    cy.get('#sequence-1 svg[data-testid="RuleIcon"]').click();
    cy.get('table').contains('BZO902_13409020_13409020.ab1');
    cy.get('table').contains('BZO903_13409037_13409037.ab1');
    cy.get('table').contains('BZO904_13409044_13409044.ab1');
    // Check that the files are in the verification file store
    cy.window().its('verificationFileStore')
      .invoke('get', 'verification-1-BZO904_13409044_13409044.ab1')
      .should('not.be.null')
      .and('have.length.gt', 1000); // Ensure it's not just a tiny value
    cy.window().its('verificationFileStore')
      .invoke('get', 'verification-1-BZO903_13409037_13409037.ab1')
      .should('not.be.null')
      .and('have.length.gt', 1000);
    cy.window().its('verificationFileStore')
      .invoke('get', 'verification-1-BZO902_13409020_13409020.ab1')
      .should('not.be.null')
      .and('have.length.gt', 1000);
  });
});
