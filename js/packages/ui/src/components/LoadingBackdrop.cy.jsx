import React from 'react';
import { Button } from '@mui/material';
import LoadingBackdrop from './LoadingBackdrop';
import useLoadingTask from '../hooks/useLoadingTask';

function Harness({ outer, inner }) {
  const withLoading = useLoadingTask();
  const run = () => withLoading(async () => {
    await outer;
    await withLoading(() => inner, 'Inner task...');
  }, 'Outer task...').catch(() => {});
  return (
    <>
      <Button onClick={run}>Run</Button>
      <LoadingBackdrop />
    </>
  );
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('<LoadingBackdrop /> and useLoadingTask', () => {
  it('blocks the UI while tasks run, showing the most recent message', () => {
    const outer = deferred();
    const inner = deferred();
    cy.mount(<Harness outer={outer.promise} inner={inner.promise} />);

    cy.get('.loading-backdrop').should('not.be.visible');
    cy.contains('button', 'Run').click();
    cy.get('.loading-backdrop').should('be.visible').and('contain', 'Outer task...');

    cy.then(() => outer.resolve());
    cy.get('.loading-backdrop').should('contain', 'Inner task...');

    cy.then(() => inner.resolve());
    cy.get('.loading-backdrop').should('not.be.visible');
  });

  it('removes the backdrop when the task throws', () => {
    const outer = deferred();
    const inner = deferred();
    cy.mount(<Harness outer={outer.promise} inner={inner.promise} />);

    cy.contains('button', 'Run').click();
    cy.get('.loading-backdrop').should('be.visible');
    cy.then(() => outer.reject(new Error('boom')));
    cy.get('.loading-backdrop').should('not.be.visible');
  });
});
