# Frontend styling: plan

Goal: readable, consistent styling in `js/`. That means one MUI theme for shared styles, components for
repeated patterns, and fewer native HTML elements and CSS files. The rules for new code are in
[`.claude/skills/mui-styling/SKILL.md`](.claude/skills/mui-styling/SKILL.md).

## Starting point (Nov 2026)

| Signal | Count | Where it concentrates |
|---|---|---|
| `sx={{…}}` | 445 in 135 files | `apps/opencloningdb` (150), `packages/ui` (221) |
| `style={{…}}` | 134 in 63 files | bulk-upload tables, `NetworkNode`, primers |
| CSS files | 12 (~800 lines) | `packages/ui/src/index.css` is 306 lines |
| Native elements | ~120 `div`, 41 raw `<a target="_blank">`, native tables and buttons | `packages/ui` (`FinishedSource.jsx` alone has 48) |
| `className` | 170 uses | 69 of 115 class names have no CSS rule: they are test hooks only |

There was no MUI theme: every shared look was an MUI default, a CSS file, or a repeated inline value.

Problems found:

- **Library CSS leaks into the host page.** `PrimerList.css` styles bare `table`, `th`, `td` and
  `tr:hover`, and `index.css` styles bare `code`, `button`, `html` and `body` (including
  `overflow: hidden`). `@opencloning/ui` is embedded in other pages, so these rules apply there too.
  `apps/opencloningdb/src/index.css` already overrides them with `!important`.
- **Tests depend on class names.** Cypress uses class selectors ~926 times, so restyling must keep class
  names.
- **Theme values are written by hand.** The primary blue is hard-coded as `rgb(25, 118, 210)` three times
  in CSS. "Saved to database" is the literal `'green'` four times in `NetworkNode.jsx`, with a
  `'default'` fallback that is not a valid CSS colour.
- **The sequence editor's CSS also leaks into the host page.** `@teselagen/ove` imports its own `ove.css`
  (~12,000 lines, including Blueprint's CSS), which styles `html` and `*` (`box-sizing`), `body` (14px
  system font, line height, text colour) and bare elements such as `p` and `small`. It is loaded with the
  library, so every page that embeds OpenCloning gets it. It is a dependency's CSS, so the steps below
  don't remove it: it would need a scoped copy of the file, or an upstream fix in OVE.

## Theme

Defined in `js/packages/ui/src/theme/` (`createOpenCloningTheme`, exported as `@opencloning/ui/theme`),
and provided by `OpenCloningThemeProvider` (`@opencloning/ui/providers/ThemeProvider`) in
`<OpenCloning />`, each app root and `cy.mount`.

A page that embeds OpenCloning can override the theme with MUI theme options, which are merged on top
of ours: `<OpenCloning themeOptions={…} />`, `StandAloneOpenCloning({ config, element, themeOptions })`
or `<OpenCloningThemeProvider themeOptions={…}>`.

The theme is also available as CSS variables with the `opencloning` prefix
(`var(--opencloning-palette-primary-main)`). They are set on `:root`, so only the outermost
`OpenCloningThemeProvider` sets the theme, and nested ones (e.g. `<OpenCloning />` inside an app) just
render their children.

Contents:

- [x] **Palette:** `savedToDatabase`, for nodes of the cloning history saved in the database.
- [ ] **Typography:** a `sequence` variant for monospace sequences (written inline 20 times), added with
  `SequenceText` in step 5.
- [x] **Component overrides:** alerts vertically centred, tooltips with an arrow and `1rem` text,
  tables with a grey header row and rows highlighted on hover.
- [x] **CSS variables**, for the CSS that is left.
- **Deliberately not defaulted:** `fullWidth` (131 uses) and `size="small"` (64 uses). Their use is
  mixed, and a hidden default makes a call site harder to read.

## Shared components

| Component | Evidence | Replaces |
|---|---|---|
| `ExternalLink` | 41 `target="_blank" rel=…` in 11 files; MUI `Link` used 5 times | the ~12 `…Message` functions in `FinishedSource.jsx` |
| `CodeBlock` ✅ | the global `code` rule, used by 2 components | added in step 4 |
| `SequenceText` | 20 inline `monospace` | `.sequence`, `.sequence-cell`, inline `fontFamily` |
| `FileUploadButton` | 16 `type="file"` inputs, 15 `display: 'none'` | hidden-input boilerplate in 15 files |
| `PreviewTable` (`columns` prop) | 5 bulk-upload tables with the same shell and hand-written `<col>` widths | ~30 lines per file |
| `DetailTable` | `TableContainer component={Paper} sx={{ maxWidth: 800 }}` ×10 | `opencloningdb` detail pages |
| Dialog scaffold | 18 dialog files, 16 with the same title/content/actions shape | build on `ConfirmMutationDialog`, `EditTextDialog` |
| `Stack` in parents | `mb: 2` ×34, `mt: 1` ×19; `Stack` imported in 2 files | per-child margins |
| Filter field width | `MIN_WIDTH` defined in 3 pages, used 12 times | set once in `UrlParamsForm` / `SearchBarTextField` |

