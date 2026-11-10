import React from 'react'
import { Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText, ListItemButton, Alert, Button, Box, ButtonGroup, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import { getExternalHttpClient } from '@opencloning/utils/httpClients';
import RequestStatusWrapper from '../form/RequestStatusWrapper';
import ServerStaticFileSelect from '../form/ServerStaticFileSelect';
import { readSubmittedTextFile } from '@opencloning/utils/readNwrite';
import { normalizeSyntaxEnzymes } from '@opencloning/utils/normalizeSyntax';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

const httpClient = getExternalHttpClient();
const baseURL = 'https://assets.opencloning.org/syntaxes/syntaxes/';
httpClient.defaults.baseURL = baseURL;

function LocalSyntaxDialog({ onClose, onSyntaxSelect }) {

  const onFileSelected = React.useCallback(async (file) => {
    const text = await readSubmittedTextFile(file);
    const syntaxData = normalizeSyntaxEnzymes(JSON.parse(text));
    onSyntaxSelect(syntaxData, []);
    onClose();
  }, [onSyntaxSelect, onClose]);
  return (
    <Dialog data-testid="local-syntax-dialog" open onClose={onClose}>
      <DialogTitle>Load syntax from local server</DialogTitle>
      <DialogContent sx={{ minWidth: '400px' }}>
        <ServerStaticFileSelect onFileSelected={onFileSelected} type="syntax" />
      </DialogContent>
    </Dialog>
  )
}

function SyntaxListItem({ syntax, onSyntaxClick }) {
  if (syntax.syntaxes === undefined) {
    const syntaxPath = syntax.path + '/syntax.json';
    const plasmidsPath = syntax.path + '/plasmids.json';
    return (
      <ListItem>
        <ListItemButton onClick={() => {onSyntaxClick(syntaxPath, plasmidsPath)}}>
          <ListItemText primary={syntax.name} secondary={syntax.description} />
        </ListItemButton>
      </ListItem>
    )
  }

  const onOptionClick = (index) => {
    const syntaxPath = `${syntax.path}/${syntax.syntaxes[index].path}`;
    const plasmidsPath = `${syntax.path}/plasmids_${syntax.syntaxes[index].path}`;
    onSyntaxClick(syntaxPath, plasmidsPath);
  }

  return (
    <ListItem>
      <Accordion>
        <AccordionSummary sx={{ my: 0, py: 0 }} expandIcon={<ExpandMoreIcon />}>
          <ListItemText sx={{ my: 0, py: 0 }} primary={syntax.name} secondary={syntax.description} />
        </AccordionSummary>
        <AccordionDetails>
          <List sx={{ py: 0, my: 0 }}>
            {syntax.syntaxes.map((syntax, index) => (
              <ListItem key={syntax.path} sx={{ my: 0, py: 0 }}>
                <ListItemButton sx={{ py: 0 }} onClick={() => onOptionClick(index)}>
                  <ListItemText primary={syntax.name} secondary={syntax.description} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>
    </ListItem>
    
  )
}

function ExistingSyntaxDialog({ staticContentPath, onClose, onSyntaxSelect, displayCreateYourOwnMessage = false }) {
  const [syntaxes, setSyntaxes] = React.useState([]);
  const [connectAttempt, setConnectAttempt] = React.useState(0);
  const [requestStatus, setRequestStatus] = React.useState({ status: 'loading' });
  const [loadError, setLoadError] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const [localDialogOpen, setLocalDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setRequestStatus({ status: 'loading' });
    const fetchData = async () => {
      try {
        const { data } = await httpClient.get('index.json');
        setRequestStatus({ status: 'success' });
        setSyntaxes(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        setRequestStatus({ status: 'error', message: 'Could not load syntaxes' });
      }
    };
    fetchData();
  }, [connectAttempt]);

  const onSyntaxClick = React.useCallback(async (syntaxPath, plasmidsPath) => {
    setLoadError(null);
    let loadingErrorPart = 'syntax'
    try {
      const { data: syntaxData } = await httpClient.get(syntaxPath);
      loadingErrorPart = 'plasmids'
      const { data: plasmidsData } = await httpClient.get(plasmidsPath);
      onSyntaxSelect(normalizeSyntaxEnzymes(syntaxData), plasmidsData);
      onClose();
    } catch {
      setLoadError(`Failed to load ${loadingErrorPart} data. Please try again.`);
    }
  }, [onSyntaxSelect, onClose]);

  const handleFileUpload = React.useCallback(async (event) => {
    setLoadError(null);
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const syntaxData = normalizeSyntaxEnzymes(JSON.parse(text));

      onSyntaxSelect(syntaxData, []);
      onClose();
    } catch (error) {
      setLoadError(`Failed to parse JSON file: ${error.message}`);
    } finally {
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onSyntaxSelect, onClose]);

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Load an existing syntax</DialogTitle>
      <DialogContent>
        {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
        <RequestStatusWrapper requestStatus={requestStatus} retry={() => setConnectAttempt((prev) => prev + 1)}>
          <List>
            {syntaxes.map((syntax) => (
              <SyntaxListItem key={syntax.path} syntax={syntax} onSyntaxClick={onSyntaxClick} />
            ))}
            {displayCreateYourOwnMessage && <ListItem>
              <ListItemText primary="🔎 Can't find your favourite syntax?" secondary="Add it yourself! It's very easy!" />
              <Button type="a" color="success" href="https://syntax.opencloning.org" target="_blank">Create a syntax</Button>
            </ListItem>}
          </List>
        </RequestStatusWrapper>
        <Box sx={{ mb: 2 }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <ButtonGroup sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              onClick={() => fileInputRef.current?.click()}
            >
                Upload syntax from JSON file
            </Button>
            {staticContentPath && (
              <Button
                onClick={() => setLocalDialogOpen(true)}
              >
                Load syntax from local server
              </Button>
            )}
          </ButtonGroup>
          {localDialogOpen && <LocalSyntaxDialog onClose={() => {setLocalDialogOpen(false); onClose()}} onSyntaxSelect={onSyntaxSelect} />}
        </Box>
      </DialogContent>
    </Dialog>
  )
}

export default ExistingSyntaxDialog
