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
