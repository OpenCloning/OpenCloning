import React from 'react';
import PrimerList from './PrimerList';
import store from '@opencloning/store';
import { cloningActions } from '@opencloning/store/cloning';
import { Provider } from 'react-redux';
import { ConfigProvider } from '@opencloning/ui/providers/ConfigProvider';

const { setPrimers, setGlobalPrimerSettings } = cloningActions;

const config = {
  backendUrl: 'http://127.0.0.1:8000',
};

const mockReply = {
  statusCode: 200, body: {
    melting_temperature: 60, gc_content: .5, homodimer: {
      melting_temperature: 0,
      deltaG: 0,
      figure: "dummy_figure"
    },
    hairpin: {
      melting_temperature: 0,
      deltaG: 0,
      figure: "dummy_figure"
    },
  }
}

describe('PrimerList', () => {
  it('displays the right information', () => {
    store.dispatch(setPrimers([
      { id: 1, name: 'P1', sequence: 'TCATTAAAGTTAACG' },
    ]));

    cy.mount(
      <Provider store={store}>
        <ConfigProvider config={config}>
          <PrimerList />
        </ConfigProvider>
      </Provider>
    );
    cy.get('td.name').contains('P1');
    cy.get('td.length').contains('15');
    cy.get('td.gc-content').contains('27');
    cy.get('td.melting-temperature').contains('37.5');
    cy.get('td.sequence').contains('TCATTAAAGTTAACG');
  });

  it('caches primer details across re-renders and re-renders on global settings change', () => {
    let calls = 0;
    store.dispatch(setPrimers([
      { id: 1, name: 'P1', sequence: 'AAA' },
    ]));
    cy.intercept('POST', 'http://127.0.0.1:8000/primer_details*', (req) => {
      calls += 1;
      const respReply = calls === 1 ? mockReply : {
        statusCode: 200, body: {
          ...mockReply.body,
          melting_temperature: calls === 1 ? 60 : 70,
        }
      }
      expect(req.body).to.deep.equal({
        sequence: 'AAA',
        settings: {
          primer_dna_conc: calls === 1 ? 50 : 100,
          primer_salt_monovalent: 50,
          primer_salt_divalent: 1.5,
        },
      });
      req.reply(respReply);
    }).as('primerDetails');

    // First mount triggers two network calls (one per unique primer sequence)
    cy.mount(
      <Provider store={store}>
        <ConfigProvider config={config}>
          <PrimerList />
        </ConfigProvider>
      </Provider>)
    cy.contains('Loading...').should('not.exist');
    cy.wait('@primerDetails');
    cy.then(() => {
      expect(calls).to.equal(1);
      cy.mount(
        <Provider store={store}>
          <ConfigProvider config={config}>
            <PrimerList />
          </ConfigProvider>
        </Provider>)
      cy.then(() => {
        expect(calls).to.equal(1);
      });
      store.dispatch(setGlobalPrimerSettings({ primer_dna_conc: 100 }))
      cy.wait('@primerDetails');
      cy.then(() => {
        expect(calls).to.equal(2);
        cy.get('td.melting-temperature').contains('70');
      });

    });

  });
});
