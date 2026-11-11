import React from 'react';
import { ConfigProvider } from '@opencloning/ui/providers/ConfigProvider';
import { convertToTeselaJson } from '@opencloning/utils/readNwrite';
import SequencingCheckModal from './SequencingCheckModal';
import { formatSequenceName } from '../common';

const BACKEND_URL = 'http://localhost:8000';
const testConfig = { backendUrl: BACKEND_URL, showAppBar: false, noExternalRequests: true, enableAssembler: false, enablePlannotate: false };
const ALIGN_DELAY = 500;

// Short reads, aligned with a stubbed response, the value is the expected identity
const READS = {
  AAAAAAAAAA: { alignment: ['AAAAAAAAAA', 'AAAAAAAAAA'], identity: '100.00' },
  CCCCCCCCCC: { alignment: ['CCCCCCCCCC', 'CCCCCCCCC-'], identity: '90.00' },
  GGGGGGGGGG: { alignment: ['GGGGGGGGGG', 'GGGGGGGGGA'], identity: '90.00' },
  TTTTTTTTTT: { alignment: ['TTTTTTTTTTTTTTTTTTTT', 'TTTTTTTTTTTTTTTTT---'], identity: '85.00' },
  ACGTACGTAC: { alignment: ['ACGTACGTAC', '--GTACGTAC'], identity: '80.00' },
};

