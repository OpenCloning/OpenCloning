const AUTH_INTERCEPTORS_ATTACHED = '__opencloningHttpClientAuthAttached';

let unauthorizedHandler = null;
let tokenGetter = null;

export function setHttpClientUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export function setHttpClientTokenGetter(fn) {
  tokenGetter = fn;
}

/**
 * Attach the bearer token to requests, and call the unauthorized handler on 401s.
 * The client must have a baseURL and allowAbsoluteUrls: false, so that every request
 * goes to the backend and the token can never be sent to a third party.
 */
export function attachAuthInterceptors(client) {
  if (client[AUTH_INTERCEPTORS_ATTACHED]) {
    return client;
  }
  if (!client.defaults.baseURL || client.defaults.allowAbsoluteUrls !== false) {
    throw new Error('Auth interceptors require a client with baseURL and allowAbsoluteUrls: false');
  }

  client[AUTH_INTERCEPTORS_ATTACHED] = true;

  client.interceptors.request.use(async (config) => {
    const token = await tokenGetter?.();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401 && unauthorizedHandler) {
        unauthorizedHandler();
      }
      return Promise.reject(error);
    },
  );

  return client;
}
