// Always returns a non-empty message, so callers don't need a fallback
export default function error2String(error) {
  if (!error) return 'Unknown error';
  if (error.code === 'ERR_NETWORK') { return 'Cannot connect to backend server'; }
  // No response from the server (e.g. timeout), or not a request error
  if (!error.code || !error.response) {
    return error.message || 'Unknown error';
  }
  if (error.response.status === 500) return 'Internal server error';
  const detail = error.response.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  } if (Array.isArray(detail)) {
    // FastAPI validation errors (422): [{ loc, msg, type, input }, ...]
    const detail2 = detail.map((d) => {
      const { input, ...rest } = d;
      return rest;
    });
    return `Server error message:\n${JSON.stringify(detail2, null, 2)}`;
  }
  // No usable detail (e.g. an HTML error page from a proxy): axios's message has the status code
  return error.message || 'Unknown error';
}
