import { describe, expect, it } from 'vitest';

import { encodePathSegment, urlMatchesPrefix } from './urlUtils';

describe('urlMatchesPrefix', () => {
  it('matches urls under the prefix', () => {
    expect(urlMatchesPrefix('https://example.com/a/b', 'https://example.com/a')).toBe(true);
    expect(urlMatchesPrefix('https://example.com/a', 'https://example.com/a')).toBe(true);
    expect(urlMatchesPrefix('https://example.com/a?x=1', 'https://example.com/a')).toBe(true);
    expect(urlMatchesPrefix('https://example.com/a/b', 'https://example.com')).toBe(true);
    expect(urlMatchesPrefix('https://example.com/esearch.fcgi?db=x', 'https://example.com/esearch.fcgi')).toBe(true);
  });

  it('does not match lookalike hosts or paths', () => {
    expect(urlMatchesPrefix('https://example.com.evil.org/a', 'https://example.com')).toBe(false);
    expect(urlMatchesPrefix('https://example.com@evil.org/a', 'https://example.com')).toBe(false);
    expect(urlMatchesPrefix('https://exampleXcom/a', 'https://example.com')).toBe(false);
    expect(urlMatchesPrefix('https://other.com/https://example.com/a', 'https://example.com/a')).toBe(false);
  });

  it('resolves relative urls and prefixes against the current origin', () => {
    const { origin } = window.location;
    expect(urlMatchesPrefix('/backend/db/sequences', '/backend/db')).toBe(true);
    expect(urlMatchesPrefix(`${origin}/backend/db/sequences`, '/backend/db')).toBe(true);
    expect(urlMatchesPrefix('https://evil.org/backend/db/sequences', '/backend/db')).toBe(false);
  });
});

describe('encodePathSegment', () => {
  it('encodes characters that would change the path', () => {
    expect(encodePathSegment('../workspaces/1/users/5')).toBe('..%2Fworkspaces%2F1%2Fusers%2F5');
    expect(encodePathSegment('a?b#c')).toBe('a%3Fb%23c');
    expect(encodePathSegment(12)).toBe('12');
  });

  it('rejects dot segments', () => {
    expect(() => encodePathSegment('.')).toThrow();
    expect(() => encodePathSegment('..')).toThrow();
  });

  it('keeps the request path when resolved by the browser', () => {
    for (const value of ['../workspaces/1', '..%2F..', 'a/../../b', '...']) {
      const url = new URL(`/db/sequence_samples/${encodePathSegment(value)}`, 'https://example.com');
      expect(url.pathname.startsWith('/db/sequence_samples/')).toBe(true);
      // Only has 3 "/" > "/db/sequence_samples/"
      expect(url.pathname.split('/')).toHaveLength(4);
    }
  });
});
