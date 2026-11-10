import { describe, expect, it } from 'vitest';

import { getExternalHttpClient, getBackendHttpClient } from './httpClients';

describe('getExternalHttpClient', () => {
  it('creates a generic client without auth interceptors', () => {
    const client = getExternalHttpClient();

    expect(client.interceptors.request.handlers.filter(Boolean)).toHaveLength(1);
    expect(client.interceptors.response.handlers.filter(Boolean)).toHaveLength(0);
  });


  it('blocks urls that only look like whitelisted ones', async () => {
    const client = getExternalHttpClient();
    const requestFulfilled = client.interceptors.request.handlers[0].fulfilled;

    const allowed = { url: 'https://assets.opencloning.org/OpenCloning-submission/index.json' };
    expect(await requestFulfilled(allowed)).toBe(allowed);

    for (const url of [
      'https://assets.opencloning.org.evil.org/OpenCloning-submission/index.json',
      'https://assets.opencloning.org@evil.org/OpenCloning-submission/index.json',
      'https://assets-opencloning.org/OpenCloning-submission/index.json',
    ]) {
      await expect(requestFulfilled({ url })).rejects.toThrow('Request blocked');
    }
  });
});

describe('getBackendHttpClient', () => {
  it('creates an authenticated backend client locked to the backend url', () => {
    const client = getBackendHttpClient('http://localhost:8000/cloning', { authenticated: true });

    expect(client.defaults.baseURL).toBe('http://localhost:8000/cloning');
    expect(client.defaults.allowAbsoluteUrls).toBe(false);
    expect(client.interceptors.request.handlers.filter(Boolean)).toHaveLength(1);
    expect(client.interceptors.response.handlers.filter(Boolean)).toHaveLength(1);
  });

  it('creates an unauthenticated backend client without auth interceptors', () => {
    const client = getBackendHttpClient('http://localhost:8000/cloning');

    expect(client.interceptors.request.handlers.filter(Boolean)).toHaveLength(0);
    expect(client.interceptors.response.handlers.filter(Boolean)).toHaveLength(0);
  });

  it('keeps every request under the backend url, even absolute ones', () => {
    const client = getBackendHttpClient('http://localhost:8000/cloning', { authenticated: true });

    expect(client.getUri({ url: 'version' })).toBe('http://localhost:8000/cloning/version');
    expect(client.getUri({ url: 'https://evil.org/x' })).toBe('http://localhost:8000/cloning/https://evil.org/x');
  });

  it('throws when the backend url is not set', () => {
    expect(() => getBackendHttpClient(undefined)).toThrow('backendUrl is required');
    expect(() => getBackendHttpClient('', { authenticated: true })).toThrow('backendUrl is required');
  });

  it('resolves relative backend urls against the current origin and keeps absolute ones', () => {
    const { origin } = window.location;

    const relative = getBackendHttpClient('/cloning');
    expect(relative.defaults.baseURL).toBe(`${origin}/cloning`);
    expect(relative.getUri({ url: 'version' })).toBe(`${origin}/cloning/version`);
    expect(relative.getUri({ url: 'https://evil.org/x' })).toBe(`${origin}/cloning/https://evil.org/x`);

    const absolute = getBackendHttpClient('https://api.example.com/cloning');
    expect(absolute.defaults.baseURL).toBe('https://api.example.com/cloning');
  });
});
