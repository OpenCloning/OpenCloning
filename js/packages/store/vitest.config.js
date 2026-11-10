import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { testConfig } from '../../vitest.common.config';

export default defineConfig({
  test: {
    ...testConfig,
  },
});
