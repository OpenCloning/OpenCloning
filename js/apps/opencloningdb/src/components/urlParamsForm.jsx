import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box } from '@mui/material';

/**
 * Hook to keep form state in sync with URL search params.
 * Use for query/filter forms that read from and write to the URL.
 *
 * @param { (searchParams: URLSearchParams) => Object } parse - map URLSearchParams to your params object
 * @param { (params: Object, nextParams: URLSearchParams) => void } applyToSearchParams - write params into nextParams (mutate)
 * @returns { paramsFromUrl, pendingParams, setPendingParams, submitToUrl }
 */
export function useQueryParamsForm(parse, applyToSearchParams) {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramsFromUrl = useMemo(() => parse(searchParams), [searchParams, parse]);
  const [pendingParams, setPendingParams] = useState(paramsFromUrl);

  useEffect(() => {
    setPendingParams(paramsFromUrl);
  }, [paramsFromUrl]);

  const submitToUrl = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    applyToSearchParams(pendingParams, next);
    setSearchParams(next);
  }, [searchParams, setSearchParams, pendingParams, applyToSearchParams]);

  return { paramsFromUrl, pendingParams, setPendingParams, submitToUrl };
}

/**
 * Form wrapper that submits pending params to the URL on submit.
 * Renders children with (pendingParams, setPendingParams) so you can plug in your fields.
 */
export function UrlParamsForm({ parse, applyToSearchParams, component, value, sx = {} }) {
  const { pendingParams, setPendingParams, submitToUrl } = useQueryParamsForm(
    parse,
    applyToSearchParams
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    submitToUrl();
  };

  return (
    <Box
      data-testid="url-params-form"
      component="form"
      onSubmit={handleSubmit}
      sx={{ minHeight: 65, mb: 2, display: 'flex', gap: 2, flexWrap: 'nowrap', alignItems: 'center', ...sx }}
    >
      {component({ pendingParams, setPendingParams, value })}
    </Box>
  );
}
