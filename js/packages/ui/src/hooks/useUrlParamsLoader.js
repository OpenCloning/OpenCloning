import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { cloningActions } from '@opencloning/store/cloning';
import useDatabase from './useDatabase';
import useLoadDatabaseFile from './useLoadDatabaseFile';
import useCloningAlerts from './useCloningAlerts';
import useValidateState from './useValidateState';
import useCloningHistoryLoader from './useCloningHistoryLoader';
import { formatSequenceLocationString, getUrlParameters } from '@opencloning/utils/other';
import { formatTemplate } from '@opencloning/utils/readNwrite';
import { encodePathSegment } from '@opencloning/utils/urlUtils';
import { getExternalHttpClient } from '@opencloning/utils/httpClients';

// For public urls (not the backend)
const httpClient = getExternalHttpClient();

const { updateSource } = cloningActions;

// OpenCloning MCP server, set at build time
const mcpUrl = import.meta.env.VITE_MCP_SERVER_URL;

/**
 * Hook to load sequences from URL parameters
 * Handles various source types: database, example, template, genome_coordinates, locus_tag
 */
export default function useUrlParamsLoader() {
  const dispatch = useDispatch();
  const database = useDatabase();
  const { addAlert } = useCloningAlerts();
  const setHistoryFileError = (e) => addAlert({ message: e, severity: 'error' });
  const { loadDatabaseFile } = useLoadDatabaseFile({ source: { id: 1 }, sendSourceRequest: null, setHistoryFileError });
  const validateState = useValidateState();
  const { applyCloningStrategy, loadHistoryFromFile } = useCloningHistoryLoader();

  useEffect(() => {
    async function loadSequenceFromUrlParams() {
      const urlParams = getUrlParameters();

      if (urlParams.source === 'database') {
        try {
          if (!database) {
            return;
          }
          const { file, databaseId } = await database.loadSequenceFromUrlParams(urlParams);
          loadDatabaseFile(file, databaseId);
        } catch (error) {
          addAlert({
            message: 'Error loading sequence from URL parameters',
            severity: 'error',
          });
          console.error(error);
        }
      } else if (urlParams.source === 'example' && urlParams.example) {
        try {
          const url = `${import.meta.env.BASE_URL}examples/${encodePathSegment(urlParams.example)}`;
          const fileName = urlParams.example;
          if (fileName.endsWith('.zip')) {
            const resp = await httpClient.get(url, { responseType: 'blob' });
            if (resp.headers['content-type'] !== 'application/zip') {
              throw new Error('Not found');
            }
            const file = new File([resp.data], fileName);
            const prepared = await loadHistoryFromFile(file, { onError: setHistoryFileError });
            await prepared?.replace();
          } else {
            const resp = await httpClient.get(url);
            if (resp.headers['content-type'] !== 'application/json') {
              throw new Error('Not found');
            }
            const file = new File([JSON.stringify(resp.data)], fileName);
            const prepared = await loadHistoryFromFile(file, { onError: setHistoryFileError });
            await prepared?.replace();
          }
        } catch (error) {
          addAlert({
            message: 'Error loading example',
            severity: 'error',
          });
          console.error(error);
        }
      } else if (urlParams.source === 'mcp' && urlParams.strategy) {
        // Only the MCP server set at build time (VITE_MCP_SERVER_URL) is fetched from, never a url from the query
        try {
          if (!mcpUrl) {
            throw new Error('No MCP server configured');
          }
          if (!/^[A-Za-z0-9_-]+$/.test(urlParams.strategy)) {
            throw new Error('Invalid strategy id');
          }
          const url = `${mcpUrl.replace(/\/$/, '')}/strategies/${encodePathSegment(urlParams.strategy)}.json`;
          const resp = await httpClient.get(url);
          const file = new File([JSON.stringify(resp.data)], 'mcp_strategy.json');
          const prepared = await loadHistoryFromFile(file, { onError: setHistoryFileError });
          await prepared?.replace();
        } catch (error) {
          addAlert({
            message: 'Error loading strategy from the MCP server (it may have expired or not exist)',
            severity: 'error',
          });
          console.error(error);
        }
      } else if (urlParams.source === 'template' && urlParams.template && urlParams.key) {
        try {
          const baseUrl = 'https://assets.opencloning.org/OpenCloning-submission';
          const url = `${baseUrl}/processed/${encodePathSegment(urlParams.key)}/templates/${encodePathSegment(urlParams.template)}`;
          const { data } = await httpClient.get(url);
          const validatedData = await validateState(data);
          const newState = formatTemplate(validatedData, url);

          await applyCloningStrategy(newState, { mode: 'replace' });
        } catch (error) {
          addAlert({
            message: 'Error loading template',
            severity: 'error',
          });
          console.error(error);
        }
      } else if (urlParams.source === 'genome_coordinates') {
        const { sequence_accession, start, end, strand, assembly_accession } = urlParams;
        if (!sequence_accession || !start || !end || !strand) {
          addAlert({
            message: 'Error loading genome sequence from URL parameters',
            severity: 'error',
          });
          return;
        }
        const startNum = Number(start);
        const endNum = Number(end);
        const strandNum = Number(strand);
        let error = '';
        if (isNaN(startNum) || isNaN(endNum)) {
          error = 'Start and end must be numbers';
        }
        else if (![1, -1].includes(strandNum)) {
          error = 'Strand must be 1 or -1';
        }
        else if (startNum < 1) {
          error = 'Start must be greater than zero';
        }
        else if (startNum >= endNum) {
          error = 'End must be greater than start';
        }
        if (error) {
          addAlert({ message: `Error loading genome coordinates from URL parameters: ${error}`, severity: 'error' });
          return;
        }

        const source = {
          id: 1,
          type: 'KnownGenomeCoordinatesSource',
          assembly_accession,
          repository_id: sequence_accession,
          coordinates: formatSequenceLocationString(start, end, strand),
        }
        dispatch(updateSource(source));
      } else if (urlParams.source === 'locus_tag') {
        const { locus_tag, assembly_accession, padding } = urlParams;
        if (!locus_tag || !assembly_accession) {
          addAlert({
            message: 'Error loading locus tag from URL parameters',
            severity: 'error',
          });
          return;
        }

        const source = {
          id: 1,
          type: 'KnownGenomeCoordinatesSource',
          assembly_accession,
          locus_tag,
          padding: padding ? Number(padding) : 1000,
        }
        dispatch(updateSource(source));
      }
    }
    loadSequenceFromUrlParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
