import error2String from './error2String';

describe('error2String', () => {
  it('returns the message of errors that are not from a request', () => {
    expect(error2String(new Error('Something failed'))).toBe('Something failed');
  });

  it('returns the message of request errors without a response (e.g. timeout)', () => {
    const error = Object.assign(new Error('timeout of 1000ms exceeded'), { code: 'ECONNABORTED' });
    expect(error2String(error)).toBe('timeout of 1000ms exceeded');
  });

  it('handles network errors', () => {
    expect(error2String({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe('Cannot connect to backend server');
  });

  it('returns the detail of the response', () => {
    const error = { code: 'ERR_BAD_REQUEST', response: { status: 400, data: { detail: 'Bad input' } } };
    expect(error2String(error)).toBe('Bad input');
  });

  it('handles server errors', () => {
    const error = { code: 'ERR_BAD_RESPONSE', response: { status: 500, data: {} } };
    expect(error2String(error)).toBe('Internal server error');
  });

  it('formats validation errors (list of details), without the input', () => {
    const error = { code: 'ERR_BAD_REQUEST', response: { status: 422, data: { detail: [{ loc: ['body', 'name'], msg: 'Field required', input: 'big' }] } } };
    const message = error2String(error);
    expect(message).toContain('Field required');
    expect(message).not.toContain('big');
  });

  it('returns the request message when the response has no usable detail', () => {
    const response = (data) => ({
      code: 'ERR_BAD_RESPONSE',
      message: 'Request failed with status code 502',
      response: { status: 502, data },
    });
    expect(error2String(response(undefined))).toBe('Request failed with status code 502');
    expect(error2String(response('<html>Bad gateway</html>'))).toBe('Request failed with status code 502');
    expect(error2String(response({ detail: null }))).toBe('Request failed with status code 502');
    expect(error2String(response({ detail: { msg: 'not a list' } }))).toBe('Request failed with status code 502');
  });

  it('never returns an empty message', () => {
    expect(error2String(undefined)).toBe('Unknown error');
    expect(error2String(new Error())).toBe('Unknown error');
    expect(error2String({ code: 'ERR_BAD_REQUEST', response: { status: 400, data: {} } })).toBe('Unknown error');
  });
});
