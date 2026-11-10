import { describe, it, expect } from 'vitest';
import { delimitedFileToJson, primersFromTextFile } from './fileParsers';

// Helper function to create a File object for testing
// File is a browser global available in jsdom test environment
function createFile(content, filename) {
  // eslint-disable-next-line no-undef
  return new File([content], filename, { type: 'text/plain' });
}

describe('delimitedFileToJson', () => {
  it('parses CSV file with comma delimiter', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC\nprimer2,CGTG', 'test.csv');

    const result = await delimitedFileToJson(file);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG' }
    ]);
  });

  it('parses CSV file with semicolon delimiter', async () => {
    const file = createFile('name;sequence\nprimer1;ATGC\nprimer2;CGTG', 'test.csv');

    const result = await delimitedFileToJson(file);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG' }
    ]);
  });

  it('parses TSV file with tab delimiter', async () => {
    const file = createFile('name\tsequence\nprimer1\tATGC\nprimer2\tCGTG', 'test.tsv');

    const result = await delimitedFileToJson(file);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG' }
    ]);
  });

  it('throws error for non-CSV/TSV file', async () => {
    const file = createFile('some content', 'test.txt');

    await expect(delimitedFileToJson(file)).rejects.toThrow('File must be a .csv or .tsv file');
  });

  it('throws error when CSV contains both comma and semicolon', async () => {
    const file = createFile('name,sequence;other\nprimer1,ATGC;extra', 'test.csv');

    await expect(delimitedFileToJson(file)).rejects.toThrow('File must contain only one delimiter, either comma or semicolon');
  });

  it('throws error for empty file', async () => {
    const file = createFile('', 'test.csv');

    await expect(delimitedFileToJson(file)).rejects.toThrow('File is empty');
  });

  it('throws error for file with only empty lines', async () => {
    const file = createFile('\n\n  \n\r\n', 'test.csv');

    await expect(delimitedFileToJson(file)).rejects.toThrow('File is empty');
  });

  it('removes empty lines', async () => {
    const file = createFile('name,sequence\n\nprimer1,ATGC\n  \nprimer2,CGTG', 'test.csv');

    const result = await delimitedFileToJson(file);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG' }
    ]);
  });

  it('validates required headers', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC', 'test.csv');

    await expect(delimitedFileToJson(file, ['name', 'sequence', 'required'])).rejects.toThrow('Headers missing: required');

    const file2 = createFile('name,sequence\nprimer1,ATGC', 'test.csv');

    const result = await delimitedFileToJson(file2, ['name', 'sequence']);

    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' }
    ]);
  });

  it('validates multiple missing headers', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC', 'test.csv');

    await expect(delimitedFileToJson(file, ['name', 'required1', 'required2'])).rejects.toThrow('Headers missing: required1, required2');
  });

  it('throws error when rows have inconsistent column count', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC,extra\nprimer2,CGTG', 'test.csv');

    await expect(delimitedFileToJson(file)).rejects.toThrow('All lines should have the same number of columns');
  });

  it('handles Windows line endings (\\r\\n)', async () => {
    const file = createFile('name,sequence\r\nprimer1,ATGC\r\nprimer2,CGTG', 'test.csv');

    const result = await delimitedFileToJson(file);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG' }
    ]);
  });

  it('handles Mac line endings (\\r)', async () => {
    const file = createFile('name,sequence\rprimer1,ATGC\rprimer2,CGTG', 'test.csv');

    const result = await delimitedFileToJson(file);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG' }
    ]);
  });

  it('handles Unix line endings (\\n)', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC\nprimer2,CGTG', 'test.csv');

    const result = await delimitedFileToJson(file);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' },
      { name: 'primer2', sequence: 'CGTG' }
    ]);
  });

  it('handles empty required headers array', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC', 'test.csv');

    const result = await delimitedFileToJson(file, []);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' }
    ]);
  });

  it('handles single row data', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC', 'test.csv');

    const result = await delimitedFileToJson(file);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' }
    ]);
  });

  it('ignores header case if parameter is passed', async () => {
    let file = createFile('Name,Sequence\nprimer1,ATGC', 'test.csv');
    let result = await delimitedFileToJson(file, ['name', 'sequence'], true);
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC' }
    ]);
    file = createFile('Name,Sequence\nprimer1,ATGC', 'test.csv');
    await expect(delimitedFileToJson(file, ['name', 'sequence'])).rejects.toThrow('Headers missing: name, sequence');
  });
});

describe('primersFromTextFile', () => {
  it('parses valid primers without errors', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC\nprimer2,CGTG', 'test.csv');

    const result = await primersFromTextFile(file, []);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC', error: '' },
      { name: 'primer2', sequence: 'CGTG', error: '' }
    ]);
  });

  it('marks primers with existing names', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC\nprimer2,CGTG', 'test.csv');

    const result = await primersFromTextFile(file, ['primer1']);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC', error: 'existing' },
      { name: 'primer2', sequence: 'CGTG', error: '' }
    ]);
  });

  it('marks primers with invalid DNA sequences', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC\nprimer2,XYZ', 'test.csv');

    const result = await primersFromTextFile(file, []);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC', error: '' },
      { name: 'primer2', sequence: 'XYZ', error: 'invalid' }
    ]);
  });

  it('prioritizes existing name error over invalid sequence error', async () => {
    const file = createFile('name,sequence\nprimer1,XYZ', 'test.csv');

    const result = await primersFromTextFile(file, ['primer1']);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'XYZ', error: 'existing' }
    ]);
  });

  it('handles multiple primers with mixed errors', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC\nprimer2,XYZ\nprimer3,CGTG', 'test.csv');

    const result = await primersFromTextFile(file, ['primer1']);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC', error: 'existing' },
      { name: 'primer2', sequence: 'XYZ', error: 'invalid' },
      { name: 'primer3', sequence: 'CGTG', error: '' }
    ]);
  });

  it('requires name and sequence headers', async () => {
    const file = createFile('name,other\nprimer1,ATGC', 'test.csv');

    await expect(primersFromTextFile(file, [])).rejects.toThrow('Headers missing: sequence');
  });

  it('handles empty existing names array', async () => {
    const file = createFile('name,sequence\nprimer1,ATGC', 'test.csv');

    const result = await primersFromTextFile(file, []);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC', error: '' }
    ]);
  });

  it('handles TSV format', async () => {
    const file = createFile('name\tsequence\nprimer1\tATGC', 'test.tsv');

    const result = await primersFromTextFile(file, []);
    
    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC', error: '' }
    ]);
  });
  it('ignores header case', async () => {
    const file = createFile('Name,Sequence\nprimer1,ATGC', 'test.csv');

    const result = await primersFromTextFile(file, []);

    expect(result).toEqual([
      { name: 'primer1', sequence: 'ATGC', error: '' }
    ]);
  });
});
