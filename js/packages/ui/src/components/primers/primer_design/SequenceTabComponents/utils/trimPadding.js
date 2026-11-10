import { getSequenceWithinRange } from '@teselagen/range-utils';
import { aliasedEnzymesByName, cutSequenceByRestrictionEnzyme } from '@teselagen/sequence-utils';

export default function trimPadding({ templateSequence, padding_left, padding_right, restrictionSitesToAvoid, roi, max_inside, max_outside }) {
  const { start, end } = roi.selectionLayer;
  const leftAnnotationRange = { start: start - padding_left, end: start - 1 };
  const leftArm = getSequenceWithinRange(leftAnnotationRange, templateSequence.sequence);
  const rightAnnotationRange = { start: end + 1, end: end + padding_right };
  const rightArm = getSequenceWithinRange(rightAnnotationRange, templateSequence.sequence);

  const leftMargin = { start: start - max_outside, end: start + max_inside - 1 };
  const rightMargin = { start: end - max_inside, end: end + max_outside - 1 };
  const leftMarginArm = getSequenceWithinRange(leftMargin, templateSequence.sequence);
  const rightMarginArm = getSequenceWithinRange(rightMargin, templateSequence.sequence);

  const enzymes = restrictionSitesToAvoid.map((enzyme) => aliasedEnzymesByName[enzyme.toLowerCase()]);
  if (enzymes.length === 0) {
    return { padding_left, padding_right, cutsitesInMargins: false };
  }

  const cutsInLeftMargin = enzymes.flatMap((enzyme) => cutSequenceByRestrictionEnzyme(
    leftMarginArm,
    true,
    enzyme,
  ));
  const cutsInRightMargin = enzymes.flatMap((enzyme) => cutSequenceByRestrictionEnzyme(
    rightMarginArm,
    false,
    enzyme,
  ));

  const cutsitesInMargins = cutsInLeftMargin.length > 0 || cutsInRightMargin.length > 0;

  const leftCutsites = enzymes.flatMap((enzyme) => cutSequenceByRestrictionEnzyme(
    leftArm,
    true,
    enzyme,
  ));
  const rightCutsites = enzymes.flatMap((enzyme) => cutSequenceByRestrictionEnzyme(
    rightArm,
    false,
    enzyme,
  ));

  let paddingLeft = padding_left;
  let paddingRight = padding_right;
  if (leftCutsites.length > 0) {
    paddingLeft = leftArm.length - 1 - Math.max(...leftCutsites.map((cutsite) => cutsite.recognitionSiteRange.end));
  }
  if (rightCutsites.length > 0) {
    paddingRight = Math.min(...rightCutsites.map((cutsite) => cutsite.recognitionSiteRange.start));
  }
  return {
    padding_left: paddingLeft,
    padding_right: paddingRight,
    cutsitesInMargins,
  };
}
