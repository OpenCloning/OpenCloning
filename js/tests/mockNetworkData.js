export const mockSequences = [
  { id: 1, name: 'Seq1' },
  { id: 2, name: 'Seq2' },
  { id: 3, name: 'Seq3' },
  { id: 4, name: 'Seq4' },
  { id: 5, name: 'Seq5' },
  { id: 6, name: 'unrelated' },
];

export const mockSources = [
  { id: 1, input: [{sequence: 2}, {sequence: 3}], },
  { id: 2, input: [{sequence: 7}, {sequence: 8}],  type: 'OligoHybridizationSource' },
  { id: 3, input: [{sequence: 4}, {sequence: 5}],  database_id: 100 },
  { id: 4, input: [], },
  { id: 5, input: [{sequence: 9}, {sequence: 10}],  type: 'OligoHybridizationSource' },
  { id: 6, input: [], },
];

export const mockPrimers = [
  { id: 7, name: 'Primer1' },
  { id: 8, name: 'Primer2', database_id: 123 },
  { id: 9, name: 'Primer3' },
  { id: 10, name: 'Primer4' },
  { id: 11, name: 'unused' },
];

export const mockFiles = [
  { sequence_id: 1, file_name: 'file1.gb' },
  { sequence_id: 1, file_name: 'file2.gb' },
  { sequence_id: 2, file_name: 'file3.gb' },
  { sequence_id: 7, file_name: 'file4.gb' },
];

export const mockTeselaJsonCache = {
  1: { name: 'Seq1' },
  2: { name: 'Seq2' },
  3: { name: 'Seq3' },
  4: { name: 'Seq4' },
  5: { name: 'Seq5' },
  6: { name: 'unrelated' },
};
