import React from 'react';
import ChipMultiSelect from './ChipMultiSelect';
import { clickMultiSelectOption } from '../../../../../cypress/e2e/common_functions';

const OPTIONS = [{ id: 1, label: 'One' }, { id: 2, label: 'Two' }, { id: 3, label: 'Three' }];

function Wrapper({ initialValue = [], onChange, ...rest }) {
  const [value, setValue] = React.useState(initialValue);
  return (
    <ChipMultiSelect
      label="Numbers"
      options={OPTIONS}
      value={value}
      onChange={(ids) => { setValue(ids); onChange(ids); }}
      {...rest}
    />
  );
}

describe('<ChipMultiSelect />', () => {
  it('shows the selected options as chips and calls onChange with ids', () => {
    const onChangeSpy = cy.spy().as('onChangeSpy');
    cy.mount(<Wrapper initialValue={[2]} onChange={onChangeSpy} />);

    cy.contains('.MuiChip-root', 'Two').should('exist');
    clickMultiSelectOption('Numbers', 'Three', 'div');
    cy.get('@onChangeSpy').should('have.been.calledWith', [2, 3]);
    cy.contains('.MuiChip-root', 'Two').find('.MuiChip-deleteIcon').click();
    cy.get('@onChangeSpy').should('have.been.calledWith', [3]);
  });

  it('ignores values that are not in the options', () => {
    cy.mount(<Wrapper initialValue={[1, 99]} onChange={cy.spy()} />);
    cy.get('.MuiChip-root').should('have.length', 1).and('contain', 'One');
  });

  it('shows the placeholder only when nothing is selected', () => {
    cy.mount(<Wrapper initialValue={[1]} onChange={cy.spy()} placeholder="Any number" />);
    cy.get('input[placeholder="Any number"]').should('not.exist');
    cy.contains('.MuiChip-root', 'One').find('.MuiChip-deleteIcon').click();
    cy.get('input[placeholder="Any number"]').should('exist');
  });
});
