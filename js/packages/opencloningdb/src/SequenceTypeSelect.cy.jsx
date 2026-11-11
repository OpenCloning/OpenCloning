import React from 'react';
import SequenceTypeSelect from './SequenceTypeSelect';
import { SEQUENCE_TYPE_LABELS } from './sequenceTypes';
import { clickMultiSelectOption } from '../../../cypress/e2e/common_functions';

describe('<SequenceTypeSelect />', () => {
  it('single: shows all the types and calls onChange with the selected type', () => {
    const onChangeSpy = cy.spy().as('onChangeSpy');
    cy.mount(<SequenceTypeSelect value="locus" onChange={onChangeSpy} labelId="my-type-label" />);

    cy.contains('label', 'Type').should('have.attr', 'id', 'my-type-label');
    cy.contains('Locus').click();
    cy.get('ul[aria-labelledby="my-type-label"] li').should('have.length', Object.keys(SEQUENCE_TYPE_LABELS).length);
    cy.get('ul[aria-labelledby="my-type-label"] li').contains('PCR product').click();
    cy.get('@onChangeSpy').should('have.been.calledOnceWith', 'pcr_product');
  });

  it('single: types restricts the options', () => {
    cy.mount(<SequenceTypeSelect value="locus" onChange={cy.spy()} labelId="my-type-label" types={['locus', 'allele']} />);
    cy.contains('Locus').click();
    cy.get('ul[aria-labelledby="my-type-label"] li').should('have.length', 2);
    cy.get('ul[aria-labelledby="my-type-label"] li').contains('Allele').should('exist');
  });

  it('multiple: adds and removes types, and shows the placeholder when empty', () => {
    function Wrapper({ onChange }) {
      const [value, setValue] = React.useState(['plasmid']);
      return (
        <SequenceTypeSelect
          multiple
          label="Sequence types"
          placeholder="All types"
          value={value}
          onChange={(v) => { setValue(v); onChange(v); }}
        />
      );
    }
    const onChangeSpy = cy.spy().as('onChangeSpy');
    cy.mount(<Wrapper onChange={onChangeSpy} />);

    cy.contains('.MuiChip-root', 'Plasmid').should('exist');
    cy.get('input[placeholder="All types"]').should('not.exist');

    clickMultiSelectOption('Sequence types', 'Allele', 'div');
    cy.get('@onChangeSpy').should('have.been.calledWith', ['plasmid', 'allele']);

    cy.contains('.MuiChip-root', 'Plasmid').find('.MuiChip-deleteIcon').click();
    cy.contains('.MuiChip-root', 'Allele').find('.MuiChip-deleteIcon').click();
    cy.get('@onChangeSpy').should('have.been.calledWith', []);
    cy.get('input[placeholder="All types"]').should('exist');
  });
});
