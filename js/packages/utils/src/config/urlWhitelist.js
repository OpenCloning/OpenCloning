/* istanbul ignore file */

export default [
  // GitHub repository for OpenCloning templates
  'https://assets.opencloning.org/OpenCloning-submission',
  // GitHub repository for annotated iGEM distribution
  'https://assets.opencloning.org/annotated-igem-distribution',
  // GitHub repository for SEVA plasmids index
  'https://assets.opencloning.org/seva_plasmids_index',
  // GitHub repository for SnapGene index
  'https://assets.opencloning.org/SnapGene_crawler',
  // GitHub repository for Open DNA Collections index
  'https://assets.opencloning.org/open-dna-collections',
  // GitHub repository for syntaxes
  'https://assets.opencloning.org/syntaxes/syntaxes',
  // NCBI entrez API
  'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
  'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi',
  // Datasets api
  'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/taxonomy/taxon_suggest',
  'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon',
  'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession',
  // OpenCloning MCP server, set at build time
  ...(import.meta.env.VITE_MCP_SERVER_URL ? [import.meta.env.VITE_MCP_SERVER_URL] : []),
];
