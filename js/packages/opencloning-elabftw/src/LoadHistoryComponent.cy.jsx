import React from 'react';
import LoadHistoryComponent from './LoadHistoryComponent';
import { eLabFTWHttpClient } from './common';

let uniqueId = 1;
const newUniqueId = () => uniqueId++;
const DATABASE_ID = newUniqueId();
const HISTORY_FILE_ID = newUniqueId();
const OTHER_FILE_ID = newUniqueId();
const TEST_FILE_CONTENT = JSON.stringify({ test: 'content' });

describe('<LoadHistoryComponent />', () => {
  it('loads history file successfully when one file exists', () => {
    const loadDatabaseFileSpy = cy.spy().as('loadDatabaseFileSpy');

    // Stub API calls
    cy.stub(eLabFTWHttpClient, 'get').callsFake(async (url) => {
      if (url === `/api/v2/items/${DATABASE_ID}`) {
        return new Promise((resolve) => {
          // Timeout to catch the loading state
          setTimeout(() => {
            resolve({
              data: {
                uploads: [
                  {
                    id: HISTORY_FILE_ID,
                    real_name: 'history.json',
                    comment: 'OpenCloning history',
                  },
                ],
              },
            });
          }, 500);
        });
      }
      if (url === `/api/v2/items/${DATABASE_ID}/uploads/${HISTORY_FILE_ID}?format=binary`) {
        return Promise.resolve({ data: new Blob([TEST_FILE_CONTENT], { type: 'application/json' }) });
      }
      return Promise.resolve({ data: [] });
    });

    cy.mount(
      <LoadHistoryComponent
        databaseId={DATABASE_ID}
        loadDatabaseFile={loadDatabaseFileSpy}
      />,
    );

    // Should show loading initially
    cy.get('.MuiCircularProgress-root').should('exist');

    // Should call loadDatabaseFile with the correct arguments
    cy.get('@loadDatabaseFileSpy').should((spy) => {
      const [file, id, isHistory] = spy.lastCall.args;
      expect(file).to.be.instanceOf(File);
      expect(file.name).to.equal('history.json');
      expect(id).to.equal(DATABASE_ID);
      expect(isHistory).to.equal(true);

      // Verify file content
      const reader = new FileReader();
      reader.onload = (e) => {
        const actualContent = e.target.result;
        expect(actualContent).to.equal(TEST_FILE_CONTENT);
      };
      reader.readAsText(file);
      return undefined; // Satisfy linter
    });

    // Loading indicator should be gone
    cy.get('.MuiCircularProgress-root').should('not.exist');
  });

  it('shows error when multiple history files found', () => {
    const loadDatabaseFileSpy = cy.spy().as('loadDatabaseFileSpy');

    cy.stub(eLabFTWHttpClient, 'get').callsFake(async (url) => {
      if (url === `/api/v2/items/${DATABASE_ID}`) {
        return Promise.resolve({
          data: {
            uploads: [
              {
                id: HISTORY_FILE_ID,
                real_name: 'history1.json',
                comment: 'OpenCloning history',
              },
              {
                id: OTHER_FILE_ID,
                real_name: 'history2.json',
                comment: 'OpenCloning history',
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    cy.mount(
      <LoadHistoryComponent
        databaseId={DATABASE_ID}
        loadDatabaseFile={loadDatabaseFileSpy}
      />,
    );

    // Should show error message
    cy.get('.MuiAlert-message').should('contain', 'Multiple history files found for this ancestor sequence');
    cy.get('@loadDatabaseFileSpy').should('not.have.been.called');
  });

  it('shows error when no history files found', () => {
    const loadDatabaseFileSpy = cy.spy().as('loadDatabaseFileSpy');

    cy.stub(eLabFTWHttpClient, 'get').callsFake(async (url) => {
      if (url === `/api/v2/items/${DATABASE_ID}`) {
        return Promise.resolve({
          data: {
            uploads: [
              {
                id: OTHER_FILE_ID,
                real_name: 'other.txt',
                comment: 'Not a history file',
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    cy.mount(
      <LoadHistoryComponent
        databaseId={DATABASE_ID}
        loadDatabaseFile={loadDatabaseFileSpy}
      />,
    );

    // Should show error message
    cy.get('.MuiAlert-message').should('contain', 'No history files found for this ancestor sequence');
    cy.get('@loadDatabaseFileSpy').should('not.have.been.called');
  });

  it('handles API error and allows retry', () => {
    const loadDatabaseFileSpy = cy.spy().as('loadDatabaseFileSpy');

    let callNumber = 0;
    cy.stub(eLabFTWHttpClient, 'get').callsFake(async (url) => {
      if (url === `/api/v2/items/${DATABASE_ID}`) {
        callNumber += 1;
        // Network error
        if (callNumber === 1) {
          throw new Error('Access denied');
        }
        // Forbidden / deleted
        else if (callNumber === 2) {
          const error = new Error('Forbidden');
          error.response = { status: 403 };
          return Promise.reject(error);
        }
        return Promise.resolve({
          data: {
            uploads: [
              {
                id: HISTORY_FILE_ID,
                real_name: 'history.json',
                comment: 'OpenCloning history',
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    cy.mount(
      <LoadHistoryComponent
        databaseId={DATABASE_ID}
        loadDatabaseFile={loadDatabaseFileSpy}
      />,
    );

    // Should show error message
    cy.get('.MuiAlert-message').should('contain', 'Failed to load history file.');
    // Click retry
    cy.get('button').contains('Retry').click();

    // Should show error message
    cy.get('.MuiAlert-message').should('contain', 'Ancestor sequence might have been deleted or you can no longer access it');
    // Click retry
    cy.get('button').contains('Retry').click();

    // Should load successfully after retry
    cy.get('@loadDatabaseFileSpy').should((spy) => {
      const [file, id, isHistory] = spy.lastCall.args;
      expect(file).to.be.instanceOf(File);
      expect(file.name).to.equal('history.json');
      expect(id).to.equal(DATABASE_ID);
      expect(isHistory).to.equal(true);
      return undefined; // Satisfy linter
    });
  });

});
