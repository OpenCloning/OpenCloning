// @vitest-environment node
// (jsdom Blobs have no arrayBuffer, which zip.js needs)
import { TextReader } from '@zip.js/zip.js';
import { getZipFileBlob } from '@opencloning/utils/readNwrite';
import {
  finalFastqFilesFromZip,
  isAlreadyLinked,
  linkEntries,
  linkRow,
  linkRowStatuses,
  newSampleCount,
  prepareLineRowsForValidation,
  prepareTemplateSequenceRowsForValidation,
  splitSpaceSeparatedField,
  withMatches,
  withTarget,
} from './bulk_upload';

describe('prepareTemplateSequenceRowsForValidation', () => {
  it('returns normalized rows when sequence_type values are valid and removes empty names', () => {
    const result = prepareTemplateSequenceRowsForValidation([
      { name: '  template_a  ', sequence_type: 'allele' },
      { name: 'template_b', sequence_type: 'pcr_product' },
      { name: '   ', sequence_type: 'allele' },
    ]);

    expect(result).to.deep.equal([
      { name: 'template_a', sequence_type: 'allele' },
      { name: 'template_b', sequence_type: 'pcr_product' },
    ]);
  });

  it('throws when sequence_type contains invalid values', () => {
    expect(() => prepareTemplateSequenceRowsForValidation([
      { name: 'template_a', sequence_type: 'not_a_type' },
    ])).to.throw('Invalid sequence_type value(s): not_a_type');
  });

  it('throws when all names are empty after trimming', () => {
    expect(() => prepareTemplateSequenceRowsForValidation([
      { name: '   ', sequence_type: 'allele' },
    ])).to.throw('File does not contain template sequence rows with names');
  });
});

describe('splitSpaceSeparatedField', () => {
  it('splits on whitespace and drops empty tokens', () => {
    expect(splitSpaceSeparatedField('  a   b  ')).to.deep.equal(['a', 'b']);
    expect(splitSpaceSeparatedField('')).to.deep.equal([]);
  });
});

describe('prepareLineRowsForValidation', () => {
  it('returns normalized rows with space-separated lists', () => {
    const result = prepareLineRowsForValidation([
      {
        uid: '  line-a  ',
        plasmids: 'p1 p2',
        genotype: 'allele1',
        parent_uids: 'parent1 parent2',
      },
    ]);

    expect(result).to.deep.equal([{
      uid: 'line-a',
      plasmids: ['p1', 'p2'],
      genotype: ['allele1'],
      parent_uids: ['parent1', 'parent2'],
    }]);
  });

  it('throws when a row has more than two parent UIDs', () => {
    expect(() => prepareLineRowsForValidation([
      {
        uid: 'line-a',
        plasmids: '',
        genotype: '',
        parent_uids: 'p1 p2 p3',
      },
    ])).to.throw('Line "line-a" has more than two parent UIDs');
  });

  it('throws when a row is missing a UID', () => {
    expect(() => prepareLineRowsForValidation([
      { uid: '   ', plasmids: '', genotype: '', parent_uids: '' },
    ])).to.throw('File contains line rows without a UID');
  });
});


async function runZip(paths) {
  const blob = await getZipFileBlob(paths.map((name) => ({ name, reader: new TextReader(`content of ${name}`) })));
  return new File([blob], 'run.zip');
}

