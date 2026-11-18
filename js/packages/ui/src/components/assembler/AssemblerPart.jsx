import React from 'react'
import { Box } from '@mui/material'

import { getSvgByGlyph } from './sbol_visual_glyphs'
import { partDataToDisplayData } from './assembler_utils'

// Width of the dashed outline of overhangs, also used as spacing so that the lines don't touch the letters
const LINE = '2.5px'
const dashedLine = (theme) => `${LINE} dashed ${theme.vars.palette.overhang.main}`

// A column of sequence: translation on top, then the watson and crick strands (one div per line)
const dnaSx = { typography: 'sequence', '& > div': { whiteSpace: 'pre', minHeight: '1em' } }

export function AssemblerPartCore({ color = 'lightgray', glyph = 'engineered-region' }) {
  return (
    <Box data-testid="assembler-part-core" sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box
        sx={{
          alignSelf: 'stretch',
          border: 3,
          borderColor: 'common.black',
          borderRadius: 1.5,
          width: '5em',
          mx: '.2em',
          mb: LINE,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ textAlign: 'center', backgroundColor: color, '& img': { height: '2.2em' } }}>
          <img src={getSvgByGlyph(glyph)} alt={`${glyph}.svg`} />
        </Box>
      </Box>
    </Box>
  )
}

// The overhang is outlined with a dashed line, and the strand that is single-stranded at the end is in bold
export function DisplayOverhang( { overhang, overhangRc, translation, isRight = false } ) {
  return (
    <Box data-testid="display-overhang" sx={[dnaSx, { px: LINE }]}>
      <Box sx={{ px: LINE }}>{translation}</Box>
      <Box sx={(theme) => ({ borderLeft: dashedLine(theme), borderBottom: dashedLine(theme), fontWeight: isRight ? undefined : 'bold' })}>
        {overhang}
      </Box>
      <Box sx={(theme) => ({ borderRight: dashedLine(theme), pl: LINE, fontWeight: isRight ? 'bold' : undefined })}>
        {overhangRc}
      </Box>
      <div> </div>
    </Box>
  )
}
export function DisplayInside( { inside, insideRc, translation } ) {
  return (
    <Box data-testid="display-inside" sx={dnaSx}>
      <div>{translation}</div>
      <Box sx={{ pb: LINE }}>{inside}</Box>
      <div>{insideRc}</div>
      <div> </div>
    </Box>
  )
}

export function AssemblerPartContainer({ children }) {
  return (
    <Box
      className="assembler-part-container"
      sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', textAlign: 'left' }}
    >
      {children}
    </Box>
  )
}

function AssemblerPart( { data, showRight = true } ) {
  const { left_overhang: leftOverhang, right_overhang: rightOverhang, left_inside: leftInside, right_inside: rightInside, glyph } = data
  const { leftTranslationOverhang, leftTranslationInside, rightTranslationOverhang, rightTranslationInside, leftOverhangRc, rightOverhangRc, leftInsideRc, rightInsideRc } = partDataToDisplayData(data)

  return (

    <AssemblerPartContainer>
      <DisplayOverhang overhang={leftOverhang} overhangRc={leftOverhangRc} translation={leftTranslationOverhang} isRight={false} />
      {leftInside && (
        <DisplayInside inside={leftInside} insideRc={leftInsideRc} translation={leftTranslationInside} isRight={false} />
      )}
      <AssemblerPartCore color={data.color || 'lightgray'} glyph={glyph} />
      {rightInside && (
        <DisplayInside inside={rightInside} insideRc={rightInsideRc} translation={rightTranslationInside} isRight={true} />
      )}
      { showRight && (
        <DisplayOverhang overhang={rightOverhang} overhangRc={rightOverhangRc} translation={rightTranslationOverhang} isRight={true} />
      )}
    </AssemblerPartContainer>

  )
}

export default AssemblerPart
