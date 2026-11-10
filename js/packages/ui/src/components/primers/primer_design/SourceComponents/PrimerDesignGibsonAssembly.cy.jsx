import React from 'react';
import { GibsonAmplifyAndCircularControls } from './PrimerDesignGibsonAssembly';

const baseTargets = [1, 2, 3];
const baseSequenceNames = [
  { id: 1, name: 'seq1' },
  { id: 2, name: 'seq2' },
  { id: 3, name: 'seq3' },
];

function TestComponent() {
  const [circularAssembly, setCircularAssembly] = React.useState(false);
  const [amplified, setAmplified] = React.useState([false, true, false]);
  return <GibsonAmplifyAndCircularControls
    targets={baseTargets}
    sequenceNames={baseSequenceNames}
    amplified={amplified}
    setAmplified={setAmplified}
    circularAssembly={circularAssembly}
    setCircularAssembly={setCircularAssembly}
  />;
}

describe('<GibsonAmplifyAndCircularControls />', () => {

  it('disables turning off a fragment when it would create two adjacent unamplified fragments in linear assemblies', () => {
    cy.mount(
      <GibsonAmplifyAndCircularControls
        targets={baseTargets}
        sequenceNames={baseSequenceNames}
        amplified={[true, false, false]}
        setAmplified={() => {}}
        circularAssembly={false}
        setCircularAssembly={() => {}}
      />,
    );


    // First checkbox corresponds to Seq. 1
    cy.get('input[type="checkbox"]').eq(0).should('be.disabled');
  });

  it('enforces circular adjacency rule when circularAssembly is true', () => {
    // Configuration where turning off the last fragment is allowed
    cy.mount(
      <GibsonAmplifyAndCircularControls
        targets={baseTargets}
        sequenceNames={baseSequenceNames}
        amplified={[false, true, true]}
        setAmplified={() => {}}
        circularAssembly
        setCircularAssembly={() => {}}
      />,
    );

    // Third checkbox corresponds to Seq. 3
    cy.get('input[type="checkbox"]').eq(1).should('be.disabled');
    cy.get('input[type="checkbox"]').eq(2).should('be.disabled');

    // Configuration where turning off the last fragment would leave both ends unamplified
    cy.mount(
      <GibsonAmplifyAndCircularControls
        targets={baseTargets}
        sequenceNames={baseSequenceNames}
        amplified={[false, true, false]}
        setAmplified={() => {}}
        circularAssembly
        setCircularAssembly={() => {}}
      />,
    );

    cy.get('input[type="checkbox"]').eq(1).should('be.disabled');

  });

  it('enforces linear rules when circularAssembly is false', () => {
    cy.mount(
      <GibsonAmplifyAndCircularControls
        targets={baseTargets}
        sequenceNames={baseSequenceNames}
        amplified={[false, true, true]}
        setAmplified={() => {}}
        circularAssembly={false}
        setCircularAssembly={() => {}}
      />,
    );
    cy.get('input[type="checkbox"]').eq(1).should('be.disabled');
    cy.get('input[type="checkbox"]').eq(2).should('not.be.disabled');

    cy.mount(
      <GibsonAmplifyAndCircularControls
        targets={baseTargets}
        sequenceNames={baseSequenceNames}
        amplified={[true, true, false]}
        setAmplified={() => {}}
        circularAssembly={false}
        setCircularAssembly={() => {}}
      />,
    );
    cy.get('input[type="checkbox"]').eq(0).should('not.be.disabled');
    cy.get('input[type="checkbox"]').eq(1).should('be.disabled');
  });

  it('disables circular assembly checkbox when there is only one target', () => {
    cy.mount(
      <GibsonAmplifyAndCircularControls
        targets={[1]}
        sequenceNames={[{ id: 1, name: 'single' }]}
        amplified={[true]}
        setAmplified={() => {}}
        circularAssembly
        setCircularAssembly={() => {}}
      />,
    );

    cy.get('input[type="checkbox"]').eq(1).should('not.exist');
    cy.get('input[name="circular-assembly"]').should('be.disabled').and('be.checked');
  });

  it('calls setAmplified with all true values when targets changeor circularAssembly changes', () => {
    cy.mount(<TestComponent />);

    cy.get('input[type="checkbox"]').eq(0).should('not.be.checked');
    cy.get('input[type="checkbox"]').eq(2).should('not.be.checked');
    cy.get('input[type="checkbox"]').last().click();
    cy.get('input[type="checkbox"]').eq(0).should('be.checked');
    cy.get('input[type="checkbox"]').eq(1).should('be.checked');
    cy.get('input[type="checkbox"]').eq(2).should('be.checked');

  })
});
