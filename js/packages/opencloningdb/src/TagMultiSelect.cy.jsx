import React from 'react';
import TagMultiSelect from './TagMultiSelect';
import endpoints from './endpoints';

const tagsUrl = { method: 'GET', pathname: `/db${endpoints.tags}` };
const postTagUrl = { method: 'POST', pathname: `/db${endpoints.tagPost}` };

const tags = [{ id: 1, name: 'tag_one' }, { id: 2, name: 'tag_two' }];

// TagMultiSelect is controlled, this keeps the selected ids in state
function Harness({ onChangeSpy, ...props }) {
  const [value, setValue] = React.useState([]);
  return (
    <TagMultiSelect
      label="Tags"
      value={value}
      onChange={(ids) => { onChangeSpy(ids); setValue(ids); }}
      {...props}
    />
  );
}

function openOptions() {
  cy.get('label').contains('Tags').siblings('div').first().click();
}

describe('<TagMultiSelect />', () => {
  beforeEach(() => {
    cy.setupOpenCloningDBTestAuth();
    cy.intercept(tagsUrl, { statusCode: 200, body: tags }).as('getTags');
  });

  it('selects tags by id', () => {
    const onChangeSpy = cy.spy().as('onChangeSpy');
    cy.mount(<Harness onChangeSpy={onChangeSpy} />);
    cy.wait('@getTags');
    openOptions();
    cy.get('li[role="option"]').contains('tag_two').click();
    cy.get('@onChangeSpy').should('have.been.calledWith', [2]);
  });

  it('does not show excluded tags', () => {
    cy.mount(<Harness onChangeSpy={cy.spy()} excludeTagIds={[1]} />);
    cy.wait('@getTags');
    openOptions();
    cy.get('li[role="option"]').should('have.length', 1);
    cy.get('li[role="option"]').contains('tag_two').should('exist');
  });

  it('creates a tag and selects it', () => {
    const onChangeSpy = cy.spy().as('onChangeSpy');
    cy.intercept(postTagUrl, (req) => {
      expect(req.body).to.deep.equal({ name: 'new_tag' });
      req.reply({ statusCode: 201, body: { id: 3, name: 'new_tag' } });
    }).as('postTag');
    cy.mount(<Harness onChangeSpy={onChangeSpy} />);
    cy.wait('@getTags');
    cy.intercept(tagsUrl, { statusCode: 200, body: [...tags, { id: 3, name: 'new_tag' }] }).as('getTagsAfterCreate');
    cy.get('input').type('new_tag');
    cy.contains('Create tag').click();
    cy.wait('@postTag');
    cy.wait('@getTagsAfterCreate');
    cy.get('@onChangeSpy').should('have.been.calledWith', [3]);
    cy.get('.MuiChip-root').contains('new_tag').should('exist');
  });

  it('calls onCreateError when creating a tag fails', () => {
    const onChangeSpy = cy.spy().as('onChangeSpy');
    const onCreateErrorSpy = cy.spy().as('onCreateErrorSpy');
    cy.intercept(postTagUrl, { statusCode: 409, body: { detail: 'Tag already exists' } }).as('postTag');
    cy.mount(<Harness onChangeSpy={onChangeSpy} onCreateError={onCreateErrorSpy} />);
    cy.wait('@getTags');
    cy.get('input').type('tag_three');
    cy.contains('Create tag').click();
    cy.wait('@postTag');
    cy.get('@onCreateErrorSpy').should('have.been.calledOnce');
    cy.get('@onCreateErrorSpy').its('lastCall.args.0.response.data.detail').should('equal', 'Tag already exists');
    cy.get('@onChangeSpy').should('not.have.been.called');
  });

  it('does not offer to create tags if allowCreate is false', () => {
    cy.mount(<Harness onChangeSpy={cy.spy()} allowCreate={false} />);
    cy.wait('@getTags');
    cy.get('input').type('tag_three');
    cy.contains('No options').should('exist');
    cy.contains('Create tag').should('not.exist');
  });
});
