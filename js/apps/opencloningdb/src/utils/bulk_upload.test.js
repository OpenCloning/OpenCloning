// @vitest-environment node
// (jsdom Blobs have no arrayBuffer, which zip.js needs)
import { TextReader } from '@zip.js/zip.js';
import { getZipFileBlob } from '@opencloning/utils/readNwrite';
import {
  finalFastqFilesFromZip,
  pairFastqFilesWithSequences,
  sampleTableTsv,
  prepareLineRowsForValidation,
  prepareTemplateSequenceRowsForValidation,
  splitSpaceSeparatedField,
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

  it('builds the sample table and pairs the filled rows with the files', async () => {
    const files = await finalFastqFilesFromZip(await runZip(runPaths));
    // Sorted by sample name, whatever the order in the zip
    expect(sampleTableTsv([...files].reverse())).toBe('sample_name\tsequence_name\nA1-P1\t\nA1-P1-2\t\n');
    expect(sampleTableTsv(files)).toBe('sample_name\tsequence_name\nA1-P1\t\nA1-P1-2\t\n');

    const pairs = pairFastqFilesWithSequences(files, [
      { sample_name: 'A1-P1', sequence_name: ' pREX0008 ' },
      { sample_name: 'A1-P1-2', sequence_name: '' },
    ]);
    expect(pairs.map(({ sequenceName, file }) => [sequenceName, file.name])).toEqual([['pREX0008', 'A1-P1.final.fastq']]);

    expect(() => pairFastqFilesWithSequences(files, [{ sample_name: 'A1-P1', sequence_name: '' }]))
      .toThrow('No sequence names were filled in the table');
    expect(() => pairFastqFilesWithSequences(files, [{ sample_name: 'B7', sequence_name: 'pREX0008' }]))
      .toThrow('Samples not found in the zip file: B7');
  });
});
