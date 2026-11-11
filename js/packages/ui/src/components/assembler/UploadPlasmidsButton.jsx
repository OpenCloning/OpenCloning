import React from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Box, ListItemIcon, Menu, MenuItem } from '@mui/material';
import { ArrowDropDown as ArrowDropDownIcon, Dns as DnsIcon, Storage as StorageIcon, UploadFile as UploadFileIcon } from '@mui/icons-material';
import { useConfig } from '../../providers';
import useDatabase from '../../hooks/useDatabase';
import ServerStaticFileSelect from '../form/ServerStaticFileSelect';
import { usePlasmidsLogic } from './usePlasmidsLogic';
import PlasmidSyntaxTable from './PlasmidSyntaxTable';
import { jsonToGenbank } from '@teselagen/bio-parsers';

function formatPlasmid(sequenceData) {

  const { appData } = sequenceData;
  const { fileName, correspondingParts, longestFeature, databaseId, textFileSequence } = appData;
  const [left_overhang, right_overhang] = correspondingParts[0].split('-');

  let plasmidName = fileName;
  if (longestFeature[0]?.name) {
    plasmidName += ` (${longestFeature[0].name})`;
  }

  if (databaseId !== undefined) {
    return {
      type: 'databaseSequence',
      plasmid_name: plasmidName,
      database_id: databaseId,
      left_overhang,
      right_overhang,
      key: `${left_overhang}-${right_overhang}`,
      sequenceData,
      textFileSequence,
      userUploaded: true,
    };
  }

  return {
    type: 'loadedFile',
    plasmid_name: plasmidName,
    file_name: fileName,
    left_overhang,
    right_overhang,
    key: `${left_overhang}-${right_overhang}`,
    sequenceData,
    genbankString: jsonToGenbank(sequenceData),
    userUploaded: true,
  };

}

