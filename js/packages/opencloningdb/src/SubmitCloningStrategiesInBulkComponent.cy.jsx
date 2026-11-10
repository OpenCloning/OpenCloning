import React from 'react';
import SubmitCloningStrategiesInBulkComponent from './SubmitCloningStrategiesInBulkComponent';
import endpoints from './endpoints';

const TAG_NAME = 'cre_lox_recombination';
const validateUrl = { method: 'POST', pathname: `/db${endpoints.sequencesCloningStrategyBulkValidate}` };
const submitUrl = { method: 'POST', pathname: `/db${endpoints.sequencesCloningStrategyBulk}` };

const fileContents = ['clear', 'synced', 'warning', 'error'].map((name) => ({
  name: `${name}.json`,
  content: JSON.stringify({ sequences: [], sources: [], primers: [], description: name }),
}));
const files = fileContents.map(({ name, content }) => new File([content], name, { type: 'application/json' }));

const strategy = (name) => ({ sequences: [], sources: [], primers: [], description: name });
const clearRow = { file_name: 'clear.json', cloning_strategy: strategy('clear') };
const syncedRow = { file_name: 'synced.json', cloning_strategy: strategy('synced'), already_synced: true };
const warningRow = { file_name: 'warning.json', cloning_strategy: strategy('warning'), parsing_warnings: ['Some warning'] };
const errorRow = { file_name: 'error.json', parsing_errors: ['Cloning strategy is not correct: bad'] };
const validationRows = [clearRow, syncedRow, warningRow, errorRow];

const createdSequences = [{ id: 100, type: 'Sequence', name: 'product' }];

function bodyToString(body) {
  return typeof body === 'string' ? body : new TextDecoder().decode(body);
}

function mountComponent() {
  const onCloseSpy = cy.spy().as('onCloseSpy');
  const onSuccessSpy = cy.spy().as('onSuccessSpy');
  cy.mount(<SubmitCloningStrategiesInBulkComponent files={files} onClose={onCloseSpy} onSuccess={onSuccessSpy} />);
}

