import { Accordion, AccordionDetails, AccordionSummary, Alert, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemButton, ListItemText } from '@mui/material';

import React from 'react';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { getExternalHttpClient } from '@opencloning/utils/httpClients';

// External urls (not the backend): no auth token, only whitelisted urls
const httpClient = getExternalHttpClient();

function SelectTemplateDialog({ onClose, open }) {
  const [templates, setTemplates] = React.useState(null);
  const [connectAttempt, setConnectAttemp] = React.useState(0);
  const [error, setError] = React.useState(null);
  const baseUrl = 'https://assets.opencloning.org/OpenCloning-submission';

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await httpClient.get(`${baseUrl}/index.json`);
        setTemplates(resp.data);
        setError('');
      } catch {
        setTemplates(null);
        setError('Failed to load templates from GitHub');
      }
    };
    fetchData();
  }, [connectAttempt]);
  return (
    <Dialog open={open} onClose={() => onClose('')} className="load-template-dialog">
      <DialogTitle>Load a template</DialogTitle>
      <Alert severity="warning" sx={{ maxWidth: '400px', margin: 'auto', fontSize: '.9rem', mb: 2 }}>
        MoClo templates will soon be replaced by the new Assembler. Go to the Assembler tab to learn more.</Alert>
      {!templates
      && (
      <DialogContent>
        {error ? (
          <Alert
            severity="error"
            action={(
              <Button color="inherit" size="small" onClick={() => { setError(''); setConnectAttemp((p) => p + 1); }}>
                Retry
              </Button>
          )}
          >
            {error}
          </Alert>
        ) : (
          <>
            Loading templates...
            {' '}
            <CircularProgress className="loading-progress" color="inherit" size="2em" />
          </>
        )}
      </DialogContent>
      )}
      <List>
        {
        templates && Object.keys(templates).map((key) => {
          const { kit, assemblies } = templates[key];
          return (
            <Accordion key={key} className="load-template-item">
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${key}-content`}
                id={`${key}-header`}
              >
                <ListItemText sx={{ my: 0 }} primary={kit.title} secondary={kit.description} />
              </AccordionSummary>
              <AccordionDetails sx={{ py: 0 }}>
                <List sx={{ py: 0, my: 0 }}>
                  {
                    assemblies.map((assembly) => (
                      <ListItem sx={{ px: 0, pt: 0 }} key={assembly.template_file} className="load-template-item">
                        <ListItemButton sx={{ py: 0 }} onClick={() => onClose(`${baseUrl}/processed/${key}/templates/${assembly.template_file}`, true)}>
                          <ListItemText primary={assembly.title} secondary={assembly.description} />
                        </ListItemButton>
                      </ListItem>
                    ))
                  }
                </List>
              </AccordionDetails>
            </Accordion>

          );
        })
        }
        <ListItem key="blah" className="load-template-item">

          <ListItemText
            primary="🔎 Can't find your favourite kit?"
            secondary={(
              <>
                Create it from an Addgene kit.
                <br />
                It&apos;s very easy!
              </>
)}
          />
          <IconButton edge="end" aria-label="submit-button">
            <Button className="button-hyperlink" variant="contained" color="success" href="https://github.com/OpenCloning/OpenCloning-submission/blob/master/docs/index.md" target="_blank" rel="noopener noreferrer">Create templates</Button>
          </IconButton>

        </ListItem>
      </List>
    </Dialog>
  );
}

export default SelectTemplateDialog;
