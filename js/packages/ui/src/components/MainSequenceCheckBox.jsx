import React from 'react';
import { Visibility as VisibilityIcon, Download as DownloadIcon, Edit as EditIcon, Rule as CheckIcon } from '@mui/icons-material';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { Tooltip } from '@mui/material';
import { isEqual } from 'lodash-es';
import { cloningActions } from '@opencloning/store/cloning';
import useStoreEditor from '../hooks/useStoreEditor';
import DownloadSequenceFileDialog from './DownloadSequenceFileDialog';
import EditSequenceNameDialog from './EditSequenceNameDialog';
import VerificationFileDialog from './verification/VerificationFileDialog';
import SubmitToDatabaseDialog from './form/SubmitToDatabaseDialog';
import { getSourceDatabaseId } from '@opencloning/store/cloning_utils';
import useDatabase from '../hooks/useDatabase';

function MainSequenceCheckBox({ id }) {
  const [downloadDialogOpen, setDownloadDialogOpen] = React.useState(false);
  const [editNameDialogOpen, setEditNameDialogOpen] = React.useState(false);
  const [verificationDialogOpen, setVerificationDialogOpen] = React.useState(false);
  const [eLabDialogOpen, setELabDialogOpen] = React.useState(false);
  const dispatch = useDispatch();
  const database = useDatabase();
  const { updateStoreEditor } = useStoreEditor();
  const store = useStore();
  const { setMainSequenceId, setCurrentTab } = cloningActions;
  const mainSequenceId = useSelector((state) => state.cloning.mainSequenceId);
  const hasVerificationFiles = useSelector((state) => state.cloning.files.some((file) => file.sequence_id === id));

  const databaseId = useSelector((state) => getSourceDatabaseId(state.cloning.sources, id), isEqual);
  const hasDatabaseId = Boolean(databaseId);
  const toggleMain = () => {
    const { mainSequenceId } = store.getState().cloning;
    if (mainSequenceId !== id) {
      dispatch(setMainSequenceId(id));
      updateStoreEditor('mainEditor', id);
    }
    dispatch(setCurrentTab(3));
    // TODO: ideally this should be done with a ref
    document.getElementById('opencloning-app-tabs')?.scrollIntoView();
  };
  const tooltipText = <div className="tooltip-text">See sequence in main editor</div>;

  const DatabaseIcon = hasDatabaseId ? database?.DatabaseIcon : database?.SubmitIcon;

  return (
    <div className="node-corner">
      {downloadDialogOpen && <DownloadSequenceFileDialog {...{ id, dialogOpen: downloadDialogOpen, setDialogOpen: setDownloadDialogOpen }} />}
      {editNameDialogOpen && <EditSequenceNameDialog {...{ id, dialogOpen: editNameDialogOpen, setDialogOpen: setEditNameDialogOpen }} />}
      {verificationDialogOpen && <VerificationFileDialog {...{ id, dialogOpen: verificationDialogOpen, setDialogOpen: setVerificationDialogOpen }} />}
      {eLabDialogOpen && <SubmitToDatabaseDialog {...{ id, dialogOpen: eLabDialogOpen, setDialogOpen: setELabDialogOpen, resourceType: 'sequence' }} />}
      {database && (
        <Tooltip title={hasDatabaseId ? `Stored in ${database.name}` : `Submit to ${database.name}`} arrow placement="top">
          <DatabaseIcon
            onClick={() => (hasDatabaseId ? window.open(database.getSequenceLink(databaseId), '_blank') : setELabDialogOpen(true))}
            type="button"
            className="node-corner-icon"
            sx={{
              color: hasDatabaseId ? 'success.main' : 'gray',
              cursor: 'pointer',
            }}
          />
        </Tooltip>
      )}
      <Tooltip title="Verification files" arrow placement="top">
        <CheckIcon onClick={() => setVerificationDialogOpen(true)} type="button" className="node-corner-icon" sx={{ color: hasVerificationFiles ? '#2e7d32' : 'gray', cursor: 'pointer', '&:hover': { filter: 'brightness(70%)' } }} />
      </Tooltip>
      <Tooltip title="Change name" arrow placement="top">
        <EditIcon onClick={() => setEditNameDialogOpen(true)} type="button" className="node-corner-icon" sx={{ color: 'gray', cursor: 'pointer', '&:hover': { filter: 'brightness(70%)' } }} />
      </Tooltip>
      <Tooltip title={tooltipText} arrow placement="top">
        <VisibilityIcon onClick={toggleMain} type="button" className="node-corner-icon" sx={{ cursor: 'pointer', color: (id === mainSequenceId) ? '#2e7d32' : 'gray', '&:hover': { filter: 'brightness(70%)' } }} />
      </Tooltip>
      <Tooltip title="Download sequence" arrow placement="top">
        <DownloadIcon onClick={() => setDownloadDialogOpen(true)} type="button" className="node-corner-icon" sx={{ color: 'gray', cursor: 'pointer', '&:hover': { filter: 'brightness(70%)' } }} />
      </Tooltip>

    </div>
  );
}

export default MainSequenceCheckBox;
