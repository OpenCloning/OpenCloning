import fs from 'fs';
import { partKey, getOverhangOrder, arcLength, goesAroundOrigin, getSyntaxLayout, getRowCells } from './syntax_layout';

// 'A-B B-C' => [{ left_overhang: 'A', right_overhang: 'B' }, { left_overhang: 'B', right_overhang: 'C' }]
const makeParts = (keys) => keys.split(' ').map((key) => {
  const [left, right] = key.split('-');
  return { left_overhang: left, right_overhang: right };
});
const rowsToKeys = (rows) => rows.map((row) => row.map(partKey).join(' '));
const layoutSummary = (keys) => {
  const { order, rows, incompleteParts, unreachableOverhangs } = getSyntaxLayout(makeParts(keys));
  return { order: order.join(' '), rows: rowsToKeys(rows), incompleteParts: incompleteParts.map(partKey), unreachableOverhangs };
};

const mocloSyntax = JSON.parse(fs.readFileSync('cypress/test_files/syntax/moclo_syntax.json', 'utf8'));
const miniSyntax = JSON.parse(fs.readFileSync('../static_content/syntaxes/mini_syntax.json', 'utf8'));

// A circle of five overhangs with one part per step
const CIRCLE = 'A-B B-C C-D D-E E-A';

describe('partKey', () => {
  it('joins the overhangs', () => {
    expect(partKey({ left_overhang: 'CCCT', right_overhang: 'AACG' })).toBe('CCCT-AACG');
  });
});

