import { duplicatedUids } from './useUidRows';

describe('duplicatedUids', () => {
  it('finds the UIDs that appear more than once, ignoring case and empty UIDs', () => {
    expect(duplicatedUids(['A1', 'B1', 'a1', '', '', 'C1', 'B1'])).toEqual(['a1', 'B1']);
    expect(duplicatedUids(['A1', 'B1', ''])).toEqual([]);
  });
});