describe('<SequencingCheckModal />', () => {
  beforeEach(() => {
    cy.setupOpenCloningDBTestAuth();
    cy.interceptOpenCloningDBStub('get_tags', { alias: 'getTags' });
    cy.interceptOpenCloningDBStub('get_text_file_sequences_by_tag', { alias: 'getSequences' });
  });

  it('checks the sequencing files of the sequences and sorts them by identity', () => {
    cy.viewport(1400, 900);
    cy.getStub('get_text_file_sequences_by_tag').then((stub) => {
      // pREP42-MCS+ (28, circular), NC_003424 (29), ase1_CDS (30), digested_vector (31), pREP42-ase1 (32)
      const [plasmid] = stub.response.body;
      const plasmidSeguid = plasmid.sequence_ref.seguid;
      const plasmidBases = convertToTeselaJson(plasmid.sequence).sequence.toUpperCase();
      // Same length as the plasmid, one base changed: the seguid does not match, so it is aligned
      const mutantBases = (plasmidBases[0] === 'A' ? 'C' : 'A') + plasmidBases.slice(1);

      const files = {
        1: { name: 'exact.fa', sequence: plasmidBases },
        2: { name: 'mutant.fa', sequence: mutantBases },
        3: { name: 'ase1_read.fa', sequence: 'ACGTACGTAC' },
        4: { name: 'read_a.fa', sequence: 'AAAAAAAAAA' },
        5: { name: 'read_c.fa', sequence: 'CCCCCCCCCC' },
        6: { name: 'read_g.fa', sequence: 'GGGGGGGGGG' },
        7: { name: 'read_t.fa', sequence: 'TTTTTTTTTT' },
        8: { name: 'broken.fa', sequence: 'ACGTTGCAAC' },
      };
      const filesBySequenceId = { 28: [1, 2], 29: [], 30: [3], 31: [4, 5, 6, 7], 32: [8] };

      cy.intercept('GET', Cypress.getDbURL('/sequences/*/sequencing_files'), (req) => {
        const sequenceId = Number(req.url.split('/').at(-2));
        req.reply(filesBySequenceId[sequenceId].map((id) => ({ id, original_name: files[id].name }))); // eslint-disable-line camelcase
      }).as('getSequencingFiles');
      cy.intercept('GET', Cypress.getDbURL('/sequencing_files/*/download'), (req) => {
        const file = files[Number(req.url.split('/').at(-2))];
        req.reply({ body: `>${file.name}\n${file.sequence}\n`, headers: { 'content-type': 'application/octet-stream' } });
      }).as('downloadFile');

      const seguidRequests = [];
      cy.intercept('POST', `${BACKEND_URL}/seguid`, (req) => {
        seguidRequests.push(req.body);
        req.reply(JSON.stringify(req.body.sequence.toUpperCase() === plasmidBases ? plasmidSeguid : 'cdseguid=something_else'));
      }).as('seguid');

      const alignStarts = [];
      const alignedTraces = [];
      cy.intercept('POST', `${BACKEND_URL}/align_sanger`, (req) => {
        alignStarts.push(Date.now());
        const trace = req.body.traces[0].toUpperCase();
        alignedTraces.push(trace);
        if (trace === 'ACGTTGCAAC') {
          req.reply({ statusCode: 400, body: { detail: 'Alignment failed' }, delay: ALIGN_DELAY });
        } else if (trace === mutantBases) {
          req.reply({ body: ['ACGT', 'ACGA'], delay: ALIGN_DELAY });
        } else {
          req.reply({ body: READS[trace].alignment, delay: ALIGN_DELAY });
        }
      }).as('alignSanger');

      cy.mount(
        <ConfigProvider config={testConfig}>
          <SequencingCheckModal open onClose={() => {}} />
        </ConfigProvider>,
      );

      // Pick the sequences with the bulk component
      cy.wait('@getTags');
      // Like clickMultiSelectOption, but the menu is closed with Escape (the page body has no size behind the modal)
      cy.get('[data-testid="sequencing-check-modal"]').contains('label', 'Tags').siblings('div').first().click();
      cy.get('div[role="presentation"]').contains('gibson_assembly').click();
      cy.focused().type('{esc}');
      cy.contains('button', 'Load sequences').click();
      cy.wait('@getSequences');

      // Before the check: sequences in the original order, the one without files last
      cy.get('[data-testid="sequencing-check-sequence-row"]').should('have.length', 5);
      cy.get('[data-testid="sequencing-check-file-row"]').should('have.length', 8);
      cy.get('[data-testid="sequencing-check-sequence-row"]').last().should('contain', 'NC_003424').and('contain', 'No sequencing data');
      cy.get('[data-testid="sequencing-check-sequence-row"]').first().should('contain', 'pREP42-MCS+').and('contain', '(2 files)');
      cy.get('@seguid.all').should('have.length', 0);
      cy.get('@alignSanger.all').should('have.length', 0);

      cy.get('[data-testid="sequencing-check-run-button"]').click();
      cy.get('[data-testid="status-icon-pending"]').should('exist');
      cy.get('[data-testid="sequencing-check-progress"]', { timeout: 10000 }).should('contain', '8 / 8');
      cy.get('[data-testid="sequencing-check-run-button"]').should('not.be.disabled');

      // Sorted: error first, then lowest identity first, no sequencing data last
      const namesById = Object.fromEntries(stub.response.body.map(({ sequence_ref: ref }) => [ref.id, formatSequenceName(ref)]));
      const expectedOrder = [32, 28, 30, 31, 29].map((id) => namesById[id]);
      cy.get('[data-testid="sequencing-check-sequence-row"]').should(($rows) => {
        expect($rows.toArray().map((row) => row.querySelector('[data-testid="sequencing-check-sequence-name"]').innerText)).to.deep.equal(expectedOrder);
      });
      cy.get('[data-testid="sequencing-check-sequence-row"]').eq(0).should('contain', 'See the sequencing files below');
      cy.get('[data-testid="sequencing-check-sequence-row"]').eq(1).find('[data-testid="sequencing-check-identity"]').should('have.text', '75.00');
      cy.get('[data-testid="sequencing-check-sequence-row"]').eq(2).find('[data-testid="sequencing-check-identity"]').should('have.text', '80.00');
      cy.get('[data-testid="sequencing-check-sequence-row"]').eq(3).find('[data-testid="sequencing-check-identity"]').should('have.text', '85.00');

      // Files sorted within each sequence, the exact match was found by seguid
      const expectedFiles = [
        ['broken.fa', ''],
        ['mutant.fa', '75.00'],
        ['exact.fa', '100.00'],
        ['ase1_read.fa', '80.00'],
        ['read_t.fa', '85.00'],
        ['read_c.fa', '90.00'],
        ['read_g.fa', '90.00'],
        ['read_a.fa', '100.00'],
      ];
      cy.get('[data-testid="sequencing-check-file-row"]').should(($rows) => {
        const actual = $rows.toArray().map((row) => {
          const cells = row.querySelectorAll('td');
          return [cells[1].innerText.trim(), cells[2].innerText.trim()];
        });
        expect(actual).to.deep.equal(expectedFiles);
      });
      cy.get('[data-testid="sequencing-check-file-row"]').first().should('contain', 'Alignment failed');
      cy.get('[data-testid="sequencing-check-file-row"]').eq(1).should('contain', 'Identity below 100%');

      cy.then(() => {
        // Only files with the same length as the reference get their seguid computed, with its topology
        expect(seguidRequests).to.have.length(2);
        seguidRequests.forEach((body) => expect(body.circular).to.equal(true));
        // The exact match is not aligned
        expect(alignedTraces).to.have.length(7);
        expect(alignedTraces).not.to.include(plasmidBases);
        // At most 4 checks at the same time: any 5 alignment requests span at least one alignment delay
        const starts = [...alignStarts].sort((a, b) => a - b);
        for (let i = 0; i + 4 < starts.length; i++) {
          expect(starts[i + 4] - starts[i]).to.be.at.least(ALIGN_DELAY * 0.8);
        }
      });

      // Pick other sequences goes back to the bulk component
      cy.contains('button', 'Pick other sequences').click();
      cy.contains('button', 'Load sequences').should('exist');
    });
  });
});
