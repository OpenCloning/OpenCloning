import { useCallback } from 'react'
import { classNameToEndPointMap } from '@opencloning/utils/sourceFunctions'
import useBackendHttpClient from '../../hooks/useBackendHttpClient'
import { arrayCombinations } from './assembler_utils'


function formatLoadedFile(plasmid, id) {
  return {
    source: {
      id,
      type: 'UploadedFileSource',
      input: [],
      sequence_file_format: "genbank",
      file_name: plasmid.file_name,
      index_in_file: 0,
    },
    sequence: {
      id,
      type: 'TextFileSequence',
      sequence_file_format: "genbank",
      overhang_crick_3prime: 0,
      overhang_watson_3prime: 0,
      file_content: plasmid.genbankString,
    },
    plasmid: plasmid,
  }
}

function formatDatabaseSequence(plasmid, id) {
  return {
    source: {
      id,
      type: 'DatabaseSource',
      input: [],
      database_id: plasmid.database_id,
    },
    sequence: {
      ...plasmid.textFileSequence,
      id,
    },
    plasmid: plasmid,
  }
}

export const useAssembler = () => {
  const httpClient = useBackendHttpClient();

  const requestSources = useCallback(async (assemblerOutput) => {
    const processedOutput = []
    for (let pos = 0; pos < assemblerOutput.length; pos++) {
      processedOutput.push([])
      for (let plasmid of assemblerOutput[pos]) {
        try {
          if (plasmid.type === 'loadedFile') {
            processedOutput[pos].push(formatLoadedFile(plasmid, pos + 1))
          } else if (plasmid.type === 'databaseSequence') {
            processedOutput[pos].push(formatDatabaseSequence(plasmid, pos + 1))
          } else {
            const { source } = plasmid;
            const url = classNameToEndPointMap[source.type]
            const {data} = await httpClient.post(url, source)
            if (data.sources.length !== 1) {
              console.error('Expected 1 source, got ' + data.sources.length)
            }
            const thisData = {
              source: {...data.sources[0], id: pos + 1},
              sequence: {...data.sequences[0], id: pos + 1},
              plasmid: plasmid,
            }
            processedOutput[pos].push(thisData)
          }} catch (e) {
          e.plasmid = plasmid;
          throw e;
        }
      }
    }
    return processedOutput
  }, [ httpClient ])


  const requestAssemblies = useCallback(async (requestedSources, enzymes=['BsaI']) => {

    const assemblies = arrayCombinations(requestedSources);
    const output = []
    for (let assembly of assemblies) {
      const url = 'restriction_and_ligation'
      const config = {
        params: {
          circular_only: true,
          sort_by_recognition_sites: true,
        }
      }
      const requestData = {
        source: {
          type: 'RestrictionAndLigationSource',
          restriction_enzymes: enzymes,
          id: assembly.length + 1,
        },
        sequences: assembly.map((p) => p.sequence),
      }
      try {
        const {data} = await httpClient.post(url, requestData, config)
        const thisSource = data.sources[0]
        const thisSequence = data.sequences[0]
        thisSource.id = assembly.length + 1
        thisSequence.id = assembly.length + 1


        const cloningStrategy = {
          sources: [thisSource, ...assembly.map((p) => p.source)],
          sequences: [thisSequence, ...assembly.map((p) => p.sequence)],
          primers: [],
        }
        output.push(cloningStrategy)
      } catch (e) {
        e.assembly = assembly;
        throw e;
      }
    }
    return output;
  }, [ httpClient ])

  return { requestSources, requestAssemblies }
}

