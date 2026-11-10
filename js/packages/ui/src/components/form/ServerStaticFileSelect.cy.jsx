import React from 'react';
import { ConfigProvider } from '../../providers/ConfigProvider';
import { localFilesHttpClient } from '../../hooks/useServerStaticFiles';
import ServerStaticFileSelect from './ServerStaticFileSelect';

// A common intercept does not work here, because we are requesting
// static files, and cypress intercepts don't work.

const config = {
  backendUrl: 'http://localhost:8000',
  staticContentPath: 'collection',
  showAppBar: false,
  noExternalRequests: false,
  enableAssembler: true,
  enablePlannotate: false,
};

export const dummyIndex = {
  sequences: [
    {
      name: 'Example sequence 1',
      path: 'example.fa',
      categories: ['Test category'],
    },
    {
      name: 'Example sequence 2',
      path: 'example2.gb',
      categories: ['Test category2'],
    },
    {
      name: 'Example sequence 3',
      path: 'example3.fa',
      categories: ['Test category'],
    },
  ],
  syntaxes: [
    {
      name: 'Example syntax 1',
      path: 'example.json',
    },
    {
      name: 'Example syntax 2',
      path: 'example2.json',
    },
  ],
};

describe('<ServerStaticFileSelect />', () => {
  it('loads index, fetches file and calls onFileSelected', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: dummyIndex,
        });
      }
      if (url.endsWith('/example.fa')) {
        return Promise.resolve({ data: 'ATGC' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    cy.wrap(httpGet).as('httpGet');

    const onFileSelected = cy.spy().as('onFileSelected');

    cy.mount(
      <ConfigProvider config={config}>
        <ServerStaticFileSelect
          onFileSelected={onFileSelected}
        />
      </ConfigProvider>,
    );

    cy.get('@httpGet').should('have.been.calledWithMatch', 'index.json');

    // Button is disabled
    cy.contains('button', 'Submit').should('be.disabled');

    // Select sequence
    cy.get('#option-select').click();
    cy.contains('Example sequence 1').click();

    // Submit form
    cy.contains('button', 'Submit').click();

    cy.get('@httpGet').should('have.been.calledWithMatch', 'example.fa');

    cy.get('@onFileSelected').should('have.been.calledOnce');
    cy.get('@onFileSelected').should((spy) => {
      const [file] = spy.lastCall.args;
      expect(file.name).to.equal('example.fa');
      expect(file.type).to.equal('text/plain');
      expect(file.size).to.equal(4);
    });
  });

  it('handles index load failure and allows retry', () => {
    let firstCall = true;
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (!url.endsWith('/index.json')) {
        throw new Error(`Unexpected URL: ${url}`);
      }
      if (firstCall) {
        firstCall = false;
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        data: dummyIndex,
      });
    });
    cy.wrap(httpGet).as('httpGet');

    cy.mount(
      <ConfigProvider config={config}>
        <ServerStaticFileSelect
          onFileSelected={cy.spy()}
        />
      </ConfigProvider>,
    );

    cy.get('@httpGet').should('have.been.calledWithMatch', 'index.json');

    // First request failed, should show retry alert
    cy.get('.MuiAlert-colorError').should('exist');
    cy.contains('Retry').click();

    // Second request succeeds
    cy.get('@httpGet').should('have.been.calledTwice');

    // Error alert should disappear and form should be visible
    cy.get('.MuiAlert-colorError').should('not.exist');
    cy.get('#option-select').should('exist');
  });

  it('handles invalid sequence and file request failure', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: {
            sequences: [
              {
                name: 'No path sequence',
                categories: ['Test category'],
              },
              {
                name: 'Valid path sequence',
                path: 'valid.fa',
                categories: ['Test category'],
              },
            ],
          },
        });
      }
      if (url.endsWith('/valid.fa')) {
        return Promise.reject(new Error('Server error'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    cy.wrap(httpGet).as('httpGet');

    const onFileSelected = cy.spy().as('onFileSelected');

    cy.mount(
      <ConfigProvider config={config}>
        <ServerStaticFileSelect
          onFileSelected={onFileSelected}
        />
      </ConfigProvider>,
    );

    cy.get('@httpGet').should('have.been.calledWithMatch', 'index.json');

    // Select category
    cy.get('#category-select').click();
    cy.contains('Test category').click();

    // First: select malformed sequence (no path)
    cy.get('#option-select').click();
    cy.contains('No path sequence').click();
    cy.contains('button', 'Submit').click();

    cy.get('.MuiAlert-colorError')
      .contains('Malformatted option, must have a path')
      .should('exist');
    cy.get('@onFileSelected').should('not.have.been.called');

    // Then: select valid sequence but make file request fail
    cy.get('#option-select').click();
    cy.contains('Valid path sequence').click();
    cy.contains('button', 'Submit').click();

    cy.get('.MuiAlert-colorError')
      .contains('Error requesting file')
      .should('exist');
    cy.get('@onFileSelected').should('not.have.been.called');
  });
  it('handles filtering by categories', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: dummyIndex,
        });
      }
    });
    cy.wrap(httpGet).as('httpGet');

    cy.mount(
      <ConfigProvider config={config}>
        <ServerStaticFileSelect
          onFileSelected={cy.spy()}
        />
      </ConfigProvider>,
    );

    cy.get('@httpGet').should('have.been.calledWithMatch', 'index.json');

    // Select category
    cy.get('#category-select').click();
    cy.contains('Test category').click();

    // Only one sequence should be shown
    cy.get('#option-select').click();
    cy.contains('Example sequence 1').should('exist');
    cy.contains('Example sequence 2').should('not.exist');
    cy.contains('Example sequence 3').should('exist');
    // Select sequence
    cy.contains('Example sequence 1').click();

    // Select All
    cy.get('#category-select').click();
    cy.contains('All').click();

    // Nothing should be selected
    cy.get('#option-select').should('have.value', '');
  });
  it('works with syntaxes', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: dummyIndex,
        });
      }
      if (url.endsWith('/example.json')) {
        return Promise.resolve({ data: '{"name": "Example syntax 1"}' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    cy.wrap(httpGet).as('httpGet');

    const onFileSelected = cy.spy().as('onFileSelected');
    cy.mount(
      <ConfigProvider config={config}>
        <ServerStaticFileSelect
          onFileSelected={onFileSelected}
          type="syntax"
        />
      </ConfigProvider>,
    );

    cy.get('@httpGet').should('have.been.calledWithMatch', 'index.json');

    // Select syntax
    cy.get('#option-select').click();
    cy.contains('Example syntax 1').click();

    // Submit form
    cy.contains('button', 'Submit').click();
    cy.get('@httpGet').should('have.been.calledWithMatch', 'example.json');

    cy.get('@onFileSelected').should('have.been.calledOnce');
    cy.get('@onFileSelected').should((spy) => {
      const [file] = spy.lastCall.args;
      expect(file.name).to.equal('example.json');
      expect(file.type).to.equal('text/plain');
      expect(file.size).to.equal(28);
    });
  });
  it('allows selecting all sequences with the Select all option when multiple', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: dummyIndex,
        });
      }
      if (url.endsWith('/example.fa')) {
        return Promise.resolve({ data: 'ATGC' });
      }
      if (url.endsWith('/example2.gb')) {
        return Promise.resolve({ data: 'ATGCA' });
      }
      if (url.endsWith('/example3.fa')) {
        return Promise.resolve({ data: 'ATGCG' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    cy.wrap(httpGet).as('httpGet');

    const onFileSelected = cy.spy().as('onFileSelected');
    cy.mount(
      <ConfigProvider config={config}>
        <ServerStaticFileSelect
          onFileSelected={onFileSelected}
          multiple
        />
      </ConfigProvider>,
    );

    cy.get('@httpGet').should('have.been.calledWithMatch', 'index.json');

    // Use the Select all option to select all sequences
    cy.get('#option-select').click();
    cy.contains('Select all').click();
    cy.get('body').click(0, 0);

    // Submit form
    cy.contains('button', 'Submit').click();

    cy.get('@httpGet').should('have.been.calledWithMatch', 'example.fa');
    cy.get('@httpGet').should('have.been.calledWithMatch', 'example2.gb');
    cy.get('@httpGet').should('have.been.calledWithMatch', 'example3.fa');

    cy.get('@onFileSelected').should('have.been.calledOnce');
    cy.get('@onFileSelected').should((spy) => {
      const [files] = spy.lastCall.args;
      expect(files).to.have.length(3);
      expect(files[0].name).to.equal('example.fa');
      expect(files[0].type).to.equal('text/plain');
      expect(files[1].name).to.equal('example2.gb');
      expect(files[1].type).to.equal('text/plain');
      expect(files[2].name).to.equal('example3.fa');
      expect(files[2].type).to.equal('text/plain');
    });
  });
  it('clicking select all only selects the sequences that were filtered by category', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: dummyIndex,
        });
      }
      if (url.endsWith('/example.fa')) {
        return Promise.resolve({ data: 'ATGC' });
      }
      if (url.endsWith('/example3.fa')) {
        return Promise.resolve({ data: 'ATGCG' });
      }
    });
    cy.wrap(httpGet).as('httpGet');
    const onFileSelected = cy.spy().as('onFileSelected');
    cy.mount(
      <ConfigProvider config={config}>
        <ServerStaticFileSelect
          onFileSelected={onFileSelected}
          multiple
        />
      </ConfigProvider>,
    );
    cy.get('@httpGet').should('have.been.calledWithMatch', 'index.json');

    // Select category
    cy.get('#category-select').click();
    cy.contains('Test category').click();

    // Select all
    cy.get('#option-select').click();
    cy.contains('Select all').click();

    // Only one sequence should be shown
    cy.get('#option-select').click();
    cy.contains('Example sequence 1').should('exist');
    cy.contains('Example sequence 2').should('not.exist');
    cy.contains('Example sequence 3').should('exist');

    // Click outside to close select element
    cy.get('body').click(0, 0);
    cy.contains('button', 'Submit').click();

    cy.get('@httpGet').should('have.been.calledThrice');
    cy.get('@onFileSelected').should('have.been.calledOnce');
    cy.get('@onFileSelected').should((spy) => {
      const [files] = spy.lastCall.args;
      expect(files).to.have.length(2);
      expect(files[0].name).to.equal('example.fa');
      expect(files[1].name).to.equal('example3.fa');
    });
  })
  it('works with multiple', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: dummyIndex,
        });
      }
      if (url.endsWith('/example.fa')) {
        return Promise.resolve({ data: 'ATGC' });
      }
      if (url.endsWith('/example2.gb')) {
        return Promise.resolve({ data: 'ATGCA' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    cy.wrap(httpGet).as('httpGet');
    const onFileSelected = cy.spy().as('onFileSelected');
    cy.mount(
      <ConfigProvider config={config}>
        <ServerStaticFileSelect
          onFileSelected={onFileSelected}
          multiple
        />
      </ConfigProvider>,
    );
    cy.get('@httpGet').should('have.been.calledWithMatch', 'index.json');

    // Select sequence
    cy.get('#option-select').click();
    cy.contains('Example sequence 1').click();
    cy.contains('Example sequence 2').click();
    // Click outside to close select element
    cy.get('body').click(0, 0);
    cy.contains('button', 'Submit').click();

    cy.get('@httpGet').should('have.been.calledThrice');
    cy.get('@onFileSelected').should('have.been.calledOnce');
    cy.get('@onFileSelected').should((spy) => {
      const [files] = spy.lastCall.args;
      expect(files).to.have.length(2);
      expect(files[0].name).to.equal('example.fa');
      expect(files[0].type).to.equal('text/plain');
      expect(files[0].size).to.equal(4);
      expect(files[1].name).to.equal('example2.gb');
      expect(files[1].type).to.equal('text/plain');
      expect(files[1].size).to.equal(5);
    });
  });

  it('can filter with multiple', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: dummyIndex,
        });
      }
    });

    cy.wrap(httpGet).as('httpGet');
    cy.mount(
      <ConfigProvider config={config}>
        <ServerStaticFileSelect
          onFileSelected={cy.spy()}
          multiple
        />
      </ConfigProvider>,
    );
    cy.get('@httpGet').should('have.been.calledWithMatch', 'index.json');

    // Select category
    cy.get('#category-select').click();
    cy.contains('Test category').click();

    // Only one sequence should be shown
    cy.get('#option-select').click();
    cy.contains('Example sequence 1').should('exist');
    cy.contains('Example sequence 2').should('not.exist');
    cy.contains('Example sequence 3').should('exist');

  });
});
