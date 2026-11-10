import React from 'react';
import { Editor, updateEditor } from '@teselagen/ove';
import { useDispatch, useStore } from 'react-redux';
import { getReverseComplementSequenceString, getSequenceDataBetweenRange } from '@teselagen/sequence-utils';
import defaultMainEditorProps from '../config/defaultMainEditorProps';
import { cloningActions } from '@opencloning/store/cloning';
import useCloningAlerts from '../hooks/useCloningAlerts';
import { Alert, Button } from '@mui/material';
import { useSelector } from 'react-redux';
import useUpdateAnnotationInMainSequence from './annotation/useUpdateAnnotationInMainSequence';
import useStoreEditor from '../hooks/useStoreEditor';
import DomesticateDialog from './domesticate/DomesticateDialog';
import AnnotationChangedAlert from './annotation/AnnotationChangedAlert';

const { setMainSequenceSelection, addPrimer } = cloningActions;

function regionRightClickedOverride(items, { annotation }, props) {
  const items2keep = items.filter((i) => i.text === 'Copy');
  return [
    ...items2keep,
    {
      text: 'Create',
      submenu: [
        "newFeature",
        "newPrimer",
      ],
    },
    ...(props.sequenceData.circular === true ? [
      "--",
      "selectInverse",
      "--",
    ] : []),
  ];
}
function primerRightClickedOverride(items, { annotation }, props) {
  return [
    ...regionRightClickedOverride(items, { annotation }, props),
    "--",
    {
      text: 'Delete Primer annotation',
      cmd: 'deletePrimer',
    }
  ];
}

function MainSequenceEditor() {
  const dispatch = useDispatch();
  const { addAlert } = useCloningAlerts();
  const { updateStoreEditor } = useStoreEditor();
  const updateAnnotationInMainSequence = useUpdateAnnotationInMainSequence();

  const annotationChanged = useSelector(
    (state) => {
      const history = state.VectorEditor.mainEditor?.sequenceDataHistory;
      if (!history) return false;
      const sequenceId = state.VectorEditor.mainEditor?.sequenceData?.id;
      if (sequenceId === 'opencloning_primer_design_product') return false;
      return state.cloning.mainSequenceId && Object.keys(history).length > 0 && history.past.length !== 0;
    }
  );

  const store = useStore();
  const editorName = 'mainEditor';
  const mainSequenceId = useSelector((state) => state.cloning.mainSequenceId);
  const topDivRef = React.useRef(null);

  const [domesticateDialogOpen, setDomesticateDialogOpen] = React.useState(false);
  const [domesticateContext, setDomesticateContext] = React.useState(null);

  const featureRightClickedOverride = React.useCallback((items, { annotation }, props) => {
    return [
      ...regionRightClickedOverride(items, { annotation }, props),
      "--",
      "editFeature",
      "deleteFeature",
      {
        text: "Duplicate Feature",
        disabled: props.readOnly,
        onClick: () => {
          const { id, ...rest } = annotation;
          props.upsertFeature({
            ...rest,
            // omit id → upsertDeleteActionGenerator assigns a new shortid
            name: annotation.name ? `${annotation.name} (copy)` : undefined,
          });
        },
      },
      "showRemoveDuplicatesDialogFeatures",
      "--",
      "toggleCdsFeatureTranslations",
      "viewFeatureProperties",
      "--",
      {
        text: 'Domesticate (experimental)',
        onClick: () => {
          setDomesticateContext({ sequenceData: props.sequenceData, annotation });
          setDomesticateDialogOpen(true);
        },
      },
    ];
  }, []);

  React.useEffect(() => {
    if (annotationChanged) {
      setTimeout(() => {
        topDivRef.current.scrollIntoView({ behavior: 'smooth' });
      }, 250);
    }
  }, [annotationChanged]);


  const onAnnotationCancel = () => {
    const currentSequenceData = store.getState().VectorEditor.mainEditor.sequenceData;
    updateStoreEditor('mainEditor', mainSequenceId, { sequenceData: currentSequenceData });
  };

  const beforeAnnotationCreate = ({ annotationTypePlural, annotation, props, isEdit }) =>  {

    if (annotationTypePlural === 'primers') {
      const existingPrimerNames = store.getState().cloning.primers.map((p) => p.name);
      if (existingPrimerNames.includes(annotation.name)) {
        addAlert({
          message: `A primer with name "${annotation.name}" already exists`,
          severity: 'error',
        });
        return false;
      }
      let { sequence } = getSequenceDataBetweenRange(props.sequenceData, annotation);
      if (annotation.strand === -1) {
        sequence = getReverseComplementSequenceString(sequence);
      }
      dispatch(addPrimer({
        name: annotation.name,
        sequence: sequence,
      }));
      addAlert({
        message: `Primer "${annotation.name}" created`,
        severity: 'success',
      });
    } else if (annotationTypePlural !== 'features') {
      return false;
    }
  };

  const extraProp = {
    beforeAnnotationCreate,
    onSelectionOrCaretChanged: (a) => dispatch(setMainSequenceSelection(a)),
    selectionLayer: {},
    sequenceData: {},
    rightClickOverrides: {
      selectionLayerRightClicked: regionRightClickedOverride,
      primerRightClicked: primerRightClickedOverride,
      translationRightClicked: regionRightClickedOverride,
      searchLayerRightClicked: regionRightClickedOverride,
      featureRightClicked: featureRightClickedOverride,
      partRightClicked: {},
      orfRightClicked: {},
      backgroundRightClicked: {},
    },
  };

  React.useEffect(() => {
    updateEditor(store, editorName, { ...defaultMainEditorProps, ...extraProp });
  }, []);

  return (
    <div style={{ textAlign: 'left' }} ref={topDivRef}>
      {annotationChanged &&
      <AnnotationChangedAlert onSave={updateAnnotationInMainSequence} onCancel={onAnnotationCancel} />
      }
      <Editor {...{ editorName, ...defaultMainEditorProps, ...extraProp, height: '800' }} />
      {domesticateDialogOpen && 
        <DomesticateDialog
          open={domesticateDialogOpen}
          onClose={() => {
            setDomesticateDialogOpen(false);
            setDomesticateContext(null);
          }}
          initialContext={domesticateContext}
          mainSequenceId={mainSequenceId}
        />
      }
    </div>
  );
}
export default React.memo(MainSequenceEditor);
