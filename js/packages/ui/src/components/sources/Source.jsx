import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isEqual } from 'lodash-es';
import SourceFile from './SourceFile';
import SourceRepositoryId from './SourceRepositoryId';
import SourceRestriction from './SourceRestriction';
import SourceAssembly from './SourceAssembly';
import SourceTypeSelector from './SourceTypeSelector';
import SourcePCRorHybridization from './SourcePCRorHybridization';
import SourceHomologousRecombination from './SourceHomologousRecombination';
import { SourceGenomeRegion } from './SourceGenomeRegion';
import SourceManuallyTyped from './SourceManuallyTyped';
import SourceAnnotation from './SourceAnnotation';
import SourceDatabase from './SourceDatabase';
import SourcePolymeraseExtension from './SourcePolymeraseExtension';
import CollectionSource from './CollectionSource';
import useSourceRequest from '../../hooks/useSourceRequest';
import MultipleOutputsSelector from './MultipleOutputsSelector';
import { cloningActions } from '@opencloning/store/cloning';
import SourceCopySequence from './SourceCopySequence';
import SourceReverseComplement from './SourceReverseComplement';
import SourceKnownGenomeRegion from './SourceKnownGenomeRegion';
import { doesSourceHaveOutput } from '@opencloning/store/cloning_utils';
import SourceServerStaticFile from './SourceServerStaticFile';

// There are several types of source, this components holds the common part,
// which for now is a select element to pick which kind of source is created
function Source({ sourceId }) {
  const source = useSelector((state) => state.cloning.sources.find((s) => s.id === sourceId), isEqual);
  const hasOutput = useSelector((state) => doesSourceHaveOutput(state.cloning, sourceId));
  const { type: sourceType } = source;
  let specificSource = null;
  const templateOnlySources = ['CollectionSource', 'KnownGenomeCoordinatesSource'];
  const { requestStatus, sendSourceRequest, sources, sequences } = useSourceRequest();
  const { addSequenceAndUpdateItsSource, updateSequenceAndItsSource } = cloningActions;
  const [chosenFragment, setChosenFragment] = React.useState(null);
  const dispatch = useDispatch();

  React.useEffect(() => {
    const dispatchedAction = hasOutput ? updateSequenceAndItsSource : addSequenceAndUpdateItsSource;
    // If there is only a single product, commit the result, else allow choosing via MultipleOutputsSelector
    if (sources.length === 1) {
      dispatch(dispatchedAction({ newSource: { ...sources[0], id: sourceId }, newSequence: sequences[0] }));
    } else if (chosenFragment !== null) {
      dispatch(dispatchedAction({ newSource: { ...sources[chosenFragment], id: sourceId }, newSequence: sequences[chosenFragment] }));
    }
  }, [sources, sequences, chosenFragment]);

  switch (sourceType) {
    /* eslint-disable */
    case 'UploadedFileSource':
      specificSource = <SourceFile {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'LocalFileSource':
      specificSource = <SourceServerStaticFile {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'RestrictionEnzymeDigestionSource':
      specificSource = <SourceRestriction {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'RepositoryIdSource':
      specificSource = <SourceRepositoryId {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'AddgeneIdSource':
      specificSource = <SourceRepositoryId {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'SnapGenePlasmidSource':
      specificSource = <SourceRepositoryId {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'EuroscarfSource':
      specificSource = <SourceRepositoryId {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'WekWikGeneIdSource':
      specificSource = <SourceRepositoryId {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'OpenDNACollectionsSource':
      specificSource = <SourceRepositoryId {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'LigationSource':
      specificSource = <SourceAssembly {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'GibsonAssemblySource':
      specificSource = <SourceAssembly {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'OverlapExtensionPCRLigationSource':
      specificSource = <SourceAssembly {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'InFusionSource':
      specificSource = <SourceAssembly {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'InVivoAssemblySource':
      specificSource = <SourceAssembly {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'GatewaySource':
      specificSource = <SourceAssembly {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'CreLoxRecombinationSource':
      specificSource = <SourceAssembly {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'RecombinaseSource':
      specificSource = <SourceAssembly {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'HomologousRecombinationSource':
      specificSource = <SourceHomologousRecombination {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'PCRSource':
      specificSource = <SourcePCRorHybridization {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'RestrictionAndLigationSource':
      specificSource = <SourceAssembly {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'GenomeCoordinatesSource':
      specificSource = <SourceGenomeRegion {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'KnownGenomeCoordinatesSource':
      specificSource = <SourceKnownGenomeRegion {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'ManuallyTypedSource':
      specificSource = <SourceManuallyTyped {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'CRISPRSource':
      specificSource = <SourceHomologousRecombination {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'OligoHybridizationSource':
      specificSource = <SourcePCRorHybridization {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'PolymeraseExtensionSource':
      specificSource = <SourcePolymeraseExtension {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'DatabaseSource':
      specificSource = <SourceDatabase {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'CollectionSource':
      specificSource = <CollectionSource {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'CopySequence':
      specificSource = <SourceCopySequence {...{ source }} />; break;
    case 'AnnotationSource':
      specificSource = <SourceAnnotation {...{ source, requestStatus, sendSourceRequest }} />; break;
    case 'ReverseComplementSource':
      specificSource = <SourceReverseComplement {...{ source, requestStatus, sendSourceRequest }} />; break;
    default:
      break;
    /* eslint-enable */
  }

  return (
    <>
      {!templateOnlySources.includes(sourceType) && (<SourceTypeSelector {...{ source }} />)}
      {specificSource}
      {sources.length > 1 && (<MultipleOutputsSelector {...{ sources, sequences, sourceId, onFragmentChosen: setChosenFragment }} />)}
    </>
  );
}

export default React.memo(Source);
