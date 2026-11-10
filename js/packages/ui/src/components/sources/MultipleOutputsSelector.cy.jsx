import React from 'react';
import MultipleOutputsSelector from './MultipleOutputsSelector';

const mockSources = [
  { id: 1, label: 'source-1' },
  { id: 2, label: 'source-2' },
  { id: 3, label: 'source-3' },
];

const mockSequences = [
  { id: 'seq-1' },
  { id: 'seq-2' },
  { id: 'seq-3' },
];

const mockable = {
  SubSequenceDisplayerComponent: ({ source, sourceId }) => <div>{`subsequence:${source.id}:${sourceId}`}</div>,
  AssemblyPlanDisplayerComponent: ({ source }) => <div>{`assembly:${source.id}`}</div>,
  CircularOrLinearViewComponent: ({ sequenceData }) => <div>{`view:${sequenceData.id}`}</div>,
  OverhangsDisplayComponent: ({ sequence }) => <div>{`overhangs:${sequence.id}`}</div>,
  convertSequence: (sequence) => sequence,
};

function TestHarness({ onFragmentChosen }) {
  const [outputs, setOutputs] = React.useState({
    sources: mockSources,
    sequences: mockSequences,
  });

  return (
    <>
      <button type="button" onClick={() => setOutputs({
        sources: mockSources.slice(0, 2),
        sequences: mockSequences.slice(0, 2),
      })}
      >
        Shrink outputs
      </button>
      <MultipleOutputsSelector
        sources={outputs.sources}
        sequences={outputs.sequences}
        sourceId={9}
        onFragmentChosen={onFragmentChosen}
        mockable={mockable}
        convertSequence={(sequence) => sequence}
      />
    </>
  );
}

describe('<MultipleOutputsSelector />', () => {
  it('renders nothing when there are no outputs', () => {
    cy.mount(
      <MultipleOutputsSelector
        sources={[]}
        sequences={[]}
        sourceId={9}
        onFragmentChosen={cy.spy()}
        mockable={mockable}
        convertSequence={(sequence) => sequence}
      />
    );

    cy.get('.multiple-output-selector').should('not.exist');
  });

  it('clamps the selected output when the outputs shrink', () => {
    const onFragmentChosen = cy.spy().as('onFragmentChosen');
    cy.mount(<TestHarness onFragmentChosen={onFragmentChosen} />);

    cy.contains('1 / 3').should('exist');
    cy.contains('subsequence:1:9').should('exist');
    cy.contains('view:seq-1').should('exist');

    cy.get('[data-testid="ArrowForwardIcon"]').closest('button').click();
    cy.contains('2 / 3').should('exist');
    cy.get('[data-testid="ArrowForwardIcon"]').closest('button').click();
    cy.contains('3 / 3').should('exist');
    cy.contains('subsequence:3:9').should('exist');
    cy.contains('assembly:3').should('exist');
    cy.contains('view:seq-3').should('exist');
    cy.contains('overhangs:seq-3').should('exist');

    cy.contains('Shrink outputs').click();

    cy.contains('1 / 2').should('exist');
    cy.contains('subsequence:1:9').should('exist');
    cy.contains('assembly:1').should('exist');
    cy.contains('view:seq-1').should('exist');
    cy.contains('overhangs:seq-1').should('exist');

    cy.get('button').contains('Choose product').click();
    cy.get('@onFragmentChosen').should('have.been.calledOnceWith', 0);
  });
});
