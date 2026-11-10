/* eslint-disable camelcase */
import React from 'react';
import { ConfigProvider } from '@opencloning/ui/providers/ConfigProvider';
import { DatabaseProvider } from '@opencloning/ui/providers/DatabaseContext';
import store from '@opencloning/store';
import { AssemblerComponent } from './Assembler';


// Test config
const testConfig = {
  backendUrl: 'http://localhost:8000',
  showAppBar: false,
  noExternalRequests: false,
  enableAssembler: true,
  enablePlannotate: false,
};

const dummyResponse = {
  sources: [
    {
      id: 1,
      type: "ManuallyTypedSource",
      output_name: null,
      database_id: null,
      input: []
    }
  ],
  sequences: [
    {
      id: 1,
      type: "TextFileSequence",
      sequence_file_format: "genbank",
      overhang_crick_3prime: 0,
      overhang_watson_3prime: 0,
      file_content: "LOCUS       name                       5 bp    DNA     linear   UNK 01-JAN-1980\nDEFINITION  description.\nACCESSION   id\nVERSION     id\nKEYWORDS    .\nSOURCE      .\n  ORGANISM  .\n            .\nFEATURES             Location/Qualifiers\nORIGIN\n        1 aaaaa\n//"
    }
  ]
}
const dummyResponse2 = {
  sources: [{
    ...dummyResponse.sources[0],
    id: 2,
    type: 'RestrictionAndLigationSource',
    input: [
      {
        sequence: 1,
      },
      {
        sequence: 2,
      }],
  }
  ],
  sequences: [{
    ...dummyResponse.sequences[0],
    id: 2,
  }],
}

// Test data
const mockPlasmids = [
  {
    id: 1,
    plasmid_name: 'Test Plasmid 1',
    left_overhang: 'CCCT',
    right_overhang: 'AACG',
    key: 'CCCT-AACG',
    type: 'AddgeneIdSource',
    source: {
      id: 1,
      type: 'AddgeneIdSource',
      input: [],
      repository_id: '12345',
    },
  },
  {
    id: 2,
    plasmid_name: 'Test Plasmid 2',
    left_overhang: 'AACG',
    right_overhang: 'CCCT',
    key: 'AACG-CCCT',
    type: 'AddgeneIdSource',
    source: {
      id: 2,
      type: 'AddgeneIdSource',
      input: [],
      repository_id: '67890',
    },
  },
  {
    id: 3,
    plasmid_name: 'Test Plasmid 3',
    left_overhang: 'CCCT',
    right_overhang: 'AACG',
    key: 'CCCT-AACG',
    type: 'AddgeneIdSource',
    source: {
      id: 3,
      type: 'AddgeneIdSource',
      input: [],
      repository_id: '11111',
    },
  },
];

const mockCategories = [
  {
    id: 1,
    displayName: 'Category 1',
    left_overhang: 'CCCT',
    right_overhang: 'AACG',
    key: 'CCCT-AACG',
  },
  {
    id: 2,
    displayName: 'Category 2',
    left_overhang: 'AACG',
    right_overhang: 'CCCT',
    key: 'AACG-CCCT',
  },
];

