# Standalone OpenCloning App

This app demonstrates how to use OpenCloning with the `StandAloneOpenCloning` function, which eliminates the need to manually set up React providers, Redux store, or ConfigProvider.

## Usage

```bash
# Install dependencies (from project root)
yarn install

# Run the standalone app
yarn workspace standalone-app dev
```

The app will be available at `http://localhost:3001`

## What This Demonstrates

This app shows the simplest way to integrate OpenCloning into your application:

```javascript
import { StandAloneOpenCloning } from '@opencloning/ui/standalone';
import '@opencloning/ui';

const container = document.getElementById('root');
const cleanup = StandAloneOpenCloning({
  config: { /* your config object */ },
  element: container
});
```

That's it! No need to:
- Set up Redux Provider
- Set up ConfigProvider  
- Import and configure the store
- Wrap components in providers

### Interactive Demo

The app includes a button in the top-right corner that demonstrates how to use the `cleanup` function to unmount and remount the component. Click the button to see OpenCloning unmount and mount dynamically!

## Comparison

Compare `src/main.js` in this app with `apps/test-app/src/main.jsx` to see the difference:

- **test-app**: Requires manual setup of all providers (29 lines)
- **standalone-app**: Just one function call (much simpler!)

## Documentation

For more details, see `packages/ui/STANDALONE.md`
