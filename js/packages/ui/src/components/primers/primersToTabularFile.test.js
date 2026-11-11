import primersToTabularFile from './primersToTabularFile';
import { mockPCRDetails } from '../../../../../tests/mockPrimerDetailsData';

const headers = [
  'id',
  'name',
  'sequence',
  'length',
  'melting_temperature',
  'gc_content',
  'homodimer_melting_temperature',
  'homodimer_deltaG',
  'hairpin_melting_temperature',
  'hairpin_deltaG',
  'pcr_source_id',
  'binding_length',
  'binding_melting_temperature',
  'binding_gc_content',
  'heterodimer_melting_temperature',
  'heterodimer_deltaG',
];

const DATABASE_ID = 7;
const HOMODIMER_MELTING_TEMPERATURE = 51.58;
const HOMODIMER_DELTA_G = -100.01;
const HAIRPIN_MELTING_TEMPERATURE = 52.01;
const HAIRPIN_DELTA_G = -101.02;
const MELTING_TEMPERATURE = 50.02;
const GC_CONTENT = 0.438;

describe('primersToTabularFile', () => {
  it('converts primers to a tabular file format', () => {
    const primers = [
      { id: 1,
        name: 'Primer1',
        sequence: 'ATCG',
        length: 4,
        database_id: DATABASE_ID,
        melting_temperature: MELTING_TEMPERATURE,
        gc_content: GC_CONTENT,
        homodimer: {
          melting_temperature: HOMODIMER_MELTING_TEMPERATURE,
          deltaG: HOMODIMER_DELTA_G,
        },
        hairpin: {
          melting_temperature: HAIRPIN_MELTING_TEMPERATURE,
          deltaG: HAIRPIN_DELTA_G,
        },
      },
      { id: 6, name: 'Primer2', sequence: 'GCTA', database_id: null },
    ];

    [',', '\t'].forEach((separator) => {
      const result = primersToTabularFile(primers, mockPCRDetails, separator);

      const expectedOutput = `${headers.join(separator)}\n${
        '1,Primer1,ATCG,4,50,44,51.6,-100,52,-101,3,21,56.7,48,20.5,-5276\n'.replaceAll(',', separator)
      }${`6,Primer2,GCTA${separator.repeat(headers.length - 3)}`.replaceAll(',', separator)}`;

      expect(result).toBe(expectedOutput);
    });
  });

  it('correctly handles zero values', () => {
    const primers = [
      { id: 1,
        name: 'Primer1',
        sequence: 'ATCG',
        length: 0,
        database_id: 0,
        melting_temperature: 0,
        gc_content: 0,
        homodimer: {
          melting_temperature: 0,
          deltaG: 0,
        },
        hairpin: {
          melting_temperature: 0,
          deltaG: 0,
        },
      },
    ];
    const mockPCRDetailsZero = [{
      ...mockPCRDetails[0],
      heterodimer: {
        melting_temperature: 0,
        deltaG: 0,
      },
      fwdPrimer: {
        ...mockPCRDetails[0].fwdPrimer,
        melting_temperature: 0,
        gc_content: 0,
        length: 0,
      },
    }];

    const result = primersToTabularFile(primers, mockPCRDetailsZero, ',');

    const expectedOutput = `${headers.join(',')}\n`
      + '1,Primer1,ATCG,0,0,0,0,0,0,0,3,0,0,0,0,0';

    expect(result).toBe(expectedOutput);
  });
  it('returns empty string if no primers', () => {
    const result = primersToTabularFile([], mockPCRDetails, ',');
    expect(result).toBe('');
  });
});
