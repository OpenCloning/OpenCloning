import { mockSources, mockSequences, mockPrimers, mockFiles } from '../../../../tests/mockNetworkData';
import { collectParentSequencesAndSources, getSubState } from './network';

describe('collectParentSequencesAndSources', () => {
  it('should collect all parent sequences and sources recursively', () => {
    const sequencesToExport = [];
    const sourcesToExport = [];

    const { parentSequences, parentSources } = collectParentSequencesAndSources(
      mockSources.find((s) => s.id === 1),
      mockSources,
      mockSequences,
    );

    expect(parentSequences).toEqual([
      { id: 2, name: 'Seq2' },
      { id: 3, name: 'Seq3' },
      { id: 4, name: 'Seq4' },
      { id: 5, name: 'Seq5' },
    ]);

    expect(parentSources).toEqual([
      mockSources.find((s) => s.id === 2),
      mockSources.find((s) => s.id === 3),
      mockSources.find((s) => s.id === 4),
      mockSources.find((s) => s.id === 5),
    ]);
  });

  it('should stop collecting when stopAtDatabaseId is true and a source with database_id is found', () => {

    const { parentSequences, parentSources } = collectParentSequencesAndSources(
      mockSources.find((s) => s.id === 1),
      mockSources,
      mockSequences,
      true,
    );

    expect(parentSequences).toEqual([
      { id: 2, name: 'Seq2' },
      { id: 3, name: 'Seq3' },
    ]);

    expect(parentSources).toEqual([
      mockSources.find((s) => s.id === 2),
      mockSources.find((s) => s.id === 3),
    ]);
  });

  it('should handle sources with no input', () => {
    const { parentSequences, parentSources } = collectParentSequencesAndSources(
      mockSources.find((s) => s.id === 4),
      mockSources,
      mockSequences,
    );

    expect(parentSequences).toEqual([]);
    expect(parentSources).toEqual([]);
  });
});

describe('getSubState', () => {
  it('should throw an error if the sequence is not found', () => {
    const state = {
      cloning: {
        sequences: [],
        sources: [],
      },
    };

    expect(() => getSubState(state, 1)).toThrow('Sequence with id 1 not found');
  });

  it('should throw an error if the source is not found', () => {
    const state = {
      cloning: {
        sequences: [{ id: 1 }],
        sources: [],
      },
    };

    expect(() => getSubState(state, 1)).toThrow('Source with id 1 not found');
  });
  it('should return the correct substate with used primers and files only', () => {
    const state = {
      cloning: {
        sequences: mockSequences,
        sources: mockSources,
        primers: mockPrimers,
        files: mockFiles,
      },
    };

    const substate = getSubState(state, 1);

    // Unlike the sequencesToExport, the substate includes the sequence with id and its source
    expect(substate.sequences).toEqual([
      { id: 1, name: 'Seq1' },
      { id: 2, name: 'Seq2' },
      { id: 3, name: 'Seq3' },
      { id: 4, name: 'Seq4' },
      { id: 5, name: 'Seq5' },
    ]);

    expect(substate.sources).toEqual([
      mockSources.find((s) => s.id === 1),
      mockSources.find((s) => s.id === 2),
      mockSources.find((s) => s.id === 3),
      mockSources.find((s) => s.id === 4),
      mockSources.find((s) => s.id === 5),
    ]);

    expect(substate.primers).toEqual([
      mockPrimers.find((p) => p.id === 7),
      mockPrimers.find((p) => p.id === 8),
      mockPrimers.find((p) => p.id === 9),
      mockPrimers.find((p) => p.id === 10),
    ]);
    expect(substate.files).toEqual(mockFiles.slice(0, 3));
  });
  it('should work with database_id', () => {
    const state = {
      cloning: {
        sequences: mockSequences,
        sources: mockSources,
        primers: mockPrimers,
      },
    };

    const substate = getSubState(state, 1, true);

    expect(substate.sequences).toEqual([
      { id: 1, name: 'Seq1' },
      { id: 2, name: 'Seq2' },
      { id: 3, name: 'Seq3' },
    ]);

    expect(substate.sources).toEqual([
      mockSources.find((s) => s.id === 1),
      mockSources.find((s) => s.id === 2),
      mockSources.find((s) => s.id === 3),
    ]);

    expect(substate.primers).toEqual([
      mockPrimers.find((p) => p.id === 7),
      mockPrimers.find((p) => p.id === 8),
    ]);
  });
});