describe('<AssemblerComponent />', () => {
  beforeEach(() => {
    // Set up a complete assembly for testing
    cy.window().then((win) => {
      // Ensure we have a clean state
      win.localStorage.clear();
    });

    const addAlertStub = cy.stub().as('addAlert')
    cy.mount(
      <ConfigProvider config={testConfig}>
        <AssemblerComponent
          plasmids={mockPlasmids}
          categories={mockCategories}
          assemblyEnzymes={['assembly_enzyme']}
          addAlert={addAlertStub}
          appInfo={{}}
        />
      </ConfigProvider>,
    );
    // Select first plasmid
    cy.get('[data-testid="plasmid-select"]').first().within(() => {
      cy.get('input').click();
    });
    cy.get('li').contains('Test Plasmid 1').click();

    // Select second plasmid
    cy.get('[data-testid="plasmid-select"]').eq(1).within(() => {
      cy.get('input').click();
    });
    cy.get('li').contains('Test Plasmid 2').click();
  });

  it('displays error when fetching sequence for a plasmid fails', () => {
    // Intercept the requestSources call (POST to addgene endpoint)
    cy.intercept('POST', 'http://localhost:8000/repository_id*', {
      statusCode: 500,
      body: {
        detail: 'Failed to fetch plasmid sequence',
      },
    }).as('fetchPlasmidError');

    // Click submit button
    cy.get('[data-testid="assembler-submit-button"]').should('be.visible').click();

    // Wait for the error request
    cy.wait('@fetchPlasmidError');

    // Check that error message is displayed
    cy.get('.MuiAlert-colorError').should('exist');
    cy.contains('Error fetching sequence for').should('exist');
    cy.contains('Test Plasmid 1').should('exist');
  });

  it('displays error when assembling sequences fails', () => {
    // Mock successful source fetching
    cy.intercept('POST', 'http://localhost:8000/repository_id*', {
      statusCode: 200,
      body: dummyResponse,
    }).as('fetchSourceSuccess');

    // Mock failed assembly request
    cy.intercept('POST', 'http://localhost:8000/restriction_and_ligation*', {
      statusCode: 500,
      body: {
        detail: 'Failed to assemble sequences',
      },
    }).as('assemblyError');

    // Click submit button
    cy.get('[data-testid="assembler-submit-button"]').should('be.visible').click();

    // Wait for both requests
    cy.wait('@fetchSourceSuccess');
    cy.wait('@assemblyError');

    // Check that error message is displayed
    cy.get('.MuiAlert-colorError').should('exist');
    cy.contains('Error assembling').should('exist');
    cy.contains('Test Plasmid 1').should('exist');
    cy.contains('Test Plasmid 2').should('exist');
  });

  it('displays network error message correctly', () => {
    // Intercept with network error
    cy.intercept('POST', 'http://localhost:8000/repository_id*', {
      forceNetworkError: true,
    }).as('networkError');

    // Click submit button
    cy.get('[data-testid="assembler-submit-button"]').should('be.visible').click();

    // Wait for the error request
    cy.wait('@networkError');

    // Check that error message is displayed
    cy.get('.MuiAlert-colorError').should('exist');
    cy.contains('Error fetching sequence for').should('exist');
  });

  it('clears error message when assembly selection is cleared', () => {
    // Intercept with error
    cy.intercept('POST', 'http://localhost:8000/repository_id*', {
      statusCode: 500,
      body: {
        detail: 'Failed to fetch plasmid sequence',
      },
    }).as('fetchPlasmidError');


    // Click submit button to trigger error
    cy.get('[data-testid="assembler-submit-button"]').should('be.visible').click();
    cy.wait('@fetchPlasmidError');

    // Verify error is displayed
    cy.get('.MuiAlert-colorError').should('exist');

    // Clear the assembly by clicking the clear button in the first category select
    cy.get('[data-testid="CancelIcon"]').first().click({ force: true });

    // Error should be cleared
    cy.get('.MuiAlert-colorError').should('not.exist');
  });

  it('works in normal case', () => {
    // Mock successful source fetching
    cy.intercept('POST', 'http://localhost:8000/repository_id*', {
      statusCode: 200,
      body: dummyResponse,
    }).as('fetchSourceSuccess');
    // Mock assembly request
    cy.intercept('POST', 'http://localhost:8000/restriction_and_ligation*', (req) => {
      // Check that the value of the enzyme was set in the request body
      expect(req.body).to.have.property('source');
      expect(req.body.source).to.have.property('restriction_enzymes');
      expect(req.body.source.restriction_enzymes).to.include('assembly_enzyme');
      // Check that the value of the sort_by_recognition_sites was set in the request query
      expect(req.query).to.have.property('sort_by_recognition_sites');
      expect(req.query.sort_by_recognition_sites).to.equal('true');
      req.reply({
        statusCode: 200,
        body: dummyResponse2,
      });
    }).as('assemblySuccess');

    // Click submit button
    cy.get('[data-testid="assembler-submit-button"]').should('be.visible').click();
    cy.wait('@fetchSourceSuccess');
    cy.wait('@assemblySuccess');

    // Check that the table displays the name
    cy.get('[data-testid="assembler-product-table"]').contains('Category 1').should('exist');
    cy.get('[data-testid="assembler-product-table"]').contains('Category 2').should('exist');
    cy.get('[data-testid="assembler-product-table"]').contains('Test Plasmid 1').should('exist');
    cy.get('[data-testid="assembler-product-table"]').contains('Test Plasmid 2').should('exist');

    // Stub URL.createObjectURL before clicking (it's called with a Blob, not the filename)
    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL').callsFake((blob) => `blob:mock-${blob?.size ?? 0}`).as('createObjectURL');
    });

    // Click download assemblies button
    cy.get('[data-testid="assembler-download-assemblies-button"]').click();

    // Check that the download was triggered (createObjectURL receives the zip Blob)

    cy.get('@createObjectURL').should((stub) => {
      expect(stub).to.have.been.calledOnce;
      expect(stub.firstCall.args[0]).to.be.instanceOf(Blob);
      expect(stub.firstCall.args[0].type).to.equal('application/zip');
    });

    cy.get('@addAlert').should('have.not.been.called');

  });
  it('displays error message when downloading assemblies fails', () => {

    cy.intercept('POST', 'http://localhost:8000/repository_id*', { statusCode: 200, body: dummyResponse }).as('fetchSourceSuccess');
    cy.intercept('POST', 'http://localhost:8000/restriction_and_ligation*', { statusCode: 200, body: dummyResponse }).as('assemblySuccess');

    cy.get('[data-testid="assembler-submit-button"]').should('be.visible').click();
    cy.wait('@fetchSourceSuccess');
    cy.wait('@assemblySuccess');


    cy.get('[data-testid="assembler-download-assemblies-button"]').click();

    cy.get('@addAlert').should('have.been.calledOnce');
    cy.get('@addAlert').should((stub) => {
      expect(stub.firstCall.args[0].message).to.include('Error downloading assemblies:');
      expect(stub.firstCall.args[0].severity).to.equal('error');
    });
  });

  it('disables download when output names have duplicates', () => {
    cy.get('[data-testid="plasmid-select"]').first().within(() => { cy.get('input').click(); });
    cy.get('li').contains('Test Plasmid 3').click();
    cy.intercept('POST', 'http://localhost:8000/repository_id*', { statusCode: 200, body: dummyResponse }).as('fetchSourceSuccess');
    cy.intercept('POST', 'http://localhost:8000/restriction_and_ligation*', { statusCode: 200, body: dummyResponse2 }).as('assemblySuccess');

    cy.get('[data-testid="assembler-submit-button"]').should('be.visible').click();
    cy.wait('@fetchSourceSuccess');
    cy.wait('@assemblySuccess');

    cy.get('[data-testid="assembler-product-table"]').should('exist');
    cy.get('[data-testid="assembler-download-assemblies-button"]').should('not.be.disabled');

    cy.get('[data-testid="assembler-product-table-edit-button"]').first().click();
    cy.get('[role="dialog"]').find('input').clear().type('duplicate_name');
    cy.get('[role="dialog"]').contains('Save').click();

    cy.get('[data-testid="assembler-product-table-edit-button"]').last().click();
    cy.get('[role="dialog"]').find('input').clear().type('duplicate_name');
    cy.get('[role="dialog"]').contains('Save').click();

    cy.get('[data-testid="assembler-download-assemblies-button"]').should('be.disabled');
  });

  it('disables download when output name is empty', () => {
    cy.intercept('POST', 'http://localhost:8000/repository_id*', { statusCode: 200, body: dummyResponse }).as('fetchSourceSuccess');
    cy.intercept('POST', 'http://localhost:8000/restriction_and_ligation*', { statusCode: 200, body: dummyResponse2 }).as('assemblySuccess');

    cy.get('[data-testid="assembler-submit-button"]').should('be.visible').click();
    cy.wait('@fetchSourceSuccess');
    cy.wait('@assemblySuccess');

    cy.get('[data-testid="assembler-product-table-edit-button"]').first().click();
    cy.get('[role="dialog"]').find('input').clear();
    cy.get('[role="dialog"]').contains('Save').click();

    cy.get('[data-testid="assembler-download-assemblies-button"]').should('be.disabled');
  });

  it('enables download when output names are valid and unique', () => {
    cy.intercept('POST', 'http://localhost:8000/repository_id*', { statusCode: 200, body: dummyResponse }).as('fetchSourceSuccess');
    cy.intercept('POST', 'http://localhost:8000/restriction_and_ligation*', { statusCode: 200, body: dummyResponse2 }).as('assemblySuccess');

    cy.get('[data-testid="assembler-submit-button"]').should('be.visible').click();
    cy.wait('@fetchSourceSuccess');
    cy.wait('@assemblySuccess');

    cy.get('[data-testid="assembler-download-assemblies-button"]').should('not.be.disabled');
  });
});

