import { sampleUidError } from './sample_uid';

describe('sampleUidError', () => {
  it('accepts UIDs that can go in a URL path', () => {
    ['S-W1', 'GB_105355_c1', 'box 1 % #?', '.hidden', 'a..b', ' S-W1 '].forEach((uid) => {
      expect(sampleUidError(uid)).toBe('');
    });
  });

  it('rejects "." and "..", slashes and control characters', () => {
    ['.', '..', ' .. ', 'a/b', 'S-W1/sequencing_files', 'a\\b', 'a\nb', 'a\u0000b', 'a\u007fb'].forEach((uid) => {
      expect(sampleUidError(uid)).toMatch(/^A UID cannot be/);
    });
  });
});
