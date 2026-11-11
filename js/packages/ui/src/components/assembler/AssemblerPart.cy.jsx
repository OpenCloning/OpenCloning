/* eslint-disable camelcase */
import React from 'react';
import AssemblerPart from './AssemblerPart';

describe('<AssemblerPart />', () => {
  it('displays everything correctly with all values', () => {
    const partData = {
      left_overhang: 'CCCT',
      right_overhang: 'AACG',
      left_inside: 'ATGCATGC',
      right_inside: 'GCATGCAT',
      left_codon_start: 1,
      right_codon_start: 2,
      color: 'red',
      glyph: 'cds',
    };

    cy.mount(<AssemblerPart data={partData} />);

    // Check that container exists
    cy.get('[class*="container"]').should('exist');

    // Check that left overhang is displayed
    cy.get('[data-testid="display-overhang"]').first().find('div').eq(0).should('have.text', 'ProT');
    cy.get('[data-testid="display-overhang"]').first().find('div').eq(1).should('have.text', 'CCCT');
    cy.get('[data-testid="display-overhang"]').first().find('div').eq(2).should('have.text', 'GGGA');
    cy.get('[data-testid="display-overhang"]').first().find('div').eq(3).should('have.text', ' ');

    cy.get('[data-testid="display-inside"]').first().find('div').eq(0).should('have.text', 'yrAlaCys');
    cy.get('[data-testid="display-inside"]').first().find('div').eq(1).should('have.text', 'ATGCATGC');
    cy.get('[data-testid="display-inside"]').first().find('div').eq(2).should('have.text', 'TACGTACG');
    cy.get('[data-testid="display-inside"]').first().find('div').eq(3).should('have.text', ' ');

    cy.get('[data-testid="display-inside"]').eq(1).find('div').eq(0).should('have.text', ' HisAla*');
    cy.get('[data-testid="display-inside"]').eq(1).find('div').eq(1).should('have.text', 'GCATGCAT');
    cy.get('[data-testid="display-inside"]').eq(1).find('div').eq(2).should('have.text', 'CGTACGTA');
    cy.get('[data-testid="display-inside"]').eq(1).find('div').eq(3).should('have.text', ' ');

    cy.get('[data-testid="display-overhang"]').eq(1).find('div').eq(0).should('have.text', '**');
    cy.get('[data-testid="display-overhang"]').eq(1).find('div').eq(1).should('have.text', 'AACG');
    cy.get('[data-testid="display-overhang"]').eq(1).find('div').eq(2).should('have.text', 'TTGC');
    cy.get('[data-testid="display-overhang"]').eq(1).find('div').eq(3).should('have.text', ' ');


    cy.get('img[alt="cds.svg"]').should('exist');
    cy.get('img').parent().then(($el) => {
      const bgColor = window.getComputedStyle($el[0]).backgroundColor;
      cy.wrap(bgColor).should('equal', 'rgb(255, 0, 0)');
    });

  });
});
