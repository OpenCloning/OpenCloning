/*
 * How a golden gate syntax is laid out
 * ------------------------------------
 * A syntax is a circle of overhangs, e.g. A -> B -> C -> D -> E -> back to A, and every part is an
 * arc of that circle that goes forward from its left overhang to its right overhang.
 *
 * - The `order` is the list of overhangs around the circle. It starts at the origin, which is the
 *   left overhang of the first part (the circle has no real start, so this is just a convention).
 * - A part covers one or more steps of the circle (A-B covers one, A-C covers two).
 * - An assembly is a chain of parts that goes around the circle exactly once. Exactly one of its
 *   parts ends at the origin (E-A) or goes around it (D-B): we call it the last part of the assembly.
 *
 * The overview table has one row per assembly, and a part takes as many columns as steps it covers.
 */
import { DirectedGraph } from 'graphology';
import { topologicalGenerations, willCreateCycle } from 'graphology-dag';
import { allSimplePaths } from 'graphology-simple-path';
import { partsToEdgesGraph } from './graph_utils';

export const partKey = (part) => `${part.left_overhang}-${part.right_overhang}`;

/**
 * The overhangs in the order in which they are found around the circle, starting at the origin.
 *
 * The parts are read in the order in which they are listed. Each part tells us that its right
 * overhang comes after its left overhang, unless that contradicts what the parts before it said:
 * such a part goes around the origin (e.g. D-B when we already know A -> B -> C -> D).
 */
export function getOverhangOrder(parts) {
  if (parts.length === 0) return [];
  const origin = parts[0].left_overhang;
  const comesBefore = new DirectedGraph();
  comesBefore.addNode(origin);
  parts.forEach(({ left_overhang: left, right_overhang: right }) => {
    comesBefore.mergeNode(left);
    comesBefore.mergeNode(right);
    if (right !== origin && !willCreateCycle(comesBefore, left, right)) {
      comesBefore.mergeEdge(left, right);
    }
  });
  const order = topologicalGenerations(comesBefore).flat();
  return [origin, ...order.filter((overhang) => overhang !== origin)];
}

/** Number of steps from an overhang to another going forward around the circle (a full turn if they are the same) */
export function arcLength(order, from, to) {
  const steps = order.indexOf(to) - order.indexOf(from);
  return steps > 0 ? steps : steps + order.length;
}

/** Whether the part passes over the origin (D-B in A-B-C-D-E). A part that ends at the origin (E-A) does not. */
export function goesAroundOrigin(part, order) {
  const right = order.indexOf(part.right_overhang);
  return right !== 0 && right <= order.indexOf(part.left_overhang);
}

/** Whether the part is the last one of the assemblies it belongs to: it ends at the origin or goes around it */
function isLastPart(part, order) {
  return part.right_overhang === order[0] || goesAroundOrigin(part, order);
}

/** Every way of going from an overhang with no part arriving to it, to an overhang with no part leaving it */
function getChains(graph) {
  const starts = graph.nodes().filter((node) => graph.inDegree(node) === 0);
  const ends = graph.nodes().filter((node) => graph.outDegree(node) === 0);
  return starts.flatMap((start) => ends.flatMap((end) => allSimplePaths(graph, start, end)));
}

/** The smallest selection of rows we can easily find that shows every part at least once, longest rows first */
function selectRows(rows) {
  const shown = new Set();
  const selected = [];
  const countNewParts = (row) => row.filter((part) => !shown.has(part)).length;
  let candidates = rows;
  while (candidates.length > 0) {
    // The row that shows the most new parts (if tied, the one with the most parts)
    const best = candidates.reduce((bestSoFar, row) => {
      const difference = countNewParts(row) - countNewParts(bestSoFar);
      return difference > 0 || (difference === 0 && row.length > bestSoFar.length) ? row : bestSoFar;
    });
    selected.push(best);
    best.forEach((part) => shown.add(part));
    candidates = candidates.filter((row) => countNewParts(row) > 0);
  }
  return selected.sort((row1, row2) => row2.length - row1.length);
}

/**
 * Everything needed to draw a syntax:
 * - order: the overhangs around the circle (see getOverhangOrder).
 * - rows: the rows of the overview table. Each row is a list of consecutive parts (the right overhang
 *   of a part is the left overhang of the next one).
 * - incompleteParts: parts that are not in any assembly that goes around the whole circle. They are
 *   still included in rows, so that a syntax can be seen while it is being written.
 * - unreachableOverhangs: overhangs that we could not place after any other overhang.
 */
export function getSyntaxLayout(parts) {
  const order = getOverhangOrder(parts);

  // If several parts have the same overhangs, only the first one is drawn
  const partByKey = {};
  parts.forEach((part) => { partByKey[partKey(part)] ??= part; });
  const uniqueParts = Object.values(partByKey);
  const pathToParts = (path) => path.slice(0, -1).map((overhang, i) => partByKey[`${overhang}-${path[i + 1]}`]);

  const lastParts = uniqueParts.filter((part) => isLastPart(part, order));
  const forwardParts = uniqueParts.filter((part) => !isLastPart(part, order));
  const forwardGraph = partsToEdgesGraph(forwardParts);
  order.forEach((overhang) => forwardGraph.mergeNode(overhang));

  // An assembly is a last part + a way of going forward from its right overhang to its left overhang
  const assemblies = lastParts.flatMap((lastPart) => (
    allSimplePaths(forwardGraph, lastPart.right_overhang, lastPart.left_overhang)
      .map((path) => [...pathToParts(path), lastPart])
  ));
  const completeRows = selectRows(assemblies);

  const shownParts = new Set(completeRows.flat());
  const incompleteParts = uniqueParts.filter((part) => !shownParts.has(part));
  const incompleteForwardGraph = partsToEdgesGraph(incompleteParts.filter((part) => !isLastPart(part, order)));
  const incompleteRows = selectRows([
    ...getChains(incompleteForwardGraph).map(pathToParts),
    ...incompleteParts.filter((part) => isLastPart(part, order)).map((part) => [part]),
  ]);

  const unreachableOverhangs = order.slice(1).filter((overhang) => forwardGraph.inDegree(overhang) === 0);

  return { order, rows: [...completeRows, ...incompleteRows], incompleteParts, unreachableOverhangs };
}

/**
 * The cells of a row of the overview table: { part, start, span, showLeft, showRight }, where start
 * is the step of the circle at which the cell starts (0 is the origin) and span the steps it takes.
 *
 * A part that goes around the origin can be drawn in two ways:
 * - by default, in one piece that continues past the end of the circle (start + span > order.length).
 * - if split is true, in two pieces: the end of the part at the start of the row (showLeft is false),
 *   and the beginning of the part at the end of the row (showRight is false).
 */
export function getRowCells(row, order, { split = false } = {}) {
  let start = order.indexOf(row[0].left_overhang);
  const cells = row.map((part) => {
    const cell = { part, start, span: arcLength(order, part.left_overhang, part.right_overhang), showLeft: true, showRight: true };
    start += cell.span;
    return cell;
  });
  const last = cells[cells.length - 1];
  const stepsPastTheEnd = last.start + last.span - order.length;
  if (!split || stepsPastTheEnd <= 0) return cells;
  return [
    { ...last, start: 0, span: stepsPastTheEnd, showLeft: false },
    ...cells.slice(0, -1),
    { ...last, span: last.span - stepsPastTheEnd, showRight: false },
  ];
}
