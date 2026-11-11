export function parseBoolean(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const normalized = String(value).toLowerCase();

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return undefined;
}

export function parseString(value) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

export function parseIntArray(values) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const parsed = values
    .flatMap((value) => String(value).split(','))
    .map((v) => parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
  return parsed.length ? parsed : undefined;
}

export function parseStringArray(values) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const trimmed = values.map((v) => String(v).trim()).filter((v) => v !== '');
  return trimmed.length ? trimmed : undefined;
}

export const VALID_SEQUENCE_TYPES = ['locus', 'allele', 'plasmid', 'pcr_product', 'restriction_fragment', 'linear_dna'];

export const SEQUENCE_TYPE_COLORS = {
  locus: { color: 'secondary.main' },
  allele: { color: 'warning.main' },
  plasmid: { color: 'primary.main' },
  pcr_product: { color: '#dd2d4a' },
  restriction_fragment: { color: 'success.main' },
  linear_dna: { color: 'default.main' },
};

export const SEQUENCE_TYPE_LABELS = {
  locus: 'Locus',
  allele: 'Allele',
  plasmid: 'Plasmid',
  pcr_product: 'PCR product',
  restriction_fragment: 'Restriction fragment',
  linear_dna: 'Linear DNA',
};

export const LINEAR_SEQUENCE_TYPES = {
  locus: 'Locus',
  allele: 'Allele',
  pcr_product: 'PCR product',
  restriction_fragment: 'Restriction fragment',
  linear_dna: 'Linear DNA',
};

export const CIRCULAR_SEQUENCE_TYPES = {
  plasmid: 'Plasmid',
};

export const TEMPLATE_SEQUENCE_TYPES = {
  allele: 'Allele',
  plasmid: 'Plasmid'
};

/**
 * Parse URL search params into sequence filter object.
 * Single source of truth for sequence query params.
 */
export function parseSequenceParams(searchParams) {
  return {
    uid: parseString(searchParams.get('uid')),
    name: parseString(searchParams.get('name')),
    tags: parseIntArray(searchParams.getAll('tags')),
    sequence_types: parseStringArray(searchParams.getAll('sequence_types'))?.filter((t) => VALID_SEQUENCE_TYPES.includes(t)),
    instantiated: parseBoolean(searchParams.get('instantiated')),
    has_uid: parseBoolean(searchParams.get('has_uid')),
    created_by: parseString(searchParams.get('created_by')),
  };
}

/**
 * Write sequence filter params into URLSearchParams (mutates nextParams).
 * Removes 'page' so search resets to first page.
 */
export function applySequenceParamsToSearchParams(params, nextParams) {
  nextParams.delete('page');

  const keys = ['name', 'uid', 'tags', 'sequence_types', 'instantiated', 'has_uid', 'created_by'];
  keys.forEach((key) => nextParams.delete(key));

  if (params.name) {
    nextParams.set('name', params.name);
  }
  if (params.uid) {
    nextParams.set('uid', params.uid);
  }
  if (params.tags) {
    params.tags.forEach((id) => nextParams.append('tags', String(id)));
  }
  if (params.sequence_types) {
    params.sequence_types.forEach((t) => nextParams.append('sequence_types', t));
  }
  if (params.instantiated === true || params.instantiated === false) {
    nextParams.set('instantiated', params.instantiated ? 'true' : 'false');
  }
  if (params.has_uid === true || params.has_uid === false) {
    nextParams.set('has_uid', params.has_uid ? 'true' : 'false');
  }
  if (params.created_by) {
    nextParams.set('created_by', params.created_by);
  }
}

/**
 * Parse URL search params into primer filter object.
 * Single source of truth for primer query params.
 */
export function parsePrimersParams(searchParams) {
  return {
    tags: parseIntArray(searchParams.getAll('tags')),
    name: parseString(searchParams.get('name')),
    uid: parseString(searchParams.get('uid')),
    has_uid: parseBoolean(searchParams.get('has_uid')),
    created_by: parseString(searchParams.get('created_by')),
  };
}

/**
 * Write primer filter params into URLSearchParams (mutates nextParams).
 * Removes 'page' so search resets to first page.
 */
export function applyPrimersParamsToSearchParams(params, nextParams) {
  nextParams.delete('page');

  const keys = ['name', 'tags', 'uid', 'has_uid', 'created_by'];
  keys.forEach((key) => nextParams.delete(key));

  if (params.name) {
    nextParams.set('name', params.name);
  }
  if (params.uid) {
    nextParams.set('uid', params.uid);
  }
  if (params.tags) {
    params.tags.forEach((id) => nextParams.append('tags', String(id)));
  }
  if (params.has_uid === true || params.has_uid === false) {
    nextParams.set('has_uid', params.has_uid ? 'true' : 'false');
  }
  if (params.created_by) {
    nextParams.set('created_by', params.created_by);
  }
}

/**
 * Parse URL search params into line filter object.
 * Single source of truth for line query params.
 */
export function parseLinesParams(searchParams) {
  return {
    tags: parseIntArray(searchParams.getAll('tags')),
    genotype: parseString(searchParams.get('genotype')),
    plasmid: parseString(searchParams.get('plasmid')),
    uid: parseString(searchParams.get('uid')),
    created_by: parseString(searchParams.get('created_by')),
  };
}

/**
 * Write line filter params into URLSearchParams (mutates nextParams).
 * Removes 'page' so search resets to first page.
 */
export function applyLinesParamsToSearchParams(params, nextParams) {
  nextParams.delete('page');

  const keys = ['tags', 'genotype', 'plasmid', 'uid', 'created_by'];
  keys.forEach((key) => nextParams.delete(key));

  if (params.genotype) {
    nextParams.set('genotype', params.genotype);
  }
  if (params.plasmid) {
    nextParams.set('plasmid', params.plasmid);
  }
  if (params.uid) {
    nextParams.set('uid', params.uid);
  }
  if (params.tags) {
    params.tags.forEach((id) => nextParams.append('tags', String(id)));
  }
  if (params.created_by) {
    nextParams.set('created_by', params.created_by);
  }
}
