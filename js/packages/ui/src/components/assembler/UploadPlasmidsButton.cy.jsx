import React from 'react';
import { ConfigProvider } from '@opencloning/ui/providers/ConfigProvider';
import { DatabaseProvider } from '@opencloning/ui/providers/DatabaseContext';
import { localFilesHttpClient } from '@opencloning/ui/hooks';
import UploadPlasmidsButton from './UploadPlasmidsButton';
import mocloSyntax from '../../../../../cypress/test_files/syntax/moclo_syntax.json';

mocloSyntax.overhangNames = {
  ...mocloSyntax.overhangNames,
  CCCT: 'CCCT_overhang',
  AACG: 'AACG_overhang',
};
mocloSyntax.assemblyEnzymes = ['BsaI'];

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

// Test config
const testConfig = {
  backendUrl: 'http://localhost:8000',
  showAppBar: false,
  noExternalRequests: false,
  enableAssembler: true,
  enablePlannotate: false,
};

describe('<UploadPlasmidsButton />', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.clear();
    });
  });

  it('calls addPlasmids with correctly formatted valid plasmid', () => {
    cy.viewport(1200, 800);
    const addPlasmidsSpy = cy.spy().as('addPlasmidsSpy');

    cy.mount(
      <ConfigProvider config={testConfig}>
        <UploadPlasmidsButton addPlasmids={addPlasmidsSpy} syntax={mocloSyntax} />
      </ConfigProvider>,
    );

    cy.get('[data-testid="load-plasmids-button"]').click();
    cy.get('[data-testid="load-plasmids-from-local-server"]').should('not.exist');
    cy.get('body').type('{esc}');
    cy.get('[data-testid="load-plasmids-file-input"]').selectFile([
      'cypress/test_files/syntax/pYTK002.gb',
      'cypress/test_files/syntax/moclo_ytk_multi_part.gb',
      'cypress/test_files/syntax/pYTK095.gb',
      'cypress/test_files/sequencing/locus.gb',
      // This one just to verify that it works with no features
      'cypress/test_files/syntax/pYTK002_no_features.gb'
    ],
    { force: true });

    // Wait for the dialog to appear (indicating plasmids were processed)
    cy.get('.MuiDialog-root', { timeout: 10000 }).should('be.visible');

    cy.get('@addPlasmidsSpy').should('not.have.been.called');

    cy.get('[data-testid="invalid-plasmids-box"]').contains('Invalid Plasmids').should('exist');
    cy.get('[data-testid="valid-plasmids-box"]').contains('Valid Plasmids').should('exist');

    cy.get('[data-testid="invalid-plasmids-box"]').contains('pYTK057')
    cy.get('[data-testid="invalid-plasmids-box"]').contains('moclo_ytk_multi_part.gb')
    cy.get('[data-testid="invalid-plasmids-box"] .MuiChip-label').contains('ATCC-TGGC')
    cy.get('[data-testid="invalid-plasmids-box"] .MuiChip-label').contains('CCCT-AACG (CCCT_overhang-AACG_overhang)')
    cy.get('[data-testid="invalid-plasmids-box"]').contains('Contains multiple parts')
    cy.get('[data-testid="invalid-plasmids-box"]').contains('locus.gb')

    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(1).find('[role="gridcell"]').eq(0).should('contain', 'pYTK002')
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(1).find('[role="gridcell"]').eq(1).should('contain', 'pYTK002.gb')
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(1).find('[role="gridcell"]').eq(2).should('contain', 'CCCT-AACG (CCCT_overhang-AACG_overhang)')
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(1).find('[role="gridcell"]').eq(3).should('contain', '1')
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(1).find('[role="gridcell"]').eq(4).should('contain', 'ConS')
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(1).then(($el) => {
      const bgColor = window.getComputedStyle($el[0]).backgroundColor;
      cy.wrap(bgColor).should('equal', 'rgb(132, 197, 222)');
    });

    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(3).find('[role="gridcell"]').eq(0).should('contain', 'pYTK095')
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(3).find('[role="gridcell"]').eq(1).should('contain', 'pYTK095.gb')
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(3).find('[role="gridcell"]').eq(2).should('contain', 'TACA-CCCT (TACA-CCCT_overhang)')
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(3).find('[role="gridcell"]').eq(3).should('contain', 'Spans multiple parts')
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(3).find('[role="gridcell"]').eq(4).should('contain', 'AmpR')

    // No features
    cy.get('[data-testid="valid-plasmids-box"] [role="row"]').eq(2).find('[role="gridcell"]').eq(4).should('contain', '-');

    // Click the import button
    cy.contains('button', 'Import valid plasmids').click();

    // Verify addPlasmids was called
    cy.get('@addPlasmidsSpy').should('have.been.called');

    // Verify it was called with an array and check structure
    cy.get('@addPlasmidsSpy').then((spy) => {
      const firstCall = spy.getCall(0);
      cy.wrap(firstCall.args[0]).should('be.an', 'array');
      cy.wrap(firstCall.args[0]).should('have.length', 3);

      const firstPlasmid = firstCall.args[0][0];

      cy.wrap(firstPlasmid.file_name).should('equal', 'pYTK002.gb');
      cy.wrap(firstPlasmid.plasmid_name).should('equal', 'pYTK002.gb (ConS)');
      cy.wrap(firstPlasmid.left_overhang).should('equal', 'CCCT');
      cy.wrap(firstPlasmid.right_overhang).should('equal', 'AACG');
      cy.wrap(firstPlasmid.key).should('equal', 'CCCT-AACG');

      const {appData} = firstPlasmid.sequenceData;

      cy.wrap(appData.fileName).should('equal', 'pYTK002.gb');
      cy.wrap(appData.correspondingParts).should('deep.equal', ['CCCT-AACG']);
      cy.wrap(appData.correspondingPartsNames).should('deep.equal', ["CCCT_overhang-AACG_overhang"]);

    });
  });


  it('does not allow to submit when all plasmids are invalid', () => {
    cy.mount(
      <ConfigProvider config={testConfig}>
        <UploadPlasmidsButton addPlasmids={() => {}} syntax={mocloSyntax} />
      </ConfigProvider>,
    );
    cy.get('[data-testid="load-plasmids-file-input"]').selectFile([
      'cypress/test_files/sequencing/locus.gb'],
    { force: true });

    // Wait for the dialog to appear (indicating plasmids were processed)
    cy.get('.MuiDialog-root', { timeout: 10000 }).should('be.visible');

    cy.get('[data-testid="invalid-plasmids-box"]').contains('Invalid Plasmids').should('exist');
    cy.get('[data-testid="valid-plasmids-box"]').should('not.exist');

    cy.get('button').contains('Import valid plasmids').should('be.disabled');

  });

  it('cancelling does not call addPlasmids', () => {
    const addPlasmidsSpy = cy.spy().as('addPlasmidsSpy');
    cy.mount(
      <ConfigProvider config={testConfig}>
        <UploadPlasmidsButton addPlasmids={addPlasmidsSpy} syntax={mocloSyntax} />
      </ConfigProvider>,
    );
    
    cy.get('[data-testid="load-plasmids-file-input"]').selectFile([
      'cypress/test_files/syntax/pYTK002.gb',
      'cypress/test_files/syntax/moclo_ytk_multi_part.gb',
      'cypress/test_files/syntax/pYTK095.gb',
      'cypress/test_files/sequencing/locus.gb'],
    { force: true });
    
    cy.get('.MuiDialog-root', { timeout: 10000 }).should('be.visible');

    cy.get('button').contains('Cancel').click();

    cy.get('@addPlasmidsSpy').should('not.have.been.called');

  });

  it('loads plasmids from local server', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: dummyIndex,
        });
      }
      if (url.endsWith('/example.fa')) {
        return Promise.resolve({ data: '>example\nATGC' });
      }
      if (url.endsWith('/example2.gb')) {
        return cy.readFile('cypress/test_files/syntax/pYTK002.gb').then((fileContent) => ({ data: fileContent }));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    cy.wrap(httpGet).as('httpGet');
    const addPlasmidsSpy = cy.spy().as('addPlasmidsSpy');
    cy.mount(
      <ConfigProvider config={{...testConfig, staticContentPath: 'collection'}}>
        <UploadPlasmidsButton addPlasmids={addPlasmidsSpy} syntax={mocloSyntax} />
      </ConfigProvider>,
    );
    cy.get('[data-testid="load-plasmids-button"]').click();
    cy.get('[data-testid="load-plasmids-from-local-server"]').click();

    cy.get('button').contains('Submit').should('be.disabled');
    cy.get('#option-select').click();
    cy.contains('Example sequence 1').click();
    cy.contains('Example sequence 2').click();
    // Click outside to close select element
    cy.get('.MuiDialog-container h2').click({force: true});
    cy.contains('button', 'Submit').click();

    cy.get('[data-testid="invalid-plasmids-box"]').contains('Invalid Plasmids').should('exist');
    cy.get('[data-testid="valid-plasmids-box"]').contains('Valid Plasmids').should('exist');
    cy.get('[data-testid="valid-plasmids-box"]').should('contain', 'pYTK002');
    cy.get('[data-testid="invalid-plasmids-box"]').should('contain', 'example.fa');
    cy.get('button').contains('Import valid plasmids').click();
    cy.get('@addPlasmidsSpy').should('have.been.called');
    cy.get('@addPlasmidsSpy').then((spy) => {
      const firstCall = spy.getCall(0);
      cy.wrap(firstCall.args[0]).should('be.an', 'array');
      cy.wrap(firstCall.args[0]).should('have.length', 1);
      cy.wrap(firstCall.args[0][0].file_name).should('equal', 'example2.gb');
    });
  });
  it('handles error loading plasmids from local server', () => {
    const httpGet = cy.stub(localFilesHttpClient, 'get').callsFake((url) => {
      if (url.endsWith('/index.json')) {
        return Promise.resolve({
          data: dummyIndex,
        });
      } 
      if (url.endsWith('/example2.gb')) {
        return Promise.resolve({ data: 'wrong_format' });
      }
    });
    cy.wrap(httpGet).as('httpGet');
    const addPlasmidsSpy = cy.spy().as('addPlasmidsSpy');
    cy.mount(
      <ConfigProvider config={{...testConfig, staticContentPath: 'collection'}}>
        <UploadPlasmidsButton addPlasmids={addPlasmidsSpy} syntax={mocloSyntax} />
      </ConfigProvider>,
    );
    cy.get('[data-testid="load-plasmids-button"]').click();
    cy.get('[data-testid="load-plasmids-from-local-server"]').click();
    cy.get('button').contains('Submit').should('be.disabled');
    cy.get('#option-select').click();
    cy.contains('Example sequence 1').click();
    cy.get('.MuiDialog-container h2').click({force: true});
    cy.contains('button', 'Submit').click();
    cy.get('.MuiAlert-colorError').contains('Error requesting file').should('exist');

    cy.get('#option-select').click();
    cy.get('ul').contains('Example sequence 1').click();
    cy.contains('Example sequence 2').click();
    cy.get('.MuiDialog-container h2').click({force: true});
    cy.contains('button', 'Submit').click();
    cy.get('.MuiAlert-colorError').contains('Error uploading plasmid from file example2.gb').should('exist');
    cy.get('.MuiAlert-colorError').contains('Error requesting file').should('not.exist');

    cy.get('@addPlasmidsSpy').should('not.have.been.called');
  });

  it('does not show the database button when there is no database or it does not support bulk loading', () => {
    cy.mount(
      <ConfigProvider config={testConfig}>
        <DatabaseProvider value={{ name: 'MockDB' }}>
          <UploadPlasmidsButton addPlasmids={() => {}} syntax={mocloSyntax} />
        </DatabaseProvider>
      </ConfigProvider>,
    );
    cy.get('[data-testid="load-plasmids-button"]').click();
    cy.get('[data-testid="load-plasmids-from-files"]').should('exist');
    cy.get('[data-testid="load-plasmids-from-database"]').should('not.exist');
  });

  it('loads plasmids from the database as DatabaseSource plasmids', () => {
    cy.readFile('cypress/test_files/syntax/pYTK002.gb').then((pYTK002) => {
      cy.readFile('cypress/test_files/syntax/moclo_ytk_multi_part.gb').then((multiPart) => {
        const entries = [
          { databaseId: 10, name: 'pYTK002_db', textFileSequence: { id: 10, type: 'TextFileSequence', sequence_file_format: 'genbank', overhang_crick_3prime: 0, overhang_watson_3prime: 0, file_content: pYTK002 } },
          { databaseId: 20, name: 'multi_part_db', textFileSequence: { id: 20, type: 'TextFileSequence', sequence_file_format: 'genbank', overhang_crick_3prime: 0, overhang_watson_3prime: 0, file_content: multiPart } },
        ];
        const mockDatabase = {
          name: 'MockDB',
          GetSequencesInBulkComponent: ({ onSequencesLoaded }) => <button type="button" onClick={() => onSequencesLoaded(entries)}>Mock load</button>,
        };
        const addPlasmidsSpy = cy.spy().as('addPlasmidsSpy');
        cy.mount(
          <ConfigProvider config={testConfig}>
            <DatabaseProvider value={mockDatabase}>
              <UploadPlasmidsButton addPlasmids={addPlasmidsSpy} syntax={mocloSyntax} />
            </DatabaseProvider>
          </ConfigProvider>,
        );
        cy.get('[data-testid="load-plasmids-button"]').click();
        cy.get('[data-testid="load-plasmids-from-database"]').contains('From MockDB').click();
        cy.contains('button', 'Mock load').click();
        // The bulk dialog closes and the valid / invalid dialog is shown
        cy.contains('button', 'Mock load').should('not.exist');
        cy.get('[data-testid="invalid-plasmids-box"]').contains('multi_part_db');
        cy.get('[data-testid="valid-plasmids-box"]').contains('pYTK002_db');

        cy.contains('button', 'Import valid plasmids').click();
        cy.get('@addPlasmidsSpy').should('have.been.calledOnce');
        cy.get('@addPlasmidsSpy').then((spy) => {
          const plasmids = spy.getCall(0).args[0];
          expect(plasmids).to.have.length(1);
          const [plasmid] = plasmids;
          expect(plasmid.type).to.equal('databaseSequence');
          expect(plasmid.database_id).to.equal(10);
          expect(plasmid.plasmid_name).to.equal('pYTK002_db (ConS)');
          expect(plasmid.key).to.equal('CCCT-AACG');
          expect(plasmid.userUploaded).to.equal(true);
          // The sequence is kept as returned by the database
          expect(plasmid.textFileSequence).to.deep.equal(entries[0].textFileSequence);
        });
      });
    });
  });

  it('shows an error if a database sequence cannot be parsed', () => {
    const mockDatabase = {
      name: 'MockDB',
      GetSequencesInBulkComponent: ({ onSequencesLoaded }) => <button type="button" onClick={() => onSequencesLoaded([{ databaseId: 1, name: 'broken', textFileSequence: { file_content: 'wrong_format' } }])}>Mock load</button>,
    };
    const addPlasmidsSpy = cy.spy().as('addPlasmidsSpy');
    cy.mount(
      <ConfigProvider config={testConfig}>
        <DatabaseProvider value={mockDatabase}>
          <UploadPlasmidsButton addPlasmids={addPlasmidsSpy} syntax={mocloSyntax} />
        </DatabaseProvider>
      </ConfigProvider>,
    );
    cy.get('[data-testid="load-plasmids-button"]').click();
    cy.get('[data-testid="load-plasmids-from-database"]').contains('From MockDB').click();
    cy.contains('button', 'Mock load').click();
    cy.get('.MuiAlert-colorError').contains('Error loading plasmid broken from database').should('exist');
    cy.get('@addPlasmidsSpy').should('not.have.been.called');
  });
});
