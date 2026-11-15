---
name: mui-styling
description: Where styles go in the JS frontend (MUI theme, shared components, sx, style, CSS). Use when adding or changing styling, colours, layout, or native HTML elements in js/apps or js/packages, or when adding a .css file.
---

# MUI styling conventions

The migration to these rules is tracked in [`styling-plan.md`](../../../styling-plan.md). Old code
still breaks them. Follow them in new code, and in old code you are already changing.

## Where a style goes

Use the first option that fits:

1. **Theme** (`js/packages/ui/src/theme/`): anything that should look the same everywhere, such as
   colours, typography and component defaults.
2. **A named component**: anything repeated three or more times, or that means something in the domain
   (`ExternalLink`, `SequenceText`). Shared ones live in `js/packages/ui/src/components/common/`.
3. **`sx`**: one-off layout on a single element. Use theme tokens, not literals:

   ```jsx
   // ✅
   <Box sx={{ mb: 2, color: 'text.secondary' }}>
   // ❌
   <Box sx={{ marginBottom: '16px', color: '#666' }}>
   ```

4. **`style`**: only on plain DOM elements that have no MUI equivalent (e.g. `<col>`), and only for a
   value computed at render time.
5. **CSS files**: no new ones. A pre-commit hook rejects them. `NetworkTree.css` (tree lines drawn with
   pseudo-elements) is expected to stay as CSS.

## Colours

Never hard-code a colour (`'green'`, `'#1976d2'`, `rgb(...)`). Use a palette token such as
`'primary.main'`, `'error.main'`, `'text.secondary'` or `'divider'`. If none fits, add a token to the
theme and use it.

- Text on the app bar inherits its colour: don't set `'white'`, set nothing (or `color="inherit"`).
- Translucent colours: `sx={(theme) => ({ backgroundColor: theme.alpha(theme.palette.error.main, 0.15) })}`.
- In CSS, use the theme's CSS variables: `var(--opencloning-palette-primary-main)`.

## `className` is for tests only

Cypress selects many elements by class name, so keep existing class names when you restyle an element.
Do not attach styles to a class; use the options above.

## Native elements

Replace native controls and text with MUI components:

| Native | MUI |
|---|---|
| `<button>` | `Button`, `IconButton` |
| `<a>` | `Link`, or `ExternalLink` for `target="_blank"` |
| `<table>`, `<tr>`, `<td>`, ... | `Table`, `TableRow`, `TableCell`, ... |
| `<h1>`...`<h6>`, `<p>` | `Typography` |

Keep plain structural elements (`div`, `span`, `ul`, `li`, `form`). Turning a bare `<div>` into a
`<Box>` adds an import and makes nothing clearer. Use `Box` when the element needs `sx`.

## Shared primitives

In `js/packages/ui/src/components/common/` (apps import them from `@opencloning/ui/components/common`):

- `ExternalLink`: any link that opens in a new tab (sets `target` and `rel`).
- `SequenceText`: a DNA sequence in text. For a table cell use `sx={{ typography: 'sequence' }}`, and for
  a text field `sx={sequenceInputSx}`. Never write `fontFamily: 'monospace'` for a sequence.
- `FileUploadButton`: a button that opens the file picker (`onFiles` gets an array of files). For a file
  picker opened from a menu, use `<input type="file" hidden ref={…}>`, not `style={{ display: 'none' }}`.
- `CodeBlock`: code or other preformatted text.

## Spacing between siblings

Put the spacing on the parent with `Stack` (`<Stack spacing={2}>`), rather than giving every child its
own `mb: 2`.

## Theme provider

Components get the theme from `OpenCloningThemeProvider`
(`@opencloning/ui/providers/ThemeProvider`). `<OpenCloning />`, each app root and `cy.mount` already
render it. Wrap any new app root or test harness in it too. Only the outermost one sets the theme
(its CSS variables are set on `:root`); nested ones just render their children. In component tests,
pass theme options with `cy.mount(component, { themeOptions })`.

Theme defaults: Tooltips have an arrow (don't pass `arrow`), Alerts centre their icon vertically, and
table rows highlight on hover (don't pass `hover`) under a grey header row.

## CSS that stays

Every selector in the library's CSS must be scoped under an OpenCloning class (e.g.
`.primer-table-container th`), never a bare element (`th`, `button`, `code`): the library CSS is loaded
in other people's pages.

Pages that embed OpenCloning can override the theme with MUI theme options, through the
`themeOptions` prop of `<OpenCloning />` and `OpenCloningThemeProvider`, or the `themeOptions` option
of `StandAloneOpenCloning`. Never set styles on `html` or `body` in the library, and never render
`CssBaseline` there: they would restyle the host page. Global resets belong in the app roots.

## Lint

ESLint reports `style` props, native elements and hex/`rgb()` colour literals in `src/**/*.jsx` as
errors. `<col>` takes its width with `Box component="col"` and `sx`.
