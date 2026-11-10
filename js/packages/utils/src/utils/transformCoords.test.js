import getTransformCoords from './transformCoords';

const testData = require('../../../../cypress/test_files/unittests/test_data_transformCoords.json');

const pcrSource = testData.sources.find((s) => s.type === 'PCRSource');

const creLoxData = require('../../../../apps/opencloning/public/examples/cre_lox_recombination.json');

const plasmidExcisionSource = creLoxData.sources.find((s) => s.id === 3);
const plasmidInsertionSource = creLoxData.sources.find((s) => s.id === 5);

describe('getTransformCoords', () => {
  it('PCRSource', () => {
    const parentSequenceData = [
      { id: 2, size: 23 },
    ];
    const productLength = 18;
    const transformCoords = getTransformCoords(pcrSource, parentSequenceData, productLength);
    // Normal primer
    expect(transformCoords({ start: 12, end: 17 }, 2)).toEqual({ start: 8, end: 13 });
    // Origin-spanning primer
    expect(transformCoords({ start: 0, end: 6 }, 2)).toEqual({ start: 19, end: 2 });
  });
  it('Insertion / circular Assembly', () => {
    let parentSequenceData = [
      { id: 1, size: 151 },
    ];
    let productLength = 113;
    let transformCoords = getTransformCoords(plasmidExcisionSource, parentSequenceData, productLength);
    expect(transformCoords({ start: 1, end: 5 }, 1)).toEqual({ start: 16, end: 20 });
    expect(transformCoords({ start: 100, end: 0 }, 1)).toEqual({ start: 115, end: 128 });

    parentSequenceData = [
      { id: 3, size: 113 },
      { id: 4, size: 38 },
    ];
    productLength = 151;
    transformCoords = getTransformCoords(plasmidInsertionSource, parentSequenceData, productLength);
    expect(transformCoords({ start: 15, end: 37 }, 3)).toEqual({ start: 0, end: 22 });
    expect(transformCoords({ start: 2, end: 35 }, 3)).toEqual(null);
    expect(transformCoords({ start: 0, end: 19 }, 4)).toEqual({ start: 0, end: 19 });
    expect(transformCoords({ start: 128, end: 150 }, 4)).toEqual({ start: 15, end: 37 });
    expect(transformCoords({ start: 38, end: 112 }, 3)).toEqual({ start: 23, end: 97 });
    expect(transformCoords({ start: 38, end: 112 }, 4)).toEqual(null);
  });
  it('Edge case', ({ skip }) => {
    // This is not priority, but it may need fixing. When a circular molecule is excised, the rangeInAssembly
    // spans the entire product, so any value in isRangeWithinRange(selection, rangeInAssembly, productLength)
    // is true. When the selection spans the origin, this should not pass, but not sure what else would be affected.
    skip(true);
    const parentSequenceData = [
      { id: 2, size: 151 },
    ];
    const productLength = 113;
    const transformCoords = getTransformCoords(plasmidExcisionSource, parentSequenceData, productLength);
    expect(transformCoords({ start: 100, end: 20 }, 2)).toEqual(null);
  });
});