describe('<SubmitCloningStrategiesInBulkComponent />', () => {
  beforeEach(() => {
    cy.setupOpenCloningDBTestAuth();
    // TagMultiSelect fetches the tags on mount, in every test
    cy.interceptOpenCloningDBStub('get_tags', { alias: 'getTags' });
  });

  it('validates the files as multipart and shows the status of each one', () => {
    cy.intercept(validateUrl, (req) => {
      expect(req.headers['content-type']).to.contain('multipart/form-data');
      const body = bodyToString(req.body);
      fileContents.forEach(({ name, content }) => {
        expect(body).to.contain(`filename="${name}"`);
        expect(body).to.contain(content);
      });
      req.reply({ statusCode: 200, body: validationRows });
    }).as('validate');

    mountComponent();
    cy.wait('@validate');
    cy.get('[data-testid="submit-cloning-strategies-in-bulk-dialog"]').within(() => {
      cy.get('tbody tr').should('have.length', 4);
      // Errors first, then warnings, informational and clear rows
      cy.get('tbody tr').eq(0).should('contain', 'error.json').and('contain', 'Invalid').and('contain', 'Cloning strategy is not correct: bad');
      cy.get('tbody tr').eq(1).should('contain', 'warning.json').and('contain', 'Review warnings').and('contain', 'Some warning');
      cy.get('tbody tr').eq(2).should('contain', 'synced.json').and('contain', 'Already synced');
      cy.get('tbody tr').eq(3).should('contain', 'clear.json').and('contain', 'Ready to import');
      cy.contains('1 clear, 1 warning, 1 error, 1 informational out of 4 uploaded items.').should('exist');
    });
  });

  it('submits the importable rows with the selected tags', () => {
    cy.intercept(validateUrl, { statusCode: 200, body: validationRows }).as('validate');
    cy.intercept(submitUrl, (req) => {
      req.reply({ statusCode: 200, body: createdSequences });
    }).as('submit');

    mountComponent();
    cy.wait(['@validate', '@getTags']);
    // Not using clickMultiSelectOption, the click outside fails inside a dialog
    cy.get('div[role="dialog"]').contains('label', 'Tags to apply (optional)').siblings('div').first().click();
    cy.get('li[role="option"]').contains(TAG_NAME).click();
    cy.get('div[role="dialog"]').contains('Upload to OpenCloningDB').click();
    cy.contains('button', 'Import entries with warnings too').click();

    cy.wait('@submit').then(({ request }) => {
      expect(request.body).to.deep.equal([
        { file_name: 'warning.json', cloning_strategy: warningRow.cloning_strategy },
        { file_name: 'clear.json', cloning_strategy: clearRow.cloning_strategy },
      ]);
      cy.getStub('get_tags').then((stub) => {
        const tag = stub.response.body.find((t) => t.name === TAG_NAME);
        expect(request.query).to.deep.equal({ tags: String(tag.id) });
      });
    });
    cy.get('@onSuccessSpy').should('have.been.calledOnceWith', createdSequences, [
      { file_name: 'warning.json', cloning_strategy: warningRow.cloning_strategy },
      { file_name: 'clear.json', cloning_strategy: clearRow.cloning_strategy },
    ]);
    cy.get('@onCloseSpy').should('have.been.calledOnce');
  });

  it('submits only the clear rows without tags', () => {
    cy.intercept(validateUrl, { statusCode: 200, body: validationRows }).as('validate');
    cy.intercept(submitUrl, (req) => {
      expect(req.query).to.deep.equal({});
      expect(req.body).to.deep.equal([{ file_name: 'clear.json', cloning_strategy: clearRow.cloning_strategy }]);
      req.reply({ statusCode: 200, body: createdSequences });
    }).as('submit');

    mountComponent();
    cy.wait('@validate');
    cy.contains('button', 'Import entries without warnings').click();
    cy.wait('@submit');
    cy.get('@onSuccessSpy').should('have.been.calledOnceWith', createdSequences, [
      { file_name: 'clear.json', cloning_strategy: clearRow.cloning_strategy },
    ]);
  });

  it('does not allow importing when no row is importable', () => {
    cy.intercept(validateUrl, { statusCode: 200, body: [syncedRow, errorRow] }).as('validate');
    cy.intercept(submitUrl, cy.spy().as('submitSpy'));

    mountComponent();
    cy.wait('@validate');
    // Only already synced rows, which are not submitted
    cy.contains('button', 'Import').should('be.disabled');
    cy.get('@submitSpy').should('not.have.been.called');
  });

  it('updates the rows when the submission conflicts with the database', () => {
    cy.intercept(validateUrl, { statusCode: 200, body: [clearRow] }).as('validate');
    cy.intercept(submitUrl, { statusCode: 409, body: [{ ...clearRow, already_synced: true }] }).as('submit');

    mountComponent();
    cy.wait('@validate');
    cy.contains('button', 'Import').click();
    cy.wait('@submit');
    cy.contains('Conflicts detected while importing. Review the updated validation results.').should('exist');
    cy.get('tbody tr').eq(0).should('contain', 'clear.json').and('contain', 'Already synced');
    cy.get('@onSuccessSpy').should('not.have.been.called');
    cy.get('@onCloseSpy').should('not.have.been.called');
  });

  it('shows the error when the submission fails', () => {
    cy.intercept(validateUrl, { statusCode: 200, body: [clearRow] }).as('validate');
    cy.intercept(submitUrl, { statusCode: 403, body: { detail: 'Insufficient permissions' } }).as('submit');

    mountComponent();
    cy.wait('@validate');
    cy.contains('button', 'Import').click();
    cy.wait('@submit');
    cy.get('.MuiAlert-colorError').contains('Insufficient permissions').should('exist');
    cy.get('@onSuccessSpy').should('not.have.been.called');
  });

  it('shows the error when the validation fails', () => {
    cy.intercept(validateUrl, { statusCode: 400, body: { detail: 'File too large' } }).as('validate');

    mountComponent();
    cy.wait('@validate');
    cy.get('.MuiAlert-colorError').contains('File too large').should('exist');
    cy.contains('button', 'Close').click();
    cy.get('@onCloseSpy').should('have.been.calledOnce');
  });

  it('uses the given title and test id', () => {
    cy.intercept(validateUrl, { statusCode: 200, body: validationRows }).as('validate');
    cy.mount(<SubmitCloningStrategiesInBulkComponent files={files} onClose={cy.spy()} title="Custom title" dataTestId="custom-test-id" />);
    cy.wait('@validate');
    cy.get('[data-testid="custom-test-id"]').should('have.attr', 'role', 'dialog').within(() => {
      cy.contains('Custom title').should('exist');
      cy.get('tbody tr').should('have.length', 4);
    });
  });

  it('closes without submitting when cancelling', () => {
    cy.intercept(validateUrl, { statusCode: 200, body: validationRows }).as('validate');
    cy.intercept(submitUrl, cy.spy().as('submitSpy'));

    mountComponent();
    cy.wait('@validate');
    cy.contains('button', 'Cancel').click();
    cy.get('@onCloseSpy').should('have.been.calledOnce');
    cy.get('@submitSpy').should('not.have.been.called');
  });
});
