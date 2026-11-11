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
});
