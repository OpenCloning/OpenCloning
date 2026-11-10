import React from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { Button, ButtonGroup } from '@mui/material';
import PrimerForm from './PrimerForm';
import PrimerTableRow from './PrimerTableRow';
import './PrimerList.css';
import { cloningActions } from '@opencloning/store/cloning';
import ImportPrimersButton from './import_primers/ImportPrimersButton';
import PrimerDatabaseImportForm from './import_primers/PrimerDatabaseImportForm';
import { getUsedPrimerIds, isCompleteOligoHybridizationSource, isCompletePCRSource } from '@opencloning/store/cloning_utils';
import useDatabase from '../../hooks/useDatabase';
import DownloadPrimersButton from './DownloadPrimersButton';
import useMultiplePrimerDetails from './primer_details/useMultiplePrimerDetails';
import { usePCRDetails } from './primer_details/usePCRDetails';
import RequestStatusWrapper from '../form/RequestStatusWrapper';

function PrimerList() {
  const primers = useSelector((state) => state.cloning.primers, shallowEqual);
  const { deletePrimer: deleteAction, addPrimer: addAction, editPrimer: editAction } = cloningActions;
  const database = useDatabase();
  const dispatch = useDispatch();
  const deletePrimer = (id) => dispatch(deleteAction(id));
  const addPrimer = (newPrimer) => dispatch(addAction(newPrimer));
  const editPrimer = (editedPrimer) => dispatch(editAction(editedPrimer));
  const [addingPrimer, setAddingPrimer] = React.useState(false);
  const [editingPrimerId, setEditingPrimerId] = React.useState(null);
  const [importingPrimer, setImportingPrimer] = React.useState(false);
  const onEditClick = (id) => {
    setEditingPrimerId(id);
    setAddingPrimer(false);
  };
  const editingPrimer = primers.find((p) => p.id === editingPrimerId);
  const switchAddingPrimer = () => setAddingPrimer(!addingPrimer);
  // We don't allow used primers to be deleted
  const primerIdsInUse = useSelector(
    (state) => getUsedPrimerIds(state.cloning.sources),
    shallowEqual,
  );
  const pcrSourceIds = useSelector((state) => state.cloning.sources
    .filter((source) => isCompletePCRSource(source) || isCompleteOligoHybridizationSource(source))
    .map((source) => source.id));
  const { primerDetails, retryGetPrimerDetails, requestStatus: primerDetailsRequestStatus } = useMultiplePrimerDetails(primers);
  const { pcrDetails, retryGetPCRDetails, requestStatus: pcrDetailsRequestStatus } = usePCRDetails(pcrSourceIds);

  const details = primerDetails.length > 0 ? primerDetails : primers.map((p) => ({ ...p, length: p.sequence.length }));
  return (
    <>
      <div className="primer-table-container">
        <RequestStatusWrapper requestStatus={primerDetailsRequestStatus} retry={() => { retryGetPrimerDetails(); retryGetPCRDetails(); }}>
          <RequestStatusWrapper requestStatus={pcrDetailsRequestStatus} retry={retryGetPCRDetails} />
        </RequestStatusWrapper>
        <table>
          <thead>
            <tr style={{ whiteSpace: 'nowrap' }}>
              <th> </th>
              <th>Name</th>
              <th>Length</th>
              <th>Tm</th>
              <th>GC%</th>
              <th>Sequence</th>
            </tr>
          </thead>
          <tbody>
            {details.filter((primer) => primer.id !== editingPrimerId).map((primer) => (
              <PrimerTableRow
                key={primer.id}
                primerDetails={primer}
                pcrDetails={pcrDetails}
                deletePrimer={deletePrimer}
                canBeDeleted={!primerIdsInUse.includes(primer.id)}
                onEditClick={onEditClick}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="primer-form-container">
        {(editingPrimerId && (
          <PrimerForm
            key="primer-edit"
            submitPrimer={editPrimer}
            cancelForm={() => setEditingPrimerId(null)}
            existingNames={primers.filter((p) => p.name !== editingPrimer.name).map((p) => p.name)}
            disabledSequenceText={primerIdsInUse.includes(editingPrimerId) ? 'Cannot edit sequence in use' : ''}
            primer={editingPrimer}
          />
        )) || (addingPrimer && (
          <PrimerForm
            key="primer-add"
            submitPrimer={addPrimer}
            cancelForm={switchAddingPrimer}
            existingNames={primers.map((p) => p.name)}
          />
        )) || (importingPrimer && (
          <PrimerDatabaseImportForm
            submitPrimer={addPrimer}
            cancelForm={() => setImportingPrimer(false)}
            existingNames={primers.map((p) => p.name)}
          />
        )) || (
            <div className="primer-add-container">
              <ButtonGroup>
              <Button
                onClick={switchAddingPrimer}
              >
                Add Primer
              </Button>
              <ImportPrimersButton addPrimer={addPrimer} />
              <DownloadPrimersButton primers={primers} />
              {database && (
                <Button
                  onClick={() => setImportingPrimer(true)}
                >
                  {`Import from ${database.name}`}
                </Button>
                
              )}
              </ButtonGroup>
            </div>
          )}
      </div>

    </>
  );
}

export default PrimerList;
