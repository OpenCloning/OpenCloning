export const mockPCRDetails = [
  {
    sourceId: 3,
    sourceType: 'PCRSource',
    fwdPrimer: {
      melting_temperature: 56.7425140341704,
      gc_content: 0.47619047619047616,
      homodimer: {
        melting_temperature: 21.849123266654033,
        deltaG: -8134.146144614118,
        figure: 'SEQ\t ACGGATC      TTAATTAA\nSEQ\t        CCCGGG\nSTR\t        GGGCCC\nSTR\tAATTAATT      CTAGGCA-',
      },
      hairpin: {
        melting_temperature: 58.96121263750837,
        deltaG: -1864.755457846266,
        figure: 'SEQ\t-///----\\\\\\----------\nSTR\tACGGATCCCCGGGTTAATTAA',
      },
      length: 21,
      id: 1,
      name: 'fwd',
      sequence: 'AGTTTTCATATCTTCCTTTATATTCTATTAATTGAATTTCAAACATCGTTTTATTGAGCTCATTTACATCAACCGGTTCACGGATCCCCGGGTTAATTAA',
    },
    rvsPrimer: {
      melting_temperature: 50.92217978039041,
      gc_content: 0.4,
      homodimer: {
        melting_temperature: 33.33183994389532,
        deltaG: -10262.988602457277,
        figure: 'SEQ\t  GAATT        TTTAAAC\nSEQ\t       CGAGCTCG\nSTR\t       GCTCGAGC\nSTR\tCAAATTT        TTAAG--',
      },
      hairpin: {
        melting_temperature: 40.798505202616354,
        deltaG: -290.37922892468487,
        figure: 'SEQ\t-----//----\\\\-------\nSTR\tGAATTCGAGCTCGTTTAAAC',
      },
      length: 20,
      id: 2,
      name: 'rvs',
      sequence: 'CTTTTATGAATTATCTATATGCTGTATTCATATGCAAAAATATGTATATTTAAATTTGATCGATTAGGTAAATAAGAAGCGAATTCGAGCTCGTTTAAAC',
    },
    heterodimer: {
      melting_temperature: 20.513993258320113,
      deltaG: -5276.181975992979,
      figure: 'SEQ\tAAACATCGTTTTATT      --   TACATCAAC  G   ACGGATCCCCGGGTTAATTAA--------------\nSEQ\t               GAGCTC  ATT         CG TTC\nSTR\t               CTCGAG  TAA         GC AAG\nSTR\t       CAAATTTG      CT   ---------  G   AATAAATGGATTAGCTAGTTTAAATTTATATGTAT',
    },
  },
];

export const mockPrimer = {
  id: 1,
  name: 'Test Primer',
  sequence: 'ACGTACGT',
  length: 8,
};

export const mockPrimerDetails = {
  ...mockPrimer,
  length: 8,
  melting_temperature: 60,
  gc_content: 0.5,
  homodimer: {
    melting_temperature: 60,
    deltaG: -100,
    figure: 'dummy_figure',
  },
  hairpin: {
    melting_temperature: 60,
    deltaG: -100,
    figure: 'dummy_figure',
  },
};
