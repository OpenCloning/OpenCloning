/* eslint-disable camelcase */
import React from 'react';
import SyntaxOverviewTable from './SyntaxOverviewTable';

const makePart = (name, left_overhang, right_overhang) => ({
  name,
  info: `info ${name}`,
  glyph: 'engineered-region',
  left_overhang,
  right_overhang,
  left_inside: '',
  right_inside: '',
  left_codon_start: 0,
  right_codon_start: 0,
  color: 'lightblue',
});

// A circle of five overhangs: CCCT -> AACG -> TATG -> ATCC -> GCTG -> back to CCCT
const circleParts = [
  makePart('One', 'CCCT', 'AACG'),
  makePart('Two', 'AACG', 'TATG'),
  makePart('Three', 'TATG', 'ATCC'),
  makePart('Four', 'ATCC', 'GCTG'),
  makePart('Five', 'GCTG', 'CCCT'),
];
// A part that covers two steps (AACG -> ATCC), and its counterpart, which goes around the first overhang
// (ATCC -> GCTG -> CCCT -> AACG)
const partsAroundOrigin = [
  ...circleParts,
  makePart('TwoThree', 'AACG', 'ATCC'),
  makePart('Around', 'ATCC', 'AACG'),
];

const rows = () => cy.get('[data-testid="overhangs-preview-table"] tr');
const cellsOfRow = (index) => rows().eq(index).find('td');
const checkColSpans = (rowIndex, colSpans) => {
  cellsOfRow(rowIndex).should('have.length', colSpans.length);
  colSpans.forEach((colSpan, cellIndex) => {
    cellsOfRow(rowIndex).eq(cellIndex).should('have.prop', 'colSpan', colSpan);
  });
};

