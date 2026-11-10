import { getExternalHttpClient } from './httpClients';

const httpClient = getExternalHttpClient();


export async function taxonSuggest(userInput) {
  const url = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/taxonomy/taxon_suggest/${userInput}`;
  const params = {
    taxon_resource_filter: 'TAXON_RESOURCE_FILTER_GENOME',
    tax_rank_filter: 'higher_taxon',
  };
  const resp = await httpClient.get(url, { params });
  const taxons = resp.data.sci_name_and_ids;

  // This might change if the API endpoint changes
  return taxons === undefined ? [] : taxons.filter((e) => e.rank === 'SPECIES');
}

export async function getReferenceAssemblyId(taxonId) {
  const url = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon/${taxonId}/dataset_report?filters.reference_only=true`;
  const resp = await httpClient.get(url);
  const { reports } = resp.data;
  return reports === undefined ? null : resp.data.reports[0].accession;
}

export async function geneSuggest(assemblyId, userInput) {
  const url = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/${assemblyId}/annotation_report?search_text=${userInput}`;
  const resp = await httpClient.get(url);
  // TODO: add support for api key
  // const resp = await httpClient.get(url, { params: {
  //   api_key: 'blah',
  // } });
  const { reports } = resp.data;
  return reports === undefined ? [] : reports;
}

export async function getInfoFromAssemblyId(assemblyId) {
  const url = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/${assemblyId}/dataset_report?filters.assembly_version=all_assemblies`;
  const resp = await httpClient.get(url);

  if (resp.status === 404 || resp.data.reports === undefined) {
    return null;
  }
  const { reports } = resp.data;
  if (reports === undefined) {
    return null;
  }

  const species = reports[0].organism;
  const exactAssemblyMatch = reports.find((report) => report.accession === assemblyId);
  let exactMatch = null;
  let newerAssembly = null;
  let pairedAccession = null;
  if (!exactAssemblyMatch) {
    // The assembly ID is valid, but it's not an exact match to a particular version.
    // For example, passing GCA_000007565 will return entries, but the actual assembly versions
    // are GCA_000007565.1, GCA_000007565.2
    exactMatch = false;
    newerAssembly = reports[0].current_accession;
    pairedAccession = reports[0].paired_accession;
  } else {
    exactMatch = true;
    newerAssembly = exactAssemblyMatch.assembly_info.assembly_status !== 'current' ? exactAssemblyMatch.current_accession : null;
    pairedAccession = exactAssemblyMatch.paired_accession;
  }

  // const url2 = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/${assemblyId}/annotation_report/download_summary`;
  // try {
  //   const resp2 = await httpClient.get(url2);
  //   const hasAnnotation = resp2.data.record_count !== undefined;
  //   return { species, hasAnnotation, newerAssembly };
  // } catch (error) {
  //   return { species, hasAnnotation: false, newerAssembly };
  // }
  return { species, hasAnnotation: reports[0].annotation_info !== undefined, newerAssembly, exactMatch, pairedAccession };

  // I used to check like this, but no longer works (see https://github.com/ncbi/datasets/issues/380)
  // const annotationInfo = reports[0].annotation_info || null;
  // return reports === undefined ? null : { species, annotationInfo };
}

export async function getInfoFromSequenceAccession(sequenceAccession) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?id=${sequenceAccession}&db=nuccore&retmode=json`;
  // For example: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?id=CP046095.1&db=nuccore&retmode=json

  const resp = await httpClient.get(url);
  // I don't think this ever happens, but just in case
  if (resp.status === 404 || resp.data.result.uids.length === 0) {
    return null;
  }

  const { taxid: taxId, accessionversion: sequenceAccessionStandard } = resp.data.result[resp.data.result.uids[0]];

  if (!taxId) {
    return { species: null, sequenceAccessionStandard };
  }

  const url2 = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?id=${taxId}&db=taxonomy&retmode=json`;
  const resp2 = await httpClient.get(url2);
  const { scientificname: organismName } = resp2.data.result[resp2.data.result.uids[0]];
  return { species: { tax_id: taxId, organism_name: organismName }, sequenceAccessionStandard };
}
