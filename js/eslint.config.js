import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import cypress from 'eslint-plugin-cypress';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';

export default [
  { ignores: ['**/build/**', '**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      vitest
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'warn',
      'max-len': ['error', { code: 300 }],
      'react/prop-types': 0,
      'react/jsx-no-target-blank': 0,
      'object-curly-newline': 0,
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'camelcase': ['warn', { properties: 'never', ignoreDestructuring: true }],
      ...vitest.configs.recommended.rules,
    },
    settings: {
      react: {
        version: '18.3'
      }
    }
  },
  // Styling conventions (.claude/skills/mui-styling)
  {
    files: ['{apps,packages}/*/src/**/*.jsx'],
    ignores: ['**/*.cy.jsx'],
    rules: {
      'react/forbid-dom-props': ['error', { forbid: [
        { propName: 'style', message: 'Use an MUI component with sx instead (see .claude/skills/mui-styling)' },
      ] }],
      'react/forbid-component-props': ['error', { forbid: [
        { propName: 'style', message: 'Use sx instead' },
      ] }],
      'react/forbid-elements': ['error', { forbid: [
        { element: 'button', message: 'use Button or IconButton' },
        { element: 'a', message: 'use Link' },
        ...['table', 'thead', 'tbody', 'tr', 'th', 'td'].map((element) => ({ element, message: 'use the MUI Table components' })),
        ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].map((element) => ({ element, message: 'use Typography' })),
      ] }],
      'no-restricted-syntax': ['error', {
        selector: 'Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\(.*\\))$/]',
        message: 'Use a theme palette token instead of a hard-coded colour',
      }],
    },
  },
  {
    files: ['cypress/**/*.{js,jsx}', '**/*.cy.{js,jsx}', '**/*.test.js'],
    plugins: {
      cypress
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        cy: 'readonly',
        Cypress: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly',
      }
    },
    rules: {
      ...cypress.configs.recommended.rules,
      'vitest/expect-expect': 'off',
      'vitest/valid-expect-in-promise': 'off',
      'vitest/valid-expect': 'off',
      'vitest/no-focused-tests': ['error', { fixable: false }],
      'vitest/no-standalone-expect': 'off',
    }
  }
];
