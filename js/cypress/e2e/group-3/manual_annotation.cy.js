import { addLane, changeTab, manuallyTypeSequence } from '../common_functions';


describe('Test manual annotation', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.viewport(1920, 1080);
  });
  it('Creates a feature and undo / redo work', () => {
    manuallyTypeSequence('ATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGT');
    cy.get('svg[data-testid="VisibilityIcon"]').click();
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
    cy.get('.veLabelText').should('not.exist');

    cy.sequenceEditorCreateFeature('feature_name', 1, 30);
    cy.get('.veLabelText').contains('feature_name').should('exist');
    cy.get('[data-testid="annotation-changed-alert"]').should('exist');

    // Undo - redo
    cy.get('span[data-test="veRedoTool"]').parent().should('have.class', 'bp3-disabled');
    cy.get('span[data-test="veUndoTool"]').click({force: true});
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
    cy.get('.veLabelText').should('not.exist');

    cy.get('span[data-test="veUndoTool"]').parent().should('have.class', 'bp3-disabled');
    cy.get('span[data-test="veRedoTool"]').click({force: true});
    cy.get('[data-testid="annotation-changed-alert"]').should('exist');
    cy.get('.veLabelText').contains('feature_name').should('exist');

    // No shown in cloning tab until saved
    changeTab('Cloning');
    cy.get('.cloning-history .veLabelText').should('not.exist');

    // Going back to sequence tab should have kept the feature and history
    cy.get('svg[data-testid="VisibilityIcon"]').click();
    cy.get('.veLabelText').contains('feature_name').should('exist');
    cy.get('span[data-test="veRedoTool"]').parent().should('have.class', 'bp3-disabled');
    cy.get('span[data-test="veUndoTool"]').parent().should('not.be.disabled');

    // Save the history
    cy.get('[data-testid="annotation-changed-alert"] button').contains('Save').click();
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
    cy.get('.veLabelText').contains('feature_name').should('exist');
    changeTab('Cloning');
    cy.get('.cloning-history .veLabelText').contains('feature_name').should('exist');

  });
  it('Can cancel de annotation', () => {
    manuallyTypeSequence('ATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGT');
    cy.get('svg[data-testid="VisibilityIcon"]').click();
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
    cy.get('.veLabelText').should('not.exist');

    cy.sequenceEditorCreateFeature('feature_name', 1, 30);
    cy.get('.veLabelText').contains('feature_name').should('exist');
    cy.get('[data-testid="annotation-changed-alert"] button').contains('Cancel').click();
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
    cy.get('.veLabelText').should('not.exist');
    cy.get('span[data-test="veRedoTool"]').parent().should('have.class', 'bp3-disabled');
    cy.get('span[data-test="veUndoTool"]').parent().should('have.class', 'bp3-disabled');
    cy.get('.veLabelText').should('not.exist');
  });
  it('Switching sequences removes editor history', () => {
    manuallyTypeSequence('ATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGT');
    addLane()
    manuallyTypeSequence('ATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGT');
    cy.get('li#sequence-1 svg[data-testid="VisibilityIcon"]').click();
    cy.sequenceEditorCreateFeature('feature_name', 1, 30);
    changeTab('Cloning');
    cy.get('li#sequence-2 svg[data-testid="VisibilityIcon"]').click();
    cy.get('.cloning-history .veLabelText').should('not.exist');
    cy.get('span[data-test="veRedoTool"]').parent().should('have.class', 'bp3-disabled');
    cy.get('span[data-test="veUndoTool"]').parent().should('have.class', 'bp3-disabled');
  });
  it('Initially does not show annotation changed alert', () => {
    changeTab('Sequence');
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
  });
  it('Can create primers', () => {
    manuallyTypeSequence('ATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGTATGT');
    cy.get('svg[data-testid="VisibilityIcon"]').click();
    cy.sequenceEditorCreateFeature('primer_name', 1, 30, true);
    cy.get('.veLabelText').contains('primer_name').should('exist');
    cy.get('[data-testid="annotation-changed-alert"] button').contains('Cancel').click();
    cy.get('[data-testid="annotation-changed-alert"]').should('not.exist');
    cy.get('.veLabelText').should('not.exist');
    changeTab('Primers');
    cy.get('.primer-table-container tr').contains('primer_name').should('exist');
    cy.get('.primer-table-container tr').contains('tgtatgtatgtatgtatgtatgtatgtat').should('exist');
  });
});