describe('sequencing run zip files', () => {
  const runPaths = [
    'run/A1-P1/A1-P1.final.fastq',
    'run/A1-P1/A1-P1_raw.fastq.gz',
    'run/A1-P1/A1-P1.final_pLann.gbk',
    'run/A1-P1-2/A1-P1-2.final.fastq',
    'run/A1-P1-2/A1-P1-2.stats',
    // Added by macOS
    '__MACOSX/run/A1-P1/._A1-P1.final.fastq',
    'run/A1-P1-2/._A1-P1-2.final.fastq',
  ];

  it('extracts the .final.fastq files, skipping hidden and __MACOSX files', async () => {
    const files = await finalFastqFilesFromZip(await runZip(runPaths));
    expect(files.map((file) => file.name).sort()).toEqual(['A1-P1-2.final.fastq', 'A1-P1.final.fastq']);
    const file = files.find(({ name }) => name === 'A1-P1.final.fastq');
    expect(await file.text()).toBe('content of run/A1-P1/A1-P1.final.fastq');
  });

  it('throws if two samples have the same file name', async () => {
    const zip = await runZip(['run1/A1/A1.final.fastq', 'run2/A1/A1.final.fastq']);
    await expect(finalFastqFilesFromZip(zip)).rejects.toThrow('Several files with the same name in the zip file: A1.final.fastq');
  });
});

