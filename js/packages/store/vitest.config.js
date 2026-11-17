import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { testConfig } from '../../vitest.common.config.js';

export default defineConfig({
  test: {
    ...testConfig,
  },
});
