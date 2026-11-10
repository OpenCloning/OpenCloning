import React from 'react';
import PrimerBulkUploadPreviewTable from './PrimerBulkUploadPreviewTable';

describe('<PrimerBulkUploadPreviewTable />', () => {
  it('shows all issue messages from bulk_upload.js with the right status icon', () => {
    const rows = [
      {
        name: 'clear-primer',
        uid: 'C1',
        sequence: 'ATGC',
      },
      {
        name: 'sequence-invalid',
        uid: 'E1',
        sequence: 'ATGC',
        'sequence_invalid': true,
      },
      {
        name: 'name-exists',
        uid: 'W1',
        sequence: 'GCTA',
        'name_exists': true,
      },
      {
        name: 'sequence-exists',
        uid: 'W2',
        sequence: 'TTAA',
        'sequence_exists': true,
      },
      {
        name: 'uid-exists',
        uid: 'E2',
        sequence: 'CCGG',
        'uid_exists': true,
      },
      {
        name: 'name-duplicated',
        uid: 'W3',
        sequence: 'AGAG',
        'name_duplicated': true,
      },
      {
        name: 'sequence-duplicated',
        uid: 'W4',
        sequence: 'CTCT',
        'sequence_duplicated': true,
      },
      {
        name: 'uid-duplicated',
        uid: 'E3',
        sequence: 'GGCC',
        'uid_duplicated': true,
      },
    ];

    const handleSubmitSpy = cy.spy().as('handleSubmitSpy');
    const handleCancelSpy = cy.spy().as('handleCancelSpy');

    cy.mount(<PrimerBulkUploadPreviewTable
      rows={rows}
      handleSubmit={handleSubmitSpy}
      handleCancel={handleCancelSpy}
      isSubmitting={false}
    />);


    cy.contains('td', 'clear-primer').parent().within(() => {
      cy.get('[data-testid="CheckCircleIcon"]').should('exist');
      cy.get('td').eq(4).should('be.empty');
    });

    cy.contains('td', 'sequence-invalid').parent().within(() => {
      cy.get('[data-testid="CancelIcon"]').should('exist');
      cy.contains('Invalid DNA sequence').should('exist');
    });

    cy.contains('td', 'name-exists').parent().within(() => {
      cy.get('[data-testid="WarningIcon"]').should('exist');
      cy.contains('Name already exists in workspace').should('exist');
    });

    cy.contains('td', 'sequence-exists').parent().within(() => {
      cy.get('[data-testid="WarningIcon"]').should('exist');
      cy.contains('Sequence already exists in workspace').should('exist');
    });

    cy.contains('td', 'uid-exists').parent().within(() => {
      cy.get('[data-testid="CancelIcon"]').should('exist');
      cy.contains('UID already exists in workspace').should('exist');
    });

    cy.contains('td', 'name-duplicated').parent().within(() => {
      cy.get('[data-testid="WarningIcon"]').should('exist');
      cy.contains('Name duplicated in uploaded file').should('exist');
    });

    cy.contains('td', 'sequence-duplicated').parent().within(() => {
      cy.get('[data-testid="WarningIcon"]').should('exist');
      cy.contains('Sequence duplicated in uploaded file').should('exist');
    });

    cy.contains('td', 'uid-duplicated').parent().within(() => {
      cy.get('[data-testid="CancelIcon"]').should('exist');
      cy.contains('UID duplicated in uploaded file').should('exist');
    });

    cy.contains('button', 'Import entries without warnings').click();
    cy.get('@handleSubmitSpy').should('have.been.calledOnce');
    cy.get('@handleSubmitSpy').then((spy) => {
      const [submittedRows, mode] = spy.getCall(0).args;
      cy.wrap(mode).should('equal', 'clear');
      cy.wrap(submittedRows).should('have.length', 1);
      cy.wrap(submittedRows.map((r) => r.name)).should('deep.equal', ['clear-primer']);
    });

    cy.contains('button', 'Import entries with warnings too').click();
    cy.get('@handleSubmitSpy').should('have.been.calledTwice');
    cy.get('@handleSubmitSpy').then((spy) => {
      const [submittedRows, mode] = spy.getCall(1).args;
      cy.wrap(mode).should('equal', 'with warnings');
      cy.wrap(submittedRows).should('have.length', 5);
      const submittedNames = submittedRows.map((r) => r.name);
      cy.wrap(submittedNames).should('have.members', [
        'name-exists',
        'sequence-exists',
        'name-duplicated',
        'sequence-duplicated',
        'clear-primer',
      ]);
      cy.wrap(submittedNames).should('not.include', 'sequence-invalid');
      cy.wrap(submittedNames).should('not.include', 'uid-exists');
      cy.wrap(submittedNames).should('not.include', 'uid-duplicated');
    });

    cy.get('@handleCancelSpy').should('not.have.been.called');
    cy.contains('button', 'Cancel').click();
    cy.get('@handleCancelSpy').should('have.been.calledOnce');
  });

  it('prioritizes error icon when row has warning and error, while showing both issues', () => {
    const rows = [
      {
        name: 'warning-and-error',
        uid: 'E4',
        sequence: 'TTAA',
        'sequence_invalid': true,
        'name_exists': true,
      },
    ];

    cy.mount(<PrimerBulkUploadPreviewTable
      rows={rows}
      handleSubmit={() => {}}
      handleCancel={() => {}}
      isSubmitting={false}
    />);

    cy.contains('td', 'warning-and-error').parent().within(() => {
      cy.get('[data-testid="CancelIcon"]').should('exist');
      cy.contains('Invalid DNA sequence').should('exist');
      cy.contains('Name already exists in workspace').should('exist');
      cy.get('[data-testid="WarningIcon"]').should('not.exist');
    });
  });

  it('shows a loading spinner when validating', () => {
    const rows = [
      {
        name: 'warning-and-error',
        uid: 'E4',
        sequence: 'TTAA',
        'sequence_invalid': true,
        'name_exists': true,
      },
    ];
    cy.mount(<PrimerBulkUploadPreviewTable
      rows={rows}
      handleSubmit={() => {}}
      handleCancel={() => {}}
      isSubmitting={false}
      isValidating={true}
    />);
    cy.get('[role="progressbar"]').should('exist');
    cy.contains('warning-and-error').should('not.exist');
  });
});
