import { it, describe } from 'vitest';
import { pcrPrimerPositionsInInput } from './cloning_utils';

// Template sequence fwd
const source1 = {
  type: 'PCRSource',
  input: [
    {
      sequence: 1,
      left_location: null,
      right_location: '1..6',
      reverse_complemented: false,
    },
    {
      sequence: 2,
      left_location: 'join(21..23,1..3)',
      right_location: '10..15',
      reverse_complemented: false,
    },
    {
      sequence: 1,
      left_location: '1..6',
      right_location: null,
      reverse_complemented: true,
    },
  ],
};

// Template sequence rvs
const source2 = {
  type: 'PCRSource',
  input: [
    {
      sequence: 1,
      left_location: null,
      right_location: '1..7',
      reverse_complemented: false,
    },
    {
      sequence: 4,
      left_location: 'join(21..23,1..4)',
      right_location: '10..15',
      reverse_complemented: true,
    },
    {
      sequence: 2,
      left_location: '1..6',
      right_location: null,
      reverse_complemented: true,
    },
  ],
};

describe('test pcrPrimerPositionsInInput', () => {
  it('test normal case', () => {
    const primerPos1 = pcrPrimerPositionsInInput(source1, { size: 23 });
    expect(primerPos1).toEqual([{ start: 20, end: 2, strand: 1 }, { start: 9, end: 14, strand: -1 }]);

    const primerPos2 = pcrPrimerPositionsInInput(source2, { size: 23 });
    expect(primerPos2).toEqual([{ end: 2, start: 19, strand: -1 }, { end: 13, start: 8, strand: 1 }]);
  });
  it('raises error if source is not a PCRSource', () => {
    const source = { type: 'dummy' };
    expect(() => pcrPrimerPositionsInInput(source, { size: 23 })).toThrow('Source is not a PCRSource');
  });
});
