# @opencloning/opencloning-elabftw

eLabFTW database adapter for OpenCloning. This package provides the interface and UI components that let OpenCloning read from and write to an [eLabFTW](https://www.elabftw.net/) instance (database, items, experiments).

## Features

- **eLabFTWInterface**: Implements the OpenCloning database interface for eLabFTW, handling sequences, primers, and file uploads via the eLabFTW API.
- **UI components**: ELabFTW-specific components like `ELabFTWFileSelect`, `GetSequenceFileAndDatabaseIdComponent`, `PrimersNotInDatabaseComponent`, `SubmitToDatabaseComponent`.

## Environment variables

Used for development, to run along with a local eLabFTW instance running in docker. It uses api keys, which you normally you don't need when running OpenCloning embedded in eLabFTW.

| Variable                     | Description                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `VITE_ELABFTW_BASE_URL`      | eLabFTW API base URL (e.g. `https://localhost:443` or `http://127.0.0.1` for a local instance) |
| `VITE_ELABFTW_API_READ_KEY`  | Read API key from eLabFTW                                                                      |
| `VITE_ELABFTW_API_WRITE_KEY` | Write API key from eLabFTW                                                                     |

## Running locally against a local eLabFTW instance

1. **Set up a local eLabFTW instance** (Docker, VM, or local install).

2. **Configure environment variables** in `apps/opencloning/.env.local` or via your shell:

   ```bash
   export VITE_ELABFTW_BASE_URL=https://localhost:443   # or your local eLabFTW URL
   export VITE_ELABFTW_API_READ_KEY=your-read-api-key
   export VITE_ELABFTW_API_WRITE_KEY=your-write-api-key
   ```

   When `VITE_ELABFTW_API_READ_KEY` is set in development, the app uses `config.elabftw.json`, which sets `database: "elabftw"`.

3. **Start the OpenCloning app** from the repo root:

   ```bash
   yarn start
   # or: yarn workspace opencloning start
   ```

4. **API keys**: In eLabFTW, go to **My account → API keys** to create read and write keys.

## License

MIT
