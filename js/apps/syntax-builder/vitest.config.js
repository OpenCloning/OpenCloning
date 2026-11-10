import { defineConfig } from 'vitest/config';
import { testConfig } from '../../vitest.common.config';

export default defineConfig({
  test: {
    ...testConfig,
  },
});

