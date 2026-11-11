import { Dialog, DialogTitle, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import React from 'react';

const examples = [
  {
    title: 'Arabidopsis CRISPR-HDR genome editing',
    link: 'arabidopsis_CRISPR_HDR.zip',
  },
  {
    title: 'Gibson assembly',
    link: 'gibson_assembly.json',
  },
  {
    title: 'Golden gate assembly',
    link: 'golden_gate.json',
  },
  {
    title: 'Integration of cassette by homologous recombination',
    link: 'homologous_recombination.json',
  },
  {
    title: 'Restriction + ligation assembly (v1)',
    link: 'restriction_ligation_assembly.json',
  },
  {
    title: 'Restriction + ligation assembly (v2)',
    link: 'restriction_then_ligation.json',
  },
  {
    title: 'Templateless PCR',
    link: 'templateless_PCR.json',
  },
  {
    title: 'CRISPR HDR',
    link: 'crispr_hdr.json',
  },
  {
    title: 'Gateway cloning',
    link: 'gateway.json',
  },
  {
    title: 'Annotate features with pLannotate',
    link: 'plannotate.json',
  },
  {
    title: 'Cre/Lox recombination',
    link: 'cre_lox_recombination.json',
  },
].sort((a, b) => a.title.localeCompare(b.title));

function SelectExampleDialog({ onClose, open }) {
  return (
    <Dialog open={open} onClose={() => onClose('')} className="load-example-dialog">
      <DialogTitle>Load an example</DialogTitle>
      <List>
        {
        examples.map((example) => (
          <ListItem key={example.link} className="load-example-item">
            <ListItemButton onClick={() => onClose(`${import.meta.env.BASE_URL}examples/${example.link}`)}><ListItemText>{example.title}</ListItemText></ListItemButton>
          </ListItem>
        ))
        }
      </List>

    </Dialog>
  );
}

export default SelectExampleDialog;
