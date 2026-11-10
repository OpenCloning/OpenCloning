import { changeTab, manuallyTypeSequence, selectOptionShould } from "../common_functions";
import defaultConfig from '../../../apps/opencloning/public/config.dev.json';


describe('test that configuration works', () => {

  it('Annotation source is not available if enablePlannotate is false', () => {
    // Intercept config.json request and modify enablePlannotate to false
    cy.intercept('GET', '**/config.json', (req) => {
      req.reply({ statusCode: 200, body: {...defaultConfig, enablePlannotate: false}});
    }).as('configRequest');

    cy.visit('/');
    cy.wait('@configRequest');

    manuallyTypeSequence('atata');
    cy.get('svg[data-testid="AddCircleIcon"]', { timeout: 20000 }).first().click();
    cy.get('li#source-2 .MuiInputBase-root').click();
    cy.get('li[data-value="AnnotationSource"]').should('not.exist');
    cy.get('li[data-value="RestrictionEnzymeDigestionSource"]').should('exist');
  });
  it('Annotation source is available if enablePlannotate is true', () => {
    // Intercept config.json request and modify enablePlannotate to true
    cy.intercept('GET', '**/config.json', (req) => {
      req.reply({ statusCode: 200, body: {...defaultConfig, enablePlannotate: true}});
    }).as('configRequest');

    cy.visit('/');
    cy.wait('@configRequest');

    manuallyTypeSequence('atata');
    cy.get('svg[data-testid="AddCircleIcon"]', { timeout: 20000 }).first().click();
    cy.get('li#source-2 .MuiInputBase-root').click();
    cy.get('li[data-value="AnnotationSource"]').should('exist');
  });
  it('Assembler is not available if enableAssembler is false', () => {
    // Intercept config.json request and modify enableAssembler to false
    cy.intercept('GET', '**/config.json', (req) => {
      req.reply({ statusCode: 200, body: {...defaultConfig, enableAssembler: false}});
    }).as('configRequest');

    cy.visit('/');
    cy.wait('@configRequest');

    // Wait for the app to finish loading
    cy.get('.loading-state-message', { timeout: 10000 }).should('not.exist');

    // Check that the assembler tab is not present
    cy.get('.MuiTabs-root').contains('Assembler').should('not.exist');
  });

  it('Assembler is available if enableAssembler is true', () => {
    // Intercept config.json request and modify enableAssembler to true
    cy.intercept('GET', '**/config.json', (req) => {
      req.reply({ statusCode: 200, body: {...defaultConfig, enableAssembler: true}});
    }).as('configRequest');
    cy.visit('/');
    cy.wait('@configRequest');

    // Check that the assembler tab is present
    cy.get('.MuiTabs-root').contains('Assembler').should('exist');
  });

  it('when staticContentPath is set, sequences and syntaxes can be loaded from local server', () => {
    // Intercept config.json request and modify staticContentPath to 'collection'
    cy.visit('/');
    cy.get('label').contains('Source type').click({force: true});
    selectOptionShould('Source type', 'Local server file', 'exist', '#source-1');
    changeTab('Assembler');
    cy.get('button').contains('Load Syntax').click();
    cy.get('button').contains('Load syntax from local server').click();
    cy.get('[data-testid="local-syntax-dialog"] input').click();
    cy.get('div[role="presentation"]').contains('syntax1').click();
    cy.get('button').contains('Submit').click();
    cy.get('button').contains('Load Plasmids').click();
    cy.get('[data-testid="load-plasmids-from-local-server"]').should('exist');
  });
  it('when staticContentPath is not set, sequences and syntaxes cannot be loaded from local server', () => {
    // Intercept config.json request and modify staticContentPath to 'collection'
    cy.intercept('GET', '**/config.json', (req) => {
      req.reply({ statusCode: 200, body: {...defaultConfig, staticContentPath: null}});
    }).as('configRequest');
    cy.visit('/');
    cy.wait('@configRequest');
    cy.get('label').contains('Source type').click({force: true});
    cy.get('ul').contains('Local server file').should('not.exist');
    changeTab('Assembler');
    cy.get('button').contains('Load Syntax').click();
    cy.get('button').contains('Load syntax from local server').should('not.exist');
    cy.get('li').contains('MoClo YTK').click();
    cy.get('button').contains('Load Plasmids').click();
    cy.get('[data-testid="load-plasmids-from-files"]').should('exist');
    cy.get('[data-testid="load-plasmids-from-local-server"]').should('not.exist');
  });
});
