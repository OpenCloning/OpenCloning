import { defineConfig } from 'vitest/config';
import { testConfig } from '../../vitest.common.config.js';

export default defineConfig({
  test: {
    ...testConfig,
  },
});
