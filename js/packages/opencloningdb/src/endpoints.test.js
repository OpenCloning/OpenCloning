import { describe, expect, it } from 'vitest';

import endpoints from './endpoints';

describe('endpoints', () => {
  it('encodes path parameters so they cannot change the request path', () => {
    expect(endpoints.sequenceSample('../workspaces/1/users/5')).toBe('/sequence_samples/..%2Fworkspaces%2F1%2Fusers%2F5');
    expect(endpoints.primer('1/../../workspaces/2')).toBe('/primers/1%2F..%2F..%2Fworkspaces%2F2');
    expect(() => endpoints.sequenceSample('..')).toThrow();
    expect(endpoints.sequenceSampleReassign('a/b')).toBe('/sequence_samples/a%2Fb/reassign');
    expect(endpoints.sequenceSampleSequencingFiles('a/b')).toBe('/sequence_samples/a%2Fb/sequencing_files');
  });

  it('keeps normal ids unchanged', () => {
    expect(endpoints.sequence(12)).toBe('/sequences/12');
    expect(endpoints.sequencingFile(4)).toBe('/sequencing_files/4');
    expect(endpoints.sequenceSample('ML-7_a')).toBe('/sequence_samples/ML-7_a');
    expect(endpoints.sequenceSampleSequencingFiles('ML-7_a')).toBe('/sequence_samples/ML-7_a/sequencing_files');
  });
});
