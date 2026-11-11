/**
 * Whether `url` starts with `prefix`, comparing the normalized urls (relative urls are
 * resolved against the current origin). Normalizing makes a host-only prefix end in "/",
 * so https://example.com matches https://example.com/path but not
 * https://example.com.evil.org or https://example.com@evil.org.
 */
export function urlMatchesPrefix(url, prefix) {
  return new URL(url, window.location.origin).href.startsWith(new URL(prefix, window.location.origin).href);
}

/**
 * Encode a value to be inserted as a single segment of a URL path, e.g.
 * `/sequences/${encodePathSegment(id)}`. Prevents client-side path traversal (CSPT):
 * "/", "?" and "#" are encoded, and "." / ".." are rejected because
 * encodeURIComponent leaves them unchanged and the browser would resolve them.
 */
export function encodePathSegment(value) {
  const segment = String(value);
  if (segment === '.' || segment === '..') {
    throw new Error(`Invalid URL path segment: "${segment}"`);
  }
  return encodeURIComponent(segment);
}
