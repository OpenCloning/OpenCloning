---
name: url-path-encoding
description: Prevent client-side path traversal (CSPT) when building request URLs. Use when adding or editing code that interpolates values into a URL path (template literals or string concatenation passed to axios/fetch/httpClient, endpoint helpers like endpoints.js), when touching the opencloningdb or eLabFTW interfaces, and when reviewing or scanning code for security issues.
---

# URL path encoding (client-side path traversal)

## The concern

If a value is put into a request path unencoded, it can change which endpoint is called. The browser
resolves `..` segments before sending the request, and the request still carries the user's
credentials (bearer token, eLabFTW API key, cookies).

Example: a teammate creates a sample UID `../workspaces/1/users/5`. When a workspace owner clicks
"delete UID", the client sends `DELETE /sequence_samples/../workspaces/1/users/5`, which the browser
turns into `DELETE /workspaces/1/users/5`: the owner unknowingly removes a member.

Values to treat as untrusted: anything typed by users (UIDs, names), anything from other users via
the API, `database_id`/ids read from loaded cloning-strategy files, and URL query params of a link.

## The rule

Every value interpolated into a URL **path** goes through `encodePathSegment` from
`@opencloning/utils/urlUtils`. It applies `encodeURIComponent` (so `/`, `?`, `#` cannot change
the path) and throws on `.` / `..` (which `encodeURIComponent` leaves unchanged).

✅ Correct:

```js
import { encodePathSegment } from '@opencloning/utils/urlUtils';

sequenceSample: (uid) => `/sequence_samples/${encodePathSegment(uid)}`,
const url = `/api/v2/items/${encodePathSegment(itemId)}/uploads/${encodePathSegment(fileId)}`;
```

❌ Wrong:

```js
sequenceSample: (uid) => `/sequence_samples/${uid}`,
const url = '/api/v2/items/' + itemId;
```

- Query string values: pass them as axios `params` (encoded by axios), not interpolated into the url.
- In `packages/opencloningdb`, add new routes to `src/endpoints.js` (it imports `encodePathSegment as e`)
  instead of building paths at call sites.
- Not needed for internal constants (e.g. `primer_design/${endpoint}` with a hard-coded endpoint name),
  but encoding them is harmless.

## Scanning for it

When planning, creating new code, making changes, or reviewing changes or auditing, search for interpolated or concatenated paths and check each hit:

```bash
grep -rnE '`[^`]*/\$\{' apps packages --include='*.js' --include='*.jsx' | grep -v 'node_modules\|/build/\|\.cy\.\|\.test\.'
grep -rnE "['\"]/[A-Za-z_/-]*['\"]\s*\+" apps packages --include='*.js' --include='*.jsx' | grep -v 'node_modules\|/build/'
```

A hit needs fixing when the request carries credentials (opencloningdb client, eLabFTW client, the
cloning backend client) **and** the value is not a hard-coded constant. Third-party requests without
credentials (NCBI, Crossref, ORCID) and `href`/navigation links are lower risk, but encoding is
still correct there.

Defense in depth on the backend: validate identifiers (UIDs, ids) against an expected format.
