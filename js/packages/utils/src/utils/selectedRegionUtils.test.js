import { selectedRegion2SequenceLocation } from './selectedRegionUtils';

describe('selectedRegion2SequenceLocation', () => {
  it('should return the correct sequence location', () => {
    // Normal features
    expect(selectedRegion2SequenceLocation({ selectionLayer: { start: 0, end: 0 }, caretPosition: -1 }, 10)).toBe('1..1');
    expect(selectedRegion2SequenceLocation({ selectionLayer: { start: 0, end: 1 }, caretPosition: -1 }, 10)).toBe('1..2');
    // Position between bases
    expect(selectedRegion2SequenceLocation({ selectionLayer: { start: -1, end: -1 }, caretPosition: 0 }, 10)).toBe('0^1');
    // Origin-spanning feature
    expect(selectedRegion2SequenceLocation({ selectionLayer: { start: 7, end: 0 }, caretPosition: -1 }, 8)).toBe('join(8..8,1..1)');
    expect(selectedRegion2SequenceLocation({ selectionLayer: { start: 6, end: 1 }, caretPosition: -1 }, 8)).toBe('join(7..8,1..2)');
  });
});
