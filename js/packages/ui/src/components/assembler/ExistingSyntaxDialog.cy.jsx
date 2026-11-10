import React from 'react';
import ExistingSyntaxDialog from './ExistingSyntaxDialog';

const mockSyntaxes = [
  {
    path: 'test-syntax-1',
    name: 'Test Syntax 1',
    description: 'First test syntax',
  },
  {
    path: 'test-syntax-2',
    name: 'Test Syntax 2',
    description: 'Second test syntax',
  },
  {
    path: 'test-syntax-3',
    name: 'Test Syntax 3',
    description: 'Third test syntax',
    syntaxes: [
      {
        path: 'test-syntax-3-1.json',
        name: 'Test Syntax 3-1',
        description: 'Third test syntax 1',
      },
      {
        path: 'test-syntax-3-2.json',
        name: 'Test Syntax 3-2',
        description: 'Third test syntax 2',
      },
    ],
  },
];

const mockSyntaxData = {
  name: 'Test Syntax',
  parts: [],
  assemblyEnzymes: ['BsmBI'],
};

const mockPlasmidsData = [
  {
    id: 1,
    name: 'Test Plasmid',
  },
];

describe('<ExistingSyntaxDialog />', () => {
  beforeEach(() => {
    // Intercept the index.json request
    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/index.json', {
      statusCode: 200,
      body: mockSyntaxes,
    }).as('getSyntaxes');
  });

  it('loads and displays syntaxes successfully', () => {
    const onCloseSpy = cy.spy().as('onCloseSpy');
    const onSyntaxSelectSpy = cy.spy().as('onSyntaxSelectSpy');

    cy.mount(
      <ExistingSyntaxDialog
        onClose={onCloseSpy}
        onSyntaxSelect={onSyntaxSelectSpy}
      />,
    );

    cy.wait('@getSyntaxes');
    cy.contains('Load an existing syntax').should('exist');
    cy.contains('Test Syntax 1').should('exist');
    cy.contains('First test syntax').should('exist');
    cy.contains('Test Syntax 2').should('exist');
    cy.contains('Second test syntax').should('exist');
  });

  it('successfully loads syntax and plasmids data when clicking a syntax', () => {
    const onCloseSpy = cy.spy().as('onCloseSpy');
    const onSyntaxSelectSpy = cy.spy().as('onSyntaxSelectSpy');

    // Intercept syntax.json and plasmids.json requests
    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-1/syntax.json', {
      statusCode: 200,
      body: mockSyntaxData,
    }).as('getSyntaxData');

    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-1/plasmids.json', {
      statusCode: 200,
      body: mockPlasmidsData,
    }).as('getPlasmidsData');

    cy.mount(
      <ExistingSyntaxDialog
        onClose={onCloseSpy}
        onSyntaxSelect={onSyntaxSelectSpy}
      />,
    );

    cy.wait('@getSyntaxes');
    cy.contains('Test Syntax 1').click();

    cy.wait('@getSyntaxData');
    cy.wait('@getPlasmidsData');

    cy.get('@onSyntaxSelectSpy').should('have.been.calledWith', mockSyntaxData, mockPlasmidsData);
    cy.get('@onCloseSpy').should('have.been.called');
  });

  it('displays error message when syntax.json request fails', () => {
    const onCloseSpy = cy.spy().as('onCloseSpy');
    const onSyntaxSelectSpy = cy.spy().as('onSyntaxSelectSpy');

    // Intercept syntax.json with error
    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-1/syntax.json', {
      statusCode: 500,
      body: { error: 'Internal server error' },
    }).as('getSyntaxDataError');

    cy.mount(
      <ExistingSyntaxDialog
        onClose={onCloseSpy}
        onSyntaxSelect={onSyntaxSelectSpy}
      />,
    );

    cy.wait('@getSyntaxes');
    cy.contains('Test Syntax 1').click();

    cy.wait('@getSyntaxDataError');

    cy.contains('Failed to load syntax data. Please try again.').should('exist');
    cy.get('@onSyntaxSelectSpy').should('not.have.been.called');
    cy.get('@onCloseSpy').should('not.have.been.called');
  });

  it('displays error message when plasmids.json request fails', () => {
    const onCloseSpy = cy.spy().as('onCloseSpy');
    const onSyntaxSelectSpy = cy.spy().as('onSyntaxSelectSpy');

    // Intercept syntax.json successfully
    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-1/syntax.json', {
      statusCode: 200,
      body: mockSyntaxData,
    }).as('getSyntaxData');

    // Intercept plasmids.json with error
    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-1/plasmids.json', {
      statusCode: 500,
      body: { error: 'Internal server error' },
    }).as('getPlasmidsDataError');

    cy.mount(
      <ExistingSyntaxDialog
        onClose={onCloseSpy}
        onSyntaxSelect={onSyntaxSelectSpy}
      />,
    );

    cy.wait('@getSyntaxes');
    cy.contains('Test Syntax 1').click();

    cy.wait('@getSyntaxData');
    cy.wait('@getPlasmidsDataError');

    cy.contains('Failed to load plasmids data. Please try again.').should('exist');
    cy.get('@onSyntaxSelectSpy').should('not.have.been.called');
    cy.get('@onCloseSpy').should('not.have.been.called');
  });

  it('clears error message when selecting a different syntax after error', () => {
    const onCloseSpy = cy.spy().as('onCloseSpy');
    const onSyntaxSelectSpy = cy.spy().as('onSyntaxSelectSpy');

    // First syntax fails
    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-1/syntax.json', {
      statusCode: 500,
      body: { error: 'Internal server error' },
    }).as('getSyntaxDataError');

    // Second syntax succeeds
    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-2/syntax.json', {
      statusCode: 200,
      body: mockSyntaxData,
    }).as('getSyntaxData2');

    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-2/plasmids.json', {
      statusCode: 200,
      body: mockPlasmidsData,
    }).as('getPlasmidsData2');

    cy.mount(
      <ExistingSyntaxDialog
        onClose={onCloseSpy}
        onSyntaxSelect={onSyntaxSelectSpy}
      />,
    );

    cy.wait('@getSyntaxes');
    
    // Click first syntax (fails)
    cy.contains('Test Syntax 1').click();
    cy.wait('@getSyntaxDataError');
    cy.contains('Failed to load syntax data. Please try again.').should('exist');

    // Click second syntax (succeeds) - error should be cleared
    cy.contains('Test Syntax 2').click();
    cy.wait('@getSyntaxData2');
    cy.wait('@getPlasmidsData2');

    cy.contains('Failed to load syntax data. Please try again.').should('not.exist');
    cy.get('@onSyntaxSelectSpy').should('have.been.calledWith', mockSyntaxData, mockPlasmidsData);
    cy.get('@onCloseSpy').should('have.been.called');
  });

  it('successfully uploads syntax from JSON file', () => {
    const onCloseSpy = cy.spy().as('onCloseSpy');
    const onSyntaxSelectSpy = cy.spy().as('onSyntaxSelectSpy');

    const uploadedSyntaxData = {
      name: 'Uploaded Syntax',
      parts: [
        { id: 1, name: 'Part 1' },
        { id: 2, name: 'Part 2' },
      ],
      assemblyEnzymes: ['BsmBI'],
    };

    const tempFile = {
      contents: Cypress.Buffer.from(JSON.stringify(uploadedSyntaxData)),
      fileName: 'syntax.json',
      mimeType: 'text/plain',
      lastModified: Date.now(),
    }

    cy.mount(
      <ExistingSyntaxDialog
        onClose={onCloseSpy}
        onSyntaxSelect={onSyntaxSelectSpy}
      />,
    );

    cy.wait('@getSyntaxes');
    cy.contains('Upload syntax from JSON file').should('exist');

    // Upload the JSON file
    cy.get('input[type="file"]').selectFile(tempFile, { force: true });

    cy.get('@onSyntaxSelectSpy').should('have.been.calledWith', uploadedSyntaxData, []);
    cy.get('@onCloseSpy').should('have.been.called');
  });

  it('displays error message when uploaded JSON file is invalid', () => {
    const onCloseSpy = cy.spy().as('onCloseSpy');
    const onSyntaxSelectSpy = cy.spy().as('onSyntaxSelectSpy');

    const invalidFile = {
      contents: Cypress.Buffer.from('{ invalid json }'),
      fileName: 'invalid.json',
      mimeType: 'text/plain',
      lastModified: Date.now(),
    }

    cy.mount(
      <ExistingSyntaxDialog
        onClose={onCloseSpy}
        onSyntaxSelect={onSyntaxSelectSpy}
      />,
    );

    cy.wait('@getSyntaxes');
    cy.contains('Upload syntax from JSON file').should('exist');

    // Upload invalid JSON
    cy.get('input[type="file"]').selectFile(invalidFile, { force: true });

    cy.contains(/Failed to parse JSON file/).should('exist');
    cy.get('@onSyntaxSelectSpy').should('not.have.been.called');
    cy.get('@onCloseSpy').should('not.have.been.called');
  });

  it('works with multiple syntaxes', () => {
    const onCloseSpy = cy.spy().as('onCloseSpy');
    const onSyntaxSelectSpy = cy.spy().as('onSyntaxSelectSpy');

    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-3/test-syntax-3-2.json', {
      statusCode: 200,
      body: mockSyntaxData,
    }).as('getSyntaxData');

    cy.intercept('GET', 'https://assets.opencloning.org/syntaxes/syntaxes/test-syntax-3/plasmids_test-syntax-3-2.json', {
      statusCode: 200,
      body: mockPlasmidsData,
    }).as('getPlasmidsData');

    cy.mount(
      <ExistingSyntaxDialog
        onClose={onCloseSpy}
        onSyntaxSelect={onSyntaxSelectSpy}
      />,
    );

    cy.wait('@getSyntaxes');
    cy.contains('Test Syntax 3').click();
    cy.contains('Test Syntax 3-1').should('exist');
    cy.contains('Test Syntax 3-2').should('exist');
    cy.contains('Third test syntax 1').should('exist');
    cy.contains('Third test syntax 2').should('exist');
    cy.contains('Test Syntax 3-2').click();
    cy.wait('@getSyntaxData');
    cy.wait('@getPlasmidsData');
    cy.get('@onSyntaxSelectSpy').should('have.been.calledWith', mockSyntaxData, mockPlasmidsData);
    cy.get('@onCloseSpy').should('have.been.called');
  });
});