describe('getOverhangOrder', () => {
  it('returns an empty order if there are no parts', () => {
    expect(getOverhangOrder([])).toEqual([]);
  });

  it('follows the parts around the circle, starting at the left overhang of the first part', () => {
    expect(getOverhangOrder(makeParts(CIRCLE))).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(getOverhangOrder(makeParts('C-D D-E E-A A-B B-C'))).toEqual(['C', 'D', 'E', 'A', 'B']);
  });

  it('does not depend on the order of the parts if none goes around the origin', () => {
    expect(getOverhangOrder(makeParts('A-B D-E B-C E-A C-D'))).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('places overhangs that split a part between the overhangs of that part', () => {
    expect(getOverhangOrder(makeParts('A-B B-C C-A B-X X-C'))).toEqual(['A', 'B', 'X', 'C']);
    expect(getOverhangOrder(mocloSyntax.parts)).toEqual(
      ['CCCT', 'AACG', 'TATG', 'TTCT', 'ATCC', 'TGGC', 'GCTG', 'TACA', 'GAGT', 'CCGA', 'CAAT'],
    );
  });

  it('is not changed by parts that go around the origin', () => {
    expect(getOverhangOrder(makeParts(`${CIRCLE} B-D D-B`))).toEqual(['A', 'B', 'C', 'D', 'E']);
    // Even if other parts skip overhangs
    expect(getOverhangOrder(makeParts(`${CIRCLE} A-C B-D B-E D-B`))).toEqual(['A', 'B', 'C', 'D', 'E']);
    // Or if every part has a counterpart
    expect(getOverhangOrder(makeParts('A-B B-C C-A B-A C-B A-C'))).toEqual(['A', 'B', 'C']);
  });

  it('starts at the left overhang of a part that would go around another origin, if it is the first part', () => {
    expect(getOverhangOrder(makeParts(`D-B ${CIRCLE} B-D`))).toEqual(['D', 'E', 'A', 'B', 'C']);
  });

  it('places at the end overhangs that are only reached by parts that go around the origin', () => {
    expect(getOverhangOrder(makeParts(`${CIRCLE} B-D D-Y Y-B`))).toEqual(['A', 'B', 'C', 'D', 'E', 'Y']);
  });
});

describe('arcLength', () => {
  const order = ['A', 'B', 'C', 'D', 'E'];
  it('counts the steps going forward', () => {
    expect(arcLength(order, 'A', 'B')).toBe(1);
    expect(arcLength(order, 'B', 'D')).toBe(2);
    expect(arcLength(order, 'E', 'A')).toBe(1);
  });
  it('goes around the origin if needed', () => {
    expect(arcLength(order, 'D', 'B')).toBe(3);
    expect(arcLength(order, 'B', 'A')).toBe(4);
  });
  it('is a full turn if the overhangs are the same', () => {
    expect(arcLength(order, 'C', 'C')).toBe(5);
  });
});

describe('goesAroundOrigin', () => {
  const order = ['A', 'B', 'C', 'D', 'E'];
  const part = (key) => makeParts(key)[0];
  it('is true for parts that pass over the origin', () => {
    expect(goesAroundOrigin(part('D-B'), order)).toBe(true);
    expect(goesAroundOrigin(part('E-B'), order)).toBe(true);
    expect(goesAroundOrigin(part('C-B'), order)).toBe(true);
  });
  it('is false for parts that start or end at the origin, or do not reach it', () => {
    expect(goesAroundOrigin(part('A-B'), order)).toBe(false);
    expect(goesAroundOrigin(part('A-E'), order)).toBe(false);
    expect(goesAroundOrigin(part('E-A'), order)).toBe(false);
    expect(goesAroundOrigin(part('B-D'), order)).toBe(false);
  });
});

describe('getSyntaxLayout', () => {
  it('handles no parts', () => {
    expect(getSyntaxLayout([])).toEqual({ order: [], rows: [], incompleteParts: [], unreachableOverhangs: [] });
  });

  it('returns a single row for a simple circle', () => {
    expect(layoutSummary(CIRCLE)).toEqual({
      order: 'A B C D E',
      rows: ['A-B B-C C-D D-E E-A'],
      incompleteParts: [],
      unreachableOverhangs: [],
    });
  });

  it('returns the parts of the syntax, not copies', () => {
    const parts = makeParts(CIRCLE);
    expect(getSyntaxLayout(parts).rows[0][0]).toBe(parts[0]);
  });

  it('shows every part with as few rows as possible, longest rows first', () => {
    // There are 8 possible assemblies in the MoClo syntax, but two rows are enough to show all parts
    const { rows } = getSyntaxLayout(mocloSyntax.parts);
    expect(rows.map((row) => row.map((part) => part.name).join(' '))).toEqual([
      '1 2 3a 3b 4a 4b 5 6 7 8a 8b',
      '1 2 3 4 5 6 7 8',
    ]);
  });

  it('handles alternative ways of splitting a part', () => {
    expect(layoutSummary('A-X1 X1-X2 X2-B A-Y Y-B A-B B-A')).toEqual({
      order: 'A X1 Y X2 B',
      rows: ['A-X1 X1-X2 X2-B B-A', 'A-Y Y-B B-A', 'A-B B-A'],
      incompleteParts: [],
      unreachableOverhangs: [],
    });
  });

  it('puts the part that goes around the origin at the end of its row', () => {
    expect(layoutSummary(`${CIRCLE} B-D D-B`)).toEqual({
      order: 'A B C D E',
      rows: ['A-B B-C C-D D-E E-A', 'B-D D-B'],
      incompleteParts: [],
      unreachableOverhangs: [],
    });
  });

  it('handles several parts that go around the origin', () => {
    expect(layoutSummary('A-B B-C C-A B-A C-B A-C').rows).toEqual([
      'A-B B-C C-A',
      'A-C C-A',
      'A-B B-A',
      'B-C C-B',
    ]);
    expect(layoutSummary(`${CIRCLE} B-D D-Y Y-B`).rows).toEqual([
      'A-B B-C C-D D-E E-A',
      'B-D D-Y Y-B',
    ]);
  });

  it('gives the same rows if the part that goes around the origin is the first part, starting from its left overhang', () => {
    expect(layoutSummary(`D-B ${CIRCLE} B-D`)).toEqual({
      order: 'D E A B C',
      rows: ['D-E E-A A-B B-C C-D', 'D-B B-D'],
      incompleteParts: [],
      unreachableOverhangs: [],
    });
  });

  it('draws parts with the same overhangs only once', () => {
    const parts = [...makeParts(CIRCLE), { left_overhang: 'A', right_overhang: 'B', name: 'duplicate' }];
    const { rows, incompleteParts } = getSyntaxLayout(parts);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe(parts[0]);
    expect(incompleteParts).toEqual([]);
  });

  describe('with parts that are not in a complete assembly', () => {
    it('shows a syntax that does not go around the whole circle', () => {
      const { rows, incompleteParts } = getSyntaxLayout(miniSyntax.parts);
      expect(rows.map((row) => row.map((part) => part.name))).toEqual([['3a\'', '3b\'']]);
      expect(incompleteParts).toEqual(miniSyntax.parts);

      expect(layoutSummary('A-B B-C')).toEqual({
        order: 'A B C',
        rows: ['A-B B-C'],
        incompleteParts: ['A-B', 'B-C'],
        unreachableOverhangs: [],
      });
    });

    it('shows them in their own rows after the complete assemblies', () => {
      expect(layoutSummary('A-B B-C C-A C-Z')).toEqual({
        order: 'A B C Z',
        rows: ['A-B B-C C-A', 'C-Z'],
        incompleteParts: ['C-Z'],
        unreachableOverhangs: [],
      });
      // A part that ends at the origin, but that nothing leads to
      expect(layoutSummary('A-B B-A Z-A')).toEqual({
        order: 'A Z B',
        rows: ['A-B B-A', 'Z-A'],
        incompleteParts: ['Z-A'],
        unreachableOverhangs: ['Z'],
      });
    });

    it('does not use a part with the same overhang on both sides', () => {
      const { rows, incompleteParts } = layoutSummary('A-B B-A C-C');
      expect(rows).toEqual(['A-B B-A', 'C-C']);
      expect(incompleteParts).toEqual(['C-C']);
    });

    it('reports overhangs that cannot be reached from the origin', () => {
      // Two circles that have nothing to do with each other
      expect(layoutSummary('A-B B-A C-D D-C').unreachableOverhangs).toEqual(['C']);
    });

    it('can misread a part that goes around the origin if it is listed before the parts it goes around (known limitation)', () => {
      // D-B is read before B-C and C-D, so nothing says yet that B comes before D
      const { order, incompleteParts, unreachableOverhangs } = layoutSummary('A-B D-B B-C C-D D-E E-A B-D');
      expect(order).not.toBe('A B C D E');
      // But it does not go unnoticed
      expect(incompleteParts).not.toEqual([]);
      expect(unreachableOverhangs).toEqual(['D']);
      // Listing it after the parts it goes around is enough
      expect(layoutSummary('A-B B-C C-D D-B D-E E-A B-D')).toEqual({
        order: 'A B C D E',
        rows: ['A-B B-C C-D D-E E-A', 'B-D D-B'],
        incompleteParts: [],
        unreachableOverhangs: [],
      });
    });
  });
});

describe('getRowCells', () => {
  const order = ['A', 'B', 'C', 'D', 'E'];
  const summarise = (cells) => cells.map(({ part, start, span, showLeft, showRight }) => (
    `${partKey(part)} start:${start} span:${span}${showLeft ? '' : ' no-left'}${showRight ? '' : ' no-right'}`
  ));

  it('places each part after the previous one, with as many steps as it covers', () => {
    const cells = getRowCells(makeParts('A-B B-D D-E E-A'), order);
    expect(summarise(cells)).toEqual(['A-B start:0 span:1', 'B-D start:1 span:2', 'D-E start:3 span:1', 'E-A start:4 span:1']);
    // Splitting makes no difference if no part goes around the origin
    expect(getRowCells(makeParts('A-B B-D D-E E-A'), order, { split: true })).toEqual(cells);
  });

  it('starts the row at the left overhang of its first part', () => {
    expect(summarise(getRowCells(makeParts('C-D'), order))).toEqual(['C-D start:2 span:1']);
    expect(summarise(getRowCells(makeParts('C-D'), order, { split: true }))).toEqual(['C-D start:2 span:1']);
  });

  it('continues past the end of the circle with a part that goes around the origin', () => {
    expect(summarise(getRowCells(makeParts('B-D D-B'), order))).toEqual(['B-D start:1 span:2', 'D-B start:3 span:3']);
  });

  it('splits a part that goes around the origin in two if asked', () => {
    expect(summarise(getRowCells(makeParts('B-D D-B'), order, { split: true }))).toEqual([
      'D-B start:0 span:1 no-left',
      'B-D start:1 span:2',
      'D-B start:3 span:2 no-right',
    ]);
    // Also when the part is on its own
    expect(summarise(getRowCells(makeParts('D-B'), order, { split: true }))).toEqual([
      'D-B start:0 span:1 no-left',
      'D-B start:3 span:2 no-right',
    ]);
  });
});
