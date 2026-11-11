import React from 'react';
import { FormHelperText, Alert, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { useSelector } from 'react-redux';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';
import LabelWithTooltip from '../form/LabelWithTooltip';
import useCloningHistoryLoader from '../../hooks/useCloningHistoryLoader';

const fileFormatToExtension = {
  genbank: 'gb',
  fasta: 'fasta',
  snapgene: 'dna',
  embl: 'embl',
  json: 'json',
};

// A component providing an interface to import a file
function SourceFile({ source, requestStatus, sendSourceRequest }) {
  const [circularize, setCircularize] = React.useState(false);
  const [showCoordinates, setShowCoordinates] = React.useState(false);
  const [coordinates, setCoordinates] = React.useState({ start: null, end: null });
  const [fileFormat, setFileFormat] = React.useState('');
  const hasOutput = useSelector((state) => state.cloning.sequences.some((s) => s.id === source.id));
  // Error message for json only
  const [alert, setAlert] = React.useState(null);
  const { loadHistoryFromFile, loadSnapgeneHistory } = useCloningHistoryLoader();
  const onChange = async (event) => {
    setAlert(null);
    const files = Array.from(event.target.files);
    if (files.length === 0) {
      return;
    }
    event.target.value = null;
    const reportError = (message) => setAlert({ message, severity: 'error' });
    // If the file is a history file, we load it
    if (
      fileFormat === 'json' || fileFormat === 'zip'
      || (fileFormat === '' && (files[0].name.endsWith('.json') || files[0].name.endsWith('.zip')))
    ) {
      // If file format is explicitly set, rename file to match that extension
      if (fileFormat) {
        files[0] = new File([files[0]], files[0].name.replace(/\.[^/.]+$/, `.${fileFormatToExtension[fileFormat]}`), {
          type: fileFormat === 'json' ? 'application/json' : files[0].type,
        });
      }

      const prepared = await loadHistoryFromFile(files[0], { onError: reportError });
      if (!prepared) {
        return;
      }

      if (hasOutput && !prepared.canGraft) {
        setAlert({ message: 'Cannot graft cloning strategy as it does not converge on a single sequence, you can load it on a source without outputs', severity: 'error' });
        return;
      }

      const graft = hasOutput && prepared.canGraft;
      try {
        const applyOptions = { source, onError: reportError };
        if (graft) {
          await prepared.graft(applyOptions);
        } else {
          await prepared.merge(applyOptions);
        }
      } catch {
        // Error already reported via onError; state restored in applyCloningStrategy
      }
      return;
    }
    if (fileFormat === 'snapgene' || (fileFormat === '' && files[0].name.endsWith('.dna'))) {
      const success = await loadSnapgeneHistory(files[0], { source });
      if (success) {
        return;
      }
    }
    const requestData = new FormData();
    requestData.append('file', files[0]);
    const config = {
      headers: {
        'content-type': 'multipart/form-data',
      },
      params: { circularize, sequence_file_format: fileFormat || null, ...coordinates },
    };
    sendSourceRequest({ endpoint: 'read_from_file', requestData, config, source });
  };

  const updateCoordinates = (value, isStart) => {
    setCoordinates((prev) => ({ ...prev, [isStart ? 'start' : 'end']: value }));
  };

  const onShowCoordinatesChange = () => {
    const newShowCoordinates = !showCoordinates;
    setShowCoordinates(newShowCoordinates);
    if (!newShowCoordinates) {
      setCoordinates({ start: null, end: null });
    }
  };

  return (
    <form className="submit-sequence-file" onSubmit={(e) => e.preventDefault()}>
      <FormControl fullWidth>
        <InputLabel id="select-file-format" shrink>File format</InputLabel>
        <Select
          labelId="select-file-format"
          id="select-file-format"
          value={fileFormat}
          onChange={(e) => setFileFormat(e.target.value)}
          label="File format"
          displayEmpty
        >
          <MenuItem value="">Guess from extension</MenuItem>
          <MenuItem value="genbank">Genbank / Ape</MenuItem>
          <MenuItem value="fasta">FASTA</MenuItem>
          <MenuItem value="snapgene">SnapGene (.dna)</MenuItem>
          <MenuItem value="embl">EMBL</MenuItem>
          <MenuItem value="json">JSON (history file)</MenuItem>
          <MenuItem value="zip">Zip (history folder)</MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth>
        <FormControlLabel
          control={<Checkbox checked={circularize} onChange={() => setCircularize(!circularize)} />}
          label={<LabelWithTooltip label="Circularize" tooltip="Make the sequence circular (for GenBank or Snapgene files, it will override the topology indicated in the file)" />}
        />
        <FormControlLabel
          control={<Checkbox checked={showCoordinates} onChange={onShowCoordinatesChange} />}
          label={<LabelWithTooltip label="Extract subsequence" tooltip="Does not work with JSON or Zip files" />}
        />
        {showCoordinates && (
          <FormControl fullWidth className="extract-subsequence">
            <TextField
              label="Start"
              value={coordinates.start}
              onChange={(e) => updateCoordinates(e.target.value, true)}
              type="number"
            />
            <TextField
              label="End"
              value={coordinates.end}
              onChange={(e) => updateCoordinates(e.target.value, false)}
              type="number"
            />
          </FormControl>
        )}
      </FormControl>

      {alert && (<Alert sx={{ marginTop: '10px' }} severity={alert.severity}>{alert.message}</Alert>)}
      <SubmitButtonBackendAPI
        component="label"
        requestStatus={requestStatus}
        {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": "submit-file" })}
      >
        Select File
        <input
          type="file"
          hidden
          onChange={onChange}
        />
      </SubmitButtonBackendAPI>
      <FormHelperText>Supports .gb, .dna, .embl, .fasta, .fa, .ape</FormHelperText>
    </form>
  );
}

export default SourceFile;
