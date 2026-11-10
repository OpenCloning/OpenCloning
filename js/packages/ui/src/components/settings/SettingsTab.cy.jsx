import React from 'react';
import SettingsTab from './SettingsTab';
import store from '@opencloning/store';
import { cloningActions } from '@opencloning/store/cloning';
import { Provider } from 'react-redux';
import { setInputValue, checkInputValue } from '../../../../../cypress/e2e/common_functions';

const { setGlobalPrimerSettings } = cloningActions;

// Field labels for maintainable selectors
const FIELD_LABELS = {
    PRIMER_DNA_CONC: 'Primer DNA concentration',
    MONOVALENT_IONS: 'Monovalent ions',
    DIVALENT_IONS: 'Divalent ions',
};

describe('SettingsTab', () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        store.dispatch(setGlobalPrimerSettings({
            primer_dna_conc: 50,
            primer_salt_monovalent: 50,
            primer_salt_divalent: 1.5,
        }));
    });

    it('displays current global primer settings', () => {
        cy.mount(
            <Provider store={store}>
                <SettingsTab />
            </Provider>
        );

        // Check that the current values are displayed using helper functions
        checkInputValue(FIELD_LABELS.PRIMER_DNA_CONC, '50');
        checkInputValue(FIELD_LABELS.MONOVALENT_IONS, '50');
        checkInputValue(FIELD_LABELS.DIVALENT_IONS, '1.5');
    });

    it('allows editing when Edit button is clicked', () => {
        cy.mount(
            <Provider store={store}>
                <SettingsTab />
            </Provider>
        );

        // Initially, fields should be disabled
        cy.contains('label', FIELD_LABELS.PRIMER_DNA_CONC)
            .parent()
            .find('input')
            .should('be.disabled');

        cy.contains('label', FIELD_LABELS.MONOVALENT_IONS)
            .parent()
            .find('input')
            .should('be.disabled');

        cy.contains('label', FIELD_LABELS.DIVALENT_IONS)
            .parent()
            .find('input')
            .should('be.disabled');

        // Click Edit button
        cy.contains('Edit').click();

        // Fields should now be enabled
        cy.contains('label', FIELD_LABELS.PRIMER_DNA_CONC)
            .parent()
            .find('input')
            .should('not.be.disabled');

        cy.contains('label', FIELD_LABELS.MONOVALENT_IONS)
            .parent()
            .find('input')
            .should('not.be.disabled');

        cy.contains('label', FIELD_LABELS.DIVALENT_IONS)
            .parent()
            .find('input')
            .should('not.be.disabled');

        // Save and Cancel buttons should be visible
        cy.contains('Save').should('be.visible');
        cy.contains('Cancel').should('be.visible');
    });

    it('validates input values and shows error messages for invalid values', () => {
        cy.mount(
            <Provider store={store}>
                <SettingsTab />
            </Provider>
        );

        // Enter edit mode
        cy.contains('Edit').click();

        // Test invalid values (0 or negative) using helper functions
        setInputValue(FIELD_LABELS.PRIMER_DNA_CONC, '0');
        setInputValue(FIELD_LABELS.MONOVALENT_IONS, '-5');
        setInputValue(FIELD_LABELS.DIVALENT_IONS, '0');

        // Check error messages
        cy.get('p').filter(':contains("Must be greater than 0")').should('have.length', 3);

        // Save button should be disabled
        cy.contains('Save').should('be.disabled');

        // Check that fields show error state
        cy.contains('label', FIELD_LABELS.PRIMER_DNA_CONC)
            .parent()
            .find('input')
            .should('have.attr', 'aria-invalid', 'true');
    });

    it('accepts sensible values and enables save button', () => {
        cy.mount(
            <Provider store={store}>
                <SettingsTab />
            </Provider>
        );

        // Enter edit mode
        cy.contains('Edit').click();

        // Enter valid values using helper functions
        setInputValue(FIELD_LABELS.PRIMER_DNA_CONC, '100');
        setInputValue(FIELD_LABELS.MONOVALENT_IONS, '75');
        setInputValue(FIELD_LABELS.DIVALENT_IONS, '2.5');

        // No error messages should be visible
        cy.contains('Must be greater than 0').should('not.exist');

        // Save button should be enabled
        cy.contains('Save').should('not.be.disabled');
    });

    it('updates store state when valid values are saved', () => {
        cy.mount(
            <Provider store={store}>
                <SettingsTab />
            </Provider>
        );

        // Enter edit mode
        cy.contains('Edit').click();

        // Enter new values using helper functions
        setInputValue(FIELD_LABELS.PRIMER_DNA_CONC, '100');
        setInputValue(FIELD_LABELS.MONOVALENT_IONS, '75');
        setInputValue(FIELD_LABELS.DIVALENT_IONS, '2.5');

        // Save the changes
        cy.contains('Save').click();

        // Verify the store state was updated
        cy.then(() => {
            const state = store.getState();
            expect(state.cloning.globalPrimerSettings).to.deep.equal({
                primer_dna_conc: 100,
                primer_salt_monovalent: 75,
                primer_salt_divalent: 2.5,
            });
        });

        // Verify the UI shows the updated values using helper functions
        checkInputValue(FIELD_LABELS.PRIMER_DNA_CONC, '100');
        checkInputValue(FIELD_LABELS.MONOVALENT_IONS, '75');
        checkInputValue(FIELD_LABELS.DIVALENT_IONS, '2.5');
    });

    it('cancels changes and reverts to original values', () => {
        cy.mount(
            <Provider store={store}>
                <SettingsTab />
            </Provider>
        );

        // Enter edit mode
        cy.contains('Edit').click();

        // Enter new values using helper functions
        setInputValue(FIELD_LABELS.PRIMER_DNA_CONC, '999');
        setInputValue(FIELD_LABELS.MONOVALENT_IONS, '888');
        setInputValue(FIELD_LABELS.DIVALENT_IONS, '777');

        // Cancel the changes
        cy.contains('Cancel').click();

        // Verify the values reverted to original using helper functions
        checkInputValue(FIELD_LABELS.PRIMER_DNA_CONC, '50');
        checkInputValue(FIELD_LABELS.MONOVALENT_IONS, '50');
        checkInputValue(FIELD_LABELS.DIVALENT_IONS, '1.5');

        // Verify the store state was not changed
        cy.then(() => {
            const state = store.getState();
            expect(state.cloning.globalPrimerSettings).to.deep.equal({
                primer_dna_conc: 50,
                primer_salt_monovalent: 50,
                primer_salt_divalent: 1.5,
            });
        });
    });

    it('handles decimal values correctly', () => {
        cy.mount(
            <Provider store={store}>
                <SettingsTab />
            </Provider>
        );

        // Enter edit mode
        cy.contains('Edit').click();

        // Enter decimal values using helper functions
        setInputValue(FIELD_LABELS.PRIMER_DNA_CONC, '25.5');
        setInputValue(FIELD_LABELS.MONOVALENT_IONS, '37.2');
        setInputValue(FIELD_LABELS.DIVALENT_IONS, '0.8');

        // Save the changes
        cy.contains('Save').click();

        // Verify the store state was updated with decimal values
        cy.then(() => {
            const state = store.getState();
            expect(state.cloning.globalPrimerSettings).to.deep.equal({
                primer_dna_conc: 25.5,
                primer_salt_monovalent: 37.2,
                primer_salt_divalent: 0.8,
            });
        });
    });

    it('validates edge case values', () => {
        cy.mount(
            <Provider store={store}>
                <SettingsTab />
            </Provider>
        );

        // Enter edit mode
        cy.contains('Edit').click();

        // Test very small positive values (should be valid) using helper functions
        setInputValue(FIELD_LABELS.PRIMER_DNA_CONC, '0.1');
        setInputValue(FIELD_LABELS.MONOVALENT_IONS, '0.01');
        setInputValue(FIELD_LABELS.DIVALENT_IONS, '0.001');

        // No error messages should be visible
        cy.contains('Must be greater than 0').should('not.exist');

        // Save button should be enabled
        cy.contains('Save').should('not.be.disabled');

        // Save and verify
        cy.contains('Save').click();

        cy.then(() => {
            const state = store.getState();
            expect(state.cloning.globalPrimerSettings).to.deep.equal({
                primer_dna_conc: 0.1,
                primer_salt_monovalent: 0.01,
                primer_salt_divalent: 0.001,
            });
        });
    });
});
