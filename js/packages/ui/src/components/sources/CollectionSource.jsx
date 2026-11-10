import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import React from 'react';
import { AddCircle as AddCircleIcon } from '@mui/icons-material';
import { useDispatch, useStore } from 'react-redux';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';
import { classNameToEndPointMap } from '@opencloning/utils/sourceFunctions';
import ObjectTable from '../ObjectTable';
import { cloningActions } from '@opencloning/store/cloning';

function CollectionSource({ source, requestStatus, sendSourceRequest }) {
  const { id: sourceId, options, image: imageInfo, title, description } = source;
  const [image, imageWidth] = imageInfo || [null, null];
  const [selectedOption, setSelectedOption] = React.useState(null);
  const dispatch = useDispatch();
  const store = useStore();
  const { replaceSource } = cloningActions;

  const onSubmit = (event) => {
    event.preventDefault();
    const { source: selectedSource } = options.find((option) => option.name === selectedOption);
    // Delete options field
    const modifySource = (s) => {
      const sourceOut = { ...s };
      delete sourceOut.options;
      return sourceOut;
    };
    const endpoint = classNameToEndPointMap[selectedSource.type];
    let requestData;
    if (selectedSource.type === 'AddgeneIdSource') {
      requestData = { id: sourceId, ...selectedSource };
    } else if (selectedSource.type === 'OligoHybridizationSource') {
      const { primers } = store.getState().cloning;
      const forwardOligo = primers.find((primer) => primer.id === selectedSource.input[0].sequence);
      const reverseOligo = primers.find((primer) => primer.id === selectedSource.input[1].sequence);
      requestData = { source: { id: sourceId, ...selectedSource }, primers: [forwardOligo, reverseOligo] };
    }
    sendSourceRequest({ endpoint, requestData, source, modifySource });
  };

  const onChange = (event) => {
    setSelectedOption(event.target.value);
  };

  const turnIntoBlankSource = () => {
    setSelectedOption(null);
    dispatch(replaceSource({
      id: sourceId,
      input: [],
      type: null,
    }));
  };

  const selectedOptionObject = options.find((option) => option.name === selectedOption);
  return (
    <div className="collection-source">
      {title && <h2>{title}</h2>}
      {description && <p>{description}</p>}
      {image && <img src={image} width={imageWidth} alt="Collection source icon" />}
      <form onSubmit={onSubmit}>
        <FormControl fullWidth>
          <InputLabel id="select-collection-source">Select a sequence</InputLabel>
          <Select
            value={selectedOption !== null ? selectedOption : ''}
            onChange={onChange}
            labelId="select-collection-source"
            label="Select a sequence"
            // Limits the height of the dropdown (adds scroll)
            MenuProps={{ PaperProps: { style: { maxHeight: 250 } } }}
          >
            <MenuItem onClick={turnIntoBlankSource} value="">
              <AddCircleIcon color="success" />
              <em style={{ marginLeft: 8 }}>Add your own</em>
            </MenuItem>
            {options.map((option) => (
              <MenuItem key={option.name} value={option.name}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedOption !== null && (
          <>
            {selectedOptionObject.info && <ObjectTable object={selectedOptionObject.info} />}
            <SubmitButtonBackendAPI
              requestStatus={requestStatus}
              {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": "submit-collection-source" })}
            >Submit</SubmitButtonBackendAPI>
          </>
        )}
      </form>
    </div>

  );
}

export default CollectionSource;