Shared primitives go in `js/packages/ui/src/components/common/`.

## Steps

Each step is one PR. Small visual changes are acceptable, but there is no visual regression testing,
so every step from 3 onwards attaches before/after screenshots of the main screens for review.

- [x] **1. Guardrails.** Conventions in the `mui-styling` skill. ESLint warnings for `style` props,
  native elements and colour literals in `src/**/*.jsx`. Pre-commit hook rejecting new `.css` files,
  with the existing ones allowlisted.
- [x] **2. Theme foundation.** Empty theme and `OpenCloningThemeProvider`, wired into `<OpenCloning />`,
  the `opencloning`, `opencloningdb` and `syntax-builder` apps, and `cy.mount`. `themeOptions` lets an
  embedding page override the theme. No visual change.
- [x] **3. Global overrides into the theme.** Global `.Mui*` overrides moved to the theme, and the 39
  explicit `arrow` props removed. Colours in JSX and CSS replaced with palette tokens and CSS variables
  (translucent highlights use `theme.alpha`). CSS variables on. Left for later steps:
  - `.Mui*` overrides scoped to one component (`select-source`, `pcr-unit`, `collapsed`): step 6.
  - Colours in rules that leak (`PrimerList.css` table rules, `code`): step 4.
  - `--border-color` in `assembly_component.module.css`: step 6 (assembler).
  - `github-icon` rule: unused, step 7.
  - `standalone-app` toggle button: stays. It is plain HTML outside React, so it can't rely on the
    theme's CSS variables (they are removed when OpenCloning unmounts).
- [x] **4. Stop the leaks.** The library CSS no longer styles elements outside OpenCloning:
  - `html`/`body`: moved to the `opencloning` app (`GlobalStyles` in `index.jsx`), the only app that needs
    the page not to scroll. Checked before/after in all four apps that load the library CSS.
  - `button`: the cursor moved to the one native button (`SourceBox`).
  - `code`: replaced by the `CodeBlock` component (`components/common/`).
  - Bare table rules: scoped to the native primer table. MUI tables were also getting them, so their grey
    header and row hover are now in the theme.
  - [x] Separate PR with screenshots: `CssBaseline` in the `opencloning`, `opencloningdb`,
    `syntax-builder` and `test-app` roots, replacing their `margin: 0` rules. `test-app` also gets
    `OpenCloningThemeProvider`, and its unused `index.css` is deleted, so the 8px body margin is gone.
    - The body font changes from Blueprint's 14px system font (from `ove.css`) to the theme's 16px.
      MUI components are unchanged. Text that inherits from `body` is slightly larger, e.g. in tree
      nodes and in the sequence editor.
    - The app bar title was sized in `em`, so it grew with the body font, and `OpenCloning.jsx`
      subtracts a fixed app bar height from `100vh`. Its size and line height are now in `rem`.
    - `CssBaseline` sets the `body` background, overriding `syntax-builder`'s `index.css`. Its page
      styles moved to `GlobalStyles`, after `CssBaseline`.
    - `standalone-app` keeps its `index.css`: it stands in for a non-React host page.
- [x] **5. Shared primitives.** Add `ExternalLink`, `SequenceText` and `FileUploadButton`, and adopt them.
  Apps import them from `@opencloning/ui/components/common`.
  - [x] `ExternalLink`: all native `<a target="_blank">` in the library, and syntax-builder's links.
    `Button`s with an `href` stay `Button`s. The app bar's Documentation link is still nested in a
    `Button`: step 6 (navigation).
  - [x] `SequenceText`, and the `sequence` typography in the theme, for sequences in text, table cells
    (`sx={{ typography: 'sequence' }}`) and text fields (`sequenceInputSx`). The `.sequence`, `#sequence`
    and `.sequence-cell` rules are deleted. File names and IDs stay monospace with their own `sx`: they
    are not sequences. syntax-builder's overhang columns keep their `index.css` rule (step 6).
  - [x] `FileUploadButton` (a `Button`, with its hidden input right after it; `onFiles` gets an array of
    files) where a plain button opens the file picker: 5 places. File pickers opened from a menu or a card
    (app bar File menu, bulk upload menus, Load Plasmids menu, sequencing files) keep their `<input>`
    with a ref, now `hidden` instead of `style={{ display: 'none' }}`. Tests that select inputs by
    position (`input[type="file"]').eq(n)`) still find them in the same order.
