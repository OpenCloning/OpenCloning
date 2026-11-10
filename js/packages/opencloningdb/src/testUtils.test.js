import fs from 'fs';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { baseUrl, setHttpClientTokenGetter } from './common';

const STUB_FOLDER = `${__dirname}/../../../OpenCloning_backend/stubs/db`;

/**
 * @typedef {Object} DbStub
 * @property {unknown} body
 * @property {string} endpoint
 * @property {Record<string, string>} headers
 * @property {string} method
 * @property {unknown} params
 * @property {{
 *   body: unknown,
 *   headers: Record<string, string>,
 *   status_code: number
 * }} response
 */

/**
 * @param {string} stubName
 * @returns {DbStub}
 */
export function getStub(stubName) {
  if (!fs.existsSync(`${STUB_FOLDER}/${stubName}.json`)) {
    throw new Error(`Stub ${stubName} not found`);
  }
  return /** @type {DbStub} */ (
    JSON.parse(fs.readFileSync(`${STUB_FOLDER}/${stubName}.json`, 'utf8'))
  );
}

/**
 * @param {unknown} server
 * @param {DbStub} stub
 */
export function addStubToServer(server, stub) {
  const url = new URL(stub.endpoint, baseUrl);
  server.use(
    http[stub.method.toLowerCase()](url.toString(), async ({ request, params }) => {
      const plainParams = Object.fromEntries(Object.entries(params ?? {}));
      const actualParams = Object.keys(plainParams).length === 0 ? null : plainParams;
      let actualBody;
      if (request.headers.get('content-type')?.includes('multipart/form-data')) {
        throw new Error('Multipart form data is not supported');
      } else {
        actualBody = await request
          .clone()
          .json()
          .catch(() => null);
      }
      expect(actualParams).toEqual(stub.params);
      expect(actualBody).toEqual(stub.body);

      const actualHeaders = Object.fromEntries(request.headers.entries());
      delete actualHeaders['content-type'];
      delete actualHeaders['accept'];
      expect(actualHeaders).toMatchObject(stub.headers);

      if (stub.response.headers['content-disposition']) {
        return new HttpResponse(Buffer.from(stub.response.body, 'base64'), {
          status: stub.response.status_code,
          headers: stub.response.headers,
        });
      }

      return HttpResponse.json(stub.response.body, {
        status: stub.response.status_code,
        headers: stub.response.headers,
      });
    }),
  );
}

export function setupToken() {
  setHttpClientTokenGetter(() => '__TEST_TOKEN__');
}

export function clearToken() {
  setHttpClientTokenGetter(null);
}

describe('test utility module', () => {
  it('exports helpers for other test files', () => {
    expect(typeof getStub).toBe('function');
    expect(typeof addStubToServer).toBe('function');
  });
});
