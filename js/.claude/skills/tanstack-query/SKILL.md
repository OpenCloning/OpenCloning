---
name: tanstack-query
description: Patterns for data fetching in this codebase. Use when making HTTP requests in React components — prefer useMutation or useQuery over manual useState/useEffect loading/error state.
---

# TanStack Query Usage

This codebase uses `@tanstack/react-query`. **Always prefer `useMutation` or `useQuery` over manual `useState`/`useEffect` patterns** for HTTP requests in React components.

## Mutations (POST / PUT / DELETE)

Use `useMutation` for any request that calls an external server in response to a user action. It provides `isPending`, `error`, and `onSuccess`/`onError` callbacks — no manual `loading` or `error` state needed.

```jsx
const { mutate, isPending, error } = useMutation({
  mutationFn: () => apiCall(formValues),
  onSuccess: (data) => {
    // navigate, dispatch, etc.
  },
});

function handleSubmit(e) {
  e.preventDefault();
  mutate();
}
```

Error display from a mutation:
```jsx
{error && <Alert severity="error">{error.response?.data?.detail ?? 'Something went wrong'}</Alert>}
```

## Queries (GET)

Use `useQuery` for data fetching. It provides `data`, `isLoading`, `error`, and automatic caching/refetching.

```jsx
const { data, isLoading, error } = useQuery({
  queryKey: ['sequences'],
  queryFn: () => fetchSequences(),
});
```

## What NOT to do

❌ Manual loading/error state:
```jsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');

async function handleSubmit() {
  setLoading(true);
  try {
    await apiCall();
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}
```

✅ Use `useMutation` instead (see above).

## Exception

Client-side validation errors (e.g. "passwords do not match") that never reach the server are fine as local `useState` since they are not related to async state.
