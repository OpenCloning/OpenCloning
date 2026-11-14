import React from 'react'
import { Box, Typography, Table, TableBody, TableRow, TableCell, FormControlLabel, Switch } from '@mui/material';
import { partDataToDisplayData } from './assembler_utils';
import AssemblerPart, { AssemblerPartContainer, AssemblerPartCore, DisplayInside, DisplayOverhang } from './AssemblerPart';
import { getRowCells, getSyntaxLayout, goesAroundOrigin, partKey } from './syntax_layout';

// See syntax_layout.js for how a syntax is laid out. In short: each row is an assembly, and each of its
// cells is a part that starts at a step of the circle of overhangs (cell.start) and takes some steps (cell.span).

// The step of the circle at which a cell ends
const getEnd = (cell) => cell.start + cell.span;

// Adds to each cell the number of empty steps before it (gap), and whether the next cell starts where it ends
function withNeighbours(cells) {
  return cells.map((cell, index) => {
    const previousEnd = index === 0 ? 0 : getEnd(cells[index - 1]);
    const next = cells[index + 1];
    return { ...cell, gap: cell.start - previousEnd, isFollowed: next !== undefined && next.start === getEnd(cell) };
  });
}

const cellKey = ({ part, showLeft }) => `${partKey(part)}-${showLeft}`;

// The side of a part that continues at the other end of the row is drawn with a dashed border
const OPEN_BORDER = 'dashed 1px gray';

function EmptyCell({ columns }) {
  return columns > 0 ? <TableCell colSpan={columns} sx={{ border: 0 }} /> : null;
}

// Empty cells that complete a row up to the last column of the table. The columns after the end of the
// circle only have these cells and the parts that continue past the end, so without a minimum width the
// browser would give them no width, and those parts would not look any longer.
function EmptyColumns({ count, minWidth }) {
  return Array.from({ length: count }, (_, index) => <TableCell key={`empty-${index}`} sx={{ border: 0, padding: 0, minWidth }} />);
}

// One column per step of the circle
function DetailedRow({ cells, totalSteps }) {
  return (
    <TableRow>
      {cells.map((cell) => {
        const { part, span, gap, showLeft, showRight } = cell;
        const sx = { border: 1, py: 0, ...(!showLeft && { borderLeft: OPEN_BORDER }), ...(!showRight && { borderRight: OPEN_BORDER }) };
        return (
          <React.Fragment key={cellKey(cell)}>
            <EmptyCell columns={gap} />
            <TableCell colSpan={span} sx={sx}>
              <Box sx={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="h6" >{part.name}</Typography>
                <Typography variant="body2" >{part.info}</Typography>
                <AssemblerPart data={part} showLeft={showLeft} showRight={showRight} />
              </Box>
            </TableCell>
          </React.Fragment>
        );
      })}
      <EmptyColumns count={totalSteps - getEnd(cells[cells.length - 1])} minWidth="8em" />
    </TableRow>
  );
}

// Two columns per step of the circle: one for the overhang at which the step starts, and one for the part.
// The right overhang of a part is in the same column as the left overhang of the next part, so it is only
// drawn if there is no part right after it.
function CompactRow({ cells, totalSteps }) {
  const cellSx = { padding: 0, borderRight: 'solid 1px gray' };
  return (
    <TableRow>
      {cells.map((cell, index) => {
        const { part, span, gap, isFollowed, showLeft, showRight } = cell;
        const { leftTranslationOverhang, leftTranslationInside, leftOverhangRc, rightOverhangRc, leftInsideRc } = partDataToDisplayData(part);
        // The first column of a gap is taken by the right overhang of the previous part
        const gapColumns = 2 * gap - (index > 0 ? 1 : 0);
        // The part also takes the column of an overhang that is not shown
        const partColumns = 2 * span - 1 + (showLeft ? 0 : 1) + (showRight ? 0 : 1);
        const partSx = { ...cellSx, textAlign: 'center', ...(!showLeft && { borderLeft: OPEN_BORDER }), ...(!showRight && { borderRight: OPEN_BORDER }) };
        return (
          <React.Fragment key={cellKey(cell)}>
            <EmptyCell columns={gapColumns} />
            {showLeft && (
              <TableCell sx={cellSx}>
                <AssemblerPartContainer>
                  <DisplayOverhang overhang={part.left_overhang} overhangRc={leftOverhangRc} translation={leftTranslationOverhang} isRight={false} />
                  {part.left_inside && <DisplayInside inside={part.left_inside} insideRc={leftInsideRc} translation={leftTranslationInside} isRight={false} />}
                </AssemblerPartContainer>
              </TableCell>
            )}
            <TableCell sx={partSx} colSpan={partColumns}>
              <AssemblerPartContainer>
                <AssemblerPartCore color={part.color} glyph={part.glyph} />
              </AssemblerPartContainer>
            </TableCell>
            {showRight && !isFollowed && (
              <TableCell sx={cellSx}>
                <AssemblerPartContainer>
                  <DisplayOverhang overhang={part.right_overhang} overhangRc={rightOverhangRc} isRight={true} />
                </AssemblerPartContainer>
              </TableCell>
            )}
          </React.Fragment>
        );
      })}
      <EmptyColumns count={2 * (totalSteps - getEnd(cells[cells.length - 1]))} minWidth="4em" />
    </TableRow>
  );
}

function SyntaxOverviewTable({ parts, mode = 'detailed' }) {
  const { order, rows } = React.useMemo(() => getSyntaxLayout(parts), [parts]);
  // A part that goes around the first overhang is drawn either in one piece that continues past the end
  // of the table, or split in two pieces, one at each end of its row
  const [split, setSplit] = React.useState(false);
  const hasPartsAroundOrigin = rows.some((row) => goesAroundOrigin(row[row.length - 1], order));
  const Row = mode === 'compact' ? CompactRow : DetailedRow;
  const rowsOfCells = rows.map((row) => withNeighbours(getRowCells(row, order, { split })));
  // The table is longer than the circle if a part continues past its end
  const totalSteps = Math.max(order.length, ...rowsOfCells.map((cells) => getEnd(cells[cells.length - 1])));

  return (
    <Box sx={{ overflowY: 'auto', overflowX: 'auto' }}>
      {hasPartsAroundOrigin && (
        <FormControlLabel
          control={<Switch data-testid="split-parts-switch" checked={split} onChange={(e) => setSplit(e.target.checked)} />}
          label="Split parts that go around the first overhang"
        />
      )}
      <Table data-testid="overhangs-preview-table" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <TableBody>
          {rowsOfCells.map((cells, index) => (
            <Row key={index} cells={cells} totalSteps={totalSteps} />
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}

export default SyntaxOverviewTable