describe('rows to link sequencing files', () => {
  const file = (sampleName) => new File(['@r\nACGT\n+\nIIII\n'], `${sampleName}.final.fastq`);
  const pREX0008 = { id: 1, name: 'pREX0008' };
  const pJOG684 = { id: 2, name: 'pJOG684' };
  const existing = { uid: 'S1', sequence_id: 1, sequence: pREX0008 };

  it('starts with the existing sample of the same name, or no sample', () => {
    expect(linkRow(file('S1'), existing)).toMatchObject({ sampleName: 'S1', uid: 'S1', sample: existing, sequence: pREX0008, skip: false });
    expect(linkRow(file('A1-P1'))).toMatchObject({ sampleName: 'A1-P1', uid: null, sample: null, candidates: [] });
  });

  it('gives the status of each row, and what blocks linking', () => {
    const rows = [
      linkRow(file('S1'), existing),
      linkRow(file('A1')),
      { ...linkRow(file('A2')), uid: 'NEW', sequence: pJOG684 },
      { ...linkRow(file('A3')), uid: 'other' },
      { ...linkRow(file('A4')), skip: true },
    ];
    expect(linkRowStatuses(rows)).toEqual([
      { status: 'existing', duplicates: [], conflict: false, blocking: false },
      { status: 'no_sample', duplicates: [], conflict: false, blocking: true },
      { status: 'new', duplicates: [], conflict: false, blocking: false },
      { status: 'no_sequence', duplicates: [], conflict: false, blocking: true },
      { status: 'skip', duplicates: [], conflict: false, blocking: false },
    ]);
  });

  it('flags rows that link to the same sample, and blocks a new sample with different sequences', () => {
    const rows = [
      linkRow(file('S1'), existing),
      { ...linkRow(file('S1-again')), uid: 's1', sample: existing },
      // Same new sample (case-insensitive), same sequence: allowed
      { ...linkRow(file('A1')), uid: 'NEW', sequence: pJOG684 },
      { ...linkRow(file('A2')), uid: 'new', sequence: pJOG684 },
      // Same new sample, different sequences
      { ...linkRow(file('B1')), uid: 'OTHER', sequence: pJOG684 },
      { ...linkRow(file('B2')), uid: 'OTHER', sequence: pREX0008 },
      // Skipped rows are not duplicates
      { ...linkRow(file('B3')), uid: 'OTHER', sequence: pREX0008, skip: true },
    ];
    const statuses = linkRowStatuses(rows);
    expect(statuses.map(({ duplicates }) => duplicates)).toEqual([['S1-again'], ['S1'], ['A2'], ['A1'], ['B2'], ['B1'], []]);
    expect(statuses.map(({ blocking }) => blocking)).toEqual([false, false, false, false, true, true, false]);
    expect(newSampleCount(rows)).toBe(2);
  });

  it('gives the sample UIDs and sequence IDs to submit', () => {
    const rows = [
      linkRow(file('S1'), existing),
      { ...linkRow(file('A1')), uid: 'NEW', sequence: pJOG684 },
      { ...linkRow(file('A2')), skip: true },
    ];
    expect(linkEntries(rows).map(({ sampleUid, sequenceId, file: f }) => [sampleUid, sequenceId, f.name])).toEqual([
      ['S1', '', 'S1.final.fastq'],
      ['NEW', '2', 'A1.final.fastq'],
    ]);
    expect(newSampleCount(rows)).toBe(1);
  });

  it('does not link a file again to a sample that already has a file with its name', () => {
    const withFile = { ...existing, sequencing_files: [{ id: 1, original_name: 'S1.final.fastq' }] };
    const rows = [
      // Same file name: already linked
      linkRow(file('S1'), withFile),
      // Another file of the same sample: linked, and not a duplicate of the already linked one
      { ...linkRow(file('A1')), uid: 'S1', sample: withFile },
      // Skipped wins over already linked
      { ...linkRow(file('S1')), uid: 'S1', sample: withFile, skip: true },
      // Changing the sample of an already linked file links it again
      { ...linkRow(file('S1'), withFile), uid: 'NEW', sample: null, sequence: pJOG684 },
    ];
    expect(isAlreadyLinked(rows[0])).toBe(true);
    expect(isAlreadyLinked(rows[1])).toBe(false);
    expect(linkRowStatuses(rows)).toEqual([
      { status: 'already_linked', duplicates: [], conflict: false, blocking: false },
      { status: 'existing', duplicates: [], conflict: false, blocking: false },
      { status: 'skip', duplicates: [], conflict: false, blocking: false },
      { status: 'new', duplicates: [], conflict: false, blocking: false },
    ]);
    expect(linkEntries(rows).map(({ sampleUid, file: f }) => [sampleUid, f.name])).toEqual([
      ['S1', 'A1.final.fastq'],
      ['NEW', 'S1.final.fastq'],
    ]);
  });

  it('changes the sample of a row, keeping the sequence for a new sample', () => {
    const other = { uid: 'S2', sequence_id: 2, sequence: pJOG684 };
    const atExisting = linkRow(file('S1'), existing);
    // Another existing sample: its sequence
    expect(withTarget(atExisting, { uid: 'S2', sample: other })).toMatchObject({ uid: 'S2', sample: other, sequence: pJOG684 });
    // A new sample: the sequence of the existing sample
    const atNew = withTarget(atExisting, { uid: 'NEW', sample: null });
    expect(atNew).toMatchObject({ uid: 'NEW', sample: null, sequence: pREX0008, matchedByRead: false });
    expect(linkRowStatuses([atNew])[0].status).toBe('new');
    // Renaming a new sample matched by read keeps the match
    const matched = { ...linkRow(file('A1')), uid: 'A1', sequence: pJOG684, matchedByRead: true };
    expect(withTarget(matched, { uid: 'A1-bis', sample: null })).toMatchObject({ uid: 'A1-bis', sequence: pJOG684, matchedByRead: true });
    // Choosing an existing sample, or none, drops the match
    expect(withTarget(matched, { uid: 'S1', sample: existing })).toMatchObject({ sequence: pREX0008, matchedByRead: false });
    expect(withTarget(matched, null)).toMatchObject({ uid: null, sample: null, sequence: null, matchedByRead: false });
  });

  it('applies the sequences that match the read to rows without sample', () => {
    const row = linkRow(file('A1'));
    expect(withMatches(row, [pJOG684])).toMatchObject({ uid: 'A1', sample: null, sequence: pJOG684, matchedByRead: true, candidates: [] });
    expect(withMatches(row, [pJOG684, pREX0008]))
      .toMatchObject({ uid: 'A1', sequence: null, matchedByRead: false, candidates: [pJOG684, pREX0008] });
    // No matches, unreadable file, or rows that have a sample or are skipped: unchanged
    const unchanged = [
      [row, []],
      [row, null],
      [row, undefined],
      [linkRow(file('S1'), existing), [pJOG684]],
      [{ ...row, uid: 'NEW' }, [pJOG684]],
      [{ ...row, skip: true }, [pJOG684]],
    ];
    unchanged.forEach(([r, matches]) => expect(withMatches(r, matches)).toBe(r));
  });
});