describe('<AssemblerComponent /> with plasmids from a database', () => {
  const databasePlasmids = [
    { id: 1, key: 'CCCT-AACG', database_id: 10 },
    { id: 2, key: 'AACG-CCCT', database_id: 20 },
  ].map(({ id, key, database_id }) => {
    const [left_overhang, right_overhang] = key.split('-');
    return {
      id,
      type: 'databaseSequence',
      plasmid_name: `DB Plasmid ${database_id}`,
      database_id,
      left_overhang,
      right_overhang,
      key,
      userUploaded: true,
      textFileSequence: { ...dummyResponse.sequences[0], id: database_id, file_content: `${dummyResponse.sequences[0].file_content}\n${database_id}` },
    };
  });

  it('uses the database sequences and creates DatabaseSources', () => {
    cy.intercept('POST', 'http://localhost:8000/restriction_and_ligation*', (req) => {
      // Sequence content is the one from the database, no request is made to fetch them
      expect(req.body.sequences.map((s) => s.file_content)).to.deep.equal(databasePlasmids.map((p) => p.textFileSequence.file_content));
      req.reply({ statusCode: 200, body: dummyResponse2 });
    }).as('assemblySuccess');

    cy.mount(
      <ConfigProvider config={testConfig}>
        <AssemblerComponent
          plasmids={databasePlasmids}
          categories={mockCategories}
          assemblyEnzymes={['assembly_enzyme']}
          addAlert={cy.stub().as('addAlert')}
          appInfo={{}}
        />
      </ConfigProvider>,
    );
    cy.get('[data-testid="plasmid-select"]').first().within(() => {
      cy.get('input').click();
    });
    // Plasmids from the database are not highlighted (only those uploaded from files)
    cy.get('li').contains('DB Plasmid 10').should('not.have.css', 'background-color', 'rgb(220, 237, 200)');
    cy.get('li').contains('DB Plasmid 10').click();
    cy.get('[data-testid="plasmid-select"]').eq(1).within(() => {
      cy.get('input').click();
    });
    cy.get('li').contains('DB Plasmid 20').click();

    cy.get('[data-testid="assembler-submit-button"]').click();
    cy.wait('@assemblySuccess');
    cy.get('[data-testid="assembler-product-table"]').contains('DB Plasmid 10').should('exist');

    cy.get('[data-testid="assembler-product-table-view-button"]').first().click();
    cy.then(() => {
      const { sources, sequences } = store.getState().cloning;
      const databaseSources = sources.filter((s) => s.type === 'DatabaseSource');
      expect(databaseSources.map((s) => s.database_id)).to.deep.equal([10, 20]);
      databaseSources.forEach((source) => {
        expect(source.input).to.deep.equal([]);
        const sequence = sequences.find((seq) => seq.id === source.id);
        expect(sequence.file_content).to.equal(databasePlasmids.find((p) => p.database_id === source.database_id).textFileSequence.file_content);
      });
    });
    cy.get('@addAlert').should('have.not.been.called');
  });

  describe('Upload to DB', () => {
    function mountAndAssemble(database) {
      cy.intercept('POST', 'http://localhost:8000/restriction_and_ligation*', { statusCode: 200, body: dummyResponse2 }).as('assemblySuccess');
      const component = (
        <ConfigProvider config={testConfig}>
          <AssemblerComponent
            plasmids={databasePlasmids}
            categories={mockCategories}
            assemblyEnzymes={['assembly_enzyme']}
            addAlert={cy.stub().as('addAlert')}
            appInfo={{ backendVersion: '1', schemaVersion: '2', frontendVersion: '3' }}
          />
        </ConfigProvider>
      );
      cy.mount(database ? <DatabaseProvider value={database}>{component}</DatabaseProvider> : component);
      cy.get('[data-testid="plasmid-select"]').first().within(() => {
        cy.get('input').click();
      });
      cy.get('li').contains('DB Plasmid 10').click();
      cy.get('[data-testid="plasmid-select"]').eq(1).within(() => {
        cy.get('input').click();
      });
      cy.get('li').contains('DB Plasmid 20').click();
      cy.get('[data-testid="assembler-submit-button"]').click();
      cy.wait('@assemblySuccess');
      cy.get('[data-testid="assembler-download-assemblies-button"]').should('exist');
    }

    // Mock of the database dialog, stores the props it receives
    // submittedCount: number of strategies the mock reports as submitted on success
    function mockDatabase(submittedCount = 1) {
      const receivedProps = [];
      function SubmitCloningStrategiesInBulkComponent(props) {
        receivedProps.push(props);
        const syncResults = Array.from({ length: submittedCount }, (_, i) => ({ file_name: `${i}.json` }));
        return (
          <div data-testid="mock-submit-dialog">
            <button type="button" onClick={() => { props.onSuccess([{ id: 100 }], syncResults); props.onClose(); }}>mock success</button>
            <button type="button" onClick={props.onClose}>mock close</button>
          </div>
        );
      }
      return { database: { name: 'MockDB', SubmitCloningStrategiesInBulkComponent }, receivedProps };
    }

    it('is not shown without a database', () => {
      mountAndAssemble(null);
      cy.get('[data-testid="assembler-upload-to-db-button"]').should('not.exist');
    });

    it('is not shown if the database does not support bulk submission', () => {
      mountAndAssemble({ name: 'MockDB' });
      cy.get('[data-testid="assembler-upload-to-db-button"]').should('not.exist');
    });

    it('is disabled when an output name is empty', () => {
      const { database } = mockDatabase();
      mountAndAssemble(database);
      cy.get('[data-testid="assembler-upload-to-db-button"]').should('not.be.disabled');
      cy.get('[data-testid="assembler-product-table-edit-button"]').first().click();
      cy.get('[role="dialog"]').find('input').clear();
      cy.get('[role="dialog"]').contains('Save').click();
      cy.get('[data-testid="assembler-upload-to-db-button"]').should('be.disabled');
    });

    it('passes the cloning strategies of the assemblies to the database dialog', () => {
      const { database, receivedProps } = mockDatabase();
      mountAndAssemble(database);
      cy.get('[data-testid="assembler-product-table-edit-button"]').first().click();
      cy.get('[role="dialog"]').find('input').clear();
      cy.get('[role="dialog"]').find('input').type('my product');
      cy.get('[role="dialog"]').contains('Save').click();

      cy.get('[data-testid="mock-submit-dialog"]').should('not.exist');
      cy.get('[data-testid="assembler-upload-to-db-button"]').click();
      cy.get('[data-testid="mock-submit-dialog"]').should('exist');
      cy.then(() => {
        const { files } = receivedProps[receivedProps.length - 1];
        expect(files).to.have.length(1);
        expect(files[0]).to.be.instanceOf(File);
        expect(files[0].name).to.equal('my_product.json');
        return files[0].text();
      }).then((content) => {
        const cloningStrategy = JSON.parse(content);
        expect(cloningStrategy.backend_version).to.equal('1');
        const databaseSources = cloningStrategy.sources.filter((s) => s.type === 'DatabaseSource');
        expect(databaseSources.map((s) => s.database_id)).to.deep.equal([10, 20]);
        const finalSource = cloningStrategy.sources.find((s) => s.type === 'RestrictionAndLigationSource');
        expect(finalSource.output_name).to.equal('my_product');
        const finalSequence = cloningStrategy.sequences.find((s) => s.id === finalSource.id);
        expect(finalSequence.file_content.split('\n')[0]).to.contain('my_product');
      });

      cy.contains('button', 'mock success').click();
      cy.get('[data-testid="mock-submit-dialog"]').should('not.exist');
      cy.get('@addAlert').should('have.been.calledOnceWith', { message: 'Uploaded 1 assembly to MockDB', severity: 'success' });
    });

    it('reports the number of submitted assemblies, not the number of files', () => {
      const { database } = mockDatabase(2);
      mountAndAssemble(database);
      cy.get('[data-testid="assembler-upload-to-db-button"]').click();
      cy.contains('button', 'mock success').click();
      cy.get('@addAlert').should('have.been.calledOnceWith', { message: 'Uploaded 2 assemblies to MockDB', severity: 'success' });
    });

    it('closes the dialog without alerts', () => {
      const { database } = mockDatabase();
      mountAndAssemble(database);
      cy.get('[data-testid="assembler-upload-to-db-button"]').click();
      cy.contains('button', 'mock close').click();
      cy.get('[data-testid="mock-submit-dialog"]').should('not.exist');
      cy.get('@addAlert').should('not.have.been.called');
    });
  });
});
