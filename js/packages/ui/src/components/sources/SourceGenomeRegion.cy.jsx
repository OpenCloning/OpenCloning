import React from 'react';
import { AssemblyIdSelector, SpeciesPicker, SequenceAccessionPicker, } from './SourceGenomeRegion';
import { ConfigProvider } from '../../providers/ConfigProvider';

const config = {
  backendUrl: 'http://127.0.0.1:8000',
};

describe('<AssemblyIdSelector />', () => {
  it('can propose a paired accession if the assembly has no annotation', () => {
    const setAssemblyId = cy.spy().as('setAssemblyId');
    const setHasAnnotation = cy.spy().as('setHasAnnotation');
    const onAssemblyIdChange = cy.spy().as('onAssemblyIdChange');

    cy.intercept('GET', 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCA_000002945.3/dataset_report*', {
      statusCode: 200,
      body: {
        reports: [{
          accession: 'GCA_000002945.3',
          organism: {
            tax_id: 559292,
            organism_name: 'Saccharomyces cerevisiae'
          },
          annotation_info: undefined,
          paired_accession: 'GCF_000002945.3',
          assembly_info: {
            assembly_status: 'current'
          }
        }]
      }
    }).as('getAssemblyInfo');

    cy.intercept('GET', 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000002945.3/dataset_report*', {
      statusCode: 200, 
      body: {
        reports: [{
          accession: 'GCF_000002945.3',
          organism: {
            tax_id: 559292,
            organism_name: 'Saccharomyces cerevisiae'
          },
          annotation_info: {},
          assembly_info: {
            assembly_status: 'current'
          }
        }]
      }
    }).as('getPairedAssemblyInfo');

    cy.mount(
      <ConfigProvider config={config}>
        <AssemblyIdSelector 
          setAssemblyId={setAssemblyId}
          setHasAnnotation={setHasAnnotation}
          onAssemblyIdChange={onAssemblyIdChange}
        />
      </ConfigProvider>
    );
    cy.get('input').type('GCA_000002945.3');
    cy.wait('@getAssemblyInfo');

    cy.wait('@getPairedAssemblyInfo');
    cy.contains('Equivalent assembly GCF_000002945.3 has annotation').should('exist');
  });
  it('shows a warning when the paired accession lookup fails', () => {
    const setAssemblyId = cy.spy().as('setAssemblyId');
    const setHasAnnotation = cy.spy().as('setHasAnnotation');
    const onAssemblyIdChange = cy.spy().as('onAssemblyIdChange');

    cy.intercept('GET', 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCA_000002945.3/dataset_report*', {
      statusCode: 200,
      body: {
        reports: [{
          accession: 'GCA_000002945.3',
          organism: {
            tax_id: 559292,
            organism_name: 'Saccharomyces cerevisiae'
          },
          annotation_info: undefined,
          paired_accession: 'GCF_000002945.3',
          assembly_info: {
            assembly_status: 'current'
          }
        }]
      }
    }).as('getAssemblyInfo');

    cy.intercept('GET', 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000002945.3/dataset_report*', {
      statusCode: 500,
      body: {}
    }).as('getPairedAssemblyInfo');

    cy.mount(
      <ConfigProvider config={config}>
        <AssemblyIdSelector
          setAssemblyId={setAssemblyId}
          setHasAnnotation={setHasAnnotation}
          onAssemblyIdChange={onAssemblyIdChange}
        />
      </ConfigProvider>
    );
    cy.get('input').type('GCA_000002945.3');
    cy.wait('@getAssemblyInfo');
    cy.wait('@getPairedAssemblyInfo');

    cy.contains('Could not check whether an equivalent assembly has annotation:').should('exist');
    cy.contains('Equivalent assembly GCF_000002945.3 has annotation').should('not.exist');
    cy.get('label').contains('Species').siblings('div').children('input')
      .should('have.value', 'Saccharomyces cerevisiae - 559292');
  });
  it('handles NCBI being down displaying the right error', () => {
    cy.intercept('GET', 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCA_000002945.3/dataset_report*', {
      statusCode: 500,
      body: {}
    }).as('getAssemblyInfo');

    cy.mount(
      <ConfigProvider config={config}>
        <AssemblyIdSelector setAssemblyId={cy.spy()} setHasAnnotation={cy.spy()} onAssemblyIdChange={cy.spy()} />
      </ConfigProvider>
    );
    cy.get('input').type('GCA_000002945.3', { delay: 0});
    cy.wait('@getAssemblyInfo');
    cy.contains('Could not connect to server for validation.').should('exist');
  });
});

describe('<SpeciesPicker />', () => {
  it('handles NCBI being down displaying the right error', () => {
    const setSpecies = cy.spy().as('setSpecies');
    const setAssemblyId = cy.spy().as('setAssemblyId');

    cy.mount(
      <ConfigProvider config={config}>
        <SpeciesPicker setSpecies={setSpecies} setAssemblyId={setAssemblyId} />
      </ConfigProvider>
    );
    cy.intercept('GET', 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/taxonomy/taxon_suggest/**', {
      statusCode: 500,
      body: {}
    }).as('getTaxonSuggest');

    cy.get('input').type('Saccharomyces cerevisiae', { delay: 0});
    cy.wait('@getTaxonSuggest');
    cy.contains('Could not retrieve data').should('exist');
    // cy.get('li').contains('Saccharomyces cerevisiae - 559292').click();
  });
});

describe('<SequenceAccessionPicker />', () => {
  it('handles NCBI being down displaying the right error', () => {
    const setSequenceAccession = cy.spy().as('setSequenceAccession');
    const assemblyAccession = 'GCA_000002945.3';

    cy.intercept('GET', 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCA_000002945.3/sequence_reports*', {
      statusCode: 500,
      body: {}
    }).as('getSequenceReports');

    cy.mount(
      <ConfigProvider config={config}>
        <SequenceAccessionPicker assemblyAccession={assemblyAccession} sequenceAccession={''} setSequenceAccession={setSequenceAccession} />
      </ConfigProvider>
    );
    cy.contains('Could not load chromosomes').should('exist');
  });
  it('displays the chromosomes', () => {
    const setSequenceAccession = cy.spy().as('setSequenceAccession');
    const assemblyAccession = 'GCA_000002945.3';

    cy.intercept('GET', 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCA_000002945.3/sequence_reports*', {
      statusCode: 200,
      body: { reports: [{ chr_name: 'chr1', refseq_accession: 'NC_000001.10' }, { chr_name: 'chr2', refseq_accession: 'NC_000002.11' }] }
    }).as('getSequenceReports');

    cy.mount(
      <ConfigProvider config={config}>
        <SequenceAccessionPicker assemblyAccession={assemblyAccession} setSequenceAccession={setSequenceAccession} />
      </ConfigProvider>
    );
    cy.wait('@getSequenceReports');
    cy.get('label').siblings('div').first().click();
    cy.contains('chr1 - NC_000001.10').should('exist');
    cy.contains('chr2 - NC_000002.11').should('exist');
    cy.get('div[role="presentation"]').contains('chr1 - NC_000001.10').click();
    // Check that the spy was called with the expected value
    cy.get('@setSequenceAccession').should('have.been.calledWith', 'NC_000001.10');

  });
});


