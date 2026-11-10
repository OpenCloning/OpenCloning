import assemblyScar from './sbol_visual_glyphs/assembly-scar.svg'
import cds from './sbol_visual_glyphs/cds.svg'
import chromosomalLocus from './sbol_visual_glyphs/chromosomal-locus.svg'
import engineeredRegion from './sbol_visual_glyphs/engineered-region.svg'
import fivePrimeStickyRestrictionSite from './sbol_visual_glyphs/five-prime-sticky-restriction-site.svg'
import originOfReplication from './sbol_visual_glyphs/origin-of-replication.svg'
import primerBindingSite from './sbol_visual_glyphs/primer-binding-site.svg'
import promoter from './sbol_visual_glyphs/promoter.svg'
import ribosomeEntrySite from './sbol_visual_glyphs/ribosome-entry-site.svg'
import specificRecombinationSite from './sbol_visual_glyphs/specific-recombination-site.svg'
import terminator from './sbol_visual_glyphs/terminator.svg'
import threePrimeStickyRestrictionSite from './sbol_visual_glyphs/three-prime-sticky-restriction-site.svg'
import cdsStop from './sbol_visual_glyphs/cds-stop.svg'

// Map glyph names (without extension) to their SVG imports
export const sbolVisualGlyphs = {
  'assembly-scar': assemblyScar,
  'cds': cds,
  'cds-stop': cdsStop,
  'chromosomal-locus': chromosomalLocus,
  'engineered-region': engineeredRegion,
  'five-prime-sticky-restriction-site': fivePrimeStickyRestrictionSite,
  'origin-of-replication': originOfReplication,
  'primer-binding-site': primerBindingSite,
  'promoter': promoter,
  'ribosome-entry-site': ribosomeEntrySite,
  'specific-recombination-site': specificRecombinationSite,
  'terminator': terminator,
  'three-prime-sticky-restriction-site': threePrimeStickyRestrictionSite,
}

// Helper function to get SVG by glyph name (without extension)
export const getSvgByGlyph = (glyphName) => {
  return sbolVisualGlyphs[glyphName] || sbolVisualGlyphs['engineered-region'] // fallback to engineered-region if not found
}

