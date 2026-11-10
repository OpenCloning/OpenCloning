---
description: "Use when writing, planning, or debugging Cypress e2e tests. Covers test patterns, common functions, iteration workflow, and file conventions for OpenCloning frontend."
applyTo: "cypress/**"
---
# E2E Testing Guidelines (Cypress)

## Project structure
- Tests are in `cypress/e2e/group-*/` folders
- Test data files go in `cypress/test_files/`
- Shared helpers are in `cypress/e2e/common_functions.js`

## Common functions (import from `../common_functions`)

Always prefer these over raw `cy.get()` chains for common operations.

## Iteration workflow
- Use `it.only(...)` on new/failing tests to skip the rest of the suite during development — e2e tests are slow
- Run with: `yarn cypress run --spec cypress/e2e/group-N/test_file.cy.js`
- Remove `.only` once tests pass

## Conventions
- Use `{ timeout: 20000 }` for assertions that wait on backend responses
- Use `{ force: true }` when selecting files via hidden inputs
- Drag-and-drop: `cy.get('div.cloning-history').selectFile(path, { action: 'drag-drop' })`
- Check warnings/errors in `#global-error-message-wrapper`
- No mocking of backend requests in integration tests — assert on UI state
