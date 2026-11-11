import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachAuthInterceptors, setHttpClientTokenGetter, setHttpClientUnauthorizedHandler } from './httpClientAuth';

const createClient = () => axios.create({ baseURL: 'http://localhost:8000/db', allowAbsoluteUrls: false });

describe('httpClientAuth', () => {
  beforeEach(() => {
    setHttpClientUnauthorizedHandler(null);
    setHttpClientTokenGetter(null);
  });

  afterEach(() => {
    setHttpClientUnauthorizedHandler(null);
    setHttpClientTokenGetter(null);
  });

  it('leaves request headers unchanged when no token getter is set', async () => {
    const client = attachAuthInterceptors(createClient());
    const requestFulfilled = client.interceptors.request.handlers[0].fulfilled;
    const config = { headers: {} };

    const result = await requestFulfilled(config);

    expect(result).toBe(config);
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('adds the bearer token from a sync token getter', async () => {
    const client = attachAuthInterceptors(createClient());
    const requestFulfilled = client.interceptors.request.handlers[0].fulfilled;
    const config = { headers: {} };

    setHttpClientTokenGetter(() => '__TEST_TOKEN__');

    const result = await requestFulfilled(config);

    expect(result).toBe(config);
    expect(config.headers.Authorization).toBe('Bearer __TEST_TOKEN__');
  });

  it('adds the bearer token from an async token getter', async () => {
    const client = attachAuthInterceptors(createClient());
    const requestFulfilled = client.interceptors.request.handlers[0].fulfilled;
    const config = { headers: {} };

    setHttpClientTokenGetter(async () => 'fresh-token');

    const result = await requestFulfilled(config);

    expect(result).toBe(config);
    expect(config.headers.Authorization).toBe('Bearer fresh-token');
  });

  it('calls the shared unauthorized handler for 401 responses', async () => {
    const client = attachAuthInterceptors(createClient());
    const responseRejected = client.interceptors.response.handlers[0].rejected;
    const handler = vi.fn();
    const error = { response: { status: 401 } };

    setHttpClientUnauthorizedHandler(handler);

    await expect(responseRejected(error)).rejects.toBe(error);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('refuses clients that could send the token to other hosts', () => {
    expect(() => attachAuthInterceptors(axios.create())).toThrow('allowAbsoluteUrls');
    expect(() => attachAuthInterceptors(axios.create({ baseURL: 'http://localhost:8000' }))).toThrow('allowAbsoluteUrls');
    expect(() => attachAuthInterceptors(axios.create({ allowAbsoluteUrls: false }))).toThrow('allowAbsoluteUrls');
  });

  it('does not attach duplicate interceptors to the same client', () => {
    const client = createClient();

    attachAuthInterceptors(client);
    attachAuthInterceptors(client);

    expect(client.interceptors.request.handlers.filter(Boolean)).toHaveLength(1);
    expect(client.interceptors.response.handlers.filter(Boolean)).toHaveLength(1);
  });
});
