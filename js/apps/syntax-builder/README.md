# Syntax Builder

## How to run dev server

From the root of the repository, run:

```bash
yarn workspace syntax-builder dev
```

## How to build

From the root of the repository, run:

```bash
yarn workspace syntax-builder build
```

## How the order of the overhangs is determined

A golden gate syntax is a circle of overhangs, for example `A → B → C → D → E → back to A`, and every
part is an arc of that circle that goes forward from its left overhang to its right overhang: `A-B` could
be a promoter, `B-C` a CDS and `A-C` a promoter + CDS.

The syntax file only stores the parts, not the order of the overhangs around the circle, so the app works
the order out from the parts. The order is used to draw the parts preview (and the syntax overview of the
Assembler in the cloning app), and to decide which categories can follow each other in the Assembler.

### The rule

1. The circle has no real start, so the app starts it at the **left overhang of the first part**. Below,
   this is called the first overhang.
2. The parts are read **in the order in which they are listed**. Each part tells the app that its right
   overhang comes after its left overhang.
3. A part that ends at the first overhang closes the circle.
4. A part that contradicts the parts read before it **goes around the first overhang**. For example, if
   the app already knows that `B` comes before `D`, the part `D-B` can only go `D → E → A → B`.

For the parts `A-B`, `B-C`, `C-D`, `D-E`, `E-A`, `B-D`, `D-B`, in that order:

| Part  | What the app learns                                                       |
|-------|---------------------------------------------------------------------------|
| `A-B` | The circle starts at `A`, and `B` comes after `A`                         |
| `B-C` | `C` comes after `B`                                                       |
| `C-D` | `D` comes after `C`                                                       |
| `D-E` | `E` comes after `D`                                                       |
| `E-A` | It ends at the first overhang, so it closes the circle                    |
| `B-D` | `D` comes after `B`, which was already known: the part covers two steps   |
| `D-B` | `B` comes before `D`, so this part goes around the first overhang         |

The order is `A B C D E`, and there are two ways of going around the circle that show all the parts:
`A-B B-C C-D D-E E-A` and `B-D D-B`.

When two overhangs are not ordered by any part (for example, two different overhangs used to split the
same part in two), the app places them next to each other. Their relative position makes no difference.

### How the parts are displayed

Each row of the preview is an assembly: a chain of parts that goes around the circle exactly once. A part
takes as many columns as steps of the circle it covers. The app shows as few rows as it needs to show
every part at least once.

A part that goes around the first overhang can be displayed in two ways, which you can choose with the
switch "Split parts that go around the first overhang" (it only appears if there is such a part):

```
In one piece (default): the row starts later and continues past the end of the circle

  A      B      C      D      E      A      B
  |-A-B--|-B-C--|-C-D--|-D-E--|-E-A--|
         |----B-D------|--------D-B---------|

Split: the end of the part is at the start of the row, and its start at the end of the row

  A      B      C      D      E      A
  |-A-B--|-B-C--|-C-D--|-D-E--|-E-A--|
   ..D-B-|----B-D------|-D-B.........
```

In the Assembler, an assembly starts with a part that either starts at the first overhang or goes around
it, and it is complete when it gets back to the left overhang of its first part (`D-B`, then `B-D`).

### What to keep in mind when writing a syntax

- **List the parts that go around the first overhang after the parts they go around.** The simplest is to
  put them at the end of the list, which is where "Add Part" puts new parts. If `D-B` is listed second
  (`A-B`, `D-B`, `B-C`, `C-D`...), nothing says yet that `B` comes before `D` when the app reads it, so the
  app takes it to mean that `B` comes after `D`, and it is `C-D` that ends up contradicting the parts
  before it. The app cannot always tell which of the two readings is the intended one, but when the
  result does not make sense it shows the warnings described below.
- **To start the circle somewhere else, change the first part.** If `D-B` is the first part, the order is
  `D E A B C`, the rows are `D-E E-A A-B B-C C-D` and `D-B B-D`, and no part goes around the first overhang.
- If several parts have the same left and right overhangs, only the first one is displayed in the preview.

### Warnings

The preview shows all the valid parts, even while the syntax is not finished, and the app warns about:

- **Parts that are not in a complete assembly.** No chain of parts that includes the part goes around the
  circle exactly once. Usually a part is missing (the circle is not closed, or there is a typo in an
  overhang), or a part that goes around the first overhang is listed too early (see above). These parts
  are highlighted in the parts table and displayed in separate rows of the preview.
- **Overhangs that cannot be reached from the first overhang.** No part places the overhang after another
  one. Usually some parts are not connected to the rest of the syntax, or a part that goes around the
  first overhang is listed too early.

The code that works out the order and the rows is in
[`syntax_layout.js`](../../packages/ui/src/components/assembler/syntax_layout.js).
