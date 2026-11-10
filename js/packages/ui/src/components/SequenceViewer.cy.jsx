/* eslint-disable camelcase */
import React from 'react';
import SequenceViewer from './SequenceViewer';
import { convertToTeselaJson } from '@opencloning/utils/readNwrite';

describe('<SequenceViewer /> fullscreen', () => {
  it('opens and closes fullscreen', () => {
    cy.readFile('cypress/test_files/sequencing/locus.gb', 'utf8').then((fileContent) => {
      const sequenceModel = { id: 'locus-1', file_content: fileContent };
      const sequenceData = convertToTeselaJson(sequenceModel);

      cy.mount(<SequenceViewer sequenceData={sequenceData} alignmentData={null} />);

      cy.contains('2026 bps').should('be.visible');
      cy.get('[aria-label="Fullscreen"]').should('be.visible').click();

      cy.get('[aria-label="Exit fullscreen"]').should('be.visible');
      cy.get('[aria-label="Fullscreen"]').should('not.exist');

      cy.get('[aria-label="Exit fullscreen"]').click();

      cy.get('[aria-label="Exit fullscreen"]').should('not.exist');
      cy.get('[aria-label="Fullscreen"]').should('be.visible');
    });
  });
});