describe('<SyntaxOverviewTable />', () => {
  it('shows a syntax in which no part goes around the first overhang', () => {
    cy.mount(<SyntaxOverviewTable parts={[...circleParts, makePart('TwoThree', 'AACG', 'ATCC')]} mode="detailed" />);
    rows().should('have.length', 2);
    checkColSpans(0, [1, 1, 1, 1, 1]);
    checkColSpans(1, [1, 2, 1, 1]);
    cellsOfRow(1).eq(1).contains('TwoThree').should('exist');
    cellsOfRow(1).eq(1).contains('info TwoThree').should('exist');
    // There is nothing to split
    cy.contains('Split parts').should('not.exist');
  });

  it('shows the same syntax in compact mode', () => {
    cy.mount(<SyntaxOverviewTable parts={[...circleParts, makePart('TwoThree', 'AACG', 'ATCC')]} mode="compact" />);
    rows().should('have.length', 2);
    // Overhang, part, overhang, part... and the last overhang
    checkColSpans(0, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    checkColSpans(1, [1, 1, 1, 3, 1, 1, 1, 1, 1]);
    cy.contains('TwoThree').should('not.exist');
    cellsOfRow(1).eq(2).find('[data-testid="display-overhang"]').should('contain', 'AACG');
    cellsOfRow(1).eq(4).find('[data-testid="display-overhang"]').should('contain', 'ATCC');
    cellsOfRow(1).last().find('[data-testid="display-overhang"]').should('contain', 'CCCT');
  });

  it('shows a part that goes around the first overhang, in one piece or split in two', () => {
    cy.mount(<SyntaxOverviewTable parts={partsAroundOrigin} mode="detailed" />);
    rows().should('have.length', 2);
    // The first row has an empty cell at the end, since the second row is one step longer
    checkColSpans(0, [1, 1, 1, 1, 1, 1]);
    cellsOfRow(0).last().should('have.text', '');

    // In one piece: the row starts at the second overhang (empty first cell) and continues past the end of the first row
    checkColSpans(1, [1, 2, 3]);
    cellsOfRow(1).eq(0).should('have.text', '');
    cellsOfRow(1).eq(1).contains('TwoThree').should('exist');
    cellsOfRow(1).eq(2).contains('Around').should('exist');
    cellsOfRow(1).eq(2).find('[data-testid="display-overhang"]').should('have.length', 2);
    cellsOfRow(1).eq(2).find('[data-testid="display-overhang"]').first().should('contain', 'ATCC');
    cellsOfRow(1).eq(2).find('[data-testid="display-overhang"]').last().should('contain', 'AACG');

    // Split in two: its end is at the start of the row, and its start is at the end of the row
    cy.contains('label', 'Split parts that go around the first overhang').click();
    rows().should('have.length', 2);
    checkColSpans(0, [1, 1, 1, 1, 1]);
    checkColSpans(1, [1, 2, 2]);
    cellsOfRow(1).eq(0).contains('Around').should('exist');
    cellsOfRow(1).eq(0).find('[data-testid="display-overhang"]').should('have.length', 1);
    cellsOfRow(1).eq(0).find('[data-testid="display-overhang"]').should('contain', 'AACG');
    cellsOfRow(1).eq(1).contains('TwoThree').should('exist');
    cellsOfRow(1).eq(2).contains('Around').should('exist');
    cellsOfRow(1).eq(2).find('[data-testid="display-overhang"]').should('have.length', 1);
    cellsOfRow(1).eq(2).find('[data-testid="display-overhang"]').should('contain', 'ATCC');

    // And back
    cy.contains('label', 'Split parts that go around the first overhang').click();
    checkColSpans(0, [1, 1, 1, 1, 1, 1]);
    checkColSpans(1, [1, 2, 3]);
  });

  it('shows a part that goes around the first overhang in compact mode', () => {
    cy.mount(<SyntaxOverviewTable parts={partsAroundOrigin} mode="compact" />);
    rows().should('have.length', 2);
    // The first row has two empty cells at the end, since the second row is one step (two columns) longer
    checkColSpans(0, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);

    // In one piece: empty step, overhang, part (2 steps), overhang, part (3 steps), overhang
    checkColSpans(1, [2, 1, 3, 1, 5, 1]);
    cellsOfRow(1).eq(1).find('[data-testid="display-overhang"]').should('contain', 'AACG');
    cellsOfRow(1).eq(3).find('[data-testid="display-overhang"]').should('contain', 'ATCC');
    cellsOfRow(1).eq(5).find('[data-testid="display-overhang"]').should('contain', 'AACG');

    // Split in two: end of the part (1 step), overhang, part (2 steps), overhang, start of the part (2 steps).
    // The row takes the same columns as the first row
    cy.contains('label', 'Split parts that go around the first overhang').click();
    checkColSpans(0, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    checkColSpans(1, [2, 1, 3, 1, 4]);
    cellsOfRow(1).eq(0).find('[data-testid="assembler-part-core"]').should('exist');
    cellsOfRow(1).eq(1).find('[data-testid="display-overhang"]').should('contain', 'AACG');
    cellsOfRow(1).eq(3).find('[data-testid="display-overhang"]').should('contain', 'ATCC');
    cellsOfRow(1).eq(4).find('[data-testid="assembler-part-core"]').should('exist');
  });

  it('shows parts that are not in a complete assembly', () => {
    cy.mount(<SyntaxOverviewTable parts={[...circleParts, makePart('Loose', 'TATG', 'TTTT')]} mode="detailed" />);
    rows().should('have.length', 2);
    // The loose part is placed under the part that starts at the same overhang, and the rest of the row is empty
    checkColSpans(1, [2, 2, 1, 1]);
    cellsOfRow(1).eq(1).contains('Loose').should('exist');
  });

  it('shows nothing if there are no parts', () => {
    cy.mount(<SyntaxOverviewTable parts={[]} mode="detailed" />);
    cy.get('[data-testid="overhangs-preview-table"]').should('exist');
    rows().should('have.length', 0);
  });
});
