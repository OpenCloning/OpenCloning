import React from 'react';
import AssemblyPlanDisplayer from './AssemblyPlanDisplayer';

describe('<AssemblyPlanDisplayer />', () => {
  it('Represents the assembly plan', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<AssemblyPlanDisplayer source={{ input: [
      { type: 'AssemblyFragment', sequence: 1, left_location: 'aa', right_location: 'bb', reverse_complemented: false },
      { type: 'AssemblyFragment', sequence: 2, left_location: 'cc', right_location: 'dd', reverse_complemented: true },
    ] }}
    />);
    cy.get('.assembly-plan-displayer').contains('1[aa,bb] - 2_rc[cc,dd]');
  });
  it('Represents the assembly plan with null coordinates', () => {
    cy.mount(<AssemblyPlanDisplayer source={{ input: [
      { type: 'AssemblyFragment', sequence: 1, left_location: null, right_location: 'aa', reverse_complemented: false },
      { type: 'AssemblyFragment', sequence: 2, left_location: 'bb', right_location: null, reverse_complemented: true },
    ] }}
    />);
    cy.get('.assembly-plan-displayer').contains('1[,aa] - 2_rc[bb,]');
  });
});
