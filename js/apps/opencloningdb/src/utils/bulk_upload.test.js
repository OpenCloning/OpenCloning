import {
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
