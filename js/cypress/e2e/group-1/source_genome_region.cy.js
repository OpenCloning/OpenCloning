import { clearInputValue, clickMultiSelectOption, setInputValue } from '../common_functions';

describe('GenomeRegion Source', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.clickMultiSelectOption('Source type', 'Genome region', 'li#source-1');
  });
  it('works for reference genome', () => {
    cy.clickMultiSelectOption('Type of region', 'Locus in reference genome', 'li#source-1');
    cy.setInputValue('Species', 'cerevisiae', 'li#source-1');
    cy.get('[role="presentation"]').contains('Saccharomyces cerevisiae', { timeout: 20000 }).click();
    cy.get('label').contains('Assembly ID', { timeout: 20000 }).siblings('div').children('input')
      .should('have.value', 'GCF_000146045.2');
    cy.setInputValue('Gene', 'ase1', 'li#source-1');
    cy.get('[role="presentation"]').contains('ASE1', { timeout: 20000 }).click();
    cy.get('label').contains('Gene coordinates').siblings('div').children('input')
      .should('have.value', 'NC_001147.6 (433688..436345, complement)');
    cy.get('label').contains('Downstream bases').siblings('div').children('input')
      .clear('');
    cy.get('label').contains('Downstream bases').siblings('div').children('input')
      .type('2000');
    cy.get('button').contains('Submit').click();
    cy.get('#source-1 a', { timeout: 20000 }).contains('GCF_000146045.2').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000146045.2');
    cy.get('#source-1 a').contains('NC_001147.6').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/nuccore/NC_001147.6');
    // TODO: Test link to gene id
    cy.get('#source-1 a').contains('854223').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/gene/854223');
    cy.get('li#sequence-1').contains('NC_001147');
    cy.get('li#sequence-1').contains('5658 bps');
  });
  it('works for other assembly', () => {
    cy.get('#tab-panel-0 .MuiInputBase-root').eq(1).click();
    cy.get('li[data-value="other_assembly"]').click();
    // Select an input field that is after a label that contains the text "assembly ID"
    cy.get('label').contains('Assembly ID').siblings('div').children('input')
      .type('GCF_000146045.2');
    cy.get('label', { timeout: 20000 }).contains('Species').siblings('div').children('input')
      .should('have.value', 'Saccharomyces cerevisiae S288C - 559292');
    cy.get('label').contains('Gene').siblings('div').click();
    cy.get('div[role="presentation"]').contains('Type at least 3 characters to search');
    cy.get('label').contains('Gene').siblings('div').children('input')
      .type('ase1');
    //   Only when the gene is selected, the submit button appears
    cy.get('li#source-1 button.MuiButtonBase-root[type="submit"]').should('not.exist');
    cy.get('div[role="presentation"]').contains('Ase1', { timeout: 20000 }).click();
    cy.get('label').contains('Gene coordinates').siblings('div').children('input')
      .should('have.value', 'NC_001147.6 (433688..436345, complement)');
    cy.get('label').contains('Downstream bases').siblings('div').children('input')
      .clear('');
    cy.get('label').contains('Downstream bases').siblings('div').children('input')
      .type('2000');
    cy.get('button').contains('Submit').click();
    cy.get('#source-1 a', { timeout: 20000 }).contains('GCF_000146045.2').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000146045.2');
    cy.get('#source-1 a').contains('NC_001147.6').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/nuccore/NC_001147.6');
    // TODO: Test link to gene id
    cy.get('#source-1 a').contains('854223').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/gene/854223');
    cy.get('li#sequence-1').contains('NC_001147');
    cy.get('li#sequence-1').contains('5658 bps');
  });
  it('gives the right warnings and errors for other assembly', () => {
    cy.get('#tab-panel-0 .MuiInputBase-root').eq(1).click();
    cy.get('li[data-value="other_assembly"]').click();
    // Select an input field that is after a label that contains the text "assembly ID"
    cy.get('label').contains('Assembly ID').siblings('div').children('input')
      .type('blah');
    cy.get('#source-1').contains('Assembly ID does not exist', { timeout: 20000 });
    cy.get('label').contains('Assembly ID').siblings('div').children('input')
      .clear('');
    cy.contains('Assembly ID does not exist').should('not.exist');
    // Shows the right message if the assembly has no annotations
    setInputValue('Assembly ID', 'GCA_006386175.1', 'li#source-1');
    cy.get('li#source-1').contains('The selected assembly has no gene annotations', { timeout: 20000 });
    // Shows a warning when the id provided is not an exact match to any particular assembly
    setInputValue('Assembly ID', 'GCA_000002945', 'li#source-1');
    cy.get('li#source-1').contains('Using assembly ID', { timeout: 20000 });
    // Shows a warning if a newer assembly exists
    setInputValue('Assembly ID', 'GCF_000002945.1', 'li#source-1');
    cy.get('li#source-1').contains('Newer assembly exists', { timeout: 20000 });
    setInputValue('Assembly ID', 'GCF_000146045.2', 'li#source-1');
    cy.get('label').contains('Gene', { timeOut: 20000 }).siblings('div').children('input')
      .type('dummy');
    cy.get('div[role="presentation"]').contains('No results found', { timeout: 20000 });
    cy.get('label').contains('Gene').siblings('div').children('input')
      .clear('');
    cy.get('label').contains('Gene').siblings('div').children('input')
      .type('ase1');
    // Only when the gene is selected, the submit button appears
    cy.get('li#source-1 button.MuiButtonBase-root[type="submit"]').should('not.exist');
    cy.get('div[role="presentation"]').contains('Ase1', { timeout: 20000 });
    cy.get('div[role="presentation"]').contains('Ase1').click();
    cy.get('label').contains('Upstream bases').siblings('div').children('input')
      .clear('');
    cy.get('label').contains('Upstream bases').siblings('div').children('input')
      .type('187800900');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('.submit-backend-api .loading-progress', { timeout: 20000 }).should('not.exist');
    cy.get('.MuiAlert-message').should('be.visible');
  });
  it('works for sequence accession', () => {
    clickMultiSelectOption('Type of region', 'sequence accession', 'li#source-1');
    // Shows species and assembly ID if sequence accession belongs to assembly
    setInputValue('Sequence accession', 'NC_001147.6', 'li#source-1');
    cy.get('label').contains('Species', { timeout: 20000 }).siblings('div').children('input')
      .should('have.value', 'Saccharomyces cerevisiae S288C - 559292');
    // Works with accessions not linked to an assembly
    clearInputValue('Sequence accession', 'li#source-1');
    // Wait to not get rate-limited by NCBI API
    cy.wait(2000);
    setInputValue('Sequence accession', 'DQ208311.2', 'li#source-1');
    cy.get('li#source-1 label').contains('Start', { timeout: 20000 }).should('be.visible');
    setInputValue('Start', '1', 'li#source-1');
    setInputValue('End', '20', 'li#source-1');
    clickMultiSelectOption('Strand', 'plus', 'li#source-1');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('li#sequence-1 .veLinearView', { timeout: 20000 }).contains('DQ208311');
    cy.get('li#sequence-1 .veLinearView').contains('20 bps');
  });
  it('gives the right errors and warnings for sequence accesion', () => {
    clickMultiSelectOption('Type of region', 'sequence accession', 'li#source-1');
    setInputValue('Sequence accession', 'blah', 'li#source-1');
    cy.get('li#source-1').contains('Sequence accession does not exist', { timeout: 20000 });
    clearInputValue('Sequence accession', 'li#source-1');
    setInputValue('Sequence accession', 'NC_001147.6', 'li#source-1');
    // Clears form if sequence accession changes
    cy.get('li#source-1 label').contains('Start', { timeOut: 2000 }).should('exist');
    setInputValue('Start', '1', 'li#source-1');
    setInputValue('End', '20', 'li#source-1');
    clickMultiSelectOption('Strand', 'plus', 'li#source-1');
    clearInputValue('Sequence accession', 'li#source-1');
    setInputValue('Sequence accession', 'blah', 'li#source-1');
    cy.contains('Sequence accession does not exist', { timeout: 20000 });
    clearInputValue('Sequence accession', 'li#source-1');
    setInputValue('Sequence accession', 'NC_001147.6', 'li#source-1');
    cy.get('label').contains('Start', { timeout: 20000 }).siblings('div').children('input')
      .should('have.value', '');
    cy.get('label').contains('End').siblings('div').children('input')
      .should('have.value', '');
    cy.get('label').contains('Strand').siblings('div').children('input')
      .should('have.value', '');
    // Frontend form validation

    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('label').contains('Start').siblings('p').contains('Field required');
    cy.get('label').contains('Start').siblings('div').children('input')
      .type('0');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('label').contains('End').siblings('p').contains('Field required');
    cy.get('label').contains('End').siblings('div').children('input')
      .type('20');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('label').contains('Strand').siblings('p').contains('Field required');
    cy.get('label').contains('Strand').siblings('div.MuiInputBase-root ').click();
    cy.get('li[data-value="plus"]').click();
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('label').contains('Start').siblings('p').contains('Start must be greater than zero');
    cy.get('label').contains('Start').siblings('div').children('input')
      .clear();
    cy.get('label').contains('Start').siblings('div').children('input')
      .type('20');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('label').contains('End').siblings('p').contains('End must be greater than start');
    cy.get('label').contains('Start').siblings('div').children('input')
      .clear();
    // Server error if coordinates fall outside of sequence
    cy.get('label').contains('Start').siblings('div').children('input')
      .type('5579130');
    cy.get('label').contains('End').siblings('div').children('input')
      .clear();
    cy.get('label').contains('End').siblings('div').children('input')
      .type('5579135');
    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('.MuiAlert-message', { timeout: 20000 }).should('be.visible');
  });
  it('searchs in the new assembly after changing species', () => {
    clickMultiSelectOption('Type of region', 'Locus in reference', 'li#source-1');
    setInputValue('Species', 'cerevisiae', 'li#source-1');
    clickMultiSelectOption('Species', 'Saccharomyces cerevisiae', 'li#source-1', { timeout: 20000 });
    // Ase1 should be there
    setInputValue('Gene', 'ase1', 'li#source-1');
    clickMultiSelectOption('Gene', 'Ase1', 'li#source-1', { timeout: 20000 });

    // Change to coli
    clearInputValue('Species', 'li#source-1');
    // There should not be Assembly ID field
    cy.get('li#source-1 label').contains('Assembly ID').should('not.exist');
    setInputValue('Species', 'E coli', 'li#source-1');
    clickMultiSelectOption('Species', 'Escherichia coli', 'li#source-1', { timeout: 20000 });
    // Ase1 should not be there
    setInputValue('Gene', 'ase1', 'li#source-1');
    cy.get('div[role="presentation"]').contains('No results found', { timeout: 20000 }).should('exist');
  });
  it('works for custom coordinates in reference genome', () => {
    clickMultiSelectOption('Type of region', 'coordinates in reference', 'li#source-1');
    setInputValue('Species', 'pombe', 'li#source-1');
    clickMultiSelectOption('Species', 'pombe', 'li#source-1', { timeout: 20000 });
    cy.get('label').contains('Assembly ID', { timeout: 20000 }).siblings('div').children('input')
      .should('have.value', 'GCF_000002945.2');
    cy.get('label').contains('Species').siblings('div').children('input')
      .should('have.value', 'Schizosaccharomyces pombe - 4896');
    cy.get('label').contains('Chromosome').should('exist');
    cy.get('label').contains('Chromosome').siblings('div.MuiInputBase-root ').click();
    // Should contain the 4 pombe chromosomes
    cy.get('li[data-value="I - NC_003424.3"]').should('exist');
    cy.get('li[data-value="II - NC_003423.3"]').should('exist');
    cy.get('li[data-value="III - NC_003421.2"]').should('exist');
    cy.get('li[data-value="MT - NC_088682.1"]').should('exist');
    // Click outside
    cy.get('body').click(0, 0);
    // Select chromosome 1
    clickMultiSelectOption('Chromosome', 'NC_003424.3', 'li#source-1');
    setInputValue('Start', '1', 'li#source-1');
    setInputValue('End', '20', 'li#source-1');
    clickMultiSelectOption('Strand', 'plus', 'li#source-1');

    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('#source-1 a', { timeout: 20000 }).contains('GCF_000002945.2').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000002945.2');
    cy.get('#source-1 a').contains('NC_003424.3').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/nuccore/NC_003424.3');
  });
  it('works for custom coordinates in another assembly', () => {
    clickMultiSelectOption('Type of region', 'coordinates in other assembly', 'li#source-1');
    setInputValue('Assembly ID', 'GCF_000002945.2', 'li#source-1');
    cy.get('label').contains('Species', { timeout: 20000 }).siblings('div').children('input')
      .should('have.value', 'Schizosaccharomyces pombe - 4896');
    cy.get('label').contains('Chromosome').should('exist');
    cy.get('label').contains('Chromosome').siblings('div.MuiInputBase-root ').click();
    // Should contain the 4 pombe chromosomes
    cy.get('li[data-value="I - NC_003424.3"]').should('exist');
    cy.get('li[data-value="II - NC_003423.3"]').should('exist');
    cy.get('li[data-value="III - NC_003421.2"]').should('exist');
    cy.get('li[data-value="MT - NC_088682.1"]').should('exist');
    // Click outside
    cy.get('body').click(0, 0);
    // Select chromosome 1
    clickMultiSelectOption('Chromosome', 'NC_003424.3', 'li#source-1');
    setInputValue('Start', '1', 'li#source-1');
    setInputValue('End', '20', 'li#source-1');
    clickMultiSelectOption('Strand', 'plus', 'li#source-1');

    cy.get('button.MuiButtonBase-root').contains('Submit').click();
    cy.get('#source-1 a', { timeout: 20000 }).contains('GCF_000002945.2').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000002945.2');
    cy.get('#source-1 a').contains('NC_003424.3').should('have.attr', 'href', 'https://www.ncbi.nlm.nih.gov/nuccore/NC_003424.3');
  });
  it('gives the right errors and warnings for custom coordinates in another assembly', () => {
    clickMultiSelectOption('Type of region', 'coordinates in other assembly', 'li#source-1');
    setInputValue('Assembly ID', 'Hello', 'li#source-1');
    cy.intercept('GET', 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/Hello/dataset_report?filters.assembly_version=all_assemblies', {
      body: {}
    }).as('getAssemblyInfo');
    cy.get('div').contains('Assembly ID does not exist').should('exist');
  });
});
