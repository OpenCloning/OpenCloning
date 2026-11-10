import React from 'react'
import styles from './assembly_component.module.css'

import { getSvgByGlyph } from './sbol_visual_glyphs'
import { partDataToDisplayData } from './assembler_utils'

export function AssemblerPartCore({ color = 'lightgray', glyph = 'engineered-region' }) {
  return (
    <div data-testid="assembler-part-core" className={styles.boxContainer}>
      <div className={styles.box}>
        <div className={styles.imageContainer} style={{ backgroundColor: color }}>
          <img src={getSvgByGlyph(glyph)} alt={`${glyph}.svg`} />
        </div>
      </div>
    </div>
  )
}

export function DisplayOverhang( { overhang, overhangRc, translation, isRight = false } ) {
  return (
    <div data-testid="display-overhang" className={`${styles.dna} ${styles.overhang} ${isRight ? styles.right : styles.left}`}>
      <div className={styles.top}>{translation}</div>
      <div className={styles.watson}>{overhang}</div>
      <div className={styles.crick}>{overhangRc}</div>
      <div className={styles.bottom}> </div>
    </div>
  )
}
export function DisplayInside( { inside, insideRc, translation, isRight = false } ) {
  return (
    <div data-testid="display-inside" className={`${styles.dna} ${styles.inside} ${isRight ? styles.right : styles.left}`}>
      <div className={styles.top}>{translation}</div>
      <div className={styles.watson}>{inside}</div>
      <div className={styles.crick}>{insideRc}</div>
      <div className={styles.bottom}> </div>
    </div>
  )
}

export function AssemblerPartContainer({ children }) {
  return (
    <div className={styles.container}>
      {children}
    </div>
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
