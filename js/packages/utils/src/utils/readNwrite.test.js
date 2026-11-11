import { describe, it, expect } from 'vitest';
import { jsonToDelimitedFile } from './readNwrite';

describe('jsonToDelimitedFile', () => {
  it('converts JSON array to delimited file with default tab delimiter', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC', length: 4 },
      { name: 'primer2', sequence: 'CGTG', length: 4 }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\tlength\nprimer1\tATGC\t4\nprimer2\tCGTG\t4');
  });

  it('converts JSON array to CSV with comma delimiter', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG' }
    ];

    const result = jsonToDelimitedFile(json, ',');

    expect(result).toBe('name,sequence\nprimer1,ATGC\nprimer2,CGTG');
  });

  it('handles single row', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC' }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\nprimer1\tATGC');
  });

  it('handles empty string values', () => {
    const json = [
      { name: 'primer1', sequence: '', length: 4 },
      { name: '', sequence: 'ATGC', length: 4 }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\tlength\nprimer1\t\t4\n\tATGC\t4');
  });

  it('handles null and undefined values', () => {
    const json = [
      { name: 'primer1', sequence: null, length: undefined },
      { name: null, sequence: 'ATGC', length: 4 }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\tlength\nprimer1\tnull\tundefined\nnull\tATGC\t4');
  });

  it('handles numeric values', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC', length: 4, temperature: 65.5 },
      { name: 'primer2', sequence: 'CGTG', length: 4, temperature: 67.0 }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\tlength\ttemperature\nprimer1\tATGC\t4\t65.5\nprimer2\tCGTG\t4\t67');
  });

  it('handles boolean values', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC', active: true },
      { name: 'primer2', sequence: 'CGTG', active: false }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\tactive\nprimer1\tATGC\ttrue\nprimer2\tCGTG\tfalse');
  });

  it('handles values containing delimiter characters', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC', description: 'test\twith\ttabs' },
      { name: 'primer2', sequence: 'CGTG', description: 'test,with,commas' }
    ];

    const result = jsonToDelimitedFile(json, '\t');

    expect(result).toBe('name\tsequence\tdescription\nprimer1\tATGC\ttest with tabs\nprimer2\tCGTG\ttest,with,commas');
  });

  it('handles values containing newlines', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC', notes: 'line1\nline2' },
      { name: 'primer2', sequence: 'CGTG', notes: 'single line' }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\tnotes\nprimer1\tATGC\tline1 line2\nprimer2\tCGTG\tsingle line');
  });

  it('preserves order of headers based on first object', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC', length: 4 },
      { length: 4, sequence: 'CGTG', name: 'primer2' }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\tlength\nprimer1\tATGC\t4\nprimer2\tCGTG\t4');
  });

  it('handles objects with different keys by using first object keys', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG', extra: 'field' }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\nprimer1\tATGC\nprimer2\tCGTG');
  });

  it('handles missing values in subsequent objects', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC', length: 4 },
      { name: 'primer2', sequence: 'CGTG' }
    ];

    const result = jsonToDelimitedFile(json);

    expect(result).toBe('name\tsequence\tlength\nprimer1\tATGC\t4\nprimer2\tCGTG\tundefined');
  });

  it('handles custom delimiter with multiple characters', () => {
    const json = [
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG' }
    ];

    const result = jsonToDelimitedFile(json, ' | ');

    expect(result).toBe('name | sequence\nprimer1 | ATGC\nprimer2 | CGTG');
  });
});