- [ ] **6. Area sweeps**, one PR each:
  - [x] `packages/ui/.../sources/`: no styling warnings left (21 before). `SourceBox.css` deleted, and
    the source rules of `index.css` (`.select-source`, `.fragment-picker`, `.pcr-unit`,
    `.finished-source`, and the unused `.collapsed`) moved into the components. New: `SourceTitle`
    for the title of a source box, and `CheckboxField` (`components/form/`) for the 9 checkboxes
    with a label on their own line. The delete button is an `IconButton`. The PCR accordion repeats
    its margins under `&.Mui-expanded`, since MUI's expanded style is more specific than `sx`.
    Screenshots of every source box in 9 examples, the empty source and a PCR form: the delete icon
    is 3px smaller, and titles are a few px taller (`Typography` line height).
  - [x] `packages/ui/.../primers/` (native table → MUI `Table`): no styling warnings left (51 before).
    `PrimerList.css`, `PrimerForm.css` and `import_primers/styles.css` deleted, with the unused
    `.import-primers-container` and `.primer-designer` rules. The primer table is an MUI `Table`
    (`size="small"`, so 14px text instead of 16px), the import modal gets the theme's shadow (its CSS
    `box-shadow: 24` was invalid), and `OrientationPicker` is a grid instead of a layout `<table>` (its
    e2e selector is now `.orientation-picker span`). The primer design e2e tests are viewport-sensitive:
    at the default 1000×660, 4 of them can fail to select a region in the editor, at 1600×1000 they pass.
  - [x] `packages/ui/.../navigation/`: no styling warnings left (5 before). `MainAppBar.css` and the
    unused `github-icon` rule deleted. The Documentation link is a `Button` with an `href` (an `<a>`
    nested in a `<button>` before), and a `MenuItem component="a"` in the mobile menu. The CSS
    `position: relative` of the app bar never applied (MUI's styles come after the CSS files), so it
    stays `position="static"`: a relative app bar draws its shadow over the tabs. Screenshots: only
    the Feedback dialog changed (paragraph spacing, 4px taller).
  - [x] `packages/ui/.../assembler/`: no styling warnings left (3 before). `assembly_component.module.css`
    deleted: its `:root` variables leaked into the host page, and `--border-color` is now the `overhang`
    palette token. `AssemblerPart` keeps the same DOM (tests read the lines of a sequence by position),
    and its container has the class `assembler-part-container` (tests select `[class*="container"]`).
    Screenshots of the MoClo YTK syntax and 8 parts of its overview: all pixel-identical.
  - [x] `apps/opencloningdb` pages and bulk upload (`PreviewTable`, `DetailTable`): no styling warnings left
    in `apps/opencloningdb` (29 before) nor in `packages/opencloningdb`. `PreviewTable` (`columns` prop, in
    `packages/opencloningdb/src/bulk_upload/common.jsx`) is used by the 5 bulk upload previews,
    `DetailTable` by the 10 tables of the detail pages, and `ButtonTooltipText` by the 7 action buttons
    with a larger tooltip. `<col>` widths use `Box component="col"`. Screenshots of the 5 previews and the
    tables of 5 detail pages: all pixel-identical (the seeded sequences have no detail tables, so
    `SequenceDetailPage` is not covered). The DB e2e tests were not run: they reset the local database.
    - [ ] Not done: the dialog scaffold and `Stack` rows from the table above. Filter field width:
      `MIN_WIDTH` is 200 in the sequences and primers pages but 150 (and 1.5×) in the lines page, so a
      single width would change the lines filters. Decide the width first.
  - [ ] `apps/syntax-builder`
- [ ] **7. Clean up.** Delete emptied CSS files (and their entries in the pre-commit allowlist). Make the
  ESLint rules errors. `github-icon`, `import-primers-container` and `primer-designer` already look
  unused.

## Decisions

- **The library sets no `html`/`body` styles.** No embedder relies on them, so step 4 moves them into the
  apps without an opt-in import.
- **An embedding page can override the theme**, with `themeOptions` (built in step 2).
- **The migration does not need to be pixel-identical.** Small visual changes are fine; screenshots are
  for review.
- **`CssBaseline` goes in the apps, never in the library.** `CssBaseline` is an MUI component that adds a
  small global CSS reset: no `body` margin, `box-sizing: border-box`, the theme's background colour and
  font on `body`, and smoother font rendering. In the library it would restyle the host page. In each app
  root it replaces the hand-written resets. It slightly changes spacing and fonts, so it gets its own PR
  in step 4.
