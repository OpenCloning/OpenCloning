import React from 'react';
import FileUploadButton from './FileUploadButton';

const file = (name) => ({ contents: Cypress.Buffer.from('ACGT'), fileName: name });

describe('<FileUploadButton />', () => {
  it('opens the file picker from the button and passes the chosen files', () => {
    const onFiles = cy.spy().as('onFiles');
    cy.mount(
      <FileUploadButton onFiles={onFiles} accept=".gb,.fasta" multiple data-testid="upload" inputProps={{ 'data-testid': 'upload-input' }}>
        Upload
      </FileUploadButton>,
    );
    cy.get('[data-testid="upload-input"]').then(($input) => {
      cy.stub($input[0], 'click').as('inputClick');
    });
    cy.get('[data-testid="upload"]').contains('Upload').click();
    cy.get('@inputClick').should('have.been.calledOnce');

    // The input is hidden, right after the button, and takes accept and multiple
    cy.get('[data-testid="upload"]').next('input').should('have.attr', 'type', 'file')
      .and('have.attr', 'accept', '.gb,.fasta')
      .and('have.attr', 'multiple');
    cy.get('[data-testid="upload-input"]').should('not.be.visible');

    cy.get('[data-testid="upload-input"]').selectFile([file('a.gb'), file('b.fasta')], { force: true });
    cy.get('@onFiles').should('have.been.calledOnce');
    cy.get('@onFiles').its('firstCall.args.0').should(($files) => {
      expect($files.map((f) => f.name)).to.deep.equal(['a.gb', 'b.fasta']);
    });
    // Reset, so the same file can be chosen again
    cy.get('[data-testid="upload-input"]').should('have.value', '');
  });

  it('shows a tooltip on the button', () => {
    cy.mount(<FileUploadButton onFiles={() => {}} tooltip="Upload a .csv file">Upload</FileUploadButton>);
    cy.contains('button', 'Upload').trigger('mouseover');
    cy.get('[role="tooltip"]').should('contain', 'Upload a .csv file');
  });
});
