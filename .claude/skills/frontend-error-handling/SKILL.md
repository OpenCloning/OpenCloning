---
name: frontend-error-handling
description: How to turn errors into messages for the user in the JS frontend (error2String, alerts, rethrowing, not swallowing errors). Use when writing a catch block, an onError handler, or code that displays an error from a request or a useQuery/useMutation, and when writing tests that check error messages.
---

# Error handling in the frontend

## Turning an error into a message: `error2String`

Use `error2String` from `@opencloning/utils/error2String` for **every** error you show to the user,
whether it comes from a request (axios) or not:

```js
import error2String from '@opencloning/utils/error2String';

addAlert({ message: error2String(error), severity: 'error' });
```

❌ Do not read the response yourself:

```js
error?.response?.data?.detail || error?.message || 'Failed to load primers'
```

The backends are FastAPI. For validation errors (422), `detail` is a **list of objects**, not a
string. Rendering it in an `<Alert>` crashes React. `error2String` formats that list.

`error2String` always returns a non-empty string, so **don't add a `|| 'fallback'`**:

| Error | Message |
|---|---|
| Network error (server down, CORS) | `Cannot connect to backend server` |
| 500 | `Internal server error` (the `detail` is not shown) |
| Response with a string `detail` | the `detail` |
| 422 with a list of `detail`s | the list, formatted (without the `input` fields) |
| Response with no usable `detail` (e.g. an HTML 502 page from a proxy) | axios's message, e.g. `Request failed with status code 502` |
| Not a request error (e.g. a thrown `Error`), or a timeout | `error.message` |
| `null`, or an error without a message | `Unknown error` |

To say what failed, add a prefix rather than a fallback:

```jsx
<Alert severity="error">Could not align the sequencing file: {error2String(error)}</Alert>
```

**eLabFTW is the exception:** inside `packages/opencloning-elabftw`, use the `error2String` from that
package's `src/utils.js`. It reads eLabFTW's error format (`description`), not FastAPI's.

## Showing the error

- **OpenCloningDB app** (`apps/opencloningdb`): `const { addErrorAlert } = useAppAlerts();`, then
  `addErrorAlert(error)`. It calls `error2String` for you.
- **`@opencloning/ui`** (the cloning interface): `useCloningAlerts().addAlert({ message: error2String(e), severity: 'error' })`.
- **Errors that belong to one form or dialog:** render them next to it, with
  `<Alert severity="error">{error2String(error)}</Alert>`. For `useQuery` and `useMutation`, use
  their `error` and `isError` (see the `tanstack-query` skill).

Call `error2String` only when there is an error (inside `onError`, a `catch`, or behind
`isError &&` / `if (error)`). Otherwise you'd show "Unknown error" for no reason.

## Rethrowing with context

Functions that callers will report (database interfaces, helpers) should throw an `Error` with a
readable message and keep the original as `cause`:

```js
} catch (e) {
  throw new Error(`Error getting sequencing files: ${error2String(e)}`, { cause: e });
}
```

## Don't swallow errors

Every `catch` must either report the error (alert, error state, or rethrow) or say in a comment
where it is reported:

```js
} catch {
  // Error already reported via onError; state restored in applyCloningStrategy
}
```

An empty `catch` on an async load leaves the user with a blank page or a spinner that never stops.
If nothing else shows the error, show it, and add `console.error(e)` so it is in the console too.
`await` the promises you call in an `async` function, or their errors are never caught.

**401s from the OpenCloningDB backend** are handled by the response interceptor: it signs the user
out and goes to the login page (see `setUnauthorizedHandler` in `useAuthBootstrap`). You don't need to
handle them, but don't show an error page for them either.

## Tests

Assert the message that `error2String` produces, e.g. `Internal server error` for an intercepted 500
and `Cannot connect to backend server` for `forceNetworkError: true`, not the backend's `detail` or
axios's `Network Error`.