/** Dialog wrapping a component that loads plasmids. children is a function that receives the onLoad callback. */
function LoadPlasmidsDialog({ title, onLoad, onClose, children }) {
  const [error, setError] = React.useState(null);

  const handleLoad = React.useCallback(async (items) => {
    try {
      await onLoad(items)
      onClose()
    } catch (e) {
      setError(e.message)
    }
  }, [onLoad, onClose])

  return <Dialog open onClose={onClose}>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent sx={{ width: '500px' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {children(handleLoad)}
    </DialogContent>
  </Dialog>
}

/**
 * "Load Plasmids" button with a dropdown. The "From files" option is always present (opens a file picker
 * and calls onFilesSelected), extraOptions are appended: [{ id, label, Icon, onClick }]
 */
function LoadPlasmidsMenuButton({ onFilesSelected, extraOptions }) {
  const [anchorEl, setAnchorEl] = React.useState(null)
  const open = Boolean(anchorEl)
  const fileInputRef = React.useRef(null)

  const onFileInputChange = (event) => {
    const files = Array.from(event.target.files)
    event.target.value = ''
    onFilesSelected(files)
  }

  return <>
    <input multiple type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={onFileInputChange} accept=".gbk,.gb,.fasta,.fa,.dna" data-testid="load-plasmids-file-input" />
    <Button
      color="primary"
      onClick={(event) => setAnchorEl(event.currentTarget)}
      endIcon={<ArrowDropDownIcon />}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
      aria-controls={open ? 'load-plasmids-menu' : undefined}
      data-testid="load-plasmids-button"
    >
      Load Plasmids
    </Button>
    <Menu id="load-plasmids-menu" anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} onClick={() => setAnchorEl(null)}>
      <MenuItem onClick={() => fileInputRef.current.click()} data-testid="load-plasmids-from-files">
        <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
        From files
      </MenuItem>
      {extraOptions.map(({ id, label, Icon, onClick }) => (
        <MenuItem key={id} onClick={onClick} data-testid={`load-plasmids-from-${id}`}>
          <ListItemIcon><Icon fontSize="small" /></ListItemIcon>
          {label}
        </MenuItem>
      ))}
    </Menu>
  </>
}

function ImportPlasmidsDialog({ validPlasmids, invalidPlasmids, onImport, onCancel }) {
  return <Dialog
    maxWidth="lg"
    fullWidth
    open={invalidPlasmids.length > 0 || validPlasmids.length > 0}
    onClose={onCancel}
    PaperProps={{ style: { maxHeight: '80vh' } }}
  >
    <DialogActions sx={{ justifyContent: 'center', position: 'sticky', top: 0, zIndex: 99, background: '#fff', py: 2 }}>
      <Button sx={{ p: 1.5, fontSize: '1rem' }} disabled={validPlasmids.length === 0} variant="contained" color="success" onClick={onImport}>Import valid plasmids</Button>
      <Button sx={{ p: 1.5, fontSize: '1rem' }} variant="contained" color="error" onClick={onCancel}>Cancel</Button>
    </DialogActions>
    {invalidPlasmids.length > 0 && (
      <Box data-testid="invalid-plasmids-box">
        <DialogTitle>Invalid Plasmids</DialogTitle>
        <DialogContent>
          <PlasmidSyntaxTable plasmids={invalidPlasmids} />
        </DialogContent>
      </Box>
    )}
    {validPlasmids.length > 0 && (
      <Box data-testid="valid-plasmids-box">
        <DialogTitle>Valid Plasmids</DialogTitle>
        <DialogContent>
          <PlasmidSyntaxTable plasmids={validPlasmids} />
        </DialogContent>
      </Box>
    )}
  </Dialog>
}

function UploadPlasmidsButton({ addPlasmids, syntax }) {
  const { uploadPlasmids, loadPlasmidsFromDatabase, linkedPlasmids, setLinkedPlasmids } = usePlasmidsLogic(syntax)
  const validPlasmids = React.useMemo(() => linkedPlasmids.filter((plasmid) => plasmid.appData.correspondingParts.length === 1), [linkedPlasmids])
  const invalidPlasmids = React.useMemo(() => linkedPlasmids.filter((plasmid) => plasmid.appData.correspondingParts.length !== 1), [linkedPlasmids])
  // null | 'local-server' | 'database'
  const [openDialog, setOpenDialog] = React.useState(null)
  const closeDialog = React.useCallback(() => setOpenDialog(null), [])
  const { staticContentPath } = useConfig();
  const database = useDatabase();

  const handleImportValidPlasmids = React.useCallback(() => {
    addPlasmids(validPlasmids.map(formatPlasmid))
    setLinkedPlasmids([])
  }, [addPlasmids, validPlasmids, setLinkedPlasmids])

  const extraMenuOptions = [
    staticContentPath && { id: 'local-server', label: 'From local server', Icon: DnsIcon, onClick: () => setOpenDialog('local-server') },
    database?.GetSequencesInBulkComponent && { id: 'database', label: `From ${database.name}`, Icon: StorageIcon, onClick: () => setOpenDialog('database') },
  ].filter(Boolean)

  return (<>
    <LoadPlasmidsMenuButton onFilesSelected={uploadPlasmids} extraOptions={extraMenuOptions} />
    {openDialog === 'local-server' && (
      <LoadPlasmidsDialog title="Load Plasmids from Local Server" onLoad={uploadPlasmids} onClose={closeDialog}>
        {(onLoad) => <ServerStaticFileSelect onFileSelected={onLoad} type="sequence" multiple />}
      </LoadPlasmidsDialog>
    )}
    {openDialog === 'database' && (
      <LoadPlasmidsDialog title={`Load Plasmids from ${database.name}`} onLoad={loadPlasmidsFromDatabase} onClose={closeDialog}>
        {(onLoad) => <database.GetSequencesInBulkComponent onSequencesLoaded={onLoad} defaultSequenceTypes={['plasmid']} />}
      </LoadPlasmidsDialog>
    )}
    <ImportPlasmidsDialog
      validPlasmids={validPlasmids}
      invalidPlasmids={invalidPlasmids}
      onImport={handleImportValidPlasmids}
      onCancel={() => setLinkedPlasmids([])}
    />
  </>)
}

export default UploadPlasmidsButton
